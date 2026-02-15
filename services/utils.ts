
import { CUTOFF_TIME } from '../constants';
import { DayOverride, OverrideType, DayStatus, Day } from '../types';

/**
 * Ottiene la data odierna in formato YYYY-MM-DD rispettando il fuso orario locale
 */
export const getTodayDateString = (): string => {
  return new Date().toLocaleDateString('en-CA');
};

/**
 * Verifica se l'ora corrente è prima del cutoff (16:30)
 */
export const isBeforeCutoff = (): boolean => {
  const now = new Date();
  const [cutoffHour, cutoffMinute] = CUTOFF_TIME.split(':').map(Number);
  
  const cutoff = new Date(now);
  cutoff.setHours(cutoffHour, cutoffMinute, 0, 0);
  
  return now < cutoff;
};

/**
 * Determina se una data specifica è considerata giornata di ordini attiva.
 */
export const getDayAvailability = (
  dateStr: string, // Formato YYYY-MM-DD
  recurringDays: string[], // ['MON', 'TUE'...]
  overrides: DayOverride[] = [],
  manualDayRecord?: Day | null
) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Creiamo la data a mezzogiorno per evitare problemi di fuso orario durante i calcoli
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[date.getDay()];
  const todayStr = getTodayDateString();
  const isToday = dateStr === todayStr;
  
  // 1. PRIORITÀ MASSIMA: CONTROLLO MANUALE (ADMIN ACTION)
  if (manualDayRecord && isToday) {
    if (manualDayRecord.status === DayStatus.OPEN) {
      return { 
        isActive: true, 
        label: 'APERTO (MANUALE)', 
        colorClass: 'text-green-600 bg-green-100 font-black',
        isToday, 
        dayName 
      };
    } else if (manualDayRecord.status === DayStatus.CLOSED) {
      return { 
        isActive: false, 
        label: 'CHIUSO (MANUALE)', 
        colorClass: 'text-red-500 bg-red-50', 
        isToday, 
        dayName 
      };
    }
  }

  // 2. CONTROLLO OVERRIDES (Eccezioni specifiche nel calendario)
  const override = (overrides || []).find(o => o.date === dateStr);
  if (override) {
    if (override.type === OverrideType.DISABLED || override.type === OverrideType.FORCE_CLOSED) {
      return { isActive: false, label: 'CHIUSO (ECCEZIONE)', colorClass: 'text-gray-400 bg-gray-50', isToday, dayName };
    }
    if (override.type === OverrideType.FORCE_OPEN || override.type === OverrideType.EXTRA) {
      let active = true;
      if (isToday && !isBeforeCutoff()) {
        active = false;
        return { isActive: false, label: 'CHIUSO (OLTRE 16:30)', colorClass: 'text-red-500 bg-red-50', isToday, dayName };
      }
      return { isActive: active, label: 'APERTO (ECCEZIONE)', colorClass: 'text-green-600 bg-green-50', isToday, dayName };
    }
  }

  // 3. CONTROLLO LOOP SETTIMANALE (Ricorrenze)
  const isScheduled = (recurringDays || []).includes(dayName);
  
  if (!isScheduled) {
    return { isActive: false, label: 'CHIUSO (CALENDARIO)', colorClass: 'text-gray-400 bg-gray-50', isToday, dayName };
  }

  // Se è programmato, verifichiamo il cutoff solo se è oggi
  let isActive = true;
  let label = 'APERTO (PROGRAMMATO)';
  let colorClass = 'text-green-600 bg-green-50';

  if (isToday && !isBeforeCutoff()) {
    isActive = false;
    label = 'CHIUSO (OLTRE 16:30)';
    colorClass = 'text-red-500 bg-red-50 font-bold';
  }

  return { isActive, label, colorClass, isToday, dayName };
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return d.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long'
  });
};
