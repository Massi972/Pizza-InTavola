
import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, Order, SlotTime, DayStatus, Modification, Role } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, SegmentedControl, Input } from '../components/UI';
import { 
  PizzaIcon, 
  ClockIcon, 
  Search, 
  Check, 
  AlertCircle, 
  X, 
  Fingerprint, 
  Lock, 
  Settings, 
  UserIcon,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Plus,
  Trash2,
  Sliders
} from '../components/Icons';
import { isBeforeCutoff } from '../services/utils';
import { SLOT_TIMES } from '../constants';
import { isBiometricAvailable, registerBiometrics } from '../services/biometrics';

interface WorkerDashboardProps {
  user: User;
  onLogout: () => void;
  onBackToAdmin?: () => void;
}

type ViewState = 'menu' | 'settings';

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, onLogout, onBackToAdmin }) => {
  const [activeTab, setActiveTab] = useState<ViewState>('menu');
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [currentDay, setCurrentDay] = useState<any>(null);
  const [overrideActive, setOverrideActive] = useState(false);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [slot, setSlot] = useState<SlotTime>('18:00');
  const [selectedAddIds, setSelectedAddIds] = useState<string[]>([]);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  const [isBioSupported, setIsBioSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('pizzastaff_biometric_enabled') === 'true');

  const addOptions = modifications.filter(m => m.type === 'ADD' && m.active);
  const removeOptions = modifications.filter(m => m.type === 'REMOVE' && m.active);

  useEffect(() => {
    const checkBio = async () => {
      const available = await isBiometricAvailable();
      setIsBioSupported(available);
    };
    checkBio();
  }, []);

  const canOrder = useMemo(() => {
    if (!currentDay || currentDay.status !== DayStatus.OPEN) return false;
    if (overrideActive) return true;
    return isBeforeCutoff();
  }, [currentDay, overrideActive]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pizzaList, modList, day, order, settings] = await Promise.all([
          db.getPizzas(),
          db.getModifications(),
          db.getCurrentDay(),
          db.getUserOrderToday(user.id),
          db.getSettings()
        ]);
        setPizzas(pizzaList.filter(p => p.active));
        setModifications(modList || []);
        setCurrentDay(day);
        setMyOrder(order);
        setOverrideActive(settings.override_cutoff);
      } catch (err: any) {
        setMessage({ text: err.message || "Errore nel caricamento dei dati", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const handleToggleAdd = (id: string) => {
    setSelectedAddIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleRemove = (id: string) => {
    setSelectedRemoveIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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
        addModificationIds: selectedAddIds,
        removeModificationIds: selectedRemoveIds,
        note: ''
      };
      await db.saveOrder(order);
      const updatedOrder = await db.getUserOrderToday(user.id);
      setMyOrder(updatedOrder);
      setSelectedPizza(null);
      setSelectedAddIds([]);
      setSelectedRemoveIds([]);
      setIsEditing(false);
      setMessage({ text: "Ordine inviato con successo!", type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ text: err.message || "Errore durante il salvataggio", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Caricamento..." onLogout={onLogout}>
        <div className="flex justify-center py-20"><div className="loading-spinner !w-8 !h-8" /></div>
      </Layout>
    );
  }

  const renderMenu = () => {
    const filteredPizzas = pizzas.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.ingredients?.some(i => i.toLowerCase().includes(search.toLowerCase()))
    );

    return (
      <div className="space-y-6">
        {!canOrder && currentDay && (
          <div className="bg-[#FF3B30] text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg">
            <Lock size={24} />
            <div>
              <p className="font-bold">Ordini chiusi 🔒</p>
              <p className="text-xs opacity-90">Oltre l'orario limite (16:30).</p>
            </div>
          </div>
        )}

        {myOrder && !selectedPizza && !isEditing && (
          <Card className={`p-5 border-2 ${overrideActive ? 'border-[#5856D6]' : 'border-[#34C759]'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className={`text-[10px] font-black ${overrideActive ? 'text-[#5856D6]' : 'text-[#34C759]'} uppercase tracking-widest mb-1`}>Prenotazione Attiva</p>
                <h2 className="text-2xl font-black">{pizzas.find(p => p.id === myOrder.pizzaId)?.name || 'Pizza'}</h2>
                <div className="mt-2 flex flex-wrap gap-1">
                  {myOrder.addModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">+{mod.name}</span> : null;
                  })}
                  {myOrder.removeModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">-{mod.name}</span> : null;
                  })}
                </div>
              </div>
              <div className="bg-[#F2F2F7] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <ClockIcon size={16} className="text-[#8E8E93]" />
                <span className="text-sm font-bold">{myOrder.slotTime}</span>
              </div>
            </div>
            {canOrder && (
              <Button onClick={() => {
                const p = pizzas.find(px => px.id === myOrder.pizzaId);
                if(p) { 
                  setSelectedPizza(p); 
                  setSlot(myOrder.slotTime); 
                  setSelectedAddIds(myOrder.addModificationIds || []); 
                  setSelectedRemoveIds(myOrder.removeModificationIds || []);
                  setIsEditing(true); 
                }
              }} variant="secondary" fullWidth className="!bg-[#F2F2F7] hover:!bg-[#E5E5EA]">
                Modifica Scelta
              </Button>
            )}
          </Card>
        )}

        {(!myOrder || isEditing) && !selectedPizza && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={18} />
              <Input 
                placeholder="Cerca la tua pizza..." 
                className="pl-10 !rounded-2xl border-none shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredPizzas.map(pizza => (
                <Card 
                  key={pizza.id} 
                  className="p-4 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => canOrder && setSelectedPizza(pizza)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-lg">{pizza.name}</h3>
                    {pizza.isVegetarian && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-black">VEG</span>}
                  </div>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">{pizza.ingredients?.join(', ')}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const isManagement = user.role === Role.ADMIN || user.role === Role.SUPERVISOR;

  return (
    <Layout 
      title={activeTab === 'menu' ? 'Menu Pizze' : 'Impostazioni'}
      onBack={activeTab === 'settings' ? () => setActiveTab('menu') : undefined}
    >
      {message && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-10 duration-500 ${
          message.type === 'success' ? 'bg-[#34C759] text-white' : 'bg-[#FF3B30] text-white'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold text-sm flex-1">{message.text}</p>
        </div>
      )}

      {activeTab === 'menu' ? renderMenu() : (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
           <div className="text-center py-6">
            <div className="w-20 h-20 bg-[#007AFF] rounded-full flex items-center justify-center text-white mx-auto shadow-xl mb-3">
              <UserIcon size={40} />
            </div>
            <h2 className="text-xl font-black">{user.firstName} {user.lastName}</h2>
            <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-widest mt-1">{user.role}</p>
          </div>
          <Card>
            <button onClick={onLogout} className="w-full p-4 flex justify-between items-center text-[#FF3B30] font-bold">
              <span>Esci</span>
              <LogOut size={20} />
            </button>
          </Card>

          {isManagement && onBackToAdmin && (
            <Card className="border-2 border-[#5856D6]">
              <button onClick={onBackToAdmin} className="w-full p-4 flex justify-between items-center text-[#5856D6] font-bold">
                <span>Pannello Admin</span>
                <Sliders size={20} />
              </button>
            </Card>
          )}
        </div>
      )}

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg ios-blur border-t border-[#C6C6C8] px-8 py-3 pb-8 flex justify-between items-center z-40">
        <button onClick={() => setActiveTab('menu')} className={`flex flex-col items-center gap-1 ${activeTab === 'menu' ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>
          <PizzaIcon size={24} />
          <span className="text-[10px] font-bold">Ordina</span>
        </button>
        
        {isManagement && onBackToAdmin && (
           <button onClick={onBackToAdmin} className="flex flex-col items-center gap-1 text-[#5856D6]">
             <Sliders size={24} />
             <span className="text-[10px] font-bold">Admin</span>
           </button>
        )}

        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>
          <Settings size={24} />
          <span className="text-[10px] font-bold">Impostazioni</span>
        </button>
      </nav>

      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setSelectedPizza(null)} />
          <div className="relative bg-[#F2F2F7] rounded-t-[32px] p-6 pb-12 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-[#C6C6C8] rounded-full mx-auto" />
            <h2 className="text-2xl font-black text-center">{selectedPizza.name}</h2>
            
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Orario di ritiro</p>
                <SegmentedControl options={SLOT_TIMES} selected={slot} onChange={(v) => setSlot(v as SlotTime)} />
              </section>

              <section className="space-y-3">
                <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Aggiunte (+)</p>
                <div className="bg-white rounded-2xl overflow-hidden divide-y divide-[#F2F2F7]">
                  {addOptions.map(opt => (
                    <button 
                      key={opt.id} 
                      onClick={() => handleToggleAdd(opt.id)}
                      className="w-full flex items-center justify-between p-4 active:bg-[#F2F2F7] transition-colors"
                    >
                      <span className="text-sm font-medium">{opt.name}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedAddIds.includes(opt.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'
                      }`}>
                        {selectedAddIds.includes(opt.id) && <Check size={14} className="text-white" />}
                      </div>
                    </button>
                  ))}
                  {addOptions.length === 0 && <p className="p-4 text-xs text-[#8E8E93] text-center">Nessuna opzione disponibile</p>}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Rimossoni (-)</p>
                <div className="bg-white rounded-2xl overflow-hidden divide-y divide-[#F2F2F7]">
                  {removeOptions.map(opt => (
                    <button 
                      key={opt.id} 
                      onClick={() => handleToggleRemove(opt.id)}
                      className="w-full flex items-center justify-between p-4 active:bg-[#F2F2F7] transition-colors"
                    >
                      <span className="text-sm font-medium">{opt.name}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedRemoveIds.includes(opt.id) ? 'bg-[#FF3B30] border-[#FF3B30]' : 'border-[#C6C6C8]'
                      }`}>
                        {selectedRemoveIds.includes(opt.id) && <Check size={14} className="text-white" />}
                      </div>
                    </button>
                  ))}
                   {removeOptions.length === 0 && <p className="p-4 text-xs text-[#8E8E93] text-center">Nessuna opzione disponibile</p>}
                </div>
              </section>

              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting}>
                {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : 'Invia Ordine'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WorkerDashboard;
