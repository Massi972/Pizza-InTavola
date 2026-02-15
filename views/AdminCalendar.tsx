
import React, { useState, useEffect } from 'react';
import { db, GlobalSettings } from '../services/db';
import { DayOverride, OverrideType, Day } from '../types';
import { Layout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { Calendar, Check, ClockIcon, Lock, Unlock, RotateCcw, AlertCircle } from '../components/Icons';
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
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [s, o, d] = await Promise.all([
        db.getSettings(),
        db.getOverrides(),
        db.getCurrentDay()
      ]);
      setSettings(s);
      setOverrides(o);
      setCurrentDayRecord(d);
      setError(null);
    } catch (err: any) {
      setError("Errore durante il caricamento dei dati: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRecurringDay = async (dayId: string) => {
    if (!settings) return;
    setActionLoading('recurring');
    
    const active = settings.active_days || [];
    const newActive = active.includes(dayId) 
      ? active.filter(d => d !== dayId) 
      : [...active, dayId];
    
    // Aggiornamento ottimistico della UI
    setSettings({ ...settings, active_days: newActive });

    try {
      await db.updateSettings({ active_days: newActive });
    } catch (err) {
      setError("Errore durante il salvataggio della ricorrenza.");
      // Rollback UI se fallisce
      setSettings(settings);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOverride = async (dateStr: string, currentStatus: any) => {
    setActionLoading(dateStr);
    try {
      const existingOverride = overrides.find(o => o.date === dateStr);
      
      if (existingOverride) {
        // Ripristina default se esiste già un'eccezione
        await db.deleteOverride(existingOverride.id);
      } else {
        // Crea eccezione
        const newType = currentStatus.isActive ? OverrideType.DISABLED : OverrideType.EXTRA;
        await db.saveOverride({
          date: dateStr,
          type: newType,
          note: 'Manuale'
        });
      }
      await fetchData();
    } catch (err) {
      setError("Errore nell'aggiornamento dell'eccezione.");
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
      const dStr = d.toLocaleDateString('en-CA');
      days.push({
        dateStr: dStr,
        availability: getDayAvailability(dStr, settings?.active_days || [], overrides, i === 0 ? currentDayRecord : null)
      });
    }
    return days;
  };

  if (loading && !settings) {
    return (
      <Layout title="Programmazione" onBack={onBack}>
        <div className="flex justify-center py-20"><div className="loading-spinner !w-10 !h-10" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Calendario Ricorrente" onBack={onBack}>
      <div className="space-y-8 pb-10">
        
        {/* MESSAGGI DI ERRORE */}
        {error && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-200 flex items-center gap-3 text-red-600 animate-in fade-in zoom-in duration-300">
            <AlertCircle size={20} />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        {/* LOOP SETTIMANALE */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ClockIcon size={18} className="text-[#007AFF]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Giorni di Attività (Loop)</p>
          </div>
          <Card className="p-4 bg-white/50 backdrop-blur-sm border border-white/40">
            <p className="text-[11px] text-[#8E8E93] mb-4 font-medium leading-relaxed">
              Tocca i giorni della settimana per attivare l'ordinazione automatica ricorrente.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map(day => {
                const isActive = settings?.active_days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    disabled={actionLoading === 'recurring'}
                    onClick={() => toggleRecurringDay(day.id)}
                    className={`px-3 py-3 rounded-2xl text-[11px] font-black transition-all border-2 flex items-center justify-center gap-2 relative overflow-hidden active:scale-95 ${
                      isActive 
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-md' 
                        : 'bg-white text-[#8E8E93] border-[#F2F2F7] shadow-sm'
                    }`}
                  >
                    {isActive ? <Check size={14} /> : null}
                    {day.label}
                    {actionLoading === 'recurring' && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* PREVIEW CALENDARIO */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Calendar size={18} className="text-[#34C759]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Prossime 2 Settimane</p>
          </div>
          
          <div className="space-y-3">
            {getNextDays().map(({ dateStr, availability }) => {
              const hasOverride = overrides.some(o => o.date === dateStr);
              const isToday = availability.isToday;

              return (
                <Card key={dateStr} className={`p-4 flex flex-col gap-4 border-2 transition-all ${
                  isToday ? 'border-[#007AFF] bg-white' : 'border-transparent bg-white/60'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-black text-[#1c1c1e]">{formatDate(dateStr)}</span>
                         {isToday && <span className="bg-[#007AFF] text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Oggi</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight ${availability.colorClass}`}>
                          {availability.label}
                        </span>
                        {hasOverride && (
                          <span className="text-[9px] font-bold text-[#5856D6] flex items-center gap-0.5 uppercase">
                            <RotateCcw size={11} /> Manuale
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                       <span className={`text-[10px] font-black uppercase tracking-tighter ${availability.isActive ? 'text-green-500' : 'text-red-500'}`}>
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
                        className="!rounded-2xl !text-[10px] !py-2.5 !bg-[#FF3B30] active:!bg-[#D70015]"
                        disabled={!!actionLoading}
                        onClick={() => handleToggleOverride(dateStr, availability)}
                      >
                        {actionLoading === dateStr ? <div className="loading-spinner !border-white" /> : <><Lock size={14} /> Disattiva Data</>}
                      </Button>
                    ) : (
                      <Button 
                        fullWidth 
                        size="sm" 
                        variant="primary" 
                        className="!rounded-2xl !text-[10px] !py-2.5 !bg-[#34C759] active:!bg-[#248A3D]"
                        disabled={!!actionLoading}
                        onClick={() => handleToggleOverride(dateStr, availability)}
                      >
                        {actionLoading === dateStr ? <div className="loading-spinner !border-white" /> : <><Unlock size={14} /> Attiva Extra</>}
                      </Button>
                    )}
                    
                    {hasOverride && (
                      <button 
                        disabled={!!actionLoading}
                        onClick={() => handleToggleOverride(dateStr, availability)}
                        className="p-2 bg-[#F2F2F7] text-[#8E8E93] rounded-2xl active:bg-[#E5E5EA] transition-colors border border-[#C6C6C8]"
                        title="Ripristina Loop"
                      >
                        <RotateCcw size={20} />
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
