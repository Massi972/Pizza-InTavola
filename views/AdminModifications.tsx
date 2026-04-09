
import React, { useState, useEffect } from 'react';
import { Modification } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Plus, Edit2, Trash2, X, Sliders, Filter, AlertCircle, RefreshCw } from '../components/Icons';

interface AdminModificationsProps {
  onBack: () => void;
}

const AdminModifications: React.FC<AdminModificationsProps> = ({ onBack }) => {
  const [mods, setMods] = useState<Modification[]>([]);
  const [editing, setEditing] = useState<Partial<Modification> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchMods = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await db.getModifications();
      setMods(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, []);

  const handleSave = async () => {
    if (!editing?.name || !editing?.type) return;
    setSaving(true);
    setError('');
    try {
      await db.saveModification(editing);
      await fetchMods();
      setEditing(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Eliminare definitivamente questa variante?")) {
      try {
        await db.deleteModification(id);
        await fetchMods();
      } catch (err: any) {
        alert("Errore: " + err.message);
      }
    }
  };

  const handleToggleActive = async (m: Modification) => {
    try {
      await db.saveModification({ ...m, active: !m.active });
      await fetchMods();
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  return (
    <Layout title="Gestione Variazioni" onBack={onBack}>
      <div className="space-y-4">
        <Button fullWidth onClick={() => { setEditing({ type: 'ADD', active: true, sort_order: 0 }); setError(''); }}>
          <Plus size={20} /> Nuova Variazione
        </Button>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
        ) : (
          <div className="space-y-3">
            {mods.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-10 italic">Nessuna variante definita.</p>
            ) : (
              mods.map(m => (
                <Card key={m.id} className={`p-4 ${!m.active ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                          m.type === 'ADD' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {m.type === 'ADD' ? 'AGGIUNGI' : 'TOGLI'}
                        </span>
                        <h3 className="font-bold">{m.name}</h3>
                      </div>
                      <p className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-tight">Ordine: {m.sort_order || 0}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(m); setError(''); }} className="p-2 text-[#007AFF] bg-[#F2F2F7] rounded-full">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-2 text-[#FF3B30] bg-red-50 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F2F2F7] flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#8E8E93] uppercase">
                      {m.active ? 'ATTIVA' : 'DISATTIVATA'}
                    </span>
                    <button 
                      onClick={() => handleToggleActive(m)}
                      className={`text-xs font-bold px-3 py-1 rounded-full ${m.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}
                    >
                      {m.active ? 'DISATTIVA' : 'ATTIVA'}
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
              <h2 className="text-xl font-bold">{editing.id ? 'Modifica Variante' : 'Nuova Variante'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Nome (es: + Prosciutto)</label>
                <Input value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Tipo</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-[#F2F2F7] border-none text-sm font-medium"
                  value={editing.type}
                  onChange={e => setEditing({...editing, type: e.target.value as 'ADD' | 'REMOVE'})}
                >
                  <option value="ADD">AGGIUNGI</option>
                  <option value="REMOVE">TOGLI</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Ordine visualizzazione</label>
                <Input type="number" value={editing.sort_order || 0} onChange={e => setEditing({...editing, sort_order: parseInt(e.target.value)})} />
              </div>
            </div>

            <Button fullWidth onClick={handleSave} disabled={saving} className="!mt-6">
              {saving ? <div className="loading-spinner border-white border-t-transparent" /> : 'Salva Variante'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminModifications;
