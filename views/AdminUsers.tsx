
import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Plus, Edit2, Trash2, X, AlertCircle, Check, Copy, MessageCircle, RefreshCw } from '../components/Icons';

interface AdminUsersProps {
  onBack: () => void;
}

const AdminUsers: React.FC<AdminUsersProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [successUser, setSuccessUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await db.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Errore fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const getPINMessage = (user: User) => {
    return `Ciao ${user.firstName}! Sono lo staff di InTavola. Questo è il tuo codice personale per ordinare la pizza: ${user.pin}. Accedi qui: ${window.location.origin}`;
  };

  const copyToClipboard = async (user: User) => {
    const msg = getPINMessage(user);
    try {
      await navigator.clipboard.writeText(msg);
      showToast("Copiato ✅");
    } catch (err) {
      alert("Errore nella copia");
    }
  };

  const sendWhatsApp = (user: User) => {
    const phone = user.phone_e164 || '';
    if (!phone) {
      alert("Numero di telefono mancante!");
      return;
    }
    
    // Pulizia aggressiva del numero: tieni solo i numeri
    // WhatsApp wa.me richiede il numero nel formato: prefisso + numero senza '+' o spazi
    // Esempio: 393331234567
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      alert("Il numero di telefono sembra incompleto o errato.");
      return;
    }

    const msg = encodeURIComponent(getPINMessage(user));
    // Utilizziamo l'endpoint api.whatsapp.com per una compatibilità maggiore su mobile
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleSave = async () => {
    if (!editing?.firstName || !editing?.lastName || !editing?.pin || !editing?.phone_e164) {
      setError('Tutti i campi (Nome, Cognome, Telefono e PIN) sono obbligatori');
      return;
    }
    
    // Validazione base del numero di telefono
    if (!editing.phone_e164.includes('+')) {
      setError('Inserisci il prefisso internazionale (es. +39 per Italia)');
      return;
    }

    if (editing.pin.length < 4 || editing.pin.length > 6 || !/^\d+$/.test(editing.pin)) {
      setError('Il PIN deve essere composto da 4-6 cifre numeriche');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      const isAvailable = await db.isPinAvailable(editing.pin, editing.id);
      if (!isAvailable) {
        setError('Questo PIN è già in uso da un altro utente attivo');
        setSaving(false);
        return;
      }

      await db.saveUser(editing);
      await fetchUsers();
      
      setSuccessUser({ ...editing as User });
      setEditing(null);
    } catch (err: any) {
      setError(err.message || "Errore nel salvataggio. Verifica che il numero di telefono sia univoco.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Gestione Personale" onBack={onBack}>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-black/80 text-white px-4 py-2 rounded-full text-sm font-bold animate-in fade-in zoom-in duration-200">
          {toast}
        </div>
      )}

      <div className="space-y-4">
        <Button fullWidth onClick={() => { setEditing({ role: Role.WORKER, pin: '', active: true, phone_e164: '+39' }); setError(''); }}>
          <Plus size={20} /> Nuovo Dipendente
        </Button>

        {loading ? (
          <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
        ) : (
          <div className="space-y-3">
            {users.length === 0 ? (
              <p className="text-center text-[#8E8E93] py-10">Nessun dipendente registrato</p>
            ) : (
              users.map(u => (
                <Card key={u.id} className={`p-4 ${!u.active ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                        u.role === Role.ADMIN ? 'bg-[#FF3B30]' : u.role === Role.SUPERVISOR ? 'bg-[#5856D6]' : 'bg-[#007AFF]'
                      }`}>
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <h3 className="font-bold">{u.firstName} {u.lastName}</h3>
                        <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{u.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(u); setError(''); }} className="p-2 text-[#007AFF] bg-[#F2F2F7] rounded-full">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => { if(window.confirm(`Eliminare ${u.firstName}?`)) db.deleteUser(u.id).then(fetchUsers) }} className="p-2 text-[#FF3B30] bg-red-50 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F2F2F7] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                        <Check size={14} /> PIN configurato
                      </span>
                      <button 
                        onClick={() => { setEditing({ ...u, pin: '' }); setError(''); }}
                        className="text-[10px] bg-[#F2F2F7] px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1 hover:bg-[#E5E5EA]"
                      >
                        <RefreshCw size={10} /> Rigenera
                      </button>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.active ? 'ATTIVO' : 'SOSPESO'}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Form Creazione/Modifica */}
      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-t-[32px] p-6 pb-10 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editing.id ? 'Aggiorna Dipendente' : 'Nuovo Dipendente'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2 text-[#FF3B30] text-xs font-bold animate-in fade-in duration-200">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Nome</label>
                  <Input placeholder="Nome" value={editing.firstName || ''} onChange={e => setEditing({...editing, firstName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Cognome</label>
                  <Input placeholder="Cognome" value={editing.lastName || ''} onChange={e => setEditing({...editing, lastName: e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">WhatsApp (es. +393331234567)</label>
                <Input 
                  placeholder="+39..."
                  type="tel"
                  value={editing.phone_e164 || ''} 
                  onChange={e => setEditing({...editing, phone_e164: e.target.value})} 
                />
                <p className="text-[9px] text-[#8E8E93] mt-1 italic">* Includi sempre il prefisso internazionale</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">PIN Personale (4-6 cifre)</label>
                <Input 
                  type="text"
                  inputMode="numeric"
                  placeholder="Inserisci PIN"
                  className="font-mono tracking-widest text-lg"
                  value={editing.pin || ''} 
                  onChange={e => setEditing({...editing, pin: e.target.value.replace(/\D/g, '').slice(0, 6)})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Ruolo</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none text-sm font-medium"
                  value={editing.role}
                  onChange={e => setEditing({...editing, role: e.target.value as Role})}
                >
                  <option value={Role.WORKER}>Dipendente</option>
                  <option value={Role.SUPERVISOR}>Supervisor (Sola Lettura)</option>
                  <option value={Role.ADMIN}>Amministratore</option>
                </select>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="active_cb"
                  className="w-5 h-5 accent-[#007AFF]"
                  checked={editing.active !== false}
                  onChange={e => setEditing({...editing, active: e.target.checked})}
                />
                <label htmlFor="active_cb" className="text-sm font-bold text-[#1c1c1e]">Utente Attivo</label>
              </div>
            </div>

            <Button fullWidth onClick={handleSave} disabled={saving} className="mt-4">
              {saving ? <div className="loading-spinner border-white border-t-transparent" /> : 'Salva e Prepara Messaggio'}
            </Button>
          </div>
        </div>
      )}

      {/* Overlay Successo / Condivisione */}
      {successUser && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-center items-center p-6">
          <div className="absolute inset-0 bg-[#007AFF]/95 backdrop-blur-md" />
          <div className="relative w-full max-w-sm bg-white rounded-[32px] p-8 text-center space-y-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Check size={40} />
            </div>
            
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[#1c1c1e]">Dati Salvati!</h2>
              <p className="text-[#8E8E93] text-sm mt-1">Invia le credenziali a <span className="text-black font-bold">{successUser.firstName}</span></p>
            </div>

            <div className="bg-[#F2F2F7] p-4 rounded-2xl border border-[#E5E5EA]">
              <p className="text-[10px] font-bold text-[#8E8E93] uppercase mb-1 tracking-widest">PIN Da Comunicare</p>
              <p className="text-3xl font-mono font-black tracking-[0.2em] text-[#007AFF]">{successUser.pin}</p>
            </div>

            <div className="space-y-3 pt-2">
              <Button fullWidth className="!bg-[#25D366] !text-white border-none shadow-lg" onClick={() => sendWhatsApp(successUser)}>
                <MessageCircle size={20} /> Invia su WhatsApp
              </Button>
              <Button fullWidth variant="secondary" className="border border-[#D1D1D6]" onClick={() => copyToClipboard(successUser)}>
                <Copy size={20} /> Copia Messaggio Testuale
              </Button>
              <p className="text-[10px] text-[#8E8E93] px-4 leading-relaxed italic">
                Nota: WhatsApp aprirà una chat. Dovrai premere "Invia" manualmente per completare la consegna.
              </p>
              <button 
                onClick={() => setSuccessUser(null)} 
                className="w-full text-xs font-bold text-[#8E8E93] uppercase tracking-widest pt-2"
              >
                Ho terminato
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminUsers;
