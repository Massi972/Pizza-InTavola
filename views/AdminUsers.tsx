
import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Plus, Edit2, Trash2, X, Lock, AlertCircle } from '../components/Icons';

interface AdminUsersProps {
  onBack: () => void;
}

const AdminUsers: React.FC<AdminUsersProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await db.getUsers();
      setUsers(data);
    } catch (err) {
      alert("Errore caricamento utenti");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSave = async () => {
    if (!editing?.firstName || !editing?.lastName || !editing?.pin || !editing?.email) {
      setError('Compila tutti i campi obbligatori (Email inclusa)');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // CONTROLLO UNICITÀ PIN
      const isAvailable = await db.isPinAvailable(editing.pin, editing.id);
      
      if (!isAvailable) {
        setError('Questo PIN è già in uso');
        setSaving(false);
        return;
      }

      await db.saveUser(editing);
      await fetchUsers();
      setEditing(null);
    } catch (err: any) {
      // Mostriamo il messaggio d'errore reale del database per il debug
      setError(err.message || "Errore imprevisto nel salvataggio.");
      console.error("Dettaglio Errore:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Eliminare questo dipendente?")) {
      try {
        await db.deleteUser(id);
        await fetchUsers();
      } catch (err) {
        alert("Errore nella cancellazione");
      }
    }
  };

  const generatePin = async () => {
    let pin = '';
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      isUnique = await db.isPinAvailable(pin, editing?.id);
      attempts++;
    }
    
    setEditing(prev => prev ? { ...prev, pin } : null);
    setError('');
  };

  return (
    <Layout title="Gestione Personale" onBack={onBack}>
      <div className="space-y-4">
        <Button fullWidth onClick={() => { setEditing({ role: Role.WORKER, pin: '', active: true, email: '' }); setError(''); }}>
          <Plus size={20} /> Aggiungi Dipendente
        </Button>

        {loading ? (
          <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
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
                    <button onClick={() => handleDelete(u.id)} className="p-2 text-[#FF3B30] bg-red-50 rounded-full">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F2F2F7] space-y-2">
                   <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 text-[#8E8E93]">
                      <Lock size={12} />
                      <span className="text-xs font-mono font-bold tracking-widest">{u.pin}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.active ? 'ATTIVO' : 'SOSPESO'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8E8E93] font-medium break-all">{u.email}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-t-[32px] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editing.id ? 'Modifica Dipendente' : 'Nuovo Dipendente'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3 text-[#FF3B30] text-sm font-bold animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle size={20} />
                <span className="flex-1 break-words">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Nome</label>
                  <Input value={editing.firstName || ''} onChange={e => { setError(''); setEditing({...editing, firstName: e.target.value}); }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Cognome</label>
                  <Input value={editing.lastName || ''} onChange={e => { setError(''); setEditing({...editing, lastName: e.target.value}); }} />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Email Personale (per recupero PIN)</label>
                <Input 
                  type="email"
                  placeholder="email@esempio.it"
                  value={editing.email || ''} 
                  onChange={e => { setError(''); setEditing({...editing, email: e.target.value}); }} 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Ruolo</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] outline-none"
                  value={editing.role}
                  onChange={e => setEditing({...editing, role: e.target.value as Role})}
                >
                  <option value={Role.WORKER}>Worker (Dipendente)</option>
                  <option value={Role.SUPERVISOR}>Supervisor (Solo Lettura)</option>
                  <option value={Role.ADMIN}>Admin (Completo)</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">PIN Personale</label>
                  <Input 
                    placeholder="4-6 cifre"
                    value={editing.pin || ''} 
                    onChange={e => { setError(''); setEditing({...editing, pin: e.target.value}); }} 
                  />
                </div>
                <Button variant="secondary" onClick={generatePin} className="!py-[14px]">
                  Genera
                </Button>
              </div>

              <div className="flex items-center gap-2 p-1">
                <input 
                  id="user-active"
                  type="checkbox" 
                  className="w-5 h-5 accent-[#007AFF]"
                  checked={editing.active ?? true} 
                  onChange={e => setEditing({...editing, active: e.target.checked})}
                />
                <label htmlFor="user-active" className="text-sm font-medium">Utente Attivo / Abilitato</label>
              </div>
            </div>

            <Button fullWidth onClick={handleSave} disabled={saving || !editing.pin}>
              {saving ? <div className="loading-spinner border-white border-t-transparent" /> : 'Salva Dipendente'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminUsers;
