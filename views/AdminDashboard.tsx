import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Day, DayStatus, SlotTime, Role, Modification, DayOverride } from '../types';
import { db, GlobalSettings } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { 
  UsersIcon, 
  PizzaIcon, 
  History, 
  Unlock, 
  Lock, 
  AlertCircle, 
  Sliders,
  RefreshCw,
  FileText,
  Calendar,
  RotateCcw,
  X,
  Check,
  ClockIcon
} from '../components/Icons';
import { formatDate, getDayAvailability, getTodayDateString } from '../services/utils';
import { generateDayReportPDF, HydratedOrder } from '../services/exportService';
import { SLOT_TIMES } from '../constants';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'pizzas' | 'users' | 'history' | 'modifications' | 'calendar') => void;
  onGoToOrder: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onNavigate, onGoToOrder }) => {
  const [currentDay, setCurrentDay] = useState<Day | null>(null);
  const [orders, setOrders] = useState<HydratedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [error, setError] = useState<{message: string, code?: string} | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [clickCount, setClickCount] = useState(0);
  const [showResetPin, setShowResetPin] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [day, globalSettings, dayOverrides] = await Promise.all([
        db.getCurrentDay(),
        db.getSettings(),
        db.getOverrides()
      ]);
      setCurrentDay(day);
      setSettings(globalSettings);
      setOverrides(dayOverrides);
      
      if (day) {
        const [dayOrders, users, pizzas, modifications] = await Promise.all([
          db.getOrdersByDay(day.id),
          db.getUsers(),
          db.getPizzas(),
          db.getModifications()
        ]);

        const hydratedOrders: HydratedOrder[] = dayOrders.map(o => ({
          ...o,
          user: users.find(u => u.id === o.userId),
          pizza: pizzas.find(p => p.id === o.pizzaId),
          addMods: (o.addModificationIds || []).map(id => modifications.find(m => m.id === id)).filter(Boolean) as Modification[],
          removeMods: (o.removeModificationIds || []).map(id => modifications.find(m => m.id === id)).filter(Boolean) as Modification[]
        }));
        
        setOrders(hydratedOrders);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error(err);
      setError({ message: err.message || "Errore caricamento dati" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calcolo della disponibilità effettiva per oggi
  const currentAvailability = useMemo(() => {
    if (!settings) return null;
    return getDayAvailability(
      getTodayDateString(),
      settings.active_days,
      overrides,
      currentDay,
      settings.cutoff_time
    );
  }, [settings, overrides, currentDay]);

  const handleTitleClick = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 7) {
      setShowResetPin(true);
      setClickCount(0);
    } else {
      resetTimerRef.current = setTimeout(() => setClickCount(0), 3000);
    }
  };

  const handleResetPinSubmit = () => {
    if (resetPin === '1131') {
      setShowResetPin(false);
      setShowFinalConfirm(true);
      setResetPin('');
    } else {
      alert("PIN Errato");
      setResetPin('');
    }
  };

  const executeSeasonalReset = async () => {
    setIsResetting(true);
    try {
      await db.resetSeasonalData();
      setShowFinalConfirm(false);
      setToast("Reset Stagionale Completato ✅");
      setTimeout(() => setToast(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert("Errore durante il reset: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleDay = async (action: 'open' | 'close') => {
    setActionLoading(true);
    try {
      if (action === 'open') {
        await db.openDay();
      } else {
        await db.closeDay();
      }
      await fetchData();
    } catch (err: any) {
      alert("Errore: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!currentDay || orders.length === 0) {
      alert("Nessun ordine presente per oggi.");
      return;
    }
    generateDayReportPDF(currentDay.date, orders, SLOT_TIMES);
  };

  const isAdmin = user.role === Role.ADMIN;

  if (loading && !error) {
    return (
      <Layout title="InTavola Admin" onLogout={onLogout}>
        <div className="flex justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Gestione Locale" onLogout={onLogout}>
      {/* Elemento invisibile per reset stagionale, spostato per non interferire con header */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-10 z-[60]" onClick={handleTitleClick} />

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-4 py-2 rounded-full text-[10px] font-bold animate-in fade-in zoom-in duration-300">
          {toast}
        </div>
      )}

      <div className="space-y-6">
        {/* Banner Errore Database */}
        {error && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 text-[#FF3B30]">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold">Errore Database</p>
                <p className="text-xs opacity-80">{error.message}</p>
              </div>
              <button onClick={() => setError(null)} className="p-1"><X size={16} /></button>
            </div>
            
            {(error.message.includes('cutoff_time') || error.message.includes('settings')) && (
              <div className="p-3 bg-white/50 rounded-lg border border-red-200">
                <p className="text-[10px] font-bold uppercase text-red-800 mb-1">Copia ed esegui in Supabase SQL Editor:</p>
                <code className="block bg-black text-white p-2 rounded text-[9px] font-mono break-all whitespace-pre-wrap">
{`ALTER TABLE settings ADD COLUMN IF NOT EXISTS cutoff_time TEXT DEFAULT '16:30';
-- Se la tabella settings non esiste proprio:
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  master_code TEXT DEFAULT 'PIZZA2025',
  override_cutoff BOOLEAN DEFAULT false,
  manager_phone TEXT,
  active_days TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI'],
  cutoff_time TEXT DEFAULT '16:30'
);
INSERT INTO settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;`}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Card Personale */}
        <Card className="p-4 border-l-4 border-[#FF9500] bg-orange-50/30">
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-orange-100 text-orange-600 rounded-full"><PizzaIcon size={20} /></div>
               <div>
                 <p className="text-[9px] font-bold text-[#8E8E93] uppercase tracking-wider">Area Dipendente</p>
                 <p className="text-sm font-bold">Ordina la tua pizza</p>
               </div>
             </div>
             <Button onClick={onGoToOrder} size="sm" className="!py-2">Vai al Menu</Button>
           </div>
        </Card>

        {/* Status Sistema */}
        {settings && currentAvailability && (
          <Card className={`p-5 border-t-4 ${currentAvailability.isActive ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-widest mb-1">Stato Ordini Staff</p>
                <h2 className="text-xl font-black text-[#1c1c1e]">{formatDate(new Date())}</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <ClockIcon size={12} className="text-[#007AFF]" />
                  <p className="text-[10px] font-bold text-[#007AFF] uppercase">Limite ordini: {settings.cutoff_time}</p>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-tight ${currentAvailability.colorClass}`}>
                {currentAvailability.label}
              </div>
            </div>

            <div className="bg-[#F2F2F7] rounded-xl p-4 mb-5">
               <div className="flex items-center justify-between">
                 <p className="text-[11px] font-bold text-[#8E8E93] uppercase">Pizze confermate:</p>
                 <p className="text-2xl font-black text-[#1c1c1e]">{orders.length}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => handleToggleDay('open')} 
                variant={currentDay?.status === 'OPEN' ? 'secondary' : 'primary'}
                disabled={actionLoading}
                className="!py-3.5"
              >
                <Unlock size={18} /> Forza Apertura
              </Button>
              <Button 
                onClick={() => handleToggleDay('close')} 
                variant="danger"
                disabled={actionLoading}
                className="!py-3.5"
              >
                <Lock size={18} /> Forza Chiusura
              </Button>
            </div>
          </Card>
        )}

        {/* Report */}
        {orders.length > 0 && (
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleDownloadReport}
            className="!bg-[#34C759] !py-4 shadow-md active:scale-95"
          >
            <FileText size={18} /> Scarica Report Cucina ({orders.length})
          </Button>
        )}

        {/* Menu Amministratore */}
        {isAdmin && (
          <div className="space-y-2 pt-4 border-t border-[#C6C6C8]">
            <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-[0.2em] mb-3 pl-1">Configurazione Gestionale</p>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('calendar')} className="justify-start !bg-white border border-[#C6C6C8]/30"><Calendar size={18} className="text-[#007AFF]" /> Programmazione Orari</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('pizzas')} className="justify-start !bg-white border border-[#C6C6C8]/30"><PizzaIcon size={18} /> Lista Pizze Menu</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('modifications')} className="justify-start !bg-white border border-[#C6C6C8]/30"><Sliders size={18} /> Lista Varianti</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('users')} className="justify-start !bg-white border border-[#C6C6C8]/30"><UsersIcon size={18} /> Lista Dipendenti</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('history')} className="justify-start !bg-white border border-[#C6C6C8]/30"><History size={18} /> Archivio Storico</Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;