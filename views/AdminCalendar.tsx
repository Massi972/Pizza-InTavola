
import React, { useState, useEffect } from 'react';
import { db, GlobalSettings } from '../services/db';
import { DayOverride, Day } from '../types';
import { Layout } from '../components/Layout';
import { Card } from '../components/UI';
import { Check, ClockIcon, Calendar, AlertCircle, RotateCcw } from '../components/Icons';
import { formatDate, getDayAvailability } from '../services/utils';

const WEEKDAYS = [
  { id: 'MON', label: 'Lun' },
  { id: 'TUE', label: 'Mar' },
  { id: 'WED', label: 'Mer' },
  { id: 'THU', label: 'Gio' },
  { id: 'FRI', label: 'Ven' },
  { id: 'SAT', label: 'Sab' },
  { id: 'SUN', label: 'Dom' }
];

const AdminCalendar: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [currentDay, setCurrentDay] = useState<Day | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [s, o, d] = await Promise.all([
        db.getSettings(),
        db.getOverrides(),
        db.getCurrentDay()
      ]);
      setSettings(s);
      setOverrides(o);
      setCurrentDay(d);
      setError(null);
    } catch (err: any) {
      setError("Impossibile caricare le impostazioni. Controlla la connessione.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleDay = async (dayId: string) => {
    if (!settings) return;
    setSavingId(dayId);
    
    const currentActive = settings.active_days || [];
    const newActive = currentActive.includes(dayId)
      ? currentActive.filter(d => d !== dayId)
      : [...currentActive, dayId];

    // Aggiornamento locale immediato per reattività
    setSettings({ ...settings, active_days: newActive });

    try {
      await db.updateSettings({ active_days: newActive });
    } catch (err: any) {
      setError("Errore nel salvataggio. Riprova tra poco.");
      // Ripristina lo stato precedente se fallisce
      setSettings(settings);
    } finally {
      setSavingId(null);
    }
  };

  const getNextTwoWeeks = () => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      days.push({
        dateStr,
        info: getDayAvailability(dateStr, settings?.active_days || [], overrides, i === 0 ? currentDay : null)
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
    <Layout title="Loop Settimanale" onBack={onBack}>
      <div className="space-y-6">
        
        {error && (
          <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-600 animate-in fade-in zoom-in duration-300">
            <AlertCircle size={20} />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        {/* SELEZIONE LOOP */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ClockIcon size={18} className="text-[#007AFF]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Configura la Settimana</p>
          </div>
          
          <Card className="p-4">
            <p className="text-[11px] text-[#8E8E93] mb-4 font-medium leading-relaxed">
              Attiva i giorni in cui il sistema deve aprire gli ordini automaticamente ogni settimana.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {WEEKDAYS.map(day => {
                const isActive = settings?.active_days.includes(day.id);
                const isSaving = savingId === day.id;
                
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`h-14 rounded-2xl flex flex-col items-center justify-center transition-all relative overflow-hidden active:scale-90 ${
                      isActive 
                        ? 'bg-[#007AFF] text-white shadow-lg' 
                        : 'bg-[#F2F2F7] text-[#8E8E93]'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase">{day.label}</span>
                    {isActive && <Check size={14} className="mt-1" />}
                    {isSaving && <div className="absolute inset-0 bg-white/30 animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* PREVIEW 14 GIORNI */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Calendar size={18} className="text-[#34C759]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Test Visivo (Prossimi 14gg)</p>
          </div>

          <div className="space-y-2">
            {getNextTwoWeeks().map(({ dateStr, info }) => (
              <Card key={dateStr} className={`p-3 flex justify-between items-center border-l-4 ${
                info.isActive ? 'border-green-500' : 'border-gray-200 opacity-60'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#1c1c1e]">{formatDate(dateStr)}</span>
                    {info.isToday && <span className="text-[8px] bg-[#007AFF] text-white px-1.5 py-0.5 rounded-full font-bold">OGGI</span>}
                  </div>
                  <p className="text-[9px] font-bold text-[#8E8E93] uppercase mt-0.5">{info.dayName}</p>
                </div>
                <div className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tight ${info.colorClass}`}>
                  {info.label}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <button 
          onClick={loadData}
          className="w-full py-4 flex items-center justify-center gap-2 text-[#007AFF] text-xs font-bold uppercase tracking-widest"
        >
          <RotateCcw size={14} /> Aggiorna Dati
        </button>
      </div>
    </Layout>
  );
};

export default AdminCalendar;
