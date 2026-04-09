import React, { useState, useEffect, useRef } from 'react';
import { db, GlobalSettings } from '../services/db';
import { DayOverride, Day, OverrideType } from '../types';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Check, ClockIcon, Calendar, AlertCircle, RotateCcw, Copy, X, Plus, Trash2 } from '../components/Icons';
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
  const [isSaving, setIsSaving] = useState(false);
  
  // Ref per evitare salvataggi multipli concorrenti
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async () => {
    setLoading(true);
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
      setError("Errore caricamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const persistSettings = async (updatedSettings: GlobalSettings) => {
    setIsSaving(true);
    setError(null);
    try {
      // Pulisco l'oggetto per assicurarmi di inviare solo i campi previsti dal database
      const cleanPayload = {
        master_code: updatedSettings.master_code,
        cutoff_time: updatedSettings.cutoff_time,
        active_days: updatedSettings.active_days,
        override_cutoff: updatedSettings.override_cutoff,
        manager_phone: updatedSettings.manager_phone
      };
      
      await db.updateSettings(cleanPayload);
    } catch (err: any) {
      console.error("Salvataggio fallito:", err);
      setError("Errore nel salvataggio: " + (err.message || "Verifica la connessione"));
      // Ricarico i dati originali in caso di errore per resettare la UI
      loadData();
    } finally {
      setIsSaving(false);
      setSavingId(null);
    }
  };

  const handleCutoffChange = (newTime: string) => {
    if (!settings) return;
    
    // Aggiornamento immediato della UI
    const updated = { ...settings, cutoff_time: newTime };
    setSettings(updated);

    // Debounce del salvataggio sul DB (aspetta 800ms dopo l'ultima modifica)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistSettings(updated);
    }, 800);
  };

  const toggleDay = async (dayId: string) => {
    if (!settings || isSaving) return;
    setSavingId(dayId);
    
    const currentActive = settings.active_days || [];
    const newActive = currentActive.includes(dayId)
      ? currentActive.filter(d => d !== dayId)
      : [...currentActive, dayId];

    const updated = { ...settings, active_days: newActive };
    
    // Per i toggle dei giorni salviamo immediatamente
    setSettings(updated);
    await persistSettings(updated);
  };

  const toggleDayOverride = async (dateStr: string, currentInfo: any) => {
    if (isSaving) return;
    setIsSaving(true);
    
    let newType: OverrideType | 'DELETE';
    if (!currentInfo.isForced) {
      newType = OverrideType.FORCE_OPEN;
    } else if (currentInfo.label.includes('APERTO')) {
      newType = OverrideType.FORCE_CLOSED;
    } else {
      newType = 'DELETE';
    }

    try {
      if (newType === 'DELETE') {
        await db.deleteOverride(dateStr);
      } else {
        await db.saveOverride({ date: dateStr, type: newType, note: 'Manuale' });
      }
      await loadData();
    } catch (err: any) {
      setError("Errore modifica eccezione: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getNextTwoWeeks = () => {
    const days = [];
    const now = new Date();
    const activeDays = settings?.active_days || [];
    const cutoff = settings?.cutoff_time || '16:30';
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      days.push({
        dateStr,
        info: getDayAvailability(dateStr, activeDays, overrides, i === 0 ? currentDay : null, cutoff)
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
    <Layout title="Programmazione" onBack={onBack}>
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-[11px] font-bold space-y-3 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" /> 
              <div className="flex-1">{error}</div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full"><X size={14} /></button>
            </div>
            
            {(error.includes('cutoff_time') || error.includes('settings')) && (
              <div className="p-3 bg-white/50 rounded-lg border border-red-200 text-[#FF3B30]">
                <p className="text-[9px] font-black uppercase mb-1">Esegui questo SQL in Supabase:</p>
                <code className="block bg-black text-white p-2 rounded text-[9px] font-mono break-all whitespace-pre-wrap">
{`ALTER TABLE settings ADD COLUMN IF NOT EXISTS cutoff_time TEXT DEFAULT '16:30';`}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Orario Cutoff */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ClockIcon size={18} className="text-[#FF9500]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Orario Chiusura Automatica</p>
          </div>
          <Card className={`p-5 flex items-center justify-between bg-white transition-opacity ${isSaving ? 'opacity-70' : ''}`}>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1c1c1e]">Limite Ordini Staff</p>
              <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-tighter">Oltre quest'ora non si ordina più</p>
            </div>
            <div className="relative">
              <input 
                type="time" 
                className={`bg-[#F2F2F7] border-none rounded-2xl px-5 py-3 font-black text-xl text-[#007AFF] outline-none shadow-inner transition-all focus:ring-2 focus:ring-[#007AFF]/20`}
                value={settings?.cutoff_time || '16:30'}
                onChange={(e) => handleCutoffChange(e.target.value)}
              />
              {isSaving && !savingId && (
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                  <div className="loading-spinner !w-3 !h-3" />
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Loop Giornaliero */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Calendar size={18} className="text-[#007AFF]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Giorni di Apertura (Loop)</p>
          </div>
          <Card className="p-4 bg-white">
            <div className="grid grid-cols-4 gap-2">
              {WEEKDAYS.map(day => {
                const isActive = (settings?.active_days || []).includes(day.id);
                const isThisSaving = savingId === day.id;
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    disabled={isSaving}
                    className={`h-16 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 relative ${
                      isActive ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-200' : 'bg-[#F2F2F7] text-[#8E8E93]'
                    } ${isSaving && !isThisSaving ? 'opacity-50' : ''}`}
                  >
                    {isThisSaving ? (
                      <div className="loading-spinner border-white/30 border-t-white" />
                    ) : (
                      <>
                        <span className="text-[11px] font-black uppercase">{day.label}</span>
                        {isActive && <Check size={14} className="mt-1" />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Anteprima e Eccezioni */}
        <section className="space-y-3 pb-10">
          <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest px-1">Anteprima Prossimi 14 Giorni</p>
          <div className="space-y-2">
            {getNextTwoWeeks().map(({ dateStr, info }) => (
              <Card 
                key={dateStr} 
                onClick={() => toggleDayOverride(dateStr, info)}
                className={`p-3 flex justify-between items-center border-l-4 cursor-pointer active:scale-[0.98] transition-all bg-white ${
                  info.isActive ? 'border-green-500' : 'border-gray-200'
                } ${isSaving ? 'pointer-events-none opacity-80' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[35px]">
                    <p className="text-[9px] font-black text-[#8E8E93] uppercase leading-none">{info.dayName}</p>
                    <p className="text-sm font-black mt-0.5">{dateStr.split('-')[2]}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1c1c1e]">{formatDate(dateStr)}</span>
                      {info.isToday && <span className="text-[8px] bg-[#007AFF] text-white px-1.5 py-0.5 rounded-full font-black">OGGI</span>}
                    </div>
                    {info.isForced && <span className="text-[8px] font-black text-[#007AFF] uppercase tracking-tighter">Modifica Manuale</span>}
                  </div>
                </div>
                <div className={`text-[9px] font-black px-2.5 py-1.5 rounded-xl uppercase tracking-tight ${info.colorClass}`}>
                  {info.label}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default AdminCalendar;