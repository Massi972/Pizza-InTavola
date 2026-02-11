
import React, { useState, useEffect } from 'react';
import { Pizza } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Plus, Edit2, Trash2, X } from '../components/Icons';

interface AdminPizzasProps {
  onBack: () => void;
}

const AdminPizzas: React.FC<AdminPizzasProps> = ({ onBack }) => {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [editing, setEditing] = useState<Partial<Pizza> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPizzas = async () => {
    setLoading(true);
    try {
      const data = await db.getPizzas();
      setPizzas(data);
    } catch (err) {
      alert("Errore caricamento pizze");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPizzas();
  }, []);

  const handleSave = async () => {
    if (!editing?.name) return;
    setSaving(true);
    try {
      await db.savePizza(editing);
      await fetchPizzas();
      setEditing(null);
    } catch (err) {
      alert("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Eliminare questa pizza dal menu?")) {
      try {
        await db.deletePizza(id);
        await fetchPizzas();
      } catch (err) {
        alert("Errore nella cancellazione");
      }
    }
  };

  const handleToggleActive = async (pizza: Pizza) => {
    try {
      await db.savePizza({ ...pizza, active: !pizza.active });
      await fetchPizzas();
    } catch (err) {
      alert("Errore aggiornamento stato");
    }
  };

  return (
    <Layout title="Gestione Pizze" onBack={onBack}>
      <div className="space-y-4">
        <Button fullWidth onClick={() => setEditing({})}>
          <Plus size={20} /> Aggiungi Nuova Pizza
        </Button>

        {loading ? (
          <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
        ) : (
          <div className="space-y-3">
            {pizzas.map(p => (
              <Card key={p.id} className={`p-4 ${!p.active ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <p className="text-xs text-[#8E8E93]">{p.ingredients?.join(', ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(p)} className="p-2 text-[#007AFF] bg-[#F2F2F7] rounded-full">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-[#FF3B30] bg-red-50 rounded-full">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F2F2F7] flex justify-between items-center">
                  <span className="text-xs font-bold text-[#8E8E93] uppercase">
                    Stato: {p.active ? 'ATTIVA' : 'DISATTIVATA'}
                  </span>
                  <button 
                    onClick={() => handleToggleActive(p)}
                    className={`text-xs font-bold px-3 py-1 rounded-full ${p.active ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}
                  >
                    {p.active ? 'DISATTIVA' : 'ATTIVA'}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-t-[32px] p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editing.id ? 'Modifica Pizza' : 'Nuova Pizza'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Nome Pizza</label>
                <Input value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Ingredienti (separati da virgola)</label>
                <Input 
                  value={editing.ingredients?.join(', ') || ''} 
                  onChange={e => setEditing({...editing, ingredients: e.target.value.split(',').map(s => s.trim())})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#8E8E93] uppercase pl-1">Allergeni (separati da virgola)</label>
                <Input 
                  value={editing.allergens?.join(', ') || ''} 
                  onChange={e => setEditing({...editing, allergens: e.target.value.split(',').map(s => s.trim())})} 
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={editing.isVegetarian || false} 
                  onChange={e => setEditing({...editing, isVegetarian: e.target.checked})}
                />
                <label className="text-sm font-medium">Pizza Vegetariana</label>
              </div>
            </div>

            <Button fullWidth onClick={handleSave} disabled={saving}>
              {saving ? <div className="loading-spinner border-white border-t-transparent" /> : 'Salva Pizza'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminPizzas;
