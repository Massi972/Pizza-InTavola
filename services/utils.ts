
import { CUTOFF_TIME } from '../constants';
import { DayOverride, OverrideType, DayStatus, Day } from '../types';

/**
 * Verifica se l'ora corrente è prima del cutoff (16:30) in Italia
 */
export const isBeforeCutoff = (): boolean => {
  const now = new Date();
  const [cutoffHour, cutoffMinute] = CUTOFF_TIME.split(':').map(Number);
  
  const cutoff = new Date(now);
  cutoff.setHours(cutoffHour, cutoffMinute, 0, 0);
  
  return now < cutoff;
};

/**
 * Determina se una data specifica è considerata giornata di ordini attiva
 */
export const getDayAvailability = (
  dateStr: string, // YYYY-MM-DD
  recurringDays: string[], // ['MON', 'TUE'...]
  overrides: DayOverride[],
  manualDayRecord?: Day | null
) => {
  // Parsing robusto: YYYY-MM-DD assume mezzogiorno locale per evitare shift di fuso orario
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[date.getDay()];
  
  const override = overrides.find(o => o.date === dateStr);
  
  let isActive = false;
  let label = '';
  let colorClass = '';

  // 1. Controllo Override (Priorità Massima)
  if (override) {
    if (override.type === OverrideType.DISABLED || override.type === OverrideType.FORCE_CLOSED) {
      isActive = false;
      label = 'DISATTIVATO (Eccezione)';
      colorClass = 'text-red-500 bg-red-50';
    } else if (override.type === OverrideType.EXTRA || override.type === OverrideType.FORCE_OPEN) {
      isActive = true;
      label = 'GIORNATA EXTRA';
      colorClass = 'text-[#FF9500] bg-orange-50';
    }
  } else {
    // 2. Controllo Ricorrenza
    isActive = (recurringDays || []).includes(dayName);
    label = isActive ? 'RICORRENTE' : 'NON PREVISTO';
    colorClass = isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50';
  }

  // 3. Controllo record manuale di chiusura nel DB (Apertura forzata dall'admin)
  if (manualDayRecord && manualDayRecord.status === DayStatus.CLOSED) {
    isActive = false;
    label = 'CHIUSA MANUALMENTE';
    colorClass = 'text-red-500 bg-red-50';
  }

  // 4. Controllo cutoff temporale (solo per oggi)
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isToday = dateStr === todayStr;
  if (isActive && isToday && !isBeforeCutoff()) {
    isActive = false;
    label = 'CHIUSA (Dopo 16:30)';
    colorClass = 'text-[#8E8E93] bg-[#E5E5EA]';
  }

  return { isActive, label, colorClass, isToday, dayName };
};

export const formatTime = (date: string | Date): string => {
  return new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (date: string | Date): string => {
  // Parsing robusto
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return d.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long'
  });
};
