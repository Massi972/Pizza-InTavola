// Servizio per la gestione delle notifiche push lato client

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Converte la VAPID public key da base64 a Uint8Array (richiesto dalla Web Push API)
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0))).buffer as ArrayBuffer;
}

// Registra il service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker non supportato da questo browser.');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('Service Worker registrato:', registration.scope);
    return registration;
  } catch (err) {
    console.error('Errore registrazione Service Worker:', err);
    return null;
  }
}

// Richiede il permesso e crea la subscription push
export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Controlla se già iscritto
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Aggiorna comunque il DB con la subscription corrente
      await saveSubscriptionToServer(userId, existing);
      return true;
    }

    // Richiedi permesso
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permesso notifiche negato.');
      return false;
    }

    // Crea nuova subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await saveSubscriptionToServer(userId, subscription);
    return true;
  } catch (err) {
    console.error('Errore subscription push:', err);
    return false;
  }
}

// Salva la subscription su Supabase tramite API Vercel
async function saveSubscriptionToServer(userId: string, subscription: PushSubscription): Promise<void> {
  await fetch('/api/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subscription }),
  });
}

// Rimuove la subscription (logout / disabilita notifiche)
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch('/api/subscription', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
  } catch (err) {
    console.error('Errore disiscrizione push:', err);
  }
}

// Controlla lo stato attuale delle notifiche
export function getNotificationStatus(): 'unsupported' | 'denied' | 'granted' | 'default' {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as 'denied' | 'granted' | 'default';
}
