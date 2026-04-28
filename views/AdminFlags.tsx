
import React, { useState, useEffect } from 'react';
import { PizzaFlag } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Plus, Edit2, Trash2, X, Flag, AlertCircle, RefreshCw } from '../components/Icons';

interface AdminFlagsProps {
  onBack: () => void;
}

const AdminFlags: React.FC<AdminFlagsProps> = ({ onBack }) => {
  const [flags, setFlags] = useState<PizzaFlag[]>([]);
  const [editing, setEditing] = useState<Partial<PizzaFlag> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dbSetupNeeded, setDbSetupNeeded] = useState(false);

  const fetchFlags = async () => {
    setLoading(true);
    setError('');
    setDbSetupNeeded(false);
    try {
      const data = await db.getPizzaFlags();
      setFlags(data);
    } catch (err: any) {
      if (err.message.includes("Configurazione Database Mancante")) {
        setDbSetupNeeded(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleSave = async () => {
    if (!editing?.name) return;
    setSaving(true);
    setError('');
    try {
      await db.savePizzaFlag(editing);
      await fetchFlags();
      setEditing(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Eliminare definitivamente questo flag?")) {
      try {
        await db.deletePizzaFlag(id);
        await fetchFlags();
      } catch (err: any) {
        alert("Errore: " + err.message);
      }
    }
  };

  const handleToggleActive = async (f: PizzaFlag) => {
    try {
      await db.savePizzaFlag({ ...f, active: !f.active });
      await fetchFlags();
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  return (
    <Layout title="Gestione Flag (Etichette)" onBack={onBack}>
      <div className="space-y-4">
        {dbSetupNeeded ? (
          <Card className="p-6 border-2 border-red-200 bg-red-50 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle size={24} />
              <h2 className="font-bold">Setup Database Richiesto</h2>
            </div>
            <p className="text-sm text-red-700 leading-relaxed">
              La tabella <strong>pizza_flags</strong> non è stata trovata nel database Supabase.
              Per favore, esegui lo script SQL fornito nelle istruzioni per configurare correttamente il sistema.
            </p>
            <Button fullWidth onClick={fetchFlags} variant="secondary">
              <RefreshCw size={16} /> Riprova caricamento
            </Button>
          </Card>
        ) : (
          <Button fullWidth onClick={() => { setEditing({ active: true, sort_order: 0 }); setError(''); }}>
            <Plus size={20} /> Nuovo Flag
          </Button>
        )}

        {error && !dbSetupNeeded && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
        ) : (
          <div className="space-y-3">
            {flags.length === 0 && !dbSetupNeeded ? (
              <p className="text-center text-xs text-gray-400 py-10 italic">Nessun flag definito.</p>
            ) : (
              flags.map(f => (
                <Card key={f.id} className={`p-4 ${!f.active ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Flag size={14} className="text-[#5856D6]" />
                        <h3 className="font-bold">{f.name}</h3>
                      </div>
                      <p className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-tight">Ordine: {f.sort_order || 0}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(f); setError(''); }} className="p-2 text-[#007AFF] bg-[#F2F2F7] rounded-full">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="p-2 text-[#FF3B30] bg-red-50 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F2F2F7] flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8E8E93] uppercase">
                      {f.active ? 'ATTIVA' : 'DISATTIVATA'}
                    </span>
                    <button 
                      onClick={() => handleToggleActive(f)}
                      className={`text-xs font-bold px-3 py-1 rounded-full ${f.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}
                    >
                      {f.active ? 'DISATTIVA' : 'ATTIVA'}
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-t-[32px] p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editing.id ? 'Modifica Flag' : 'Nuovo Flag'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Nome (es: Cottura Croccante, Senza Origano)</label>
                <Input value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Ordine visualizzazione</label>
                <Input type="number" value={editing.sort_order || 0} onChange={e => setEditing({...editing, sort_order: parseInt(e.target.value)})} />
              </div>
            </div>

            <Button fullWidth onClick={handleSave} disabled={saving} className="!mt-6">
              {saving ? <div className="loading-spinner border-white border-t-transparent" /> : 'Salva Flag'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminFlags;
