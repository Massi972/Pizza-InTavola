
import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, Order, SlotTime, DayStatus, Modification } from '../types';
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
  LogOut
} from '../components/Icons';
import { isBeforeCutoff } from '../services/utils';
import { SLOT_TIMES } from '../constants';
import { isBiometricAvailable, registerBiometrics } from '../services/biometrics';

interface WorkerDashboardProps {
  user: User;
  onLogout: () => void;
}

type ViewState = 'menu' | 'settings';

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<ViewState>('menu');
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [currentDay, setCurrentDay] = useState<any>(null);
  const [overrideActive, setOverrideActive] = useState(false);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [slot, setSlot] = useState<SlotTime>('18:00');
  const [addModId, setAddModId] = useState<string | null>(null);
  const [removeModId, setRemoveModId] = useState<string | null>(null);
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
        setModifications(modList);
        setCurrentDay(day);
        setMyOrder(order);
        setOverrideActive(settings.override_cutoff);
      } catch (err) {
        setMessage({ text: "Errore caricamento dati", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const handleToggleBiometrics = async () => {
    if (biometricEnabled) {
      localStorage.removeItem('pizzastaff_stored_pin');
      localStorage.setItem('pizzastaff_biometric_enabled', 'false');
      setBiometricEnabled(false);
      setMessage({ text: "Accesso biometrico disattivato", type: "success" });
    } else {
      setSubmitting(true);
      const success = await registerBiometrics(user.id, `${user.firstName} ${user.lastName}`);
      if (success) {
        localStorage.setItem('pizzastaff_stored_pin', user.pin);
        localStorage.setItem('pizzastaff_biometric_enabled', 'true');
        localStorage.removeItem('pizzastaff_biometric_declined');
        setBiometricEnabled(true);
        setMessage({ text: "Configurazione Face ID / Touch ID riuscita!", type: "success" });
      } else {
        setMessage({ text: "Operazione annullata o non supportata", type: "error" });
      }
      setSubmitting(false);
    }
    setTimeout(() => setMessage(null), 3000);
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
        addModificationId: addModId,
        removeModificationId: removeModId,
        note: ''
      };
      await db.saveOrder(order);
      const updatedOrder = await db.getUserOrderToday(user.id);
      setMyOrder(updatedOrder);
      setSelectedPizza(null);
      setAddModId(null);
      setRemoveModId(null);
      setIsEditing(false);
      setMessage({ text: "Ordine inviato con successo!", type: "success" });
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
                <div className="mt-1 space-y-0.5">
                  {myOrder.addModificationId && (
                    <p className="text-[10px] text-green-600 font-bold uppercase tracking-tight">
                      + {modifications.find(m => m.id === myOrder.addModificationId)?.name}
                    </p>
                  )}
                  {myOrder.removeModificationId && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight">
                      - {modifications.find(m => m.id === myOrder.removeModificationId)?.name}
                    </p>
                  )}
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
                  setAddModId(myOrder.addModificationId || null); 
                  setRemoveModId(myOrder.removeModificationId || null);
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

  const renderSettings = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="text-center py-6">
        <div className="w-20 h-20 bg-[#007AFF] rounded-full flex items-center justify-center text-white mx-auto shadow-xl mb-3">
          <UserIcon size={40} />
        </div>
        <h2 className="text-xl font-black">{user.firstName} {user.lastName}</h2>
        <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-widest mt-1">Dipendente</p>
      </div>

      <div className="space-y-4">
        <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest px-4">Sicurezza e Accesso</p>
        <Card className="divide-y divide-[#F2F2F7]">
          {isBioSupported ? (
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                  <Fingerprint size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold">Face ID / Touch ID</p>
                  <p className="text-[10px] text-[#8E8E93]">{biometricEnabled ? 'Attivo per questo dispositivo' : 'Accedi senza inserire il PIN'}</p>
                </div>
              </div>
              <button 
                onClick={handleToggleBiometrics}
                disabled={submitting}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${biometricEnabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${biometricEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          ) : (
            <div className="p-4 flex items-center gap-3 opacity-50">
              <Fingerprint size={20} className="text-[#8E8E93]" />
              <p className="text-sm font-medium text-[#8E8E93]">Biometria non supportata</p>
            </div>
          )}
          
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F2F2F7] text-[#8E8E93]">
                <Lock size={20} />
              </div>
              <div>
                <p className="text-sm font-bold">PIN Personale</p>
                <p className="text-[10px] text-[#8E8E93]">Il tuo codice: ****</p>
              </div>
            </div>
            <span className="text-xs text-[#8E8E93] font-bold">PRIVATO</span>
          </div>
        </Card>

        <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest px-4 pt-4">Account</p>
        <Card>
          <button 
            onClick={onLogout}
            className="w-full p-4 flex justify-between items-center active:bg-[#F2F2F7] transition-colors"
          >
            <div className="flex items-center gap-3 text-[#FF3B30]">
              <div className="p-2 rounded-xl bg-red-50">
                <LogOut size={20} />
              </div>
              <span className="text-sm font-bold">Esci dall'applicazione</span>
            </div>
            <ChevronRight size={18} className="text-[#C6C6C8]" />
          </button>
        </Card>

        <p className="text-center text-[10px] text-[#8E8E93] font-medium pt-8">
          Pizza InTavola Staff v2.1.0<br/>
          Sviluppato per InTavola SRL
        </p>
      </div>
    </div>
  );

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

      {activeTab === 'menu' ? renderMenu() : renderSettings()}

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg ios-blur border-t border-[#C6C6C8] px-8 py-3 pb-8 flex justify-between items-center z-40">
        <button 
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'menu' ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}
        >
          <PizzaIcon size={24} />
          <span className="text-[10px] font-bold">Ordina</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}
        >
          <Settings size={24} />
          <span className="text-[10px] font-bold">Impostazioni</span>
        </button>
      </nav>

      {selectedPizza && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if(!submitting) setSelectedPizza(null); }} />
          <div className="relative bg-white rounded-t-[32px] p-6 pb-12 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-[#E5E5EA] rounded-full mx-auto" />
            <h2 className="text-2xl font-black">{selectedPizza.name}</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Orario di ritiro</p>
                <SegmentedControl options={SLOT_TIMES} selected={slot} onChange={(v) => setSlot(v as SlotTime)} />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Modifiche (Opzionali)</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Aggiungi</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl bg-[#F2F2F7] border-none text-sm font-medium appearance-none"
                      value={addModId || ''}
                      onChange={(e) => setAddModId(e.target.value || null)}
                    >
                      <option value="">Nessuna aggiunta</option>
                      {addOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>+ {opt.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#8E8E93] uppercase pl-1 block mb-1">Togli</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl bg-[#F2F2F7] border-none text-sm font-medium appearance-none"
                      value={removeModId || ''}
                      onChange={(e) => setRemoveModId(e.target.value || null)}
                    >
                      <option value="">Nessuna rimozione</option>
                      {removeOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>- {opt.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

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
