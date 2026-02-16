import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, Order, SlotTime, DayStatus, Modification, Role, DayOverride } from '../types';
import { db, GlobalSettings } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, SegmentedControl, Input } from '../components/UI';
import { 
  PizzaIcon, 
  ClockIcon, 
  Search, 
  Check, 
  AlertCircle, 
  X, 
  Lock, 
  Settings, 
  UserIcon,
  LogOut,
  Sliders,
  Fingerprint
} from '../components/Icons';
import { isBeforeCutoff, getDayAvailability, getTodayDateString } from '../services/utils';
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
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [slot, setSlot] = useState<SlotTime>('18:00');
  const [selectedAddIds, setSelectedAddIds] = useState<string[]>([]);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [isBioSupported, setIsBioSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('pizzastaff_biometric_enabled') === 'true');

  useEffect(() => {
    const checkBio = async () => {
      const available = await isBiometricAvailable();
      setIsBioSupported(available);
    };
    checkBio();
  }, []);

  const availability = useMemo(() => {
    const today = getTodayDateString();
    return getDayAvailability(
        today, 
        settings?.active_days || [], 
        overrides, 
        currentDay,
        settings?.cutoff_time || '16:30'
    );
  }, [settings, overrides, currentDay]);

  const canOrder = useMemo(() => {
    if (settings?.override_cutoff) return true;
    return availability.isActive;
  }, [availability, settings]);

  const addOptions = useMemo(() => modifications.filter(m => m.type === 'ADD' && m.active), [modifications]);
  const removeOptions = useMemo(() => modifications.filter(m => m.type === 'REMOVE' && m.active), [modifications]);

  const handleToggleAdd = (id: string) => {
    setSelectedAddIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleRemove = (id: string) => {
    setSelectedRemoveIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pizzaList, modList, day, order, globalSettings, dayOverrides] = await Promise.all([
          db.getPizzas(),
          db.getModifications(),
          db.getCurrentDay(),
          db.getUserOrderToday(user.id),
          db.getSettings(),
          db.getOverrides()
        ]);
        setPizzas(pizzaList.filter(p => p.active));
        setModifications(modList || []);
        setCurrentDay(day);
        setMyOrder(order);
        setSettings(globalSettings);
        setOverrides(dayOverrides);
      } catch (err: any) {
        setErrorMessage(err.message || "Errore nel caricamento dei dati");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const handleConfirmOrder = async () => {
    if (!selectedPizza) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const order: Partial<Order> = {
        id: myOrder?.id,
        dayId: currentDay?.id, 
        userId: user.id,
        pizzaId: selectedPizza.id,
        slotTime: slot,
        addModificationIds: selectedAddIds,
        removeModificationIds: selectedRemoveIds,
        note: ''
      };
      await db.saveOrder(order);
      setShowRecap(false);
      setShowSuccess(true);
      setSelectedPizza(null);
      setTimeout(() => onLogout(), 2000);
    } catch (err: any) {
      setErrorMessage(err.message || "Errore durante il salvataggio");
      setSubmitting(false);
    }
  };

  const renderMenu = () => {
    const filteredPizzas = pizzas.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.ingredients?.some(i => i.toLowerCase().includes(search.toLowerCase()))
    );

    const showClosedMessage = !canOrder;

    return (
      <div className="space-y-6">
        <div className="pt-2 pb-2">
          <h1 className="text-[32px] font-black text-[#1c1c1e] tracking-tight leading-[1.1]">
            Ciao {user.firstName}!
          </h1>
          <p className="text-lg font-bold text-[#8E8E93] mt-1">
            Quale pizza ordiniamo?
          </p>
        </div>

        {showClosedMessage && (
          <div className="bg-[#FF3B30] text-white p-5 rounded-3xl flex items-center gap-4 shadow-xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-3 bg-white/20 rounded-full shrink-0">
                <Lock size={24} />
            </div>
            <div className="flex-1">
              <p className="font-black text-base tracking-tight">Servizio non attivo</p>
              <p className="text-xs font-medium opacity-90 leading-tight">
                {availability.label.includes('OLTRE') 
                    ? `Chiuso alle ${settings?.cutoff_time}.`
                    : "Servizio non disponibile per oggi."
                }
              </p>
            </div>
          </div>
        )}

        {myOrder && !selectedPizza && !isEditing && (
          <Card className={`p-6 border-2 max-w-2xl mx-auto ${availability.isActive ? 'border-[#34C759] shadow-lg' : 'border-[#C6C6C8] opacity-80 grayscale'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              <div className="flex-1">
                <p className={`text-[10px] font-black ${availability.isActive ? 'text-[#34C759]' : 'text-[#8E8E93]'} uppercase tracking-[0.2em] mb-2`}>Il tuo ordine</p>
                <h2 className="text-2xl font-black">{pizzas.find(p => p.id === myOrder.pizzaId)?.name || 'Pizza'}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {myOrder.addModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-[10px] font-black px-2.5 py-1 rounded-full bg-green-100 text-green-700">+{mod.name}</span> : null;
                  })}
                  {myOrder.removeModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-[10px] font-black px-2.5 py-1 rounded-full bg-red-100 text-red-700">-{mod.name}</span> : null;
                  })}
                </div>
              </div>
              <div className="bg-[#F2F2F7] px-4 py-2 rounded-2xl flex items-center gap-2 self-start sm:self-center">
                <ClockIcon size={16} className="text-[#8E8E93]" />
                <span className="text-base font-black">{myOrder.slotTime}</span>
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
              }} variant="secondary" fullWidth className="!bg-[#F2F2F7] hover:!bg-[#E5E5EA] !py-3.5">
                Modifica Scelta
              </Button>
            )}
          </Card>
        )}

        {(!myOrder || isEditing) && !selectedPizza && (
          <div className={`space-y-6 ${!canOrder ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={18} />
                <Input 
                  placeholder="Cerca pizza o ingredienti..." 
                  className="pl-11 !py-3.5 !rounded-2xl border-none shadow-sm focus:shadow-md transition-shadow bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPizzas.map(pizza => (
                <Card 
                  key={pizza.id} 
                  className="p-4 cursor-pointer hover:shadow-lg active:scale-95 transition-all flex flex-col h-full border border-transparent hover:border-[#007AFF]/10"
                  onClick={() => canOrder && setSelectedPizza(pizza)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-lg text-[#1c1c1e]">{pizza.name}</h3>
                    {pizza.isVegetarian && (
                      <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded-full font-black tracking-wider shrink-0">VEG</span>
                    )}
                  </div>
                  <p className="text-xs text-[#8E8E93] leading-relaxed flex-1 italic">
                    {pizza.ingredients?.join(', ')}
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#F2F2F7] flex justify-end">
                    <span className="text-[#007AFF] text-[10px] font-black uppercase tracking-widest">Scegli</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isManagement = user.role === Role.ADMIN || user.role === Role.SUPERVISOR;

  return (
    <Layout 
      title={activeTab === 'menu' ? 'Menu Pizze' : 'Il mio Profilo'}
      onBack={activeTab === 'settings' ? () => setActiveTab('menu') : undefined}
    >
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500 shadow-lg">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-black text-[#1c1c1e] tracking-tight">Ordine Inviato!</h2>
          <p className="text-[#8E8E93] font-bold mt-2 uppercase tracking-[0.3em] text-[10px]">A presto in cucina</p>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-safe-plus-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md p-4 rounded-2xl shadow-2xl bg-[#FF3B30] text-white flex items-center gap-3 animate-in slide-in-from-top-10 duration-500">
          <AlertCircle size={20} className="shrink-0" />
          <p className="font-bold text-xs flex-1">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={18} /></button>
        </div>
      )}

      {activeTab === 'menu' ? renderMenu() : (
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right duration-300">
           <Card className="p-8 text-center bg-white shadow-xl">
            <div className="w-20 h-20 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-full flex items-center justify-center text-white mx-auto shadow-lg mb-4">
              <UserIcon size={40} />
            </div>
            <h2 className="text-xl font-black text-[#1c1c1e]">{user.firstName} {user.lastName}</h2>
            <p className="text-[10px] font-black text-[#007AFF] uppercase tracking-widest mt-1 bg-[#F2F2F7] inline-block px-4 py-1 rounded-full">{user.role}</p>
          </Card>

          <div className="grid grid-cols-1 gap-6">
            <section className="space-y-3">
              <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Sicurezza e Accesso</p>
              <Card className="overflow-hidden">
                {isBioSupported ? (
                  <div className="p-4 flex items-center justify-between hover:bg-[#F2F2F7] transition-colors cursor-pointer" onClick={() => !biometricEnabled && registerBiometrics(user.id, user.firstName).then(s => s && setBiometricEnabled(true))}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                        <Fingerprint size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Biometria</p>
                        <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-tighter">Face ID / Impronta</p>
                      </div>
                    </div>
                    <div className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 cursor-pointer ${
                      biometricEnabled ? 'bg-[#34C759]' : 'bg-[#C6C6C8]'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        biometricEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3 opacity-50 grayscale">
                    <Fingerprint size={20} className="text-gray-400" />
                    <p className="text-xs font-bold">Biometria non disponibile su questo dispositivo</p>
                  </div>
                )}
              </Card>
            </section>

            <section className="space-y-3">
              <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Azioni</p>
              <Card className="divide-y divide-[#F2F2F7]">
                {isManagement && onBackToAdmin && (
                  <button onClick={onBackToAdmin} className="w-full p-4 flex justify-between items-center text-[#5856D6] font-bold hover:bg-[#F2F2F7] transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#F2F2F7] text-[#5856D6] rounded-xl group-hover:bg-[#5856D6] group-hover:text-white transition-colors">
                        <Sliders size={18} />
                      </div>
                      <span className="text-sm">Gestione Locale</span>
                    </div>
                  </button>
                )}
                <button onClick={onLogout} className="w-full p-4 flex justify-between items-center text-[#FF3B30] font-bold hover:bg-red-50 transition-all group">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 text-[#FF3B30] rounded-xl group-hover:bg-[#FF3B30] group-hover:text-white transition-colors">
                        <LogOut size={18} />
                      </div>
                      <span className="text-sm">Esci dall'app</span>
                    </div>
                </button>
              </Card>
            </section>
          </div>
        </div>
      )}

      {/* Navigazione fissata al fondo rispettando la Safe Area di iPhone */}
      <nav className="fixed bottom-0 left-0 right-0 ios-blur border-t border-[#C6C6C8] pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center z-40">
        <div className="w-full max-w-lg px-8 flex justify-between items-center">
          <button 
            onClick={() => setActiveTab('menu')} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'menu' ? 'text-[#007AFF] scale-110 font-bold' : 'text-[#8E8E93] opacity-60'}`}
          >
            <PizzaIcon size={24} />
            <span className="text-[10px] font-black uppercase tracking-tighter">Menu</span>
          </button>
          
          {isManagement && onBackToAdmin && (
             <button onClick={onBackToAdmin} className="flex flex-col items-center gap-1 text-[#5856D6] active:scale-110 transition-transform">
               <Sliders size={24} />
               <span className="text-[10px] font-black uppercase tracking-tighter">Admin</span>
             </button>
          )}

          <button 
            onClick={() => setActiveTab('settings')} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-[#007AFF] scale-110 font-bold' : 'text-[#8E8E93] opacity-60'}`}
          >
            <Settings size={24} />
            <span className="text-[10px] font-black uppercase tracking-tighter">Profilo</span>
          </button>
        </div>
      </nav>

      {/* Pannello Selezione Pizza - Supporto Safe Area iPhone */}
      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setSelectedPizza(null)} />
          <div className="relative bg-[#F2F2F7] w-full max-w-lg rounded-t-[32px] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-y-auto max-h-[92dvh] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
            <div className="w-12 h-1.5 bg-[#C6C6C8] rounded-full mx-auto shrink-0 mb-2" />
            
            <div className="text-center">
              <h2 className="text-2xl font-black text-[#1c1c1e]">{selectedPizza.name}</h2>
              <p className="text-xs text-[#8E8E93] mt-1 font-medium">{selectedPizza.ingredients?.join(', ')}</p>
            </div>
            
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Orario ritiro</p>
                <div className="bg-white p-2 rounded-2xl shadow-sm">
                  <SegmentedControl options={SLOT_TIMES} selected={slot} onChange={(v) => setSlot(v as SlotTime)} />
                </div>
              </section>

              <div className="space-y-6">
                <section className="space-y-3">
                  <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Aggiungi (+)</p>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {addOptions.length === 0 && <p className="p-4 text-[10px] text-center text-gray-400 italic">Nessun ingrediente extra</p>}
                    {addOptions.map(opt => (
                      <button 
                        key={opt.id} 
                        onClick={() => handleToggleAdd(opt.id)}
                        className="w-full flex items-center justify-between p-3.5 active:bg-[#F2F2F7] transition-colors"
                      >
                        <span className="text-sm font-bold text-[#1c1c1e]">{opt.name}</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedAddIds.includes(opt.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'
                        }`}>
                          {selectedAddIds.includes(opt.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Togli (-)</p>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {removeOptions.length === 0 && <p className="p-4 text-[10px] text-center text-gray-400 italic">Nessuna rimozione</p>}
                    {removeOptions.map(opt => (
                      <button 
                        key={opt.id} 
                        onClick={() => handleToggleRemove(opt.id)}
                        className="w-full flex items-center justify-between p-3.5 active:bg-[#F2F2F7] transition-colors"
                      >
                        <span className="text-sm font-bold text-[#1c1c1e]">{opt.name}</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedRemoveIds.includes(opt.id) ? 'bg-[#FF3B30] border-[#FF3B30]' : 'border-[#C6C6C8]'
                        }`}>
                          {selectedRemoveIds.includes(opt.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              
              <Button fullWidth onClick={() => setShowRecap(true)} disabled={submitting} className="!py-4 !text-lg">
                Conferma Ordine
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recap Overlay */}
      {showRecap && selectedPizza && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => !submitting && setShowRecap(false)} />
          <Card className="relative w-full max-w-xs p-6 space-y-6 shadow-2xl bg-white rounded-[28px]">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-[#1c1c1e] tracking-tight">Riepilogo</h3>
              <p className="text-[9px] text-[#8E8E93] font-bold uppercase tracking-[0.2em]">Verifica il tuo ordine</p>
            </div>

            <div className="bg-[#F2F2F7] p-4 rounded-2xl space-y-3">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-[#8E8E93] uppercase">Pizza</p>
                  <p className="text-lg font-black">{selectedPizza.name}</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-[#8E8E93] uppercase">Orario</p>
                  <p className="text-lg font-black">{slot}</p>
                </div>

              {(selectedAddIds.length > 0 || selectedRemoveIds.length > 0) && (
                <div className="pt-3 border-t border-[#C6C6C8]/20 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAddIds.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">+{m.name}</span> : null;
                    })}
                    {selectedRemoveIds.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full">-{m.name}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting} className="!py-4 !text-base shadow-lg">
                {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : 'SÌ, INVIA ORA'}
              </Button>
              <button 
                onClick={() => setShowRecap(false)}
                disabled={submitting}
                className="w-full py-2 text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em]"
              >
                Annulla
              </button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};

export default WorkerDashboard;