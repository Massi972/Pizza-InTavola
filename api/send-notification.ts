import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  // Inizializza tutto dentro l'handler
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
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

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        results.sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          results.removed++;
        } else {
          console.error('Errore push:', err.statusCode, err.message);
          results.failed++;
        }
      }
    })
  );

  return res.status(200).json({ success: true, ...results });
}
