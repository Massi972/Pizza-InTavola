import React, { useState, useEffect, useMemo } from 'react';
import { User, Pizza, PizzaFlag, Order, SlotTime, Modification, Role, DayOverride } from '../types';
import { db, GlobalSettings } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, SegmentedControl, Input } from '../components/UI';
import { useTranslation } from '../services/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
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
  Flag,
  History,
  Star,
  RefreshCw
} from '../components/Icons';
import { getDayAvailability, getTodayDateString } from '../services/utils';
import { SLOT_TIMES } from '../constants';

interface WorkerDashboardProps {
  user: User;
  onLogout: () => void;
  onBackToAdmin?: () => void;
}

type ViewState = 'menu' | 'history' | 'settings';

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, onLogout, onBackToAdmin }) => {
  const { t, isRtl, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<ViewState>('menu');
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [pizzaFlags, setPizzaFlags] = useState<PizzaFlag[]>([]);
  const [currentDay, setCurrentDay] = useState<any>(null);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [favoriteOrder, setFavoriteOrder] = useState<Partial<Order> | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [slot, setSlot] = useState<SlotTime | ''>('');
  const [selectedAddIds, setSelectedAddIds] = useState<string[]>([]);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [selectedFlagIds, setSelectedFlagIds] = useState<string[]>([]);

  const handleSelectPizza = (pizza: Pizza) => {
    setSelectedPizza(pizza);
    setSlot('');
    setSelectedAddIds([]);
    setSelectedRemoveIds([]);
    setSelectedFlagIds([]);
    setErrorMessage(null);
  };
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availability = useMemo(() => {
    const today = getTodayDateString();
    return getDayAvailability(
        today, 
        settings?.active_days || [], 
        overrides, 
        currentDay,
        settings?.cutoff_time || '16:30',
        settings?.temporary_opening_until
    );
  }, [settings, overrides, currentDay]);

  const canOrder = useMemo(() => {
    if (settings?.override_cutoff) return true;
    return availability.isActive;
  }, [availability, settings]);

  const addOptions = useMemo(() => modifications.filter(m => m.type === 'ADD' && m.active), [modifications]);
  const removeOptions = useMemo(() => modifications.filter(m => m.type === 'REMOVE' && m.active), [modifications]);

  const handleToggleAdd = (id: string) => {
    setSelectedAddIds(prev => {
      const isSelected = prev.includes(id);
      if (!isSelected && (prev.length + selectedRemoveIds.length) >= 2) return prev;
      return isSelected ? prev.filter(i => i !== id) : [...prev, id];
    });
  };

  const handleToggleRemove = (id: string) => {
    setSelectedRemoveIds(prev => {
      const isSelected = prev.includes(id);
      if (!isSelected && (prev.length + selectedAddIds.length) >= 2) return prev;
      return isSelected ? prev.filter(i => i !== id) : [...prev, id];
    });
  };

  const handleToggleFlag = (id: string) => {
    setSelectedFlagIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pizzaList, modList, flagList, day, order, globalSettings, dayOverrides, history] = await Promise.all([
        db.getPizzas(),
        db.getModifications(),
        db.getPizzaFlags(),
        db.getCurrentDay(),
        db.getUserOrderToday(user.id),
        db.getSettings(),
        db.getOverrides(),
        db.getUserRecentOrders(user.id, 20)
      ]);
      setPizzas(pizzaList.filter(p => p.active));
      setModifications(modList || []);
      setPizzaFlags(flagList.filter(f => f.active) || []);
      setCurrentDay(day);
      setMyOrder(order);
      setSettings(globalSettings);
      setOverrides(dayOverrides);
      setRecentOrders(history);

      // Calcola Pizza Preferita (combinazione più frequente negli ultimi ordini)
      if (history.length > 0) {
        const counts: Record<string, { count: number, order: Order }> = {};
        history.forEach(o => {
          // Creiamo una chiave univoca per la combinazione pizza + orario + variazioni
          const modsKey = [...(o.addModificationIds || [])].sort().join(',');
          const remsKey = [...(o.removeModificationIds || [])].sort().join(',');
          const flagsKey = [...(o.flagIds || [])].sort().join(',');
          const key = `${o.pizzaId}|${o.slotTime}|${modsKey}|${remsKey}|${flagsKey}`;
          
          if (!counts[key]) counts[key] = { count: 0, order: o };
          counts[key].count++;
        });

        const favorite = Object.values(counts).sort((a, b) => b.count - a.count)[0];
        if (favorite && favorite.count >= 2) { 
           setFavoriteOrder({
             pizzaId: favorite.order.pizzaId,
             slotTime: favorite.order.slotTime,
             addModificationIds: favorite.order.addModificationIds,
             removeModificationIds: favorite.order.removeModificationIds,
             flagIds: favorite.order.flagIds
           });
        } else {
          setFavoriteOrder(null);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteOrder = async () => {
    if (!favoriteOrder || !canOrder) return;
    const pizza = pizzas.find(p => p.id === favoriteOrder.pizzaId);
    if (!pizza) return;

    setSelectedPizza(pizza);
    setSlot(favoriteOrder.slotTime || '18:00');
    setSelectedAddIds(favoriteOrder.addModificationIds || []);
    setSelectedRemoveIds(favoriteOrder.removeModificationIds || []);
    setSelectedFlagIds(favoriteOrder.flagIds || []);
    setShowRecap(true);
  };

  useEffect(() => {
    fetchData();
    // Polling per aggiornare stato disponibilità in tempo reale
    const pollId = setInterval(fetchData, 15000); 
    return () => clearInterval(pollId);
  }, [user.id]);

  const handleConfirmOrder = async () => {
    if (!selectedPizza) return;
    if (!slot) {
      setErrorMessage(t('selectTimeError'));
      return;
    }
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
        slotTime: slot as SlotTime,
        addModificationIds: selectedAddIds,
        removeModificationIds: selectedRemoveIds,
        flagIds: selectedFlagIds,
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

  const renderMenu = () => {
    const filteredPizzas = pizzas.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.ingredients?.some(i => i.toLowerCase().includes(search.toLowerCase()))
    );

    return (
      <div className="space-y-5">
        <div className="flex justify-between items-center pt-2 pb-1 gap-4">
          <div>
            <h1 className="text-[28px] font-black text-[#1c1c1e] tracking-tight leading-[1.1]">
              {t('helloUser', { name: user.firstName })}
            </h1>
            <p className="text-sm font-bold text-[#8E8E93] mt-1">{t('choosePizzaToday')}</p>
          </div>
          <div className="shrink-0">
            <LanguageSwitcher direction="down" align="right" />
          </div>
        </div>

        {favoriteOrder && !myOrder && canOrder && (
          <Card 
            className="p-4 border-2 border-amber-200 bg-amber-50/50 cursor-pointer active:scale-95 transition-all shadow-sm"
            onClick={handleFavoriteOrder}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                  <Star size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest px-1 bg-amber-100/50 rounded inline-block">{t('favOrderTitle')}</p>
                  <h3 className="text-sm font-black text-[#1c1c1e] mt-0.5">{pizzas.find(p => p.id === favoriteOrder.pizzaId)?.name}</h3>
                </div>
              </div>
              <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{t('favOrderBtn')}</div>
            </div>
          </Card>
        )}

        {errorMessage && (errorMessage.includes('pizzas') || errorMessage.includes('settings')) && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 text-[#FF3B30]">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold">{t('dbConfigNeeded')}</p>
                <p className="text-xs opacity-80">{t('dbConfigDesc')}</p>
              </div>
            </div>
          </div>
        )}

        {!canOrder && (
          <div className="bg-[#FF3B30] text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-white/20 rounded-full shrink-0"><Lock size={20} /></div>
            <div className="flex-1">
              <p className="font-black text-sm tracking-tight">{t('serviceNotActive')}</p>
              <p className="text-[10px] font-medium opacity-90 leading-tight">
                {availability.label.includes('OLTRE') 
                  ? t('ordersEndedAt', { time: settings?.cutoff_time || '16:30' }) 
                  : t('serviceNotAvailableToday')}
              </p>
            </div>
          </div>
        )}

        {myOrder && !selectedPizza && !isEditing && (
          <Card className={`p-5 border-2 max-w-2xl mx-auto ${availability.isActive ? 'border-[#34C759]' : 'border-[#C6C6C8] opacity-80 grayscale'}`}>
            <div className="flex justify-between items-start gap-3 mb-5">
              <div className="flex-1">
                <p className={`text-[9px] font-black ${availability.isActive ? 'text-[#34C759]' : 'text-[#8E8E93]'} uppercase tracking-[0.2em] mb-1.5`}>{t('currentOrderTitle')}</p>
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
                  {myOrder.flagIds?.map(id => {
                    const flag = pizzaFlags.find(f => f.id === id);
                    return flag ? <span key={id} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{flag.name}</span> : null;
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
                  setSelectedFlagIds(myOrder.flagIds || []);
                  setIsEditing(true); 
                }
              }} variant="secondary" fullWidth className="!bg-[#F2F2F7] !py-3">{t('changeSelectionBtn')}</Button>
            )}
          </Card>
        )}

        {(!myOrder || isEditing) && !selectedPizza && (
          <div className={`space-y-5 ${!canOrder ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
              <Input placeholder={t('searchPizzaPlaceholder')} className="pl-10 !py-3 !rounded-xl border-none shadow-sm bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
              {filteredPizzas.map(pizza => (
                <Card key={pizza.id} className="p-4 cursor-pointer hover:shadow-md active:scale-[0.97] transition-all flex flex-col h-full border border-transparent hover:border-[#007AFF]/10" onClick={() => canOrder && handleSelectPizza(pizza)}>
                  <div className="flex justify-between items-start mb-1.5">
                    <h3 className="font-black text-base text-[#1c1c1e] truncate pr-2">{pizza.name}</h3>
                    {pizza.isVegetarian && <span className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded-full font-black tracking-wider shrink-0">VEG</span>}
                  </div>
                  <p className="text-[11px] text-[#8E8E93] leading-snug flex-1 italic line-clamp-2">{pizza.ingredients?.join(', ')}</p>
                  <div className="mt-3 pt-2 border-t border-[#F2F2F7] flex justify-end">
                    <span className="text-[#007AFF] text-[9px] font-black uppercase tracking-widest">{t('chooseLabel')}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="pt-2 pb-1 text-center">
        <h2 className="text-2xl font-black text-[#1c1c1e] tracking-tight leading-tight">{t('historyTitle')}</h2>
        <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest mt-1">{t('historySubtitle')}</p>
      </div>

      {recentOrders.length === 0 ? (
        <div className="py-20 text-center space-y-4">
           <div className="w-20 h-20 bg-[#F2F2F7] rounded-full flex items-center justify-center mx-auto text-[#8E8E93] opacity-30">
             <History size={40} />
           </div>
           <div>
             <p className="text-sm text-[#8E8E93] font-bold">{t('noOrdersYet')}</p>
             <p className="text-[10px] text-[#C6C6C8] font-medium mt-1">{t('noOrdersDesc')}</p>
           </div>
        </div>
      ) : (
        <div className="space-y-3 pb-24">
          {recentOrders.map(o => {
            const pizza = pizzas.find(p => p.id === o.pizzaId);
            const dateObj = o.createdAt ? new Date(o.createdAt) : null;
            const dateStr = dateObj ? dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '--';
            
            return (
              <Card key={o.id} className="p-4 flex items-center justify-between gap-4 border border-transparent shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-black text-[#8E8E93] uppercase bg-[#F2F2F7] px-1.5 py-0.5 rounded cursor-default">{dateStr}</span>
                    <span className="text-[9px] font-black text-[#007AFF] uppercase bg-blue-50 px-1.5 py-0.5 rounded cursor-default">{o.slotTime}</span>
                  </div>
                  <h4 className="text-sm font-black text-[#1c1c1e] truncate">{pizza?.name || 'Pizza'}</h4>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {o.addModificationIds?.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[8px] font-bold bg-green-50 text-green-600 px-1 rounded">+{m.name}</span> : null;
                    })}
                    {o.removeModificationIds?.map(id => {
                      const m = modifications.find(mod => mod.id === id);
                      return m ? <span key={id} className="text-[8px] font-bold bg-red-50 text-red-600 px-1 rounded">-{m.name}</span> : null;
                    })}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if(!canOrder) return;
                    setSelectedPizza(pizza || null);
                    setSlot(o.slotTime);
                    setSelectedAddIds(o.addModificationIds || []);
                    setSelectedRemoveIds(o.removeModificationIds || []);
                    setSelectedFlagIds(o.flagIds || []);
                    setShowRecap(true);
                  }}
                  className={`p-3 rounded-2xl transition-all ${canOrder ? 'bg-[#007AFF] text-white active:scale-90 shadow-md shadow-blue-200' : 'bg-gray-100 text-gray-400 opacity-40 cursor-not-allowed'}`}
                  title="Ripeti Ordine"
                >
                  <RefreshCw size={20} />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const isManagement = user.role === Role.ADMIN || user.role === Role.SUPERVISOR;

  return (
    <Layout title={activeTab === 'menu' ? 'InTavola Staff' : activeTab === 'history' ? t('historyTitle') : t('profileTitle')} onBack={activeTab !== 'menu' ? () => setActiveTab('menu') : undefined}>
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-5 animate-in zoom-in duration-500 shadow-md"><Check size={32} strokeWidth={3} /></div>
          <h2 className="text-2xl font-black text-[#1c1c1e] tracking-tight">{t('orderSentTitle')}</h2>
          <p className="text-[#8E8E93] font-bold mt-1.5 uppercase tracking-widest text-[9px] mb-8 text-center">{t('orderSentDesc')}</p>
          <div className="w-full max-w-xs space-y-3">
            <Button fullWidth onClick={() => { setShowSuccess(false); setActiveTab('menu'); }}>{t('myOrderBtn')}</Button>
            <Button fullWidth variant="ghost" onClick={onLogout}>{t('logoutBtn')}</Button>
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

      {activeTab === 'menu' ? renderMenu() : activeTab === 'history' ? renderHistory() : (
        <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right duration-300">
           <Card className="p-6 text-center bg-white shadow-md">
            <div className="w-16 h-16 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-full flex items-center justify-center text-white mx-auto shadow-md mb-4"><UserIcon size={32} /></div>
            <h2 className="text-lg font-black text-[#1c1c1e]">{user.firstName} {user.lastName}</h2>
            <p className="text-[9px] font-black text-[#007AFF] uppercase tracking-widest mt-1 bg-[#F2F2F7] inline-block px-3 py-0.5 rounded-full">{user.role}</p>
          </Card>

           <div className="grid grid-cols-1 gap-5">
            <section className="space-y-2">
              <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">
                {language === 'it' && "Account"}
                {language === 'en' && "Account Settings"}
                {language === 'es' && "Ajustes de Cuenta"}
                {language === 'ar' && "إعدادات الحساب"}
                {language === 'ur' && "اکاؤنٹ کی ترتیبات"}
              </p>
              <Card className="divide-y divide-[#F2F2F7]">
                {isManagement && onBackToAdmin && (
                  <button onClick={onBackToAdmin} className="w-full p-4 flex justify-between items-center text-[#5856D6] font-bold active:bg-[#F2F2F7] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-[#F2F2F7] text-[#5856D6] rounded-lg"><Sliders size={16} /></div>
                      <span className="text-xs">
                        {language === 'it' && "Torna al Gestionale"}
                        {language === 'en' && "Back to Admin Dashboard"}
                        {language === 'es' && "Volver al Panel de Admin"}
                        {language === 'ar' && "العودة للوحة التحكم"}
                        {language === 'ur' && "ایڈمن پینل پر واپس جائیں"}
                      </span>
                    </div>
                  </button>
                )}
                <button onClick={onLogout} className="w-full p-4 flex justify-between items-center text-[#FF3B30] font-bold active:bg-red-50 transition-all">
                   <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-red-50 text-[#FF3B30] rounded-lg"><LogOut size={16} /></div>
                      <span className="text-xs">{t('logoutBtn')}</span>
                    </div>
                </button>
              </Card>
            </section>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 ios-blur border-t border-[#C6C6C8] pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-center z-40">
        <div className="w-full max-w-lg px-6 flex justify-between items-center">
          <button onClick={() => setActiveTab('menu')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'menu' ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93] opacity-60'}`}>
            <PizzaIcon size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">
              {language === 'it' && "Menu"}
              {language === 'en' && "Menu"}
              {language === 'es' && "Menú"}
              {language === 'ar' && "القائمة"}
              {language === 'ur' && "مینو"}
            </span>
          </button>
          
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'history' ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93] opacity-60'}`}>
            <History size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{t('historyTab')}</span>
          </button>

          {isManagement && onBackToAdmin && (
             <button onClick={onBackToAdmin} className="flex flex-col items-center gap-1 text-[#5856D6] active:scale-105 transition-transform flex-1">
               <Sliders size={22} />
               <span className="text-[9px] font-black uppercase tracking-tighter">Admin</span>
             </button>
          )}

          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'settings' ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93] opacity-60'}`}>
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
                <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">
                  {t('pickupTimeLabel')} <span className="text-[#FF3B30] font-black">*</span>
                </p>
                <div className="relative">
                  <select
                    id="pizza-time-select"
                    value={slot}
                    onChange={(e) => {
                      const val = e.target.value as SlotTime;
                      setSlot(val);
                      if (val) {
                        setErrorMessage(null);
                      }
                    }}
                    className="w-full bg-white text-[#1c1c1e] text-xs font-black py-3.5 pl-4 pr-10 rounded-xl border border-transparent shadow-sm outline-none focus:ring-2 focus:ring-[#007AFF]/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="text-gray-400 font-medium">
                      {t('selectTimePlaceholder')}
                    </option>
                    {SLOT_TIMES.map((time) => (
                      <option key={time} value={time} className="text-[#1c1c1e] font-black">
                        {time}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#8E8E93]">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </section>
              <div className="space-y-5">
                <section className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest">{t('addLabel')}</p>
                    <p className="text-[8px] font-bold text-[#007AFF] uppercase">{t('maxModsError')}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {addOptions.length === 0 && <p className="p-3 text-[10px] text-center text-gray-400 italic">{t('noAdditions')}</p>}
                    {addOptions.map(opt => {
                      const isSelected = selectedAddIds.includes(opt.id);
                      const limitReached = !isSelected && (selectedAddIds.length + selectedRemoveIds.length) >= 2;
                      return (
                        <button 
                          key={opt.id} 
                          onClick={() => handleToggleAdd(opt.id)} 
                          className={`w-full flex items-center justify-between p-3 active:bg-[#F2F2F7] transition-colors ${limitReached ? 'opacity-40' : ''}`}
                        >
                          <span className="text-xs font-bold text-[#1c1c1e]">{opt.name}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'}`}>
                            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest">{t('removeLabel')}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                    {removeOptions.length === 0 && <p className="p-3 text-[10px] text-center text-gray-400 italic">{t('noRemovals')}</p>}
                    {removeOptions.map(opt => {
                      const isSelected = selectedRemoveIds.includes(opt.id);
                      const limitReached = !isSelected && (selectedAddIds.length + selectedRemoveIds.length) >= 2;
                      return (
                        <button 
                          key={opt.id} 
                          onClick={() => handleToggleRemove(opt.id)} 
                          className={`w-full flex items-center justify-between p-3 active:bg-[#F2F2F7] transition-colors ${limitReached ? 'opacity-40' : ''}`}
                        >
                          <span className="text-xs font-bold text-[#1c1c1e]">{opt.name}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#FF3B30] border-[#FF3B30]' : 'border-[#C6C6C8]'}`}>
                            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
                {pizzaFlags.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-[9px] font-black text-[#5856D6] uppercase tracking-widest pl-1">{t('extraOptionsLabel')}</p>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-[#F2F2F7]">
                      {pizzaFlags.map(flag => (
                        <button key={flag.id} onClick={() => handleToggleFlag(flag.id)} className="w-full flex items-center justify-between p-3 active:bg-[#F2F2F7] transition-colors text-indigo-700">
                          <span className="text-xs font-bold">{flag.name}</span>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedFlagIds.includes(flag.id) ? 'bg-[#5856D6] border-[#5856D6]' : 'border-[#C6C6C8]'}`}>{selectedFlagIds.includes(flag.id) && <Check size={12} className="text-white" strokeWidth={3} />}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
              
              <div className="pt-2 flex flex-col gap-2">
                {errorMessage && (
                  <p className="text-[11px] text-[#FF3B30] font-black mb-2 text-center uppercase bg-red-50 py-2.5 px-4 rounded-xl border border-red-100 animate-pulse tracking-tight">
                    {errorMessage}
                  </p>
                )}
                <Button 
                  fullWidth 
                  onClick={() => {
                    if (!slot) {
                      setErrorMessage(t('selectTimeError'));
                      return;
                    }
                    setErrorMessage(null);
                    setShowRecap(true);
                  }} 
                  disabled={submitting} 
                  className="!py-4 !text-base"
                >
                  {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : (
                    language === 'it' ? "Conferma Ordine" :
                    language === 'en' ? "Confirm Order" :
                    language === 'es' ? "Confirmar Pedido" :
                    language === 'ar' ? "تأكيد الطلب" :
                    language === 'ur' ? "آرڈر کی تصدیق کریں" : "Conferma Ordine"
                  )}
                </Button>
                <button 
                  onClick={() => !submitting && setSelectedPizza(null)}
                  className="w-full py-2 text-[10px] font-black text-[#8E8E93] uppercase tracking-widest"
                >
                  {t('cancelBtn')}
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
              <h3 className="text-lg font-black text-[#1c1c1e] tracking-tight">
                {language === 'it' && "Riepilogo"}
                {language === 'en' && "Recap Summary"}
                {language === 'es' && "Resumen de Pedido"}
                {language === 'ar' && "ملخص الطلب"}
                {language === 'ur' && "آرڈر کا خلاصہ"}
              </h3>
              <p className="text-[9px] text-[#8E8E93] font-bold uppercase tracking-widest">
                {language === 'it' && "Verifica prima di inviare"}
                {language === 'en' && "Verify before submitting"}
                {language === 'es' && "Verifica antes de enviar"}
                {language === 'ar' && "تحقق قبل الإرسال"}
                {language === 'ur' && "جمع کرانے سے پہلے تصدیق کریں"}
              </p>
            </div>

            <div className="bg-[#F2F2F7] p-4 rounded-xl space-y-3">
                <div className="flex flex-col">
                  <p className="text-[8px] font-black text-[#8E8E93] uppercase tracking-tighter">
                    {language === 'it' && "La tua pizza"}
                    {language === 'en' && "Your pizza"}
                    {language === 'es' && "Tu pizza"}
                    {language === 'ar' && "بيتزا خاصة بك"}
                    {language === 'ur' && "آپ کا پیزا"}
                  </p>
                  <p className="text-base font-black truncate">{selectedPizza.name}</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-[8px] font-black text-[#8E8E93] uppercase tracking-tighter">
                    {language === 'it' && "Orario"}
                    {language === 'en' && "Pickup Time"}
                    {language === 'es' && "Hora de Recogida"}
                    {language === 'ar' && "وقت الاستلام"}
                    {language === 'ur' && "پک اپ کا وقت"}
                  </p>
                  <p className="text-base font-black">{slot}</p>
                </div>

              {(selectedAddIds.length > 0 || selectedRemoveIds.length > 0 || selectedFlagIds.length > 0) && (
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
                    {selectedFlagIds.map(id => {
                      const f = pizzaFlags.find(flag => flag.id === id);
                      return f ? <span key={id} className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{f.name}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button fullWidth onClick={handleConfirmOrder} disabled={submitting} className="!py-3.5 !text-sm shadow-md">
                {submitting ? <div className="loading-spinner border-white border-t-transparent" /> : (
                  language === 'it' ? "SÌ, INVIA ORDINE" :
                  language === 'en' ? "YES, SEND ORDER" :
                  language === 'es' ? "SÍ, ENVIAR PEDIDO" :
                  language === 'ar' ? "نعم، أرسل الطلب" :
                  language === 'ur' ? "ہاں، آرڈر بھیجیں" : "SÌ, INVIA ORDINE"
                )}
              </Button>
              <button 
                onClick={() => setShowRecap(false)}
                disabled={submitting}
                className="w-full py-2 text-[9px] font-black text-[#8E8E93] uppercase tracking-widest"
              >
                {t('cancelBtn')}
              </button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};

export default WorkerDashboard;