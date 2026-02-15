
import React, { useState, useEffect } from 'react';
import { db, GlobalSettings } from '../services/db';
import { DayOverride, OverrideType, Day } from '../types';
import { Layout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { Calendar, Plus, Trash2, Check, AlertCircle, ClockIcon, X } from '../components/Icons';
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
  const [addingOverride, setAddingOverride] = useState(false);
  const [newOverride, setNewOverride] = useState<Partial<DayOverride>>({ 
    date: new Date().toISOString().split('T')[0], 
    type: OverrideType.EXTRA 
  });

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

  const toggleDay = async (dayId: string) => {
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

  const handleSaveOverride = async () => {
    if (!newOverride.date) return;
    try {
      await db.saveOverride(newOverride);
      setAddingOverride(false);
      fetchData();
    } catch (err) {
      alert("Errore salvataggio eccezione");
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!window.confirm("Rimuovere questa eccezione?")) return;
    try {
      await db.deleteOverride(id);
      fetchData();
    } catch (err) {
      alert("Errore eliminazione");
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
        ...getDayAvailability(dStr, settings?.active_days || [], overrides, i === 0 ? currentDayRecord : null)
      });
    }
    return days;
  };

  if (loading) return <Layout title="Calendario" onBack={onBack}><div className="flex justify-center py-20"><div className="loading-spinner" /></div></Layout>;

  return (
    <Layout title="Programmazione Ordini" onBack={onBack}>
      <div className="space-y-8">
        {/* Sezione Ricorrenza Settimanale */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 pl-2">
            <ClockIcon size={18} className="text-[#007AFF]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Ricorrenza Settimanale</p>
          </div>
          <Card className="p-4 grid grid-cols-1 gap-2">
            <p className="text-xs text-[#8E8E93] mb-2 leading-relaxed">Seleziona i giorni in cui il sistema aprirà automaticamente gli ordini ogni settimana.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map(day => {
                const isActive = settings?.active_days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                      isActive 
                        ? 'bg-[#007AFF] text-white border-[#007AFF]' 
                        : 'bg-white text-[#8E8E93] border-[#F2F2F7]'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Prossimi 14 Giorni */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 pl-2">
            <Calendar size={18} className="text-[#34C759]" />
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Prossimi 14 Giorni</p>
          </div>
          <div className="space-y-2">
            {getNextDays().map(day => (
              <Card key={day.dateStr} className={`p-3 flex justify-between items-center ${day.isToday ? 'border-l-4 border-[#007AFF]' : ''}`}>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-[#1c1c1e]">{formatDate(day.dateStr)} {day.isToday && '(Oggi)'}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${day.colorClass}`}>
                      {day.label}
                    </span>
                    {!day.isActive && <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">● Chiuso</span>}
                    {day.isActive && <span className="text-[9px] font-bold text-green-500 uppercase tracking-tighter">● Aperto</span>}
                  </div>
                </div>
                {/* Azione rapida per forzare chiusura oggi */}
                {day.isToday && day.isActive && (
                    <Button size="sm" variant="danger" className="!py-1.5 !px-3 !text-[10px]" onClick={async () => {
                        if(window.confirm("Chiudere manualmente gli ordini per oggi?")) {
                            await db.closeDay();
                            fetchData();
                        }
                    }}>Chiudi Ora</Button>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Gestione Eccezioni */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-widest">Eccezioni e Date Speciali</p>
            <button onClick={() => setAddingOverride(true)} className="text-[#007AFF] text-[10px] font-black uppercase">Aggiungi</button>
          </div>
          <div className="space-y-2">
            {overrides.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-400 italic">Nessuna eccezione programmata</p>
            ) : (
              overrides.map(ov => (
                <Card key={ov.id} className="p-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black">{formatDate(ov.date)}</p>
                    <p className={`text-[10px] font-bold uppercase mt-0.5 ${ov.type === OverrideType.DISABLED ? 'text-red-500' : 'text-[#FF9500]'}`}>
                      {ov.type === OverrideType.DISABLED ? 'DISATTIVATO' : 'GIORNATA EXTRA'}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteOverride(ov.id)} className="p-2 text-[#FF3B30] bg-red-50 rounded-full">
                    <Trash2 size={16} />
                  </button>
                </Card>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Modal Aggiunta Eccezione */}
      {addingOverride && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddingOverride(false)} />
          <div className="relative bg-white rounded-t-[32px] p-6 pb-12 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Aggiungi Eccezione</h2>
              <button onClick={() => setAddingOverride(false)} className="p-2 bg-[#F2F2F7] rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#8E8E93] uppercase">Scegli Data</label>
                <Input type="date" value={newOverride.date} onChange={e => setNewOverride({...newOverride, date: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#8E8E93] uppercase">Tipo Azione</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-[#F2F2F7] border-none text-sm font-medium"
                  value={newOverride.type}
                  onChange={e => setNewOverride({...newOverride, type: e.target.value as OverrideType})}
                >
                  <option value={OverrideType.EXTRA}>GIORNATA EXTRA (Apri orders)</option>
                  <option value={OverrideType.DISABLED}>ECCEZIONE (Chiudi oggi)</option>
                </select>
              </div>

              <Button fullWidth onClick={handleSaveOverride}>Salva Eccezione</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminCalendar;
