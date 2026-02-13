
import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, Order, SlotTime, DayStatus } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, SegmentedControl, Input } from '../components/UI';
import { PizzaIcon, ClockIcon, Search, Check, AlertCircle, X, Fingerprint, Lock } from '../components/Icons';
import { isBeforeCutoff } from '../services/utils';
import { SLOT_TIMES } from '../constants';

interface WorkerDashboardProps {
  user: User;
  onLogout: () => void;
}

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, onLogout }) => {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [currentDay, setCurrentDay] = useState<any>(null);
  const [overrideActive, setOverrideActive] = useState(false);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [slot, setSlot] = useState<SlotTime>('18:00');
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('pizzastaff_biometric_enabled') === 'true');

  const canOrder = useMemo(() => {
    if (!currentDay || currentDay.status !== DayStatus.OPEN) return false;
    if (overrideActive) return true;
    return isBeforeCutoff();
  }, [currentDay, overrideActive]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pizzaList, day, order, settings] = await Promise.all([
          db.getPizzas(),
          db.getCurrentDay(),
          db.getUserOrderToday(user.id),
          db.getSettings()
        ]);
        setPizzas(pizzaList.filter(p => p.active));
        setCurrentDay(day);
        setMyOrder(order);
        setOverrideActive(settings.override_cutoff);
      } catch (err) {
        setMessage({ text: "Errore nel caricamento dei dati", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const toggleBiometrics = () => {
    if (biometricEnabled) {
      localStorage.removeItem('pizzastaff_stored_pin');
      localStorage.setItem('pizzastaff_biometric_enabled', 'false');
      setBiometricEnabled(false);
      setMessage({ text: "Face ID / Impronta disattivata", type: "success" });
    } else {
      localStorage.setItem('pizzastaff_stored_pin', user.pin);
      localStorage.setItem('pizzastaff_biometric_enabled', 'true');
      localStorage.removeItem('pizzastaff_biometric_declined');
      setBiometricEnabled(true);
      setMessage({ text: "Face ID / Impronta attivata!", type: "success" });
    }
    setTimeout(() => setMessage(null), 2000);
  };

  const filteredPizzas = pizzas.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.ingredients?.some(i => i.toLowerCase().includes(search.toLowerCase()))
  );

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
      setMessage({ text: "Ordine Confermato ed inviato", type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: "Errore durante il salvataggio", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Caricamento..." onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="loading-spinner !w-10 !h-10" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Ordina Pizza" onLogout={onLogout}>
      {message && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-10 duration-500 ${
          message.type === 'success' ? 'bg-[#34C759] text-white' : 'bg-[#FF3B30] text-white'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold text-sm flex-1">{message.text}</p>
        </div>
      )}

      {/* Banner Stato */}
      {!canOrder && currentDay && (
        <div className="bg-[#FF3B30] text-white p-4 rounded-2xl mb-6 flex items-center gap-3">
          <Lock size={24} />
          <div>
            <p className="font-bold">Ordini chiusi 🔒</p>
            <p className="text-xs opacity-90">Oltre l'orario limite (16:30).</p>
          </div>
        </div>
      )}

      {/* Card Sicurezza Accesso */}
      <Card className="p-4 mb-6 border-l-4 border-[#5856D6]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              <Fingerprint size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#8E8E93] uppercase">Accesso Biometrico</p>
              <p className="text-sm font-bold">{biometricEnabled ? 'Face ID / Impronta Attivo' : 'Non Attivo'}</p>
            </div>
          </div>
          <button 
            onClick={toggleBiometrics}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
              biometricEnabled ? 'bg-red-50 text-[#FF3B30] border border-red-100' : 'bg-[#007AFF] text-white'
            }`}
          >
            {biometricEnabled ? 'Disattiva' : 'Attiva ora'}
          </button>
        </div>
      </Card>

      {/* Ordine Esistente */}
      {myOrder && !selectedPizza && !isEditing && (
        <Card className={`p-4 mb-6 border-2 ${overrideActive ? 'border-[#5856D6]' : 'border-[#34C759]'}`}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className={`text-xs font-bold ${overrideActive ? 'text-[#5856D6]' : 'text-[#34C759]'} uppercase mb-1`}>Il tuo ordine di oggi</p>
              <h2 className="text-xl font-bold">
                {pizzas.find(p => p.id === myOrder.pizzaId)?.name || 'Pizza'}
              </h2>
            </div>
            <div className="bg-[#F2F2F7] px-3 py-1 rounded-full flex items-center gap-1">
              <ClockIcon size={14} />
              <span className="text-sm font-bold">{myOrder.slotTime}</span>
            </div>
          </div>
          {canOrder && (
            <Button onClick={() => {
              const p = pizzas.find(px => px.id === myOrder.pizzaId);
              if(p) { setSelectedPizza(p); setSlot(myOrder.slotTime); setNote(myOrder.note); setIsEditing(true); }
            }} variant="secondary" fullWidth>
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
              placeholder="Cerca pizza..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredPizzas.map(pizza => (
              <Card 
                key={pizza.id} 
                className="p-4 cursor-pointer active:scale-95 transition-all"
                onClick={() => canOrder && setSelectedPizza(pizza)}
              >
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-lg">{pizza.name}</h3>
                  {pizza.isVegetarian && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">VEG</span>}
                </div>
                <p className="text-xs text-[#8E8E93]">{pizza.ingredients?.join(', ')}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Bottom Sheet Order */}
      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if(!submitting) setSelectedPizza(null); }} />
          <div className="relative bg-white rounded-t-[32px] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom">
            <h2 className="text-2xl font-bold">{selectedPizza.name}</h2>
            <div className="space-y-4">
              <SegmentedControl options={SLOT_TIMES} selected={slot} onChange={(v) => setSlot(v as SlotTime)} />
              <Input placeholder="Note particolari..." value={note} onChange={(e) => setNote(e.target.value)} />
              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting}>
                {submitting ? 'Invio...' : 'Conferma'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WorkerDashboard;
