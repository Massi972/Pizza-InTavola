
import React, { useState, useEffect } from 'react';
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
  Edit2, 
  Check, 
  AlertCircle, 
  X,
  Fingerprint,
  Sliders,
  RefreshCw,
  Download,
  FileText
} from '../components/Icons';
import { formatDate } from '../services/utils';
import { generateDayReportPDF, HydratedOrder } from '../services/exportService';
import { SLOT_TIMES } from '../constants';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'pizzas' | 'users' | 'history' | 'modifications') => void;
  onGoToOrder: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onNavigate, onGoToOrder }) => {
  const [currentDay, setCurrentDay] = useState<Day | null>(null);
  const [orders, setOrders] = useState<HydratedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [error, setError] = useState<{message: string, code?: string} | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('pizzastaff_biometric_enabled') === 'true');
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

  const handleDownloadReport = () => {
    if (!currentDay || orders.length === 0) {
      alert("Nessun ordine presente per oggi.");
      return;
    }
    generateDayReportPDF(currentDay.date, orders, SLOT_TIMES);
  };

  const toggleBiometrics = () => {
    if (biometricEnabled) {
      localStorage.removeItem('pizzastaff_stored_pin');
      localStorage.setItem('pizzastaff_biometric_enabled', 'false');
      setBiometricEnabled(false);
      setToast("Biometria disattivata");
    } else {
      localStorage.setItem('pizzastaff_stored_pin', user.pin);
      localStorage.setItem('pizzastaff_biometric_enabled', 'true');
      localStorage.removeItem('pizzastaff_biometric_declined');
      setBiometricEnabled(true);
      setToast("Biometria attivata");
    }
    setTimeout(() => setToast(null), 2000);
  };

  const isReadOnly = user.role === Role.SUPERVISOR;

  if (loading && !error) {
    return (
      <Layout title="Admin" onLogout={onLogout}>
        <div className="flex justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Admin" onLogout={onLogout}>
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

        {/* Pulsante Ordina per Admin/Supervisor */}
        <Card className="p-4 border-l-4 border-[#FF9500] bg-orange-50/30">
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-orange-100 text-orange-600 rounded-full">
                 <PizzaIcon size={24} />
               </div>
               <div>
                 <p className="text-[10px] font-bold text-[#8E8E93] uppercase">Sezione Personale</p>
                 <p className="text-sm font-bold">Prenota la tua pizza oggi</p>
               </div>
             </div>
             <Button onClick={onGoToOrder} size="sm" className="!py-2">
               Vai al Menu
             </Button>
           </div>
        </Card>

        <Card className="p-4 border-l-4 border-[#5856D6]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                <Fingerprint size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#8E8E93] uppercase">Sicurezza Accesso</p>
                <p className="text-sm font-bold">{biometricEnabled ? 'Biometria Attiva' : 'PIN Standard'}</p>
              </div>
            </div>
            <button 
              onClick={toggleBiometrics}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${
                biometricEnabled ? 'bg-red-50 text-[#FF3B30]' : 'bg-[#007AFF] text-white'
              }`}
            >
              {biometricEnabled ? 'Disattiva' : 'Attiva ora'}
            </button>
          </div>
        </Card>

        {settings && (
          <>
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs font-bold text-[#8E8E93] uppercase">Giorno</p>
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
                  <Button onClick={() => db.openDay().then(fetchData)} className="flex-1" disabled={isReadOnly || actionLoading}>
                    <Unlock size={18} /> Apri Ordini
                  </Button>
                ) : (
                  <Button onClick={() => db.closeDay().then(fetchData)} className="flex-1" variant="danger" disabled={isReadOnly || actionLoading}>
                    <Lock size={18} /> Chiudi Ordini
                  </Button>
                )}
              </div>
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
                className="!bg-[#34C759] hover:!bg-[#28A745] !py-4"
              >
                <FileText size={20} /> Scarica Report Ordini (PDF)
              </Button>
            )}
          </>
        )}

        <div className="space-y-2">
          <Button variant="secondary" fullWidth onClick={() => onNavigate('pizzas')} className="justify-start"><PizzaIcon size={18} /> Menu Pizze</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('modifications')} className="justify-start"><Sliders size={18} /> Variazioni</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('users')} className="justify-start"><UsersIcon size={18} /> Dipendenti</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('history')} className="justify-start"><History size={18} /> Storico</Button>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
