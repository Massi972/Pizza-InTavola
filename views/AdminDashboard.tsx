
import React, { useState, useEffect } from 'react';
import { User, Day, DayStatus, SlotTime, Role } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { 
  UsersIcon, 
  PizzaIcon, 
  History, 
  Unlock, 
  Lock, 
  FileText, 
  Download,
  TableIcon,
  Edit2,
  Check
} from '../components/Icons';
import { formatDate } from '../services/utils';
import { exportToCSV, exportToXLSX, exportToPDF } from '../services/exportService';

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
  const [viewMode, setViewMode] = useState<'byUser' | 'byPizza'>('byUser');
  const [masterCode, setMasterCode] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [day, code] = await Promise.all([
        db.getCurrentDay(),
        db.getMasterCode()
      ]);
      setCurrentDay(day);
      setMasterCode(code);
      
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateCode = async () => {
    setActionLoading(true);
    try {
      await db.updateMasterCode(masterCode);
      setIsEditingCode(false);
    } catch (err) {
      alert("Errore salvataggio codice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDay = async () => {
    setActionLoading(true);
    try {
      await db.openDay();
      await fetchData();
    } catch (err) {
      alert("Errore nell'apertura giornata");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseDay = async () => {
    if (window.confirm("Chiudere gli ordini per oggi?")) {
      setActionLoading(true);
      try {
        await db.closeDay();
        await fetchData();
      } catch (err) {
        alert("Errore nella chiusura giornata");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const totalsBySlot = orders.reduce((acc, o) => {
    acc[o.slotTime] = (acc[o.slotTime] || 0) + 1;
    return acc;
  }, {} as any);

  const totalsByPizza = orders.reduce((acc, o) => {
    const pizzaName = o.pizza?.name || 'Sconosciuta';
    acc[pizzaName] = (acc[pizzaName] || 0) + 1;
    return acc;
  }, {} as any);

  const ordersBySlot = orders.reduce((acc, o) => {
    if (!acc[o.slotTime]) acc[o.slotTime] = [];
    acc[o.slotTime].push(o);
    return acc;
  }, {} as Record<string, any[]>);

  const handleExport = (type: 'pdf' | 'xlsx' | 'csv') => {
    if (!currentDay) return;
    const dateStr = currentDay.date;
    switch(type) {
      case 'csv': exportToCSV(dateStr, orders); break;
      case 'xlsx': exportToXLSX(dateStr, orders); break;
      case 'pdf': exportToPDF(dateStr, ordersBySlot as any, totalsByPizza); break;
    }
  };

  const isReadOnly = user.role === Role.SUPERVISOR;

  if (loading) {
    return (
      <Layout title="Admin" onLogout={onLogout}>
        <div className="flex flex-col items-center justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Admin" onLogout={onLogout}>
      <div className="space-y-6">
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
          <div className="flex gap-2">
            {!currentDay || currentDay.status === DayStatus.CLOSED ? (
              <Button onClick={handleOpenDay} className="flex-1" variant="primary" disabled={isReadOnly || actionLoading}>
                {actionLoading ? <div className="loading-spinner border-white border-t-transparent" /> : <><Unlock size={18} /> Apri Giornata</>}
              </Button>
            ) : (
              <Button onClick={handleCloseDay} className="flex-1" variant="danger" disabled={isReadOnly || actionLoading}>
                {actionLoading ? <div className="loading-spinner border-white border-t-transparent" /> : <><Lock size={18} /> Chiudi Giornata</>}
              </Button>
            )}
          </div>
        </Card>

        {/* Codice Locale per Dipendenti */}
        <Card className="p-4 border-l-4 border-[#007AFF]">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-[#8E8E93] uppercase">Codice Locale (per attivazione dipendenti)</h3>
            {!isReadOnly && (
              <button onClick={() => isEditingCode ? handleUpdateCode() : setIsEditingCode(true)} className="text-[#007AFF]">
                {isEditingCode ? <Check size={18} /> : <Edit2 size={16} />}
              </button>
            )}
          </div>
          {isEditingCode ? (
            <Input 
              value={masterCode} 
              onChange={e => setMasterCode(e.target.value.toUpperCase())}
              className="font-mono font-bold tracking-widest uppercase"
              placeholder="Inserisci nuovo codice"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-black tracking-tighter text-[#007AFF]">{masterCode}</span>
              <p className="text-[10px] text-[#8E8E93] leading-tight">Scrivi questo codice in bacheca. I dipendenti lo useranno per impostare il loro PIN.</p>
            </div>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {(['17:30', '18:00', '19:00'] as SlotTime[]).map(slot => (
            <Card key={slot} className="p-3 text-center">
              <p className="text-[10px] font-bold text-[#8E8E93] uppercase">{slot}</p>
              <p className="text-xl font-bold text-[#007AFF]">{totalsBySlot[slot] || 0}</p>
            </Card>
          ))}
        </div>

        {/* Riepilogo Ordini */}
        {orders.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Ordini di oggi ({orders.length})</h3>
              <div className="flex bg-[#E5E5EA] p-1 rounded-lg">
                <button onClick={() => setViewMode('byUser')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'byUser' ? 'bg-white shadow-sm' : 'text-[#8E8E93]'}`}>Dipendente</button>
                <button onClick={() => setViewMode('byPizza')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'byPizza' ? 'bg-white shadow-sm' : 'text-[#8E8E93]'}`}>Pizza</button>
              </div>
            </div>
            {viewMode === 'byUser' ? (
              <div className="space-y-6">
                {(['17:30', '18:00', '19:00'] as SlotTime[]).map(slot => (
                  <div key={slot} className="space-y-2">
                    {ordersBySlot[slot]?.length > 0 && (
                      <>
                        <h4 className="text-xs font-bold text-[#8E8E93] uppercase pl-1">{slot}</h4>
                        <div className="space-y-2">
                          {ordersBySlot[slot].map(o => (
                            <Card key={o.id} className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-sm">{o.user?.firstName} {o.user?.lastName}</p>
                                  <p className="text-xs text-[#007AFF] font-medium">{o.pizza?.name}</p>
                                  {o.note && <p className="text-[10px] italic text-[#8E8E93] mt-1">"{o.note}"</p>}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(totalsByPizza).map(([name, qty]) => (
                  <Card key={name} className="p-4 flex justify-between items-center">
                    <p className="font-bold">{name}</p>
                    <div className="bg-[#007AFF] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{qty as any}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export Actions */}
        {orders.length > 0 && (
          <Card className="p-4">
            <h3 className="font-bold text-sm uppercase text-[#8E8E93] mb-3">Esporta Riepilogo</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => handleExport('pdf')} className="!p-2 text-xs"><FileText size={16} /> PDF</Button>
              <Button variant="secondary" onClick={() => handleExport('xlsx')} className="!p-2 text-xs"><TableIcon size={16} /> XLSX</Button>
              <Button variant="secondary" onClick={() => handleExport('csv')} className="!p-2 text-xs"><Download size={16} /> CSV</Button>
            </div>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 gap-2">
          <Button variant="secondary" fullWidth onClick={() => onNavigate('pizzas')} className="justify-start"><PizzaIcon size={20} className="text-[#007AFF]" /> Gestione Menu Pizze</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('users')} className="justify-start"><UsersIcon size={20} className="text-[#5856D6]" /> Gestione Dipendenti</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('history')} className="justify-start"><History size={20} className="text-[#FF9500]" /> Storico Ordini</Button>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
