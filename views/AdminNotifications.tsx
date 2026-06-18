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
  scheduled_at: string; // ISO timestamp UTC
  target: string;       // 'all' o user_id
  sent: boolean;
  created_at: string;
}

interface AdminNotificationsProps {
  user: User;
  onBack: () => void;
}

const EMPTY_FORM = {
  title: '',
  body: '',
  date: '',
  time: '',
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

  // Broadcast immediato
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
      supabase
        .from('scheduled_notifications')
        .select('*')
        .order('scheduled_at', { ascending: true }),
      db.getUsers(),
    ]);
    if (notifData) setNotifications(notifData);
    setUsers(userList.filter(u => u.active));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Converte data+ora locali in UTC ISO per salvare
  const toUtcIso = (date: string, time: string): string => {
    // date = 'YYYY-MM-DD', time = 'HH:MM' (ora italiana locale del browser)
    const localDate = new Date(`${date}T${time}:00`);
    return localDate.toISOString();
  };

  // Formatta timestamp UTC in data+ora italiana per display
  const formatDateTime = (isoUtc: string): string => {
    const d = new Date(isoUtc);
    return d.toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Rome',
    });
  };

  // Restituisce true se il messaggio è nel passato
  const isPast = (isoUtc: string): boolean => new Date(isoUtc) < new Date();

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('Inserisci titolo e testo', false); return;
    }
    if (!form.date || !form.time) {
      showToast('Scegli data e ora', false); return;
    }
    if (form.target === 'single' && !form.targetUserId) {
      showToast('Seleziona un dipendente', false); return;
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
    }]);
    setSaving(false);
    if (error) { showToast('Errore nel salvataggio', false); return; }
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    showToast('Messaggio programmato salvato!');
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
      // Marca come inviato
      await supabase.from('scheduled_notifications').update({ sent: true }).eq('id', n.id);
      showToast(`Inviato a ${result.sent ?? 0} dispositivi!`);
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

  // Minima data selezionabile: oggi
  const todayStr = new Date().toISOString().split('T')[0];

  const pending = notifications.filter(n => !n.sent && !isPast(n.scheduled_at));
  const pastOrSent = notifications.filter(n => n.sent || isPast(n.scheduled_at));

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
                  <button
                    onClick={() => { setBroadcastTarget('all'); setBroadcastUserId(''); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${broadcastTarget === 'all' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                  >
                    👥 Tutti
                  </button>
                  <button
                    onClick={() => setBroadcastTarget('single')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${broadcastTarget === 'single' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                  >
                    👤 Singolo
                  </button>
                </div>
              </div>
              {broadcastTarget === 'single' && (
                <select
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                  value={broadcastUserId}
                  onChange={(e) => setBroadcastUserId(e.target.value)}
                >
                  <option value="">— Seleziona dipendente —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              )}
              <Input placeholder="Titolo (es. 🍕 Ordina la pizza!)" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} />
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

        {/* MESSAGGI PROGRAMMATI */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[#1c1c1e]">⏰ Messaggi programmati</p>
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
            <Plus size={14} />
            {showForm ? 'Annulla' : 'Nuovo'}
          </Button>
        </div>

        {/* FORM NUOVO */}
        {showForm && (
          <Card className="p-4 space-y-4">
            <p className="font-medium text-[#1c1c1e] text-sm">Nuovo messaggio programmato</p>

            {/* Destinatario */}
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Destinatario</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setForm({ ...form, target: 'all', targetUserId: '' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.target === 'all' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                >
                  👥 Tutti
                </button>
                <button
                  onClick={() => setForm({ ...form, target: 'single' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.target === 'single' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#3C3C43]'}`}
                >
                  👤 Singolo
                </button>
              </div>
              {form.target === 'single' && (
                <select
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                  value={form.targetUserId}
                  onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}
                >
                  <option value="">— Seleziona dipendente —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Data e ora */}
            <div>
              <p className="text-xs text-[#8E8E93] mb-2 font-medium">Quando inviarlo</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#8E8E93]">Data</label>
                  <input
                    type="date"
                    min={todayStr}
                    className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#8E8E93]">Ora</label>
                  <input
                    type="time"
                    className="w-full mt-1 px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Titolo e testo */}
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

            <Button fullWidth loading={saving} onClick={handleSave}>
              <Check size={16} /> Salva messaggio
            </Button>
          </Card>
        )}

        {/* LISTA IN ATTESA */}
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw size={24} className="animate-spin text-[#8E8E93]" />
          </div>
        ) : pending.length === 0 && pastOrSent.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell size={32} className="mx-auto text-[#C6C6C8] mb-3" />
            <p className="text-[#8E8E93] text-sm">Nessun messaggio programmato</p>
            <p className="text-[#C6C6C8] text-xs mt-1">Creane uno con il pulsante "Nuovo"</p>
          </Card>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wide px-1">In attesa</p>
                {pending.map((n) => (
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
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-[#FF9F0A]/10 text-[#FF9F0A] shrink-0">
                        In attesa
                      </span>
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

            {pastOrSent.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wide px-1">Inviati / Scaduti</p>
                {pastOrSent.map((n) => (
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
          </>
        )}

        <Card className="p-4 bg-[#F2F2F7]">
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            ℹ️ I messaggi programmati vengono inviati automaticamente alla data e ora scelta tramite Supabase. Puoi anche inviarli subito con il pulsante "Invia ora".
          </p>
        </Card>

      </div>
    </Layout>
  );
};

export default AdminNotifications;
