
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
        <div className="pt-6 pb-2">
          <h1 className="text-[34px] font-black text-[#1c1c1e] tracking-tight leading-[1.1]">
            Ciao! {user.firstName}
          </h1>
          <p className="text-xl font-bold text-[#8E8E93] mt-1">
            che pizza mangi oggi?
          </p>
        </div>

        {showClosedMessage && (
          <div className="bg-[#FF3B30] text-white p-5 rounded-3xl flex items-center gap-4 shadow-xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-3 bg-white/20 rounded-full shrink-0">
                <Lock size={28} />
            </div>
            <div className="flex-1">
              <p className="font-black text-lg tracking-tight">Servizio non attivo</p>
              <p className="text-sm font-medium opacity-90 leading-tight">
                {availability.label.includes('OLTRE') 
                    ? `Gli ordini per oggi sono chiusi. L'orario limite era alle ${settings?.cutoff_time}.`
                    : availability.label.includes('FORZATO')
                    ? "Oggi il locale ha forzato la chiusura degli ordini staff."
                    : "Oggi non è un giorno previsto per le pizze staff."
                }
              </p>
            </div>
          </div>
        )}

        {myOrder && !selectedPizza && !isEditing && (
          <Card className={`p-6 border-2 max-w-2xl mx-auto ${availability.isActive ? 'border-[#34C759] shadow-lg' : 'border-[#C6C6C8] opacity-80 grayscale'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              <div className="flex-1">
                <p className={`text-[11px] font-black ${availability.isActive ? 'text-[#34C759]' : 'text-[#8E8E93]'} uppercase tracking-[0.2em] mb-2`}>La tua scelta per oggi</p>
                <h2 className="text-3xl font-black">{pizzas.find(p => p.id === myOrder.pizzaId)?.name || 'Pizza'}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {myOrder.addModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-xs font-black px-2.5 py-1 rounded-full bg-green-100 text-green-700">+{mod.name}</span> : null;
                  })}
                  {myOrder.removeModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-xs font-black px-2.5 py-1 rounded-full bg-red-100 text-red-700">-{mod.name}</span> : null;
                  })}
                </div>
              </div>
              <div className="bg-[#F2F2F7] px-4 py-2 rounded-2xl flex items-center gap-2 self-start sm:self-center">
                <ClockIcon size={18} className="text-[#8E8E93]" />
                <span className="text-lg font-black">{myOrder.slotTime}</span>
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
              }} variant="secondary" fullWidth className="!bg-[#F2F2F7] hover:!bg-[#E5E5EA] !py-4">
                Modifica Scelta
              </Button>
            )}
          </Card>
        )}

        {(!myOrder || isEditing) && !selectedPizza && (
          <div className={`space-y-6 ${!canOrder ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={20} />
                <Input 
                  placeholder="Cerca pizza o ingredienti..." 
                  className="pl-12 !py-4 !rounded-2xl border-none shadow-md focus:shadow-lg transition-shadow bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPizzas.map(pizza => (
                <Card 
                  key={pizza.id} 
                  className="p-5 cursor-pointer hover:shadow-xl active:scale-95 transition-all flex flex-col h-full border border-transparent hover:border-[#007AFF]/20"
                  onClick={() => canOrder && setSelectedPizza(pizza)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-xl text-[#1c1c1e]">{pizza.name}</h3>
                    {pizza.isVegetarian && (
                      <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider shrink-0">VEG</span>
                    )}
                  </div>
                  <p className="text-sm text-[#8E8E93] leading-relaxed flex-1 italic">
                    {pizza.ingredients?.join(', ')}
                  </p>
                  <div className="mt-4 pt-4 border-t border-[#F2F2F7] flex justify-end">
                    <span className="text-[#007AFF] text-xs font-black uppercase tracking-widest">Scegli</span>
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
      title={activeTab === 'menu' ? 'Dashboard' : 'Il mio Profilo'}
      onBack={activeTab === 'settings' ? () => setActiveTab('menu') : undefined}
    >
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500 shadow-lg">
            <Check size={48} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black text-[#1c1c1e] tracking-tight">Ordine Inviato!</h2>
          <p className="text-[#8E8E93] font-bold mt-2 uppercase tracking-[0.3em] text-xs">Buon appetito</p>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md p-4 rounded-2xl shadow-2xl bg-[#FF3B30] text-white flex items-center gap-3 animate-in slide-in-from-top-10 duration-500">
          <AlertCircle size={24} className="shrink-0" />
          <p className="font-bold text-sm flex-1">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={20} /></button>
        </div>
      )}

      {activeTab === 'menu' ? renderMenu() : (
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right duration-300">
           <Card className="p-8 text-center bg-white shadow-xl">
            <div className="w-24 h-24 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-full flex items-center justify-center text-white mx-auto shadow-xl mb-4">
              <UserIcon size={48} />
            </div>
            <h2 className="text-2xl font-black text-[#1c1c1e]">{user.firstName} {user.lastName}</h2>
            <p className="text-sm font-black text-[#007AFF] uppercase tracking-widest mt-1 bg-[#F2F2F7] inline-block px-4 py-1 rounded-full">{user.role}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
              <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-2">Sicurezza</p>
              <Card className="overflow-hidden">
                {isBioSupported ? (
                  <div className="p-5 flex items-center justify-between hover:bg-[#F2F2F7] transition-colors cursor-pointer" onClick={() => !biometricEnabled && registerBiometrics(user.id, user.firstName).then(s => s && setBiometricEnabled(true))}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                        <Fingerprint size={24} />
                      </div>
                      <div>
                        <p className="text-base font-bold">Biometria</p>
                        <p className="text-xs text-[#8E8E93] font-bold uppercase tracking-tighter">Accesso rapido</p>
                      </div>
                    </div>
                    <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 cursor-pointer ${
                      biometricEnabled ? 'bg-[#34C759]' : 'bg-[#C6C6C8]'
                    }`}>
                      <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        biometricEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex items-center gap-3 opacity-50 grayscale">
                    <Fingerprint size={24} className="text-gray-400" />
                    <p className="text-sm font-bold">Biometria non disponibile</p>
                  </div>
                )}
              </Card>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-2">Sistema</p>
              <Card className="divide-y divide-[#F2F2F7]">
                {isManagement && onBackToAdmin && (
                  <button onClick={onBackToAdmin} className="w-full p-5 flex justify-between items-center text-[#5856D6] font-bold hover:bg-[#F2F2F7] transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#F2F2F7] text-[#5856D6] rounded-2xl group-hover:bg-[#5856D6] group-hover:text-white transition-colors">
                        <Sliders size={20} />
                      </div>
                      <span>Dashboard Gestionale</span>
                    </div>
                  </button>
                )}
                <button onClick={onLogout} className="w-full p-5 flex justify-between items-center text-[#FF3B30] font-bold hover:bg-red-50 transition-all group">
                   <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-red-50 text-[#FF3B30] rounded-2xl group-hover:bg-[#FF3B30] group-hover:text-white transition-colors">
                        <LogOut size={20} />
                      </div>
                      <span>Disconnetti</span>
                    </div>
                </button>
              </Card>
            </section>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 ios-blur border-t border-[#C6C6C8] py-3 pb-8 md:pb-6 flex justify-center z-40">
        <div className="w-full max-w-2xl px-12 flex justify-between items-center">
          <button 
            onClick={() => setActiveTab('menu')} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'menu' ? 'text-[#007AFF] scale-110 font-bold' : 'text-[#8E8E93] opacity-60 hover:opacity-100'}`}
          >
            <PizzaIcon size={26} />
            <span className="text-[11px] font-black uppercase tracking-tighter">Menu</span>
          </button>
          
          {isManagement && onBackToAdmin && (
             <button onClick={onBackToAdmin} className="flex flex-col items-center gap-1 text-[#5856D6] hover:scale-110 transition-transform">
               <Sliders size={26} />
               <span className="text-[11px] font-black uppercase tracking-tighter">Admin</span>
             </button>
          )}

          <button 
            onClick={() => setActiveTab('settings')} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-[#007AFF] scale-110 font-bold' : 'text-[#8E8E93] opacity-60 hover:opacity-100'}`}
          >
            <Settings size={26} />
            <span className="text-[11px] font-black uppercase tracking-tighter">Profilo</span>
          </button>
        </div>
      </nav>

      {/* Pannello Selezione Pizza - Responsive */}
      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && setSelectedPizza(null)} />
          <div className="relative bg-[#F2F2F7] w-full max-w-4xl rounded-t-[40px] p-6 pb-12 space-y-8 shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-y-auto max-h-[92vh]">
            <div className="w-16 h-1.5 bg-[#C6C6C8] rounded-full mx-auto" />
            
            <div className="text-center">
              <h2 className="text-3xl font-black text-[#1c1c1e]">{selectedPizza.name}</h2>
              <p className="text-sm text-[#8E8E93] mt-1 font-medium">{selectedPizza.ingredients?.join(', ')}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-4">
                <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Orario di ritiro</p>
                <div className="bg-white p-2 rounded-3xl shadow-sm">
                  <SegmentedControl options={SLOT_TIMES} selected={slot} onChange={(v) => setSlot(v as SlotTime)} />
                </div>
                
                <div className="hidden md:block pt-4">
                   <Button fullWidth onClick={() => setShowRecap(true)} disabled={submitting} className="!py-5 !text-lg">
                    Rivedi Ordine
                  </Button>
                </div>
              </section>

              <div className="space-y-6">
                <section className="space-y-3">
                  <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Aggiunte (+)</p>
                  <div className="bg-white rounded-[24px] shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {addOptions.length === 0 && <p className="p-4 text-xs text-center text-gray-400 italic">Nessuna aggiunta disponibile</p>}
                    {addOptions.map(opt => (
                      <button 
                        key={opt.id} 
                        onClick={() => handleToggleAdd(opt.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-[#F2F2F7] transition-colors"
                      >
                        <span className="text-sm font-bold text-[#1c1c1e]">{opt.name}</span>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedAddIds.includes(opt.id) ? 'bg-[#007AFF] border-[#007AFF] shadow-md' : 'border-[#C6C6C8]'
                        }`}>
                          {selectedAddIds.includes(opt.id) && <Check size={16} className="text-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.2em] pl-1">Rimozioni (-)</p>
                  <div className="bg-white rounded-[24px] shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {removeOptions.length === 0 && <p className="p-4 text-xs text-center text-gray-400 italic">Nessuna rimozione disponibile</p>}
                    {removeOptions.map(opt => (
                      <button 
                        key={opt.id} 
                        onClick={() => handleToggleRemove(opt.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-[#F2F2F7] transition-colors"
                      >
                        <span className="text-sm font-bold text-[#1c1c1e]">{opt.name}</span>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedRemoveIds.includes(opt.id) ? 'bg-[#FF3B30] border-[#FF3B30] shadow-md' : 'border-[#C6C6C8]'
                        }`}>
                          {selectedRemoveIds.includes(opt.id) && <Check size={16} className="text-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="md:hidden">
              <Button fullWidth onClick={() => setShowRecap(true)} disabled={submitting} className="!py-5 !text-lg">
                Rivedi Ordine
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recap Overlay - Responsive Width */}
      {showRecap && selectedPizza && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !submitting && setShowRecap(false)} />
          <Card className="relative w-full max-w-lg p-8 space-y-6 shadow-2xl bg-white rounded-[32px]">
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-black text-[#1c1c1e] tracking-tight">Riepilogo</h3>
              <p className="text-xs text-[#8E8E93] font-bold uppercase tracking-[0.2em]">Conferma la tua scelta finale</p>
            </div>

            <div className="bg-[#F2F2F7] p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#007AFF] text-white rounded-2xl shadow-lg">
                  <PizzaIcon size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Pizza selezionata</p>
                  <p className="text-xl font-black">{selectedPizza.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FF9500] text-white rounded-2xl shadow-lg">
                  <ClockIcon size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Orario di ritiro</p>
                  <p className="text-xl font-black">{slot}</p>
                </div>
              </div>

              {(selectedAddIds.length > 0 || selectedRemoveIds.length > 0) && (
                <div className="pt-4 border-t border-[#C6C6C8]/30 space-y-2">
                  <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Personalizzazioni</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAddIds.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[10px] font-black bg-green-100 text-green-700 px-3 py-1 rounded-full shadow-sm">+{m.name}</span> : null;
                    })}
                    {selectedRemoveIds.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[10px] font-black bg-red-100 text-red-700 px-3 py-1 rounded-full shadow-sm">-{m.name}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting} className="!py-5 !text-lg">
                {submitting ? <div className="loading-spinner !w-6 !h-6 border-white border-t-transparent" /> : 'Invia Ordine'}
              </Button>
              <button 
                onClick={() => setShowRecap(false)}
                disabled={submitting}
                className="w-full py-2 text-xs font-black text-[#8E8E93] uppercase tracking-[0.2em] hover:text-[#1c1c1e] transition-colors"
              >
                Torna a modificare
              </button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};

export default WorkerDashboard;
