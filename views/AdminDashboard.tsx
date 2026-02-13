
import React, { useState, useEffect } from 'react';
import { User, Day, DayStatus, SlotTime, Role } from '../types';
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
  X 
} from '../components/Icons';
import { formatDate } from '../services/utils';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'pizzas' | 'users' | 'history') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onNavigate }) => {
  const [currentDay, setCurrentDay] = useState<Day | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [error, setError] = useState<{message: string, code?: string} | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [day, globalSettings] = await Promise.all([
        db.getCurrentDay(),
        db.getSettings()
      ]);
      setCurrentDay(day);
      setSettings(globalSettings);
      
      if (day) {
        const [dayOrders, users, pizzas] = await Promise.all([
          db.getOrdersByDay(day.id),
          db.getUsers(),
          db.getPizzas()
        ]);
        const hydratedOrders = dayOrders.map(o => ({
          ...o,
          user: users.find(u => u.id === o.userId),
          pizza: pizzas.find(p => p.id === o.pizzaId)
        }));
        setOrders(hydratedOrders);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('relation "settings" does not exist')) {
        setError({ message: "Tabella 'settings' mancante nel database.", code: '42P01' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateSetting = async (key: keyof GlobalSettings, value: any) => {
    if (!settings) return;
    setActionLoading(true);
    setError(null);
    try {
      await db.updateSettings({ [key]: value });
      setSettings({ ...settings, [key]: value });
      setIsEditingCode(false);
      setIsEditingPhone(false);
    } catch (err: any) {
      console.error("Errore salvataggio settings:", err);
      setError({
        message: err.message || "Errore sconosciuto durante il salvataggio.",
        code: err.code
      });
    } finally {
      setActionLoading(false);
    }
  };

  const isReadOnly = user.role === Role.SUPERVISOR;

  if (loading && !error) {
    return (
      <Layout title="Admin" onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Admin" onLogout={onLogout}>
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
            
            {(error.message.includes('settings') || error.code === '42P01') && (
              <div className="p-3 bg-white/50 rounded-lg border border-red-200">
                <p className="text-[10px] font-bold uppercase text-red-800 mb-1">Copia ed esegui in Supabase SQL Editor:</p>
                <code className="block bg-black text-white p-2 rounded text-[9px] font-mono break-all whitespace-pre-wrap">
{`CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  master_code TEXT DEFAULT 'PIZZA2025',
  override_cutoff BOOLEAN DEFAULT false,
  manager_phone TEXT
);
INSERT INTO settings (id, master_code) VALUES ('global', 'PIZZA2025');`}
                </code>
              </div>
            )}
          </div>
        )}

        {settings && (
          <>
            {/* Gestione Giornata */}
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs font-bold text-[#8E8E93] uppercase">Stato Giornata</p>
                  <h2 className="text-lg font-bold">{formatDate(new Date())}</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  currentDay?.status === DayStatus.OPEN ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {currentDay ? (currentDay.status === DayStatus.OPEN ? 'APERTA' : 'CHIUSA') : 'MAI APERTA'}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  {!currentDay || currentDay.status === DayStatus.CLOSED ? (
                    <Button onClick={() => db.openDay().then(fetchData)} className="flex-1" variant="primary" disabled={isReadOnly || actionLoading}>
                       <Unlock size={18} /> Apri Giornata
                    </Button>
                  ) : (
                    <Button onClick={() => db.closeDay().then(fetchData)} className="flex-1" variant="danger" disabled={isReadOnly || actionLoading}>
                       <Lock size={18} /> Chiudi Giornata
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-[#F2F2F7] rounded-xl">
                  <span className="text-xs font-bold">Override Orario</span>
                  <button 
                    onClick={() => updateSetting('override_cutoff', !settings.override_cutoff)}
                    disabled={isReadOnly || actionLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.override_cutoff ? 'bg-[#34C759]' : 'bg-[#C6C6C8]'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.override_cutoff ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </Card>

            {/* Impostazioni Codici e WhatsApp */}
            <div className="grid grid-cols-1 gap-3">
              <Card className="p-4 border-l-4 border-[#007AFF]">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Codice Locale (Bacheca)</h3>
                  <button 
                    disabled={actionLoading}
                    onClick={() => isEditingCode ? updateSetting('master_code', settings.master_code) : setIsEditingCode(true)}
                  >
                    {isEditingCode ? (actionLoading ? <div className="loading-spinner" /> : <Check size={16} />) : <Edit2 size={14} />}
                  </button>
                </div>
                {isEditingCode ? (
                  <Input 
                    autoFocus
                    value={settings.master_code} 
                    onChange={e => setSettings({...settings, master_code: e.target.value.toUpperCase()})}
                    className="font-mono font-bold tracking-widest uppercase"
                  />
                ) : (
                  <span className="text-2xl font-mono font-black text-[#007AFF]">{settings.master_code}</span>
                )}
              </Card>

              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Numero WhatsApp Locale</h3>
                  <button 
                    disabled={actionLoading}
                    onClick={() => isEditingPhone ? updateSetting('manager_phone', settings.manager_phone) : setIsEditingPhone(true)}
                  >
                    {isEditingPhone ? (actionLoading ? <div className="loading-spinner" /> : <Check size={16} />) : <Edit2 size={14} />}
                  </button>
                </div>
                {isEditingPhone ? (
                  <Input 
                    autoFocus
                    placeholder="39333..."
                    value={settings.manager_phone} 
                    onChange={e => setSettings({...settings, manager_phone: e.target.value})}
                  />
                ) : (
                  <span className="text-sm font-bold text-green-600">{settings.manager_phone || 'Non configurato'}</span>
                )}
              </Card>
            </div>

            {/* Statistiche Quick */}
            <div className="grid grid-cols-3 gap-2">
              {['17:30', '18:00', '19:00'].map(slot => (
                <Card key={slot} className="p-3 text-center">
                  <p className="text-[10px] font-bold text-[#8E8E93]">{slot}</p>
                  <p className="text-lg font-bold text-[#007AFF]">{orders.filter(o => o.slotTime === slot).length}</p>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Quick Links */}
        <div className="space-y-2">
          <Button variant="secondary" fullWidth onClick={() => onNavigate('pizzas')} className="justify-start"><PizzaIcon size={18} /> Menu Pizze</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('users')} className="justify-start"><UsersIcon size={18} /> Dipendenti</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('history')} className="justify-start"><History size={18} /> Storico</Button>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
