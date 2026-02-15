
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
 * Determina se una data specifica è considerata giornata di ordini attiva.
 * LOGICA:
 * 1. Priorità Assoluta: Record Manuale (Apertura/Chiusura da Admin Dashboard). 
 *    Se l'Admin APRE, non c'è cutoff. Se l'Admin CHIUDE, è chiuso.
 * 2. Seconda Priorità: Override (Eccezioni nel calendario). Rispetta il Cutoff.
 * 3. Terza Priorità: Loop Settimanale (Giorni ricorrenti). Rispetta il Cutoff.
 */
export const getDayAvailability = (
  dateStr: string, // Formato YYYY-MM-DD
  recurringDays: string[], // ['MON', 'TUE'...]
  overrides: DayOverride[] = [],
  manualDayRecord?: Day | null
) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[date.getDay()];
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isToday = dateStr === todayStr;
  
  let isActive = false;
  let label = '';
  let colorClass = '';

  // 1. PRIORITÀ MASSIMA: CONTROLLO MANUALE (ADMIN ACTION)
  // Se l'admin ha cliccato "Apri/Chiudi" oggi, questo comando ignora ogni altra regola.
  if (manualDayRecord && isToday) {
    if (manualDayRecord.status === DayStatus.OPEN) {
      return { 
        isActive: true, 
        label: 'APERTO MANUALMENTE', 
        colorClass: 'text-green-600 bg-green-100 font-black',
        isToday, 
        dayName 
      };
    } else {
      return { 
        isActive: false, 
        label: 'CHIUSO MANUALMENTE', 
        colorClass: 'text-red-500 bg-red-50', 
        isToday, 
        dayName 
      };
    }
  }

  // Se non c'è un record manuale per oggi, procediamo con la logica programmata
  const override = (overrides || []).find(o => o.date === dateStr);
  
  // 2. CONTROLLO PROGRAMMAZIONE (Loop o Eccezioni)
  let isScheduled = false;
  if (override) {
    isScheduled = !(override.type === OverrideType.DISABLED || override.type === OverrideType.FORCE_CLOSED);
    label = isScheduled ? 'ECCEZIONE (Attiva)' : 'DISATTIVATO';
  } else {
    isScheduled = (recurringDays || []).includes(dayName);
    label = isScheduled ? 'RICORRENTE' : 'NON ATTIVO';
  }

  isActive = isScheduled;
  colorClass = isScheduled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50';

  // 3. APPLICAZIONE CUTOFF (Solo per la programmazione automatica e solo per oggi)
  if (isActive && isToday && !isBeforeCutoff()) {
    isActive = false;
    label = 'CHIUSO (Oltre 16:30)';
    colorClass = 'text-gray-500 bg-gray-100';
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
