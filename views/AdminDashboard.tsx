
import React, { useState, useEffect, useRef } from 'react';
import { User, Day, DayStatus, SlotTime, Role, Modification } from '../types';
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
  RotateCcw
} from '../components/Icons';
import { formatDate } from '../services/utils';
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
  const [error, setError] = useState<{message: string, code?: string} | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [clickCount, setClickCount] = useState(0);
  const [showResetPin, setShowResetPin] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setSchemaError(null);
    try {
      const [day, globalSettings] = await Promise.all([
        db.getCurrentDay(),
        db.getSettings()
      ]);
      setCurrentDay(day);
      setSettings(globalSettings);
      
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
      if (err.message?.includes('add_modification_ids')) {
        setSchemaError("CONFIGURAZIONE DATABASE NECESSARIA: Esegui lo script SQL nel pannello di controllo.");
      } else {
        setError({ message: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleDay = async (action: 'open' | 'close') => {
    setActionLoading(true);
    try {
      if (action === 'open') await db.openDay();
      else await db.closeDay();
      await fetchData();
    } catch (err: any) {
      alert("Errore: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin = user.role === Role.ADMIN;
  const isSupervisor = user.role === Role.SUPERVISOR;

  if (loading && !error) {
    return (
      <Layout title="Dashboard Gestionale" onLogout={onLogout}>
        <div className="flex justify-center py-24"><div className="loading-spinner !w-12 !h-12" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Gestionale" onLogout={onLogout}>
      <div className="space-y-8">
        {/* Sezione Personale - Responsive Width */}
        <Card className="p-6 border-l-8 border-[#FF9500] bg-orange-50/20 max-w-2xl mx-auto shadow-lg">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-4">
               <div className="p-4 bg-orange-100 text-orange-600 rounded-[22%] shadow-sm shrink-0">
                 <PizzaIcon size={32} />
               </div>
               <div>
                 <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-widest">Accesso Dipendente</p>
                 <p className="text-xl font-black text-[#1c1c1e]">Ordina la tua pizza</p>
               </div>
             </div>
             <Button onClick={onGoToOrder} className="!px-10 !py-4 !text-lg !rounded-2xl w-full sm:w-auto shadow-md">
               Vai al Menu
             </Button>
           </div>
        </Card>

        {/* Status e Totali - Grid Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 flex flex-col justify-between shadow-md">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-black text-[#8E8E93] uppercase tracking-widest">Giorno Corrente</p>
                    <h2 className="text-2xl font-black">{formatDate(new Date())}</h2>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-tight ${
                    currentDay?.status === DayStatus.OPEN ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {currentDay?.status === DayStatus.OPEN ? 'SERVIZIO APERTO' : 'SERVIZIO CHIUSO'}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                {!currentDay || currentDay.status === DayStatus.CLOSED ? (
                  <Button 
                    onClick={() => handleToggleDay('open')} 
                    className="flex-1 !py-4 shadow-sm" 
                    disabled={actionLoading}
                  >
                    <Unlock size={20} /> Apri Prenotazioni
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleToggleDay('close')} 
                    className="flex-1 !py-4" 
                    variant="danger" 
                    disabled={actionLoading}
                  >
                    <Lock size={20} /> Chiudi Prenotazioni
                  </Button>
                )}
              </div>
            </Card>

            <Card className="p-6 flex flex-col justify-center items-center text-center shadow-md border-b-8 border-[#007AFF]">
              <p className="text-xs font-black text-[#8E8E93] uppercase tracking-widest mb-2">Pizze Prenotate Oggi</p>
              <div className="relative">
                <p className="text-6xl font-black text-[#007AFF] drop-shadow-sm">{orders.length}</p>
                <div className="absolute -top-1 -right-4 w-4 h-4 bg-[#007AFF] rounded-full animate-ping opacity-20" />
              </div>
              {orders.length > 0 && (
                <button 
                  onClick={() => generateDayReportPDF(currentDay!.date, orders, SLOT_TIMES)}
                  className="mt-6 flex items-center gap-2 text-[#34C759] font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform"
                >
                  <FileText size={18} /> Scarica Report Cucina
                </button>
              )}
            </Card>
        </div>

        {/* Pannello Amministrazione - Griglia Adattiva */}
        {isAdmin && (
          <section className="pt-4 border-t border-[#C6C6C8]/50">
            <p className="text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.3em] mb-6 px-1">Gestione Sistema</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="secondary" onClick={() => onNavigate('calendar')} className="justify-start !bg-white border-2 border-transparent hover:border-[#007AFF]/20 !p-5 shadow-sm">
                <Calendar size={22} className="text-[#007AFF]" />
                <div className="text-left">
                   <p className="text-base font-black">Calendario</p>
                   <p className="text-[10px] text-[#8E8E93] font-bold uppercase">Automazioni e Loop</p>
                </div>
              </Button>
              
              <Button variant="secondary" onClick={() => onNavigate('pizzas')} className="justify-start !bg-white border-2 border-transparent hover:border-[#007AFF]/20 !p-5 shadow-sm">
                <PizzaIcon size={22} className="text-[#007AFF]" />
                <div className="text-left">
                   <p className="text-base font-black">Menu Pizze</p>
                   <p className="text-[10px] text-[#8E8E93] font-bold uppercase">Lista prodotti attivi</p>
                </div>
              </Button>

              <Button variant="secondary" onClick={() => onNavigate('modifications')} className="justify-start !bg-white border-2 border-transparent hover:border-[#007AFF]/20 !p-5 shadow-sm">
                <Sliders size={22} className="text-[#007AFF]" />
                <div className="text-left">
                   <p className="text-base font-black">Variazioni</p>
                   <p className="text-[10px] text-[#8E8E93] font-bold uppercase">Ingredienti extra/meno</p>
                </div>
              </Button>

              <Button variant="secondary" onClick={() => onNavigate('users')} className="justify-start !bg-white border-2 border-transparent hover:border-[#007AFF]/20 !p-5 shadow-sm">
                <UsersIcon size={22} className="text-[#007AFF]" />
                <div className="text-left">
                   <p className="text-base font-black">Staff e PIN</p>
                   <p className="text-[10px] text-[#8E8E93] font-bold uppercase">Gestione dipendenti</p>
                </div>
              </Button>

              <Button variant="secondary" onClick={() => onNavigate('history')} className="justify-start !bg-white border-2 border-transparent hover:border-[#007AFF]/20 !p-5 shadow-sm">
                <History size={22} className="text-[#007AFF]" />
                <div className="text-left">
                   <p className="text-base font-black">Storico</p>
                   <p className="text-[10px] text-[#8E8E93] font-bold uppercase">Tutti gli ordini passati</p>
                </div>
              </Button>
            </div>
          </section>
        )}
        
        {!isAdmin && (
          <div className="text-center py-12 bg-white rounded-3xl border border-[#C6C6C8]/30">
            <Lock size={32} className="mx-auto text-[#C6C6C8] mb-3" />
            <p className="text-sm font-black text-[#8E8E93] uppercase tracking-widest">Accesso limitato supervisore</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
