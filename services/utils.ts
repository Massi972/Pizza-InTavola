
import { DayOverride, OverrideType, DayStatus, Day } from '../types';

/**
 * Ottiene la data odierna in formato YYYY-MM-DD
 */
export const getTodayDateString = (): string => {
  return new Date().toLocaleDateString('en-CA');
};

/**
 * Verifica se l'ora corrente è prima del cutoff dinamico
 */
export const isBeforeCutoff = (cutoffTimeStr: string): boolean => {
  const now = new Date();
  const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(':').map(Number);
  
  const cutoff = new Date(now);
  cutoff.setHours(cutoffHour, cutoffMinute, 0, 0);
  
  return now < cutoff;
};

/**
 * Determina se una data specifica è considerata giornata di ordini attiva.
 */
export const getDayAvailability = (
  dateStr: string, 
  recurringDays: string[], 
  overrides: DayOverride[] = [],
  manualDayRecord: Day | null,
  cutoffTimeStr: string = '16:30',
  temporaryOpeningUntil?: number | null
) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[date.getDay()];
  const todayStr = getTodayDateString();
  const isToday = dateStr === todayStr;
  
  // 1. PRIORITÀ MASSIMA: CONTROLLO MANUALE (ADMIN ACTION)
  if (manualDayRecord && isToday) {
    if (manualDayRecord.status === DayStatus.OPEN) {
      // Se c'è un tempo di scadenza, verifica se è passato
      if (temporaryOpeningUntil && Date.now() > temporaryOpeningUntil) {
        return { 
          isActive: false, 
          label: 'CHIUSO (TEMPO SCADUTO)', 
          colorClass: 'text-red-500 bg-red-50', 
          isToday, 
          dayName 
        };
      }

      return { 
        isActive: true, 
        label: temporaryOpeningUntil ? 'APERTURA TEMPORANEA' : 'APERTO (FORZATO)', 
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

  // 2. CONTROLLO OVERRIDES
  const override = (overrides || []).find(o => o.date === dateStr);
  if (override) {
    if (override.type === OverrideType.DISABLED || override.type === OverrideType.FORCE_CLOSED) {
      return { isActive: false, label: 'CHIUSO (FORZATO)', colorClass: 'text-red-700 bg-red-50 font-bold', isToday, dayName, isForced: true };
    }
    if (override.type === OverrideType.FORCE_OPEN || override.type === OverrideType.EXTRA) {
      return { isActive: true, label: 'APERTO (FORZATO)', colorClass: 'text-green-700 bg-green-100 font-bold', isToday, dayName, isForced: true };
    }
  }

  // 3. CONTROLLO LOOP SETTIMANALE
  const isScheduled = (recurringDays || []).includes(dayName);
  
  if (!isScheduled) {
    return { isActive: false, label: 'CHIUSO (CALENDARIO)', colorClass: 'text-gray-400 bg-gray-50', isToday, dayName };
  }

  let isActive = true;
  let label = 'APERTO (PROGRAMMATO)';
  let colorClass = 'text-green-600 bg-green-50';

  if (isToday && !isBeforeCutoff(cutoffTimeStr)) {
    isActive = false;
    label = `CHIUSO (OLTRE ${cutoffTimeStr})`;
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
