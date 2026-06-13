import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Variabili ambiente mancanti:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
    return res.status(500).json({ error: 'Configurazione server mancante' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'POST') {
    const { userId, subscription } = req.body || {};
    if (!userId || !subscription?.endpoint) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
    }, { onConflict: 'endpoint' });

    if (error) {
      console.error('Errore Supabase:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Endpoint mancante' });
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Metodo non consentito' });
}
