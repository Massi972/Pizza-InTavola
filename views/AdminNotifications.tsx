import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button, Card, Input } from '../components/UI';
import { Plus, Trash2, Bell, Check, AlertCircle, RefreshCw, UsersIcon } from '../components/Icons';
import { supabase, db } from '../services/db';
import { User } from '../types';

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
  user: User;
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

const AdminNotifications: React.FC<AdminNotificationsProps> = ({ user, onBack }) => {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'single'>('all');
  const [broadcastUserId, setBroadcastUserId] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: notifData }, userList] = await Promise.all([
      supabase.from('scheduled_notifications').select('*').order('created_at', { ascending: false }),
      db.getUsers(),
    ]);
    if (notifData) setNotifications(notifData);
    setUsers(userList.filter(u => u.active));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
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
    if (error) { showToast('Errore nel salvataggio', false); return; }
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    showToast('Messaggio schedulato salvato!');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('scheduled_notifications').delete().eq('id', id);
    if (error) { showToast('Errore eliminazione', false); return; }
    showToast('Eliminato');
    fetchData();
  };

  const handleToggleActive = async (n: ScheduledNotification) => {
    const { error } = await supabase.from('scheduled_notifications').update({ active: !n.active }).eq('id', n.id);
    if (!error) fetchData();
  };

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

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast('Inserisci titolo e testo', false);
      return;
    }
    if (broadcastTarget === 'single' && !broadcastUserId) {
      showToast('Seleziona un dipendente', false);
      return;
    }
    setSendingAll(true);
    try {
      const body: any = {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        url: '/',
      };
      if (broadcastTarget === 'single') body.targetUserId = broadcastUserId;

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (broadcastTarget === 'single') {
        const userName = users.find(u => u.id === broadcastUserId);
        showToast(`Inviato a ${userName?.firstName} ${userName?.lastName} (${result.sent ?? 0} dispositivi)`);
      } else {
        showToast(`Inviato a ${result.sent ?? 0} dispositivi!`);
      }
      setBroadcastTitle('');
      setBroadcastBody('');
      setBroadcastTarget('all');
      setBroadcastUserId('');
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

        {/* BROADCAST IMMEDIATO */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-[#1c1c1e]">📢 Invia subito</p>
              <p className="text-xs text-[#8E8E93] mt-0.5">Messaggio immediato a tutti o a un singolo</p>
            </div>
            <Button size="sm" variant={showBroadcast ? 'secondary' : 'primary'} onClick={() => setShowBroadcast(!showBroadcast)}>
              {showBroadcast ? 'Chiudi' : 'Scrivi'}
            </Button>
          </div>

          {showBroadcast && (
            <div className="space-y-3 pt-3 border-t border-[#F2F2F7]">

              {/* Destinatario */}
              <div>
                <p className="text-xs text-[#8E8E93] mb-2 font-medium">Destinatario</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setBroadcastTarget('all'); setBroadcastUserId(''); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${broadcastTarget === 'all' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                  >
                    <UsersIcon size={14} /> Tutti
                  </button>
                  <button
                    onClick={() => setBroadcastTarget('single')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${broadcastTarget === 'single' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                  >
                    👤 Singolo
                  </button>
                </div>
              </div>

              {/* Selezione dipendente */}
              {broadcastTarget === 'single' && (
                <select
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                  value={broadcastUserId}
                  onChange={(e) => setBroadcastUserId(e.target.value)}
                >
                  <option value="">— Seleziona dipendente —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              )}

              <Input
                placeholder="Titolo (es. 🍕 Ordina la pizza!)"
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
                🚀 {broadcastTarget === 'single' ? 'Invia al dipendente' : 'Invia a tutti'}
              </Button>
            </div>
          )}
        </Card>

        {/* MESSAGGI SCHEDULATI */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[#1c1c1e]">⏰ Messaggi schedulati</p>
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
            <Plus size={14} />
            {showForm ? 'Annulla' : 'Nuovo'}
          </Button>
        </div>

        {/* FORM NUOVO */}
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
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Giorni di invio</p>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${form.days_of_week.includes(d.value) ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Orario di invio</p>
              <div className="flex gap-3">
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
              <Check size={16} /> Salva messaggio
            </Button>
          </Card>
        )}

        {/* LISTA */}
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
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                        📅 {formatDays(n.days_of_week)}
                      </span>
                      <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                        🕐 {formatTime(n.hour, n.minute)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleActive(n)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${n.active ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}
                  >
                    {n.active ? 'Attivo' : 'Inattivo'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#F2F2F7]">
                  <Button size="sm" variant="secondary" loading={sending === n.id} onClick={() => handleSendNow(n)} className="flex-1">
                    🚀 Invia ora
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(n.id)} className="px-3">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-4 bg-[#F2F2F7]">
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            ℹ️ Il cron automatico gira ogni martedì e giovedì alle 9:00 e invia il primo messaggio schedulato attivo a tutti i dipendenti.
          </p>
        </Card>

      </div>
    </Layout>
  );
};

export default AdminNotifications;
