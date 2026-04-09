import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, Order, SlotTime, Modification, Role, DayOverride } from '../types';
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
import { getDayAvailability, getTodayDateString } from '../services/utils';
import { SLOT_TIMES } from '../constants';
import { isBiometricAvailable, registerPasskey, revokePasskeys } from '../services/biometrics';

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
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('pizzastaff_passkey_active') === 'true');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const checkBio = async () => {
      const available = await isBiometricAvailable();
      setIsBioSupported(available);
      
      const serverHasPasskeys = await db.hasPasskeys(user.id);
      if (serverHasPasskeys) {
        localStorage.setItem('pizzastaff_passkey_active', 'true');
        setBiometricEnabled(true);
      } else {
        localStorage.removeItem('pizzastaff_passkey_active');
        setBiometricEnabled(false);
      }
    };
    checkBio();
  }, [user.id]);

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
    setSelectedAddIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleRemove = (id: string) => {
    setSelectedRemoveIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

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
      setErrorMessage(err.message || "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const handleConfirmOrder = async () => {
    if (!selectedPizza) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // Usiamo una variabile locale per il dayId per sicurezza durante l'invio
      const targetDayId = currentDay?.id || undefined;
      
      const orderPayload: Partial<Order> = {
        id: myOrder?.id,
        dayId: targetDayId,
        userId: user.id,
        pizzaId: selectedPizza.id,
        slotTime: slot,
        addModificationIds: selectedAddIds,
        removeModificationIds: selectedRemoveIds,
        note: ''
      };

      await db.saveOrder(orderPayload);
      
      // Recupero immediato dell'ordine salvato per aggiornare la UI locale
      const updatedOrder = await db.getUserOrderToday(user.id);
      setMyOrder(updatedOrder);
      
      // Reset stati UI
      setShowRecap(false);
      setSelectedPizza(null);
      setIsEditing(false);
      setShowSuccess(true);
    } catch (err: any) {
      console.error("Errore ordine:", err);
      setErrorMessage(err.message || "Errore durante il salvataggio. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePasskey = async () => {
    setActionLoading(true);
    try {
      if (biometricEnabled) {
        if (confirm("Vuoi disattivare l'accesso biometrico su tutti i dispositivi?")) {
          await revokePasskeys(user.id);
          setBiometricEnabled(false);
          alert("Accesso rapido disattivato.");
        }
      } else {
        const success = await registerPasskey(user.id);
        if (success) {
          setBiometricEnabled(true);
          alert("Accesso rapido con Face ID / Impronta attivato ✅");
        }
      }
    } catch (err: any) {
      alert("Errore biometria: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderMenu = () => {
    const filteredPizzas = pizzas.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.ingredients?.some(i => i.toLowerCase().includes(search.toLowerCase()))
    );

    return (
      <div className="space-y-5">
        <div className="pt-2 pb-1">
          <h1 className="text-[28px] font-black text-[#1c1c1e] tracking-tight leading-[1.1]">Ciao {user.firstName}!</h1>
          <p className="text-base font-bold text-[#8E8E93] mt-1">Scegli la tua pizza di oggi.</p>
        </div>

        {errorMessage && (errorMessage.includes('pizzas') || errorMessage.includes('settings')) && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 text-[#FF3B30]">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold">Configurazione Database Necessaria</p>
                <p className="text-xs opacity-80">Le tabelle del database non sono state trovate. Contatta l'amministratore per eseguire lo script di setup in Supabase.</p>
              </div>
            </div>
          </div>
        )}

        {!canOrder && (
          <div className="bg-[#FF3B30] text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-white/20 rounded-full shrink-0"><Lock size={20} /></div>
            <div className="flex-1">
              <p className="font-black text-sm tracking-tight">Servizio non attivo</p>
              <p className="text-[10px] font-medium opacity-90 leading-tight">
                {availability.label.includes('OLTRE') ? `Gli ordini sono terminati alle ${settings?.cutoff_time}.` : "Servizio non disponibile per oggi."}
              </p>
            </div>
          </div>
        )}

        {myOrder && !selectedPizza && !isEditing && (
          <Card className={`p-5 border-2 max-w-2xl mx-auto ${availability.isActive ? 'border-[#34C759] shadow-lg' : 'border-[#C6C6C8] opacity-80 grayscale'}`}>
            <div className="flex justify-between items-start gap-3 mb-5">
              <div className="flex-1">
                <p className={`text-[9px] font-black ${availability.isActive ? 'text-[#34C759]' : 'text-[#8E8E93]'} uppercase tracking-[0.2em] mb-1.5`}>Il tuo ordine attuale</p>
                <h2 className="text-xl font-black truncate">{pizzas.find(p => p.id === myOrder.pizzaId)?.name || 'Pizza'}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {myOrder.addModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700">+{mod.name}</span> : null;
                  })}
                  {myOrder.removeModificationIds?.map(id => {
                    const mod = modifications.find(m => m.id === id);
                    return mod ? <span key={id} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">-{mod.name}</span> : null;
                  })}
                </div>
              </div>
              <div className="bg-[#F2F2F7] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <ClockIcon size={14} className="text-[#8E8E93]" />
                <span className="text-sm font-black">{myOrder.slotTime}</span>
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
              }} variant="secondary" fullWidth className="!bg-[#F2F2F7] !py-3">Cambia Scelta</Button>
            )}
          </Card>
        )}

        {(!myOrder || isEditing) && !selectedPizza && (
          <div className={`space-y-5 ${!canOrder ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
              <Input placeholder="Cerca pizza..." className="pl-10 !py-3 !rounded-xl border-none shadow-sm bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
              {filteredPizzas.map(pizza => (
                <Card key={pizza.id} className="p-4 cursor-pointer hover:shadow-md active:scale-[0.97] transition-all flex flex-col h-full border border-transparent hover:border-[#007AFF]/10" onClick={() => canOrder && setSelectedPizza(pizza)}>
                  <div className="flex justify-between items-start mb-1.5">
                    <h3 className="font-black text-base text-[#1c1c1e] truncate pr-2">{pizza.name}</h3>
                    {pizza.isVegetarian && <span className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded-full font-black tracking-wider shrink-0">VEG</span>}
                  </div>
                  <p className="text-[11px] text-[#8E8E93] leading-snug flex-1 italic line-clamp-2">{pizza.ingredients?.join(', ')}</p>
                  <div className="mt-3 pt-2 border-t border-[#F2F2F7] flex justify-end">
                    <span className="text-[#007AFF] text-[9px] font-black uppercase tracking-widest">Scegli</span>
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
    <Layout title={activeTab === 'menu' ? 'InTavola Staff' : 'Profilo'} onBack={activeTab === 'settings' ? () => setActiveTab('menu') : undefined}>
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-5 animate-in zoom-in duration-500 shadow-md"><Check size={32} strokeWidth={3} /></div>
          <h2 className="text-2xl font-black text-[#1c1c1e] tracking-tight">Ordine Inviato!</h2>
          <p className="text-[#8E8E93] font-bold mt-1.5 uppercase tracking-widest text-[9px] mb-8 text-center">Troverai la pizza pronta all'orario scelto.</p>
          <div className="w-full max-w-xs space-y-3">
            <Button fullWidth onClick={() => { setShowSuccess(false); setActiveTab('menu'); }}>Torna al Menu</Button>
            <Button fullWidth variant="ghost" onClick={onLogout}>Esci dall'App</Button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm p-4 rounded-xl shadow-2xl bg-[#FF3B30] text-white flex items-center gap-3 animate-in slide-in-from-top-10 duration-500">
          <AlertCircle size={20} className="shrink-0" />
          <p className="font-bold text-xs flex-1">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={16} /></button>
        </div>
      )}

      {activeTab === 'menu' ? renderMenu() : (
        <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right duration-300">
           <Card className="p-6 text-center bg-white shadow-md">
            <div className="w-16 h-16 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-full flex items-center justify-center text-white mx-auto shadow-md mb-4"><UserIcon size={32} /></div>
            <h2 className="text-lg font-black text-[#1c1c1e]">{user.firstName} {user.lastName}</h2>
            <p className="text-[9px] font-black text-[#007AFF] uppercase tracking-widest mt-1 bg-[#F2F2F7] inline-block px-3 py-0.5 rounded-full">{user.role}</p>
          </Card>

          <div className="grid grid-cols-1 gap-5">
            <section className="space-y-2">
              <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Sicurezza</p>
              <Card className="overflow-hidden">
                {isBioSupported ? (
                  <div className="p-4 flex items-center justify-between hover:bg-[#F2F2F7] transition-colors cursor-pointer" onClick={handleTogglePasskey}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                        <Fingerprint size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Accesso Rapido</p>
                        <p className="text-[9px] text-[#8E8E93] font-bold tracking-tight">Face ID / Touch ID</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {actionLoading && <div className="loading-spinner" />}
                      <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-1 ${biometricEnabled ? 'bg-[#34C759]' : 'bg-[#C6C6C8]'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${biometricEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3 opacity-50 grayscale bg-gray-50">
                    <Fingerprint size={18} className="text-gray-400" />
                    <p className="text-[10px] font-bold">Biometria non supportata</p>
                  </div>
                )}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                   <p className="text-[10px] text-gray-500 italic">La passkey resta sul dispositivo. Se cambi telefono, usa il PIN.</p>
                </div>
              </Card>
            </section>

            <section className="space-y-2">
              <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Account</p>
              <Card className="divide-y divide-[#F2F2F7]">
                {isManagement && onBackToAdmin && (
                  <button onClick={onBackToAdmin} className="w-full p-4 flex justify-between items-center text-[#5856D6] font-bold active:bg-[#F2F2F7] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-[#F2F2F7] text-[#5856D6] rounded-lg"><Sliders size={16} /></div>
                      <span className="text-xs">Torna al Gestionale</span>
                    </div>
                  </button>
                )}
                <button onClick={onLogout} className="w-full p-4 flex justify-between items-center text-[#FF3B30] font-bold active:bg-red-50 transition-all">
                   <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-red-50 text-[#FF3B30] rounded-lg"><LogOut size={16} /></div>
                      <span className="text-xs">Esci dall'app</span>
                    </div>
                </button>
              </Card>
            </section>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 ios-blur border-t border-[#C6C6C8] pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-center z-40">
        <div className="w-full max-w-lg px-10 flex justify-between items-center">
          <button onClick={() => setActiveTab('menu')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'menu' ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93] opacity-60'}`}>
            <PizzaIcon size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">Menu</span>
          </button>
          {isManagement && onBackToAdmin && (
             <button onClick={onBackToAdmin} className="flex flex-col items-center gap-1 text-[#5856D6] active:scale-105 transition-transform">
               <Sliders size={22} />
               <span className="text-[9px] font-black uppercase tracking-tighter">Admin</span>
             </button>
          )}
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93] opacity-60'}`}>
            <Settings size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">Profilo</span>
          </button>
        </div>
      </nav>

      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setSelectedPizza(null)} />
          <div className="relative bg-[#F2F2F7] w-full max-w-lg rounded-t-[28px] p-5 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-y-auto max-h-[90dvh] pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <button 
              onClick={() => !submitting && setSelectedPizza(null)}
              className="absolute top-4 right-4 p-2 bg-[#C6C6C8]/20 hover:bg-[#C6C6C8]/40 rounded-full text-[#8E8E93] transition-colors z-10"
            >
              <X size={20} />
            </button>
            <div className="w-10 h-1 bg-[#C6C6C8] rounded-full mx-auto shrink-0 mb-1" />
            <div className="text-center">
              <h2 className="text-xl font-black text-[#1c1c1e] truncate pr-10">{selectedPizza.name}</h2>
              <p className="text-[11px] text-[#8E8E93] mt-1 font-medium">{selectedPizza.ingredients?.join(', ')}</p>
            </div>
            <div className="space-y-5">
              <section className="space-y-2">
                <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Orario di ritiro</p>
                <div className="bg-white p-1.5 rounded-xl shadow-sm"><SegmentedControl options={SLOT_TIMES} selected={slot} onChange={(v) => setSlot(v as SlotTime)} /></div>
              </section>
              <div className="space-y-5">
                <section className="space-y-2">
                  <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Aggiungi (+)</p>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {addOptions.length === 0 && <p className="p-3 text-[10px] text-center text-gray-400 italic">Nessuna aggiunta</p>}
                    {addOptions.map(opt => (
                      <button key={opt.id} onClick={() => handleToggleAdd(opt.id)} className="w-full flex items-center justify-between p-3 active:bg-[#F2F2F7] transition-colors">
                        <span className="text-xs font-bold text-[#1c1c1e]">{opt.name}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedAddIds.includes(opt.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'}`}>{selectedAddIds.includes(opt.id) && <Check size={12} className="text-white" strokeWidth={3} />}</div>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="space-y-2">
                  <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Togli (-)</p>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {removeOptions.length === 0 && <p className="p-3 text-[10px] text-center text-gray-400 italic">Nessuna rimozione</p>}
                    {removeOptions.map(opt => (
                      <button key={opt.id} onClick={() => handleToggleRemove(opt.id)} className="w-full flex items-center justify-between p-3 active:bg-[#F2F2F7] transition-colors">
                        <span className="text-xs font-bold text-[#1c1c1e]">{opt.name}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedRemoveIds.includes(opt.id) ? 'bg-[#FF3B30] border-[#FF3B30]' : 'border-[#C6C6C8]'}`}>{selectedRemoveIds.includes(opt.id) && <Check size={12} className="text-white" strokeWidth={3} />}</div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              
              <div className="pt-2 flex flex-col gap-2">
                {errorMessage && <p className="text-[10px] text-[#FF3B30] font-black mb-2 text-center uppercase tracking-tighter">{errorMessage}</p>}
                <Button fullWidth onClick={() => setShowRecap(true)} disabled={submitting} className="!py-4 !text-base">
                  {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : 'Conferma Ordine'}
                </Button>
                <button 
                  onClick={() => !submitting && setSelectedPizza(null)}
                  className="w-full py-2 text-[10px] font-black text-[#8E8E93] uppercase tracking-widest"
                >
                  Annulla e torna al menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRecap && selectedPizza && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => !submitting && setShowRecap(false)} />
          <Card className="relative w-full max-w-xs p-5 space-y-5 shadow-2xl bg-white rounded-[24px]">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-[#1c1c1e] tracking-tight">Riepilogo</h3>
              <p className="text-[9px] text-[#8E8E93] font-bold uppercase tracking-widest">Verifica prima di inviare</p>
            </div>

            <div className="bg-[#F2F2F7] p-4 rounded-xl space-y-3">
                <div className="flex flex-col">
                  <p className="text-[8px] font-black text-[#8E8E93] uppercase tracking-tighter">La tua pizza</p>
                  <p className="text-base font-black truncate">{selectedPizza.name}</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-[8px] font-black text-[#8E8E93] uppercase tracking-tighter">Orario</p>
                  <p className="text-base font-black">{slot}</p>
                </div>

              {(selectedAddIds.length > 0 || selectedRemoveIds.length > 0) && (
                <div className="pt-2 border-t border-[#C6C6C8]/20 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {selectedAddIds.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">+{m.name}</span> : null;
                    })}
                    {selectedRemoveIds.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">-{m.name}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting} className="!py-3.5 !text-sm shadow-md">
                {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : 'SÌ, INVIA ORDINE'}
              </Button>
              <button 
                onClick={() => setShowRecap(false)}
                disabled={submitting}
                className="w-full py-2 text-[9px] font-black text-[#8E8E93] uppercase tracking-widest"
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