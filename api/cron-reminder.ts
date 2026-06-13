import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel invoca il cron con l'header Authorization automaticamente
  // ma aggiungiamo anche il controllo del metodo
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // Controlla che sia martedì (2) o giovedì (4) — ora italiana (UTC+2)
  const now = new Date();
  const italyOffset = 2 * 60; // UTC+2 (CEST)
  const italyTime = new Date(now.getTime() + italyOffset * 60 * 1000);
  const dayOfWeek = italyTime.getUTCDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio

  if (dayOfWeek !== 2 && dayOfWeek !== 4) {
    console.log(`Cron eseguito ma oggi non è martedì/giovedì (giorno: ${dayOfWeek}). Skip.`);
    return res.status(200).json({ skipped: true, day: dayOfWeek });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://pizza-in-tavola.vercel.app'; // fallback con il tuo dominio

  try {
    const response = await fetch(`${baseUrl}/api/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        title: '🍕 Ordina la pizza!',
        body: 'Ricordati di ordinare la tua pizza per oggi. Apri l\'app e fai il tuo ordine!',
        url: '/',
      }),
    });

    const result = await response.json();
    console.log('Reminder inviato:', result);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('Errore cron reminder:', err);
    return res.status(500).json({ error: err.message });
  }
}
