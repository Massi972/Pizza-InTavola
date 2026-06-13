import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Firma VAPID manuale usando Web Crypto (nativo Node 20, no dipendenze esterne)
async function signVapid(audience: string): Promise<string> {
  const subject = process.env.VAPID_SUBJECT!;
  const privateKeyB64 = process.env.VAPID_PRIVATE_KEY!;
  const publicKeyB64 = process.env.VITE_VAPID_PUBLIC_KEY!;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600;

  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aud: audience, exp, sub: subject })).toString('base64url');
  const unsigned = `${header}.${payload}`;

  // Importa la chiave privata VAPID (formato base64url → raw)
  const rawKey = Buffer.from(privateKeyB64, 'base64url');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    Buffer.from(unsigned)
  );

  const sigB64 = Buffer.from(sig).toString('base64url');
  const jwt = `${unsigned}.${sigB64}`;

  return `vapid t=${jwt}, k=${publicKeyB64}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { title, body, url, targetUserId } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Titolo e testo obbligatori' });

  let query = supabase.from('push_subscriptions').select('*');
  if (targetUserId) query = query.eq('user_id', targetUserId);

  const { data: subscriptions, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({ success: true, sent: 0, message: 'Nessuna subscription trovata' });
  }

  const payload = JSON.stringify({ title, body, url: url || '/' });
  const results = { sent: 0, failed: 0, removed: 0 };

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      // Estrai l'audience dall'endpoint (es. https://fcm.googleapis.com)
      const endpointUrl = new URL(sub.endpoint);
      const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
      const authHeader = await signVapid(audience);

      // Cifra il payload con le chiavi del browser
      const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);

      const pushRes = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
        },
        body: encrypted,
      });

      if (pushRes.status === 201 || pushRes.status === 200) {
        results.sent++;
      } else if (pushRes.status === 410 || pushRes.status === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        results.removed++;
      } else {
        console.error('Push failed:', pushRes.status, await pushRes.text());
        results.failed++;
      }
    } catch (err: any) {
      console.error('Errore push:', err.message);
      results.failed++;
    }
  }));

  return res.status(200).json({ success: true, ...results });
}

// Cifratura AES-128-GCM per Web Push (RFC 8291)
async function encryptPayload(payload: string, p256dhB64: string, authB64: string): Promise<Buffer> {
  const p256dh = Buffer.from(p256dhB64, 'base64url');
  const auth = Buffer.from(authB64, 'base64url');
  const plaintext = Buffer.from(payload, 'utf8');

  // Genera una coppia di chiavi effimere
  const ephemeralKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const ephemeralPublicKey = await crypto.subtle.exportKey('raw', ephemeralKeys.publicKey);

  // Importa la chiave pubblica del browser
  const browserPublicKey = await crypto.subtle.importKey(
    'raw', p256dh,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // Deriva il segreto condiviso
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: browserPublicKey },
    ephemeralKeys.privateKey,
    256
  );

  // HKDF per ricavare le chiavi
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await hkdf(auth, Buffer.from(sharedSecret), Buffer.concat([
    Buffer.from('WebPush: info\0'),
    p256dh,
    Buffer.from(ephemeralPublicKey),
  ]), 32);

  const cek = await hkdf(salt, prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, Buffer.from('Content-Encoding: nonce\0'), 12);

  // Cifra
  const cryptoKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    cryptoKey,
    Buffer.concat([plaintext, Buffer.from([2])]) // padding delimiter
  );

  // Header aes128gcm (RFC 8188)
  const header = Buffer.alloc(21 + ephemeralPublicKey.byteLength);
  Buffer.from(salt).copy(header, 0);
  header.writeUInt32BE(4096, 16); // record size
  header.writeUInt8(ephemeralPublicKey.byteLength, 20);
  Buffer.from(ephemeralPublicKey).copy(header, 21);

  return Buffer.concat([header, Buffer.from(encrypted)]);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}
