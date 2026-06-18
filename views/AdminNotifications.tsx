import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button, Card, Input } from '../components/UI';
import { Plus, Trash2, Bell, Check, AlertCircle, RefreshCw } from '../components/Icons';
import { supabase } from '../services/db';
import { User } from '../types';
import { db } from '../services/db';

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduled_at: string;
  target: string;
  sent: boolean;
  recurring: boolean;
  recurring_days: number[];
  recurring_hour: number;
  recurring_minute: number;
  created_at: string;
}

interface AdminNotificationsProps {
  user: User;
  onBack: () => void;
}

const DAYS = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
];

const EMPTY_FORM = {
  title: '',
  body: '',
  type: 'once' as 'once' | 'recurring',
  date: '',
  time: '',
  recurringDays: [] as number[],
  recurringHour: 9,
  recurringMinute: 0,
  target: 'all',
  targetUserId: '',
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
      supabase.from('scheduled_notifications').select('*').order('scheduled_at', { ascending: true }),
      db.getUsers(),
    ]);
    if (notifData) setNotifications(notifData);
    setUsers(userList.filter(u => u.active));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Calcola il prossimo scheduled_at per un messaggio ricorrente
  const nextOccurrence = (days: number[], hour: number, minute: number): string => {
    const now = new Date();
    // Ora italiana
    const italy = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    
    for (let offset = 0; offset <= 7; offset++) {
      const candidate = new Date(italy);
      candidate.setDate(italy.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);
      
      if (days.includes(candidate.getDay()) && candidate > italy) {
        // Converti da ora italiana a UTC
        const utcCandidate = new Date(candidate.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
        const diff = candidate.getTime() - utcCandidate.getTime();
        return new Date(candidate.getTime() + diff).toISOString();
      }
    }
    return new Date().toISOString();
  };

  const toUtcIso = (date: string, time: string): string => {
    return new Date(`${date}T${time}:00`).toISOString();
  };

  const formatDateTime = (isoUtc: string): string => {
    return new Date(isoUtc).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Rome',
    });
  };

  const isPast = (isoUtc: string): boolean => new Date(isoUtc) < new Date();

  const formatRecurringDays = (days: number[]) =>
    [...days].sort((a, b) => {
      const order = [1,2,3,4,5,6,0];
      return order.indexOf(a) - order.indexOf(b);
    }).map(d => DAYS.find(x => x.value === d)?.label).join(', ');

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('Inserisci titolo e testo', false); return;
    }
    if (form.target === 'single' && !form.targetUserId) {
      showToast('Seleziona un dipendente', false); return;
    }

    if (form.type === 'once') {
      if (!form.date || !form.time) {
        showToast('Scegli data e ora', false); return;
      }
      const scheduled_at = toUtcIso(form.date, form.time);
      if (new Date(scheduled_at) < new Date()) {
        showToast('La data/ora deve essere nel futuro', false); return;
      }
      setSaving(true);
      const { error } = await supabase.from('scheduled_notifications').insert([{
        title: form.title.trim(),
        body: form.body.trim(),
        scheduled_at,
        target: form.target === 'single' ? form.targetUserId : 'all',
        sent: false,
        recurring: false,
        recurring_days: [],
        recurring_hour: 0,
        recurring_minute: 0,
      }]);
      setSaving(false);
      if (error) { showToast('Errore nel salvataggio', false); return; }
    } else {
      if (form.recurringDays.length === 0) {
        showToast('Seleziona almeno un giorno', false); return;
      }
      const scheduled_at = nextOccurrence(form.recurringDays, form.recurringHour, form.recurringMinute);
      setSaving(true);
      const { error } = await supabase.from('scheduled_notifications').insert([{
        title: form.title.trim(),
        body: form.body.trim(),
        scheduled_at,
        target: form.target === 'single' ? form.targetUserId : 'all',
        sent: false,
        recurring: true,
        recurring_days: form.recurringDays,
        recurring_hour: form.recurringHour,
        recurring_minute: form.recurringMinute,
      }]);
      setSaving(false);
      if (error) { showToast('Errore nel salvataggio', false); return; }
    }

    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    showToast('Messaggio salvato!');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('scheduled_notifications').delete().eq('id', id);
    if (error) { showToast('Errore eliminazione', false); return; }
    showToast('Eliminato');
    fetchData();
  };

  const handleSendNow = async (n: ScheduledNotification) => {
    setSending(n.id);
    try {
      const body: any = { title: n.title, body: n.body, url: '/' };
      if (n.target && n.target !== 'all') body.targetUserId = n.target;
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (n.recurring) {
        // Riprogramma alla prossima occorrenza
        const next = nextOccurrence(n.recurring_days, n.recurring_hour, n.recurring_minute);
        await supabase.from('scheduled_notifications').update({ sent: false, scheduled_at: next }).eq('id', n.id);
        showToast(`Inviato! Prossimo invio: ${formatDateTime(next)}`);
      } else {
        await supabase.from('scheduled_notifications').update({ sent: true }).eq('id', n.id);
        showToast(`Inviato a ${result.sent ?? 0} dispositivi!`);
      }
      fetchData();
    } catch {
      showToast('Errore invio', false);
    }
    setSending(null);
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      showToast('Inserisci titolo e testo', false); return;
    }
    if (broadcastTarget === 'single' && !broadcastUserId) {
      showToast('Seleziona un dipendente', false); return;
    }
    setSendingAll(true);
    try {
      const body: any = { title: broadcastTitle.trim(), body: broadcastBody.trim(), url: '/' };
      if (broadcastTarget === 'single') body.targetUserId = broadcastUserId;
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (broadcastTarget === 'single') {
        const u = users.find(u => u.id === broadcastUserId);
        showToast(`Inviato a ${u?.firstName} ${u?.lastName} (${result.sent ?? 0} dispositivi)`);
      } else {
        showToast(`Inviato a ${result.sent ?? 0} dispositivi!`);
      }
      setBroadcastTitle(''); setBroadcastBody('');
      setBroadcastTarget('all'); setBroadcastUserId('');
      setShowBroadcast(false);
    } catch {
      showToast('Errore invio', false);
    }
    setSendingAll(false);
  };

  const getUserName = (target: string) => {
    if (target === 'all') return '👥 Tutti';
    const u = users.find(u => u.id === target);
    return u ? `👤 ${u.firstName} ${u.lastName}` : '👤 Singolo';
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const pending = notifications.filter(n => !n.sent && !isPast(n.scheduled_at));
  const recurring = notifications.filter(n => n.recurring && !n.sent);
  const pastOrSent = notifications.filter(n => !n.recurring && (n.sent || isPast(n.scheduled_at)));

  return (
    <Layout title="Notifiche Push" onBack={onBack}>
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
              <p className="text-xs text-[#8E8E93] mt-0.5">Notifica immediata a tutti o a un singolo</p>
            </div>
            <Button size="sm" variant={showBroadcast ? 'secondary' : 'primary'} onClick={() => setShowBroadcast(!showBroadcast)}>
              {showBroadcast ? 'Chiudi' : 'Scrivi'}
            </Button>
          </div>
          {showBroadcast && (
            <div className="space-y-3 pt-3 border-t border-[#F2F2F7]">
              <div>
                <p className="text-xs text-[#8E8E93] mb-2 font-medium">Destinatario</p>
                <div className="flex gap-2">
                  <button onClick={() => { setBroadcastTarget('all'); setBroadcastUserId(''); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${broadcastTarget === 'all' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                    👥 Tutti
                  </button>
                  <button onClick={() => setBroadcastTarget('single')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${broadcastTarget === 'single' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                    👤 Singolo
                  </button>
                </div>
              </div>
              {broadcastTarget === 'single' && (
                <select className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                  value={broadcastUserId} onChange={(e) => setBroadcastUserId(e.target.value)}>
                  <option value="">— Seleziona dipendente —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              )}
              <Input placeholder="Titolo (es. 🍕 Ordina la pizza!)" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} />
              <textarea className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all text-sm resize-none"
                rows={3} placeholder="Testo del messaggio..." value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} />
              <Button fullWidth loading={sendingAll} onClick={handleBroadcast}>
                🚀 {broadcastTarget === 'single' ? 'Invia al dipendente' : 'Invia a tutti'}
              </Button>
            </div>
          )}
        </Card>

        {/* NUOVO MESSAGGIO */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[#1c1c1e]">⏰ Messaggi programmati</p>
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
            <Plus size={14} />
            {showForm ? 'Annulla' : 'Nuovo'}
          </Button>
        </div>

        {showForm && (
          <Card className="p-4 space-y-4">
            <p className="font-medium text-[#1c1c1e] text-sm">Nuovo messaggio programmato</p>

            {/* Tipo: una volta / ricorrente */}
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Tipo</p>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, type: 'once' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.type === 'once' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                  📅 Una volta
                </button>
                <button onClick={() => setForm({ ...form, type: 'recurring' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.type === 'recurring' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                  🔁 Ricorrente
                </button>
              </div>
            </div>

            {/* Una volta: data + ora */}
            {form.type === 'once' && (
              <div>
                <p className="text-xs text-[#8E8E93] mb-2 font-medium">Quando inviarlo</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-[#8E8E93]">Data</label>
                    <input type="date" min={todayStr}
                      className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                      value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-[#8E8E93]">Ora</label>
                    <input type="time"
                      className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                      value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {/* Ricorrente: giorni + ora */}
            {form.type === 'recurring' && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#8E8E93] mb-2 font-medium">Giorni della settimana</p>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map(d => (
                      <button key={d.value}
                        onClick={() => setForm(f => ({
                          ...f,
                          recurringDays: f.recurringDays.includes(d.value)
                            ? f.recurringDays.filter(x => x !== d.value)
                            : [...f.recurringDays, d.value]
                        }))}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${form.recurringDays.includes(d.value) ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8E8E93] mb-2 font-medium">Ora di invio</p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-[#8E8E93]">Ora</label>
                      <select className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                        value={form.recurringHour} onChange={(e) => setForm({ ...form, recurringHour: Number(e.target.value) })}>
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-[#8E8E93]">Minuti</label>
                      <select className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                        value={form.recurringMinute} onChange={(e) => setForm({ ...form, recurringMinute: Number(e.target.value) })}>
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Destinatario */}
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Destinatario</p>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, target: 'all', targetUserId: '' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.target === 'all' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                  👥 Tutti
                </button>
                <button onClick={() => setForm({ ...form, target: 'single' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.target === 'single' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}>
                  👤 Singolo
                </button>
              </div>
              {form.target === 'single' && (
                <select className="w-full mt-2 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                  value={form.targetUserId} onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}>
                  <option value="">— Seleziona dipendente —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              )}
            </div>

            {/* Titolo e testo */}
            <Input placeholder="Titolo (es. 🍕 Ordina la pizza!)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all text-sm resize-none"
              rows={3} placeholder="Testo del messaggio..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />

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
        ) : (
          <>
            {/* Ricorrenti */}
            {recurring.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wide px-1">🔁 Ricorrenti</p>
                {recurring.map(n => (
                  <Card key={n.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1c1c1e] text-sm truncate">{n.title}</p>
                        <p className="text-xs text-[#8E8E93] mt-0.5 line-clamp-2">{n.body}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                            📅 {formatRecurringDays(n.recurring_days)} alle {String(n.recurring_hour).padStart(2,'0')}:{String(n.recurring_minute).padStart(2,'0')}
                          </span>
                          <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                            {getUserName(n.target)}
                          </span>
                        </div>
                        <p className="text-xs text-[#8E8E93] mt-1">Prossimo: {formatDateTime(n.scheduled_at)}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#007AFF]/10 text-[#007AFF] shrink-0">Attivo</span>
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

            {/* Una volta in attesa */}
            {pending.filter(n => !n.recurring).length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wide px-1">In attesa</p>
                {pending.filter(n => !n.recurring).map(n => (
                  <Card key={n.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1c1c1e] text-sm truncate">{n.title}</p>
                        <p className="text-xs text-[#8E8E93] mt-0.5 line-clamp-2">{n.body}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                            📅 {formatDateTime(n.scheduled_at)}
                          </span>
                          <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                            {getUserName(n.target)}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#FF9F0A]/10 text-[#FF9F0A] shrink-0">In attesa</span>
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

            {/* Inviati/scaduti */}
            {pastOrSent.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wide px-1">Inviati / Scaduti</p>
                {pastOrSent.map(n => (
                  <Card key={n.id} className="p-4 opacity-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1c1c1e] text-sm truncate">{n.title}</p>
                        <p className="text-xs text-[#8E8E93] mt-0.5 line-clamp-1">{n.body}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                            📅 {formatDateTime(n.scheduled_at)}
                          </span>
                          <span className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-lg font-medium">
                            {getUserName(n.target)}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold shrink-0 ${n.sent ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                        {n.sent ? 'Inviato' : 'Scaduto'}
                      </span>
                    </div>
                    <div className="flex justify-end mt-3 pt-3 border-t border-[#F2F2F7]">
                      <Button size="sm" variant="danger" onClick={() => handleDelete(n.id)} className="px-3">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {recurring.length === 0 && pending.length === 0 && pastOrSent.length === 0 && (
              <Card className="p-8 text-center">
                <Bell size={32} className="mx-auto text-[#C6C6C8] mb-3" />
                <p className="text-[#8E8E93] text-sm">Nessun messaggio programmato</p>
                <p className="text-[#C6C6C8] text-xs mt-1">Creane uno con il pulsante "Nuovo"</p>
              </Card>
            )}
          </>
        )}

        <Card className="p-4 bg-[#F2F2F7]">
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            ℹ️ I messaggi ricorrenti si ripetono automaticamente ogni settimana. Quelli "una volta" vengono inviati alla data scelta e poi archiviati.
          </p>
        </Card>

      </div>
    </Layout>
  );
};

export default AdminNotifications;
