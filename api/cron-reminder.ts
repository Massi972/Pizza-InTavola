import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // Ora italiana (UTC+2 CEST / UTC+1 CET)
  const now = new Date();
  const italyOffset = 2 * 60;
  const italyTime = new Date(now.getTime() + italyOffset * 60 * 1000);
  const dayOfWeek = italyTime.getUTCDay();   // 0=Dom ... 6=Sab
  const currentHour = italyTime.getUTCHours();
  const currentMinute = italyTime.getUTCMinutes();

  console.log(`Cron eseguito: giorno=${dayOfWeek}, ora=${currentHour}:${String(currentMinute).padStart(2,'0')}`);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  // Legge messaggi schedulati attivi per questo giorno e ora
  const { data: messages, error } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('active', true)
    .eq('hour', currentHour)
    .lte('minute', currentMinute + 4)  // tolleranza 5 minuti per il cron
    .gte('minute', Math.max(0, currentMinute - 4));

  if (error) {
    console.error('Errore lettura scheduled_notifications:', error);
    return res.status(500).json({ error: error.message });
  }

  // Filtra per giorno della settimana (days_of_week è un array)
  const toSend = (messages || []).filter(m =>
    Array.isArray(m.days_of_week) && m.days_of_week.includes(dayOfWeek)
  );

  if (toSend.length === 0) {
    console.log('Nessun messaggio da inviare per questo giorno/ora.');
    return res.status(200).json({ skipped: true, day: dayOfWeek, hour: currentHour, minute: currentMinute });
  }

  const results: any[] = [];

  for (const msg of toSend) {
    // Recupera subscription per target
    let query = supabase.from('push_subscriptions').select('*');
    if (msg.target && msg.target !== 'all') {
      query = query.eq('user_id', msg.target);
    }
    const { data: subscriptions } = await query;
    if (!subscriptions || subscriptions.length === 0) {
      results.push({ id: msg.id, title: msg.title, sent: 0, message: 'Nessuna subscription' });
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

    results.push({ id: msg.id, title: msg.title, sent, failed, removed });
  }

  console.log('Risultati cron:', results);
  return res.status(200).json({ success: true, processed: results.length, results });
}
