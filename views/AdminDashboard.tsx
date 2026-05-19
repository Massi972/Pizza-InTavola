import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Day, DayStatus, SlotTime, Role, Modification, PizzaFlag, DayOverride } from '../types';
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
  ClockIcon,
  Flag
} from '../components/Icons';
import { formatDate, getDayAvailability, getTodayDateString } from '../services/utils';
import { generateDayReportPDF, HydratedOrder } from '../services/exportService';
import { SLOT_TIMES } from '../constants';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'pizzas' | 'users' | 'history' | 'modifications' | 'calendar' | 'flags') => void;
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
        const [dayOrders, users, pizzas, modifications, pizzaFlags] = await Promise.all([
          db.getOrdersByDay(day.id),
          db.getUsers(),
          db.getPizzas(),
          db.getModifications(),
          db.getPizzaFlags()
        ]);

        const hydratedOrders: HydratedOrder[] = dayOrders.map(o => ({
          ...o,
          user: users.find(u => u.id === o.userId),
          pizza: pizzas.find(p => p.id === o.pizzaId),
          addMods: (o.addModificationIds || []).map(id => modifications.find(m => m.id === id)).filter(Boolean) as Modification[],
          removeMods: (o.removeModificationIds || []).map(id => modifications.find(m => m.id === id)).filter(Boolean) as Modification[],
          flags: (o.flagIds || []).map(id => pizzaFlags.find(f => f.id === id)).filter(Boolean) as PizzaFlag[]
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
      settings.cutoff_time,
      settings.temporary_opening_until
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

  const [autoCloseTimer, setAutoCloseTimer] = useState<number | null>(null);
  const autoCloseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Gestione timer di chiusura automatica persistente
  useEffect(() => {
    if (autoCloseIntervalRef.current) clearInterval(autoCloseIntervalRef.current);
    
    if (settings?.temporary_opening_until && currentDay?.status === 'OPEN') {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((settings.temporary_opening_until - now) / 1000));
      
      if (remaining > 0) {
        setAutoCloseTimer(remaining);
        autoCloseIntervalRef.current = setInterval(() => {
          setAutoCloseTimer(prev => {
            if (prev === null || prev <= 1) {
              if (autoCloseIntervalRef.current) clearInterval(autoCloseIntervalRef.current);
              handleToggleDay('close');
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // Tempo scaduto ma giornata ancora aperta: chiudi
        handleToggleDay('close');
      }
    } else {
      setAutoCloseTimer(null);
    }

    return () => {
      if (autoCloseIntervalRef.current) clearInterval(autoCloseIntervalRef.current);
    };
  }, [settings?.temporary_opening_until, currentDay?.status]);

  const handleToggleDay = async (action: 'open' | 'close') => {
    setActionLoading(true);
    try {
      if (action === 'open') {
        const timeoutMs = 120000; // 2 minuti
        const until = Date.now() + timeoutMs;
        
        await Promise.all([
          db.openDay(),
          db.updateSettings({ temporary_opening_until: until })
        ]);
      } else {
        await Promise.all([
          db.closeDay(),
          db.updateSettings({ temporary_opening_until: null })
        ]);
      }
      await fetchData();
    } catch (err: any) {
      alert("Errore: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Polling per sincronizzare lo stato tra più admin/dispositivi
    const pollId = setInterval(fetchData, 10000); 
    return () => clearInterval(pollId);
  }, []);

  const handleDownloadReport = () => {
    if (!currentDay || orders.length === 0) {
      alert("Nessun ordine presente per oggi.");
      return;
    }
    generateDayReportPDF(currentDay.date, orders, SLOT_TIMES, settings || undefined);
  };

  const isAdmin = user.role === Role.ADMIN;
  const isSupervisorOrAdmin = user.role === Role.ADMIN || user.role === Role.SUPERVISOR;

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

      {autoCloseTimer !== null && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-4 py-2 rounded-full text-[10px] font-black animate-in fade-in zoom-in duration-300 flex items-center gap-2 shadow-xl border-2 border-white">
          <ClockIcon size={14} className="animate-pulse" />
          APERTURA TEMPORANEA: CHIUSURA TRA {Math.floor(autoCloseTimer / 60)}:{(autoCloseTimer % 60).toString().padStart(2, '0')}
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
            
            {isAdmin && error.message.includes('SCHEMA_ERROR') && (
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-[10px] font-bold uppercase text-indigo-800 mb-1">Esegui questo comando per AGGIORNARE il database (senza perdere dati):</p>
                <code className="block bg-black text-white p-2 rounded text-[9px] font-mono whitespace-pre-wrap mb-2">
{`ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS temporary_opening_until BIGINT,
ADD COLUMN IF NOT EXISTS registration_open BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pdf_title TEXT DEFAULT 'IN TAVOLA - PIZZA STAFF',
ADD COLUMN IF NOT EXISTS pdf_show_summary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pdf_show_list BOOLEAN DEFAULT true;`}
                </code>
                <p className="text-[9px] text-indigo-600 italic">Vai su Supabase → SQL Editor → Nuovo Progetto → incolla e premi RUN</p>
              </div>
            )}

            {isAdmin && (error.message.includes('pizzas') || error.message.includes('settings') || error.message.includes('users') || error.message.includes('orders')) && (
              <div className="p-3 bg-white/50 rounded-lg border border-red-200">
                <p className="text-[10px] font-bold uppercase text-red-800 mb-1">OPPURE: Reset totale (ATTENZIONE: cancella tutto):</p>
                <code className="block bg-black text-white p-2 rounded text-[9px] font-mono break-all whitespace-pre-wrap">
{`-- 1. Pulizia totale (rimuove sia tabelle che viste esistenti in modo sicuro)
DO $$ 
 DECLARE
    r RECORD;
 BEGIN
    -- Rimuove le viste se esistono
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname IN ('settings', 'users', 'pizzas', 'modifications', 'pizza_flags', 'days', 'day_overrides', 'orders')) LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
    
    -- Rimuove le tabelle se esistono
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('settings', 'users', 'pizzas', 'modifications', 'pizza_flags', 'days', 'day_overrides', 'orders')) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
 END $$;
 
 -- 2. Creazione tabelle reali
 CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  master_code TEXT DEFAULT 'PIZZA2025',
  override_cutoff BOOLEAN DEFAULT false,
  manager_phone TEXT,
  active_days TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI'],
  cutoff_time TEXT DEFAULT '16:30',
  temporary_opening_until BIGINT
 );
 INSERT INTO settings (id) VALUES ('global');
 
 CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_e164 TEXT,
  pin TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
 );
 
 CREATE TABLE pizzas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ingredients TEXT[],
  allergens TEXT[],
  active BOOLEAN DEFAULT true,
  is_vegetarian BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
 );
 
 CREATE TABLE modifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('ADD', 'REMOVE')),
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
 );
 
 CREATE TABLE pizza_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
 );
 
 CREATE TABLE days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  status TEXT NOT NULL,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
 );
 
 CREATE TABLE day_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
 );
 
 CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID REFERENCES days(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pizza_id UUID REFERENCES pizzas(id) ON DELETE CASCADE,
  slot_time TEXT NOT NULL,
  add_modification_ids UUID[],
  remove_modification_ids UUID[],
  flag_ids UUID[],
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(day_id, user_id)
 );
 
 -- 3. Inserisci Admin iniziale (PIN: 1234)
 INSERT INTO users (first_name, last_name, pin, role) 
 VALUES ('Admin', 'Principale', '1234', 'ADMIN');
 
 -- 4. Disabilita RLS
 ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
 ALTER TABLE users DISABLE ROW LEVEL SECURITY;
 ALTER TABLE pizzas DISABLE ROW LEVEL SECURITY;
 ALTER TABLE modifications DISABLE ROW LEVEL SECURITY;
 ALTER TABLE pizza_flags DISABLE ROW LEVEL SECURITY;
 ALTER TABLE days DISABLE ROW LEVEL SECURITY;
 ALTER TABLE day_overrides DISABLE ROW LEVEL SECURITY;
 ALTER TABLE orders DISABLE ROW LEVEL SECURITY;`}
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

        {/* Menu Amministratore / Supervisor */}
        {isSupervisorOrAdmin && (
          <div className="space-y-2 pt-4 border-t border-[#C6C6C8]">
            <p className="text-[9px] font-black text-[#8E8E93] uppercase tracking-[0.2em] mb-3 pl-1">Configurazione Gestionale</p>
            
            {/* Solo per Admin */}
            {isAdmin && (
              <Button variant="secondary" fullWidth onClick={() => onNavigate('calendar')} className="justify-start !bg-white border border-[#C6C6C8]/30">
                <Calendar size={18} className="text-[#007AFF]" /> Programmazione Orari
              </Button>
            )}

            {/* Per Admin e Supervisor */}
            <Button variant="secondary" fullWidth onClick={() => onNavigate('pizzas')} className="justify-start !bg-white border border-[#C6C6C8]/30">
              <PizzaIcon size={18} /> Lista Pizze Menu
            </Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('modifications')} className="justify-start !bg-white border border-[#C6C6C8]/30">
              <Sliders size={18} /> Lista Varianti
            </Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('flags')} className="justify-start !bg-white border border-[#C6C6C8]/30">
              <Flag size={18} className="text-[#5856D6]" /> Lista Flag (Etichette)
            </Button>

            {/* Solo per Admin */}
            {isAdmin && (
              <>
                <Button variant="secondary" fullWidth onClick={() => onNavigate('users')} className="justify-start !bg-white border border-[#C6C6C8]/30">
                  <UsersIcon size={18} /> Lista Dipendenti
                </Button>
                <Button variant="secondary" fullWidth onClick={() => onNavigate('history')} className="justify-start !bg-white border border-[#C6C6C8]/30">
                  <History size={18} /> Archivio Storico
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;