
import React, { useState, useEffect } from 'react';
import { db, GlobalSettings } from '../services/db';
import { DayOverride, OverrideType, Day } from '../types';
import { Layout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { Calendar, Trash2, Check, ClockIcon, X, Unlock, Lock, RotateCcw } from '../components/Icons';
import { formatDate, getDayAvailability } from '../services/utils';

const WEEKDAYS = [
  { id: 'MON', label: 'Lunedì' },
  { id: 'TUE', label: 'Martedì' },
  { id: 'WED', label: 'Mercoledì' },
  { id: 'THU', label: 'Giovedì' },
  { id: 'FRI', label: 'Venerdì' },
  { id: 'SAT', label: 'Sabato' },
  { id: 'SUN', label: 'Domenica' }
];

const AdminCalendar: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [currentDayRecord, setCurrentDayRecord] = useState<Day | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, o, d] = await Promise.all([
        db.getSettings(),
        db.getOverrides(),
        db.getCurrentDay()
      ]);
      setSettings(s);
      setOverrides(o);
      setCurrentDayRecord(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRecurringDay = async (dayId: string) => {
    if (!settings) return;
    const active = settings.active_days || [];
    const newActive = active.includes(dayId) 
      ? active.filter(d => d !== dayId) 
      : [...active, dayId];
    
    try {
      await db.updateSettings({ active_days: newActive });
      setSettings({ ...settings, active_days: newActive });
    } catch (err) {
      alert("Errore salvataggio ricorrenza");
    }
  };

  const handleToggleOverride = async (dateStr: string, currentStatus: any) => {
    setActionLoading(dateStr);
    try {
      const existingOverride = overrides.find(o => o.date === dateStr);
      
      if (existingOverride) {
        // Se esiste già un'eccezione, la rimuoviamo (ripristina default)
        await db.deleteOverride(existingOverride.id);
      } else {
        // Se non esiste, creiamo l'eccezione opposta allo stato attuale
        const newType = currentStatus.isActive ? OverrideType.DISABLED : OverrideType.EXTRA;
        await db.saveOverride({
          date: dateStr,
          type: newType,
          note: 'Manuale da calendario'
        });
      }
      await fetchData();
    } catch (err) {
      alert("Errore nell'aggiornamento della data");
    } finally {
      setActionLoading(null);
    }
  };

  const getNextDays = () => {
    const days = [];
    const start = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      days.push({
        dateStr: dStr,
        availability: getDayAvailability(dStr, settings?.active_days || [], overrides, i === 0 ? currentDayRecord : null)
      });
    }
    return days;
  };

  if (loading && !settings) return <Layout title="Calendario" onBack={onBack}><div className="flex justify-center py-20"><div className="loading-spinner" /></div></Layout>;

  return (
    <Layout title="Gestione Date" onBack={onBack}>
      <div className="space-y-8 pb-10">
        
        {/* Sezione Giorni Ricorrenti */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ClockIcon size={18} className="text-[#007AFF]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Programma Settimanale (Loop)</p>
          </div>
          <Card className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map(day => {
                const isActive = settings?.active_days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleRecurringDay(day.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2 flex items-center justify-center gap-2 ${
                      isActive 
                        ? 'bg-[#007AFF] text-white border-[#007AFF]' 
                        : 'bg-white text-[#8E8E93] border-[#F2F2F7] shadow-sm'
                    }`}
                  >
                    {isActive && <Check size={14} />}
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-[#8E8E93] mt-3 italic text-center">I giorni selezionati saranno aperti automaticamente ogni settimana.</p>
          </Card>
        </section>

        {/* Prossimi 14 Giorni Interattivi */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Calendar size={18} className="text-[#34C759]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Calendario Prossime 2 Settimane</p>
          </div>
          
          <div className="space-y-3">
            {getNextDays().map(({ dateStr, availability }) => {
              const hasOverride = overrides.some(o => o.date === dateStr);
              const isToday = availability.isToday;

              return (
                <Card key={dateStr} className={`p-4 flex flex-col gap-3 transition-all ${isToday ? 'ring-2 ring-[#007AFF] ring-inset' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-black text-[#1c1c1e]">{formatDate(dateStr)}</span>
                         {isToday && <span className="bg-[#007AFF] text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase">Oggi</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${availability.colorClass}`}>
                          {availability.label}
                        </span>
                        {hasOverride && (
                          <span className="text-[8px] font-bold text-[#5856D6] uppercase flex items-center gap-0.5">
                            <RotateCcw size={10} /> Eccezione Attiva
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                       <span className={`text-[10px] font-black uppercase ${availability.isActive ? 'text-green-500' : 'text-red-500'}`}>
                         {availability.isActive ? '● Aperto' : '● Chiuso'}
                       </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {availability.isActive ? (
                      <Button 
                        fullWidth 
                        size="sm" 
                        variant="danger" 
                        className="!rounded-xl !text-[10px] !py-2"
                        disabled={actionLoading === dateStr}
                        onClick={() => handleToggleOverride(dateStr, availability)}
                      >
                        {actionLoading === dateStr ? <div className="loading-spinner border-white" /> : <><Lock size={14} /> Forza Chiusura</>}
                      </Button>
                    ) : (
                      <Button 
                        fullWidth 
                        size="sm" 
                        variant="primary" 
                        className="!rounded-xl !text-[10px] !py-2 !bg-[#34C759]"
                        disabled={actionLoading === dateStr}
                        onClick={() => handleToggleOverride(dateStr, availability)}
                      >
                        {actionLoading === dateStr ? <div className="loading-spinner border-white" /> : <><Unlock size={14} /> Forza Apertura</>}
                      </Button>
                    )}
                    
                    {hasOverride && (
                      <button 
                        onClick={() => handleToggleOverride(dateStr, availability)}
                        className="p-2 bg-[#F2F2F7] text-[#8E8E93] rounded-xl active:bg-[#E5E5EA]"
                        title="Ripristina Default"
                      >
                        <RotateCcw size={18} />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

      </div>
    </Layout>
  );
};

export default AdminCalendar;
