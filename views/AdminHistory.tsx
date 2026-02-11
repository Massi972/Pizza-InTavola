
import React, { useState, useEffect } from 'react';
import { Day, Order } from '../types';
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
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const fetchDays = async () => {
      setLoading(true);
      try {
        const data = await db.getDays();
        setDays(data);
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
        pizza: pizzas.find(p => p.id === o.pizzaId)
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
                    <div>
                      <p className="font-bold text-sm">{o.user?.firstName} {o.user?.lastName}</p>
                      <p className="text-xs text-[#007AFF] font-medium">{o.pizza?.name || 'Pizza eliminata'}</p>
                      {o.note && <p className="text-[10px] italic text-[#8E8E93]">"{o.note}"</p>}
                    </div>
                    <div className="text-[10px] font-bold bg-[#F2F2F7] px-2 py-0.5 rounded">
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
