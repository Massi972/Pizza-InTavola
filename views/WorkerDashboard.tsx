
import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, Order, SlotTime, DayStatus } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, SegmentedControl, Input } from '../components/UI';
import { PizzaIcon, ClockIcon, Search, Check, AlertCircle, X } from '../components/Icons';
import { isBeforeCutoff } from '../services/utils';
import { SLOT_TIMES } from '../constants';

interface WorkerDashboardProps {
  user: User;
  onLogout: () => void;
}

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, onLogout }) => {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [currentDay, setCurrentDay] = useState<any>(null);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [slot, setSlot] = useState<SlotTime>('18:00');
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const canOrder = useMemo(() => {
    return currentDay?.status === DayStatus.OPEN && isBeforeCutoff();
  }, [currentDay]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pizzaList, day, order] = await Promise.all([
          db.getPizzas(),
          db.getCurrentDay(),
          db.getUserOrderToday(user.id)
        ]);
        setPizzas(pizzaList.filter(p => p.active));
        setCurrentDay(day);
        setMyOrder(order);
      } catch (err) {
        setMessage({ text: "Errore nel caricamento dei dati", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const filteredPizzas = pizzas.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.ingredients?.some(i => i.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelectPizza = (pizza: Pizza) => {
    if (!canOrder && !isEditing) return;
    setSelectedPizza(pizza);
  };

  const handleConfirmOrder = async () => {
    if (!selectedPizza || !currentDay) return;
    
    setSubmitting(true);
    try {
      const order: Partial<Order> = {
        id: myOrder?.id,
        dayId: currentDay.id,
        userId: user.id,
        pizzaId: selectedPizza.id,
        slotTime: slot,
        note: note
      };

      await db.saveOrder(order);
      const updatedOrder = await db.getUserOrderToday(user.id);
      setMyOrder(updatedOrder);
      setSelectedPizza(null);
      setNote('');
      setIsEditing(false);
      
      // Messaggio di successo personalizzato come richiesto
      setMessage({ text: "Ordine Confermato ed inviato", type: "success" });
      
      // Auto-dismiss dopo 3 secondi
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: "Errore durante il salvataggio", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = () => {
    if (!myOrder) return;
    const pizza = pizzas.find(p => p.id === myOrder.pizzaId);
    if (pizza) {
      setSelectedPizza(pizza);
      setSlot(myOrder.slotTime);
      setNote(myOrder.note);
      setIsEditing(true);
    }
  };

  if (loading) {
    return (
      <Layout title="Caricamento..." onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="loading-spinner !w-10 !h-10" />
          <p className="text-[#8E8E93] font-medium">Recupero menu in corso...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Ordina Pizza" onLogout={onLogout}>
      {/* Toast / Banner Messaggio di Successo/Errore stile iOS */}
      {message && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm p-4 rounded-2xl shadow-2xl flex items-center gap-3 transition-all transform animate-in fade-in slide-in-from-top-10 duration-500 ease-out ${
          message.type === 'success' ? 'bg-[#34C759] text-white' : 'bg-[#FF3B30] text-white'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold text-sm flex-1">{message.text}</p>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Banner Stato */}
      {!currentDay ? (
        <div className="bg-[#FF9500] text-white p-4 rounded-2xl mb-6 flex items-center gap-3">
          <AlertCircle size={24} />
          <div>
            <p className="font-bold">Giornata non ancora aperta</p>
            <p className="text-xs opacity-90">L'admin aprirà le ordinazioni a breve.</p>
          </div>
        </div>
      ) : !canOrder ? (
        <div className="bg-[#FF3B30] text-white p-4 rounded-2xl mb-6 flex items-center gap-3">
          <AlertCircle size={24} />
          <div>
            <p className="font-bold">Ordini chiusi 🔒</p>
            <p className="text-xs opacity-90">Oltre le 16:30 o giornata terminata. Non puoi più ordinare o modificare.</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#34C759] text-white p-4 rounded-2xl mb-6 flex items-center gap-3">
          <Check size={24} />
          <div>
            <p className="font-bold">Ordini Aperti</p>
            <p className="text-xs opacity-90">Puoi ordinare o modificare fino alle 16:30.</p>
          </div>
        </div>
      )}

      {/* Ordine Esistente */}
      {myOrder && !selectedPizza && !isEditing && (
        <Card className="p-4 mb-6 border-2 border-[#34C759]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-[#34C759] uppercase mb-1">Il tuo ordine di oggi</p>
              <h2 className="text-xl font-bold">
                {pizzas.find(p => p.id === myOrder.pizzaId)?.name || 'Pizza non disponibile'}
              </h2>
            </div>
            <div className="bg-[#F2F2F7] px-3 py-1 rounded-full flex items-center gap-1">
              <ClockIcon size={14} />
              <span className="text-sm font-bold">{myOrder.slotTime}</span>
            </div>
          </div>
          {myOrder.note && (
            <div className="bg-[#F2F2F7] p-2 rounded-lg mb-4">
              <p className="text-xs text-[#8E8E93]">Nota:</p>
              <p className="text-sm italic">"{myOrder.note}"</p>
            </div>
          )}
          {canOrder && (
            <Button onClick={handleEdit} variant="secondary" fullWidth>
              Modifica Ordine
            </Button>
          )}
        </Card>
      )}

      {/* Menu Pizze */}
      {(!myOrder || isEditing) && !selectedPizza && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={18} />
            <Input 
              placeholder="Cerca pizza o ingrediente..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredPizzas.length > 0 ? filteredPizzas.map(pizza => (
              <Card 
                key={pizza.id} 
                className={`p-4 cursor-pointer active:scale-95 transition-all ${
                  selectedPizza?.id === pizza.id ? 'ring-2 ring-[#007AFF]' : ''
                }`}
              >
                <div onClick={() => handleSelectPizza(pizza)}>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-lg">{pizza.name}</h3>
                    {pizza.isVegetarian && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Veg</span>}
                  </div>
                  <p className="text-sm text-[#8E8E93] line-clamp-2">{pizza.ingredients?.join(', ')}</p>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {pizza.allergens?.map(a => (
                      <span key={a} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            )) : (
              <p className="text-center text-[#8E8E93] py-10">Nessuna pizza trovata</p>
            )}
          </div>
        </>
      )}

      {/* Bottom Sheet Order Detail */}
      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!submitting) { setSelectedPizza(null); setIsEditing(false); } }} />
          <div className="relative bg-white rounded-t-[32px] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-[#E5E5EA] rounded-full mx-auto mb-2" />
            
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{selectedPizza.name}</h2>
                <p className="text-[#8E8E93]">{selectedPizza.ingredients?.join(', ')}</p>
              </div>
              <button disabled={submitting} onClick={() => { setSelectedPizza(null); setIsEditing(false); }} className="bg-[#F2F2F7] p-2 rounded-full disabled:opacity-50">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8E8E93] uppercase">Orario Consegna</label>
              <SegmentedControl 
                options={SLOT_TIMES}
                selected={slot}
                onChange={(v) => setSlot(v as SlotTime)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8E8E93] uppercase">Note (opzionale)</label>
              <Input 
                placeholder="Es. Senza cipolla, ben cotta..."
                value={note}
                disabled={submitting}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting}>
                {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : (isEditing ? 'Aggiorna Ordine' : 'Conferma Ordine')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WorkerDashboard;
