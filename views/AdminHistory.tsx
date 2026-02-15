
import React, { useState, useEffect } from 'react';
import { Day, Order, Modification, User, Pizza } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { Calendar, ChevronRight, FileText, Download, TableIcon, AlertCircle } from '../components/Icons';
import { formatDate } from '../services/utils';
import { generateFullHistoryPDF, generateHistoryCSV, HydratedOrder } from '../services/exportService';

interface AdminHistoryProps {
  onBack: () => void;
}

const AdminHistory: React.FC<AdminHistoryProps> = ({ onBack }) => {
  const [days, setDays] = useState<Day[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [dayOrders, setDayOrders] = useState<any[]>([]);
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dayList, modList, orderList, userList, pizzaList] = await Promise.all([
          db.getDays(),
          db.getModifications(),
          db.getAllOrders(),
          db.getUsers(),
          db.getPizzas()
        ]);
        setDays(dayList);
        setModifications(modList);
        setAllOrders(orderList);
        setUsers(userList);
        setPizzas(pizzaList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSelectDay = async (day: Day) => {
    setSelectedDay(day);
    setOrdersLoading(true);
    try {
      const orders = await db.getOrdersByDay(day.id);
      setDayOrders(orders.map(o => ({
        ...o,
        user: users.find(u => u.id === o.userId),
        pizza: pizzas.find(p => p.id === o.pizzaId),
        addMods: (o.addModificationIds || []).map((id: string) => modifications.find(m => m.id === id)).filter(Boolean),
        removeMods: (o.removeModificationIds || []).map((id: string) => modifications.find(m => m.id === id)).filter(Boolean)
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const getHydratedFullHistory = (): HydratedOrder[] => {
    return allOrders.map(o => {
      const day = days.find(d => d.id === o.dayId);
      return {
        ...o,
        dayDate: day?.date,
        user: users.find(u => u.id === o.userId),
        pizza: pizzas.find(p => p.id === o.pizzaId),
        addMods: (o.addModificationIds || []).map(id => modifications.find(m => m.id === id)).filter(Boolean) as Modification[],
        removeMods: (o.removeModificationIds || []).map(id => modifications.find(m => m.id === id)).filter(Boolean) as Modification[]
      };
    });
  };

  const handleExportPDF = () => {
    setExporting(true);
    const hydrated = getHydratedFullHistory();
    generateFullHistoryPDF(hydrated);
    setExporting(false);
  };

  const handleExportCSV = () => {
    setExporting(true);
    const hydrated = getHydratedFullHistory();
    generateHistoryCSV(hydrated);
    setExporting(false);
  };

  // Calcolo statistiche
  const stats = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const ordersWithDates = allOrders.map(o => {
      const day = days.find(d => d.id === o.dayId);
      return { ...o, date: day ? new Date(day.date) : null };
    });

    const monthOrders = ordersWithDates.filter(o => o.date && o.date.getMonth() === currentMonth && o.date.getFullYear() === currentYear);
    const yearOrders = ordersWithDates.filter(o => o.date && o.date.getFullYear() === currentYear);

    return {
      total: allOrders.length,
      month: monthOrders.length,
      year: yearOrders.length,
      avgPerDay: days.length > 0 ? (allOrders.length / days.length).toFixed(1) : 0
    };
  }, [allOrders, days]);

  return (
    <Layout title="Storico e Report" onBack={selectedDay ? () => setSelectedDay(null) : onBack}>
      {loading ? (
        <div className="flex justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      ) : !selectedDay ? (
        <div className="space-y-6">
          
          {/* Dashboard Statistiche */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-white border-l-4 border-[#007AFF]">
              <p className="text-[10px] font-black text-[#8E8E93] uppercase mb-1">Totale Storico</p>
              <p className="text-2xl font-black">{stats.total}</p>
              <p className="text-[9px] font-bold text-[#8E8E93] mt-1">Media {stats.avgPerDay} /gg</p>
            </Card>
            <Card className="p-4 bg-white border-l-4 border-[#34C759]">
              <p className="text-[10px] font-black text-[#8E8E93] uppercase mb-1">Mese Corrente</p>
              <p className="text-2xl font-black">{stats.month}</p>
              <p className="text-[9px] font-bold text-[#8E8E93] mt-1">{new Date().toLocaleString('it-IT', { month: 'long' })}</p>
            </Card>
            <Card className="p-4 bg-white border-l-4 border-[#5856D6] col-span-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-[#8E8E93] uppercase mb-1">Anno {new Date().getFullYear()}</p>
                  <p className="text-2xl font-black">{stats.year}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-[#8E8E93] uppercase">Giornate Lavorate</p>
                  <p className="text-lg font-black">{days.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Azioni Esportazione */}
          <section className="space-y-2">
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Esporta Dati Completi</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={handleExportPDF} disabled={exporting || allOrders.length === 0} className="!bg-white !border-[#C6C6C8] border !text-xs">
                <FileText size={16} /> Storico PDF
              </Button>
              <Button variant="secondary" onClick={handleExportCSV} disabled={exporting || allOrders.length === 0} className="!bg-white !border-[#C6C6C8] border !text-xs">
                <TableIcon size={16} /> Storico CSV
              </Button>
            </div>
          </section>

          {/* Lista Giornate */}
          <section className="space-y-3">
             <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest pl-1">Dettaglio Giornaliero</p>
            {days.length === 0 ? (
              <div className="text-center py-10">
                <Calendar size={48} className="mx-auto text-[#C6C6C8] mb-4" />
                <p className="text-[#8E8E93]">Nessuna giornata registrata</p>
              </div>
            ) : (
              <div className="space-y-2">
                {days.map(day => (
                  <Card 
                    key={day.id} 
                    className="p-4 flex justify-between items-center cursor-pointer active:bg-[#F2F2F7] transition-colors"
                    onClick={() => handleSelectDay(day)}
                  >
                    <div>
                      <h3 className="font-bold text-sm">{formatDate(day.date)}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          day.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {day.status}
                        </span>
                        <span className="text-[10px] font-bold text-[#8E8E93]">
                          {allOrders.filter(o => o.dayId === day.id).length} ordini
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-[#C6C6C8]" />
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center">
            <div>
               <h2 className="text-xl font-bold">{formatDate(selectedDay.date)}</h2>
               <p className="text-[10px] text-[#8E8E93] font-bold uppercase">Riepilogo della giornata</p>
            </div>
            <div className="text-sm font-black bg-[#007AFF] text-white px-4 py-1.5 rounded-full shadow-sm">
              {dayOrders.length} pizze
            </div>
          </div>

          {ordersLoading ? (
            <div className="flex justify-center py-10"><div className="loading-spinner" /></div>
          ) : (
            <div className="space-y-2">
              {dayOrders.length === 0 && (
                 <p className="text-center text-[#8E8E93] py-10 italic">Nessun ordine trovato per questa data.</p>
              )}
              {dayOrders.map(o => (
                <Card key={o.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{o.user?.firstName} {o.user?.lastName}</p>
                        <span className="text-[9px] font-black bg-[#F2F2F7] px-1.5 py-0.5 rounded text-[#8E8E93]">{o.slotTime}</span>
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                         <p className="text-xs text-[#007AFF] font-bold">{o.pizza?.name || 'Pizza eliminata'}</p>
                         <div className="flex flex-wrap gap-1">
                           {o.addMods?.map((m: Modification) => (
                             <span key={m.id} className="text-[8px] font-black text-green-600 bg-green-50 px-1 rounded">+{m.name}</span>
                           ))}
                           {o.removeMods?.map((m: Modification) => (
                             <span key={m.id} className="text-[8px] font-black text-red-500 bg-red-50 px-1 rounded">-{m.name}</span>
                           ))}
                         </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default AdminHistory;
