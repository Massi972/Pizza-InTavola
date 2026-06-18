import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Calcola il prossimo timestamp UTC per un messaggio ricorrente
function nextOccurrenceUTC(days: number[], hour: number, minute: number): string {
  const now = new Date();
  // Converti ora corrente in ora italiana
  const italyNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(italyNow);
    candidate.setDate(italyNow.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);

    if (days.includes(candidate.getDay()) && candidate > italyNow) {
      // Converti da ora italiana a UTC
      const utcString = candidate.toLocaleString('en-US', { timeZone: 'Europe/Rome' });
      const utcDate = new Date(utcString);
      const diff = candidate.getTime() - utcDate.getTime();
      return new Date(candidate.getTime() + diff).toISOString();
    }
  }
  // Fallback: 7 giorni da adesso
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

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

  const now = new Date().toISOString();

  // Trova messaggi da inviare: scheduled_at <= adesso, sent = false
  const { data: messages, error } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('sent', false)
    .lte('scheduled_at', now);

  if (error) {
    console.error('Errore lettura:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!messages || messages.length === 0) {
    return res.status(200).json({ skipped: true });
  }

  const results: any[] = [];

  for (const msg of messages) {
    // Recupera subscriptions
    let query = supabase.from('push_subscriptions').select('*');
    if (msg.target && msg.target !== 'all') {
      query = query.eq('user_id', msg.target);
    }
    const { data: subscriptions } = await query;

    let sent = 0, failed = 0, removed = 0;

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({ title: msg.title, body: msg.body, url: '/' });

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
            failed++;
          }
        }
      }));
    }

    // Ricorrente: riprogramma alla prossima occorrenza
    // Una volta: marca come sent
    if (msg.recurring && Array.isArray(msg.recurring_days) && msg.recurring_days.length > 0) {
      const next = nextOccurrenceUTC(msg.recurring_days, msg.recurring_hour ?? 9, msg.recurring_minute ?? 0);
      await supabase
        .from('scheduled_notifications')
        .update({ sent: false, scheduled_at: next })
        .eq('id', msg.id);
      results.push({ id: msg.id, title: msg.title, sent, failed, removed, next_scheduled: next });
    } else {
      await supabase
        .from('scheduled_notifications')
        .update({ sent: true })
        .eq('id', msg.id);
      results.push({ id: msg.id, title: msg.title, sent, failed, removed });
    }
  }

  return res.status(200).json({ success: true, processed: results.length, results });
}
