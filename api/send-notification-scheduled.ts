import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  // Trova tutti i messaggi non ancora inviati con scheduled_at <= adesso
  const now = new Date().toISOString();
  const { data: messages, error } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('sent', false)
    .lte('scheduled_at', now);

  if (error) {
    console.error('Errore lettura scheduled_notifications:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!messages || messages.length === 0) {
    return res.status(200).json({ skipped: true, message: 'Nessun messaggio da inviare' });
  }

  const results: any[] = [];

  for (const msg of messages) {
    // Recupera le subscription giuste in base al target
    let query = supabase.from('push_subscriptions').select('*');
    if (msg.target && msg.target !== 'all') {
      query = query.eq('user_id', msg.target);
    }
    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) {
      // Nessuna subscription: marca comunque come inviato per non ritentare
      await supabase.from('scheduled_notifications').update({ sent: true }).eq('id', msg.id);
      results.push({ id: msg.id, title: msg.title, sent: 0, note: 'Nessuna subscription trovata' });
      continue;
    }

    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: '/' });
    let sent = 0, failed = 0, removed = 0;

    await Promise.all(subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          removed++;
        } else {
          console.error('Errore push:', err.statusCode, err.message);
          failed++;
        }
      }
    }));

    // Marca come inviato
    await supabase.from('scheduled_notifications').update({ sent: true }).eq('id', msg.id);
    results.push({ id: msg.id, title: msg.title, sent, failed, removed });
  }

  console.log('Scheduled notifications processed:', results);
  return res.status(200).json({ success: true, processed: results.length, results });
}
