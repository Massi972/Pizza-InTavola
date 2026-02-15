
import React, { useState, useEffect } from 'react';
import { User, Day, DayStatus, SlotTime, Role, Modification } from '../types';
import { db, GlobalSettings } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button } from '../components/UI';
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
  Calendar
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
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('SCHEMA ERROR') || err.message?.includes('add_modification_ids')) {
        setSchemaError("CONFIGURAZIONE DATABASE NECESSARIA: Manca la colonna 'add_modification_ids'. Esegui lo script SQL nel pannello di controllo.");
      } else if (err.message?.includes('relation "settings" does not exist')) {
        setError({ message: "Tabella 'settings' mancante.", code: '42P01' });
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
      if (action === 'open') {
        await db.openDay();
      } else {
        await db.closeDay();
      }
      await fetchData();
    } catch (err: any) {
      alert("Errore durante l'operazione: " + err.message);
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
  const isSupervisor = user.role === Role.SUPERVISOR;

  if (loading && !error) {
    return (
      <Layout title="Admin" onLogout={onLogout}>
        <div className="flex justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Gestionale" onLogout={onLogout}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-4 py-2 rounded-full text-xs font-bold animate-in fade-in zoom-in duration-300">
          {toast}
        </div>
      )}

      <div className="space-y-6">
        {schemaError && (
          <Card className="p-4 bg-red-50 border-2 border-red-200 animate-pulse">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="shrink-0 mt-1" size={20} />
              <div className="space-y-2">
                <p className="text-xs font-black uppercase">Errore Critico Database</p>
                <p className="text-sm font-bold leading-tight">{schemaError}</p>
                <Button onClick={fetchData} variant="secondary" className="!py-1.5 !text-[10px] !bg-white">
                  <RefreshCw size={12} /> Riprova
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 border-l-4 border-[#FF9500] bg-orange-50/30">
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-orange-100 text-orange-600 rounded-full">
                 <PizzaIcon size={24} />
               </div>
               <div>
                 <p className="text-[10px] font-bold text-[#8E8E93] uppercase">Sezione Personale</p>
                 <p className="text-sm font-bold">Ordina la tua pizza</p>
               </div>
             </div>
             <Button onClick={onGoToOrder} size="sm" className="!py-2">
               Vai al Menu
             </Button>
           </div>
        </Card>

        {settings && (
          <>
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs font-bold text-[#8E8E93] uppercase">Status Ordini Staff</p>
                  <h2 className="text-lg font-bold">{formatDate(new Date())}</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  currentDay?.status === DayStatus.OPEN ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {currentDay?.status || 'NON APERTO'}
                </div>
              </div>
              <div className="flex gap-2">
                {!currentDay || currentDay.status === DayStatus.CLOSED ? (
                  <Button 
                    onClick={() => handleToggleDay('open')} 
                    className="flex-1" 
                    disabled={actionLoading}
                  >
                    <Unlock size={18} /> Apri Ordini
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleToggleDay('close')} 
                    className="flex-1" 
                    variant="danger" 
                    disabled={actionLoading}
                  >
                    <Lock size={18} /> Chiudi Ordini
                  </Button>
                )}
              </div>
              <p className="text-[9px] text-[#8E8E93] mt-3 text-center uppercase font-bold tracking-wider">
                Azioni rapide per {isSupervisor ? 'Supervisore' : 'Admin'}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 flex flex-col justify-center items-center text-center">
                <p className="text-[10px] font-bold text-[#8E8E93] uppercase mb-1">Totale Ordini</p>
                <p className="text-3xl font-black text-[#007AFF]">{orders.length}</p>
              </Card>
              <Card className="p-4 flex flex-col justify-center items-center text-center">
                <p className="text-[10px] font-bold text-[#8E8E93] uppercase mb-1">Codice Locale</p>
                <p className="text-lg font-mono font-black">{settings.master_code}</p>
              </Card>
            </div>

            {orders.length > 0 && (
              <Button 
                variant="primary" 
                fullWidth 
                onClick={handleDownloadReport}
                className="!bg-[#34C759] hover:!bg-[#28A745] !py-4 shadow-lg active:scale-95"
              >
                <FileText size={20} /> Scarica Report (PDF)
              </Button>
            )}
          </>
        )}

        {/* SEZIONE GESTIONE - SOLO PER ADMIN */}
        {isAdmin && (
          <div className="space-y-2 pt-4 border-t border-[#C6C6C8]">
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] mb-3 pl-1">Amministrazione</p>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('calendar')} className="justify-start !bg-white border-2 border-[#F2F2F7]"><Calendar size={18} className="text-[#007AFF]" /> Programmazione Calendario</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('pizzas')} className="justify-start"><PizzaIcon size={18} /> Menu Pizze</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('modifications')} className="justify-start"><Sliders size={18} /> Variazioni</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('users')} className="justify-start"><UsersIcon size={18} /> Gestione PIN e Dipendenti</Button>
            <Button variant="secondary" fullWidth onClick={() => onNavigate('history')} className="justify-start"><History size={18} /> Storico Giornate</Button>
          </div>
        )}
        
        {!isAdmin && (
          <p className="text-center text-[10px] text-[#8E8E93] font-bold uppercase py-6">
            Accesso limitato al ruolo Supervisore
          </p>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
