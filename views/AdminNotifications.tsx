import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button, Card, Input } from '../components/UI';
import { Plus, Trash2, Bell, Check, AlertCircle, RefreshCw } from '../components/Icons';
import { supabase } from '../services/db';

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  days_of_week: number[];
  hour: number;
  minute: number;
  active: boolean;
  target: string;
  created_at: string;
}

interface AdminNotificationsProps {
  onBack: () => void;
}

const DAYS = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sab', value: 6 },
];

const EMPTY_FORM = {
  title: '',
  body: '',
  days_of_week: [] as number[],
  hour: 9,
  minute: 0,
  active: true,
  target: 'all',
};

const AdminNotifications: React.FC<AdminNotificationsProps> = ({ onBack }) => {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('Inserisci titolo e testo', false);
      return;
    }
    if (form.days_of_week.length === 0) {
      showToast('Seleziona almeno un giorno', false);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('scheduled_notifications').insert([{
      title: form.title.trim(),
      body: form.body.trim(),
      days_of_week: form.days_of_week,
      hour: form.hour,
      minute: form.minute,
      active: true,
      target: 'all',
    }]);
    setSaving(false);
    if (error) {
      showToast('Errore nel salvataggio', false);
      return;
    }
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    showToast('Messaggio schedulato salvato!');
    fetchNotifications();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('scheduled_notifications')
      .delete()
      .eq('id', id);
    if (error) {
      showToast('Errore eliminazione', false);
      return;
    }
    showToast('Eliminato');
    fetchNotifications();
  };

  const handleToggleActive = async (n: ScheduledNotification) => {
    const { error } = await supabase
      .from('scheduled_notifications')
      .update({ active: !n.active })
      .eq('id', n.id);
    if (!error) fetchNotifications();
  };

  // Invia subito una notifica specifica (test)
  const handleSendNow = async (n: ScheduledNotification) => {
    setSending(n.id);
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: n.title, body: n.body, url: '/' }),
      });
      const result = await res.json();
      showToast(`Inviato a ${result.sent ?? 0} dispositivi!`);
    } catch {
      showToast('Errore invio', false);
    }
    setSending(null);
  };

  // Invia subito a tutti (broadcast manuale)
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast('Inserisci titolo e testo', false);
      return;
    }
    setSendingAll(true);
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: broadcastTitle.trim(), body: broadcastBody.trim(), url: '/' }),
      });
      const result = await res.json();
      showToast(`Inviato a ${result.sent ?? 0} dispositivi!`);
      setBroadcastTitle('');
      setBroadcastBody('');
      setShowBroadcast(false);
    } catch {
      showToast('Errore invio', false);
    }
    setSendingAll(false);
  };

  const formatDays = (days: number[]) =>
    [...days].sort((a, b) => a - b).map((d) => DAYS.find((x) => x.value === d)?.label).join(', ');

  const formatTime = (hour: number, minute: number) =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <Layout title="Notifiche Push" onBack={onBack}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-white text-sm font-medium transition-all ${toast.ok ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`}>
          {toast.ok ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="space-y-4">

        {/* SEZIONE BROADCAST IMMEDIATO */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-[#1c1c1e]">📢 Invia ora a tutti</p>
              <p className="text-xs text-[#8E8E93] mt-0.5">Messaggio immediato a tutti gli utenti</p>
            </div>
            <Button size="sm" variant={showBroadcast ? 'secondary' : 'primary'} onClick={() => setShowBroadcast(!showBroadcast)}>
              {showBroadcast ? 'Chiudi' : 'Scrivi'}
            </Button>
          </div>

          {showBroadcast && (
            <div className="space-y-3 pt-3 border-t border-[#F2F2F7]">
              <Input
                placeholder="Titolo (es. Attenzione!)"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />
              <textarea
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all text-sm resize-none"
                rows={3}
                placeholder="Testo del messaggio..."
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
              />
              <Button fullWidth loading={sendingAll} onClick={handleBroadcast}>
                🚀 Invia a tutti ora
              </Button>
            </div>
          )}
        </Card>

        {/* SEZIONE MESSAGGI SCHEDULATI */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[#1c1c1e]">⏰ Messaggi schedulati</p>
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
            <Plus size={14} />
            {showForm ? 'Annulla' : 'Nuovo'}
          </Button>
        </div>

        {/* FORM NUOVO MESSAGGIO */}
        {showForm && (
          <Card className="p-4 space-y-4">
            <p className="font-medium text-[#1c1c1e] text-sm">Nuovo messaggio schedulato</p>

            <Input
              placeholder="Titolo (es. 🍕 Ordina la pizza!)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <textarea
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all text-sm resize-none"
              rows={3}
              placeholder="Testo del messaggio..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />

            {/* Selezione giorni */}
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Giorni di invio</p>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                      form.days_of_week.includes(d.value)
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-[#F2F2F7] text-[#3C3C43]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Orario */}
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Orario di invio</p>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <label className="text-xs text-[#8E8E93]">Ora</label>
                  <select
                    className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                    value={form.hour}
                    onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#8E8E93]">Minuti</label>
                  <select
                    className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                    value={form.minute}
                    onChange={(e) => setForm({ ...form, minute: Number(e.target.value) })}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Button fullWidth loading={saving} onClick={handleSave}>
              <Check size={16} />
              Salva messaggio
            </Button>
          </Card>
        )}

        {/* LISTA MESSAGGI SCHEDULATI */}
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw size={24} className="animate-spin text-[#8E8E93]" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell size={32} className="mx-auto text-[#C6C6C8] mb-3" />
            <p className="text-[#8E8E93] text-sm">Nessun messaggio schedulato</p>
            <p className="text-[#C6C6C8] text-xs mt-1">Creane uno con il pulsante "Nuovo"</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <Card key={n.id} className={`p-4 ${!n.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1c1c1e] text-sm truncate">{n.title}</p>
                    <p className="text-xs text-[#8E8E93] mt-0.5 line-clamp-2">{n.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                        📅 {formatDays(n.days_of_week)}
                      </span>
                      <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                        🕐 {formatTime(n.hour, n.minute)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {/* Toggle attivo/inattivo */}
                    <button
                      onClick={() => handleToggleActive(n)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                        n.active ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'
                      }`}
                    >
                      {n.active ? 'Attivo' : 'Inattivo'}
                    </button>
                  </div>
                </div>

                {/* Azioni */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#F2F2F7]">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={sending === n.id}
                    onClick={() => handleSendNow(n)}
                    className="flex-1"
                  >
                    🚀 Invia ora
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(n.id)}
                    className="px-3"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* INFO CRON */}
        <Card className="p-4 bg-[#F2F2F7]">
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            ℹ️ I messaggi schedulati vengono inviati automaticamente dal server ogni martedì e giovedì alle 9:00. Gli orari personalizzati qui sopra sono salvati per riferimento — per attivarli contatta lo sviluppatore.
          </p>
        </Card>

      </div>
    </Layout>
  );
};

export default AdminNotifications;
