
import React, { useState, useEffect } from 'react';
import { Day, Order, Modification } from '../types';
import { db } from '../services/db';
import { Layout } from '../components/Layout';
import { Card } from '../components/UI';
import { Calendar, ChevronRight } from '../components/Icons';
import { formatDate } from '../services/utils';

interface AdminHistoryProps {
  onBack: () => void;
}

const AdminHistory: React.FC<AdminHistoryProps> = ({ onBack }) => {
  const [days, setDays] = useState<Day[]>([]);
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const fetchDays = async () => {
      setLoading(true);
      try {
        const [dayList, modList] = await Promise.all([
          db.getDays(),
          db.getModifications()
        ]);
        setDays(dayList);
        setModifications(modList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDays();
  }, []);

  const handleSelectDay = async (day: Day) => {
    setSelectedDay(day);
    setOrdersLoading(true);
    try {
      const dayOrders = await db.getOrdersByDay(day.id);
      const [users, pizzas] = await Promise.all([
        db.getUsers(),
        db.getPizzas()
      ]);
      
      setOrders(dayOrders.map(o => ({
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

  return (
    <Layout title="Storico Ordini" onBack={selectedDay ? () => setSelectedDay(null) : onBack}>
      {loading ? (
        <div className="flex justify-center py-20"><div className="loading-spinner" /></div>
      ) : !selectedDay ? (
        <div className="space-y-3">
          {days.length === 0 ? (
            <div className="text-center py-10">
              <Calendar size={48} className="mx-auto text-[#C6C6C8] mb-4" />
              <p className="text-[#8E8E93]">Nessuna giornata registrata</p>
            </div>
          ) : (
            days.map(day => (
              <Card 
                key={day.id} 
                className="p-4 flex justify-between items-center cursor-pointer active:bg-[#F2F2F7]"
                onClick={() => handleSelectDay(day)}
              >
                <div>
                  <h3 className="font-bold">{formatDate(day.date)}</h3>
                  <p className="text-xs text-[#8E8E93]">Status: {day.status}</p>
                </div>
                <ChevronRight size={20} className="text-[#C6C6C8]" />
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{formatDate(selectedDay.date)}</h2>
            <div className="text-sm font-bold bg-[#007AFF] text-white px-3 py-1 rounded-full">
              {orders.length} ordini
            </div>
          </div>

          {ordersLoading ? (
            <div className="flex justify-center py-10"><div className="loading-spinner" /></div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <Card key={o.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{o.user?.firstName} {o.user?.lastName}</p>
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
                    <div className="text-[10px] font-bold bg-[#F2F2F7] px-2 py-0.5 rounded ml-2">
                      {o.slotTime}
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
