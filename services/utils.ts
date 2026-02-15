
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
 * Sincronizzato con il loop settimanale dell'admin
 */
export const getDayAvailability = (
  dateStr: string, // Formato YYYY-MM-DD
  recurringDays: string[], // ['MON', 'TUE'...]
  overrides: DayOverride[] = [],
  manualDayRecord?: Day | null
) => {
  // Parsing robusto per evitare shift di fuso orario
  const [year, month, day] = dateStr.split('-').map(Number);
  // Usiamo mezzogiorno per evitare che il fuso orario sposti la data al giorno prima o dopo
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[date.getDay()];
  
  const override = (overrides || []).find(o => o.date === dateStr);
  
  let isActive = false;
  let label = '';
  let colorClass = '';

  // 1. Controllo Eccezioni (Override manuali)
  if (override) {
    if (override.type === OverrideType.DISABLED || override.type === OverrideType.FORCE_CLOSED) {
      isActive = false;
      label = 'DISATTIVATO';
      colorClass = 'text-red-500 bg-red-50';
    } else {
      isActive = true;
      label = 'EXTRA (Attivo)';
      colorClass = 'text-orange-500 bg-orange-50';
    }
  } else {
    // 2. Controllo LOOP SETTIMANALE (Ricorrenza)
    isActive = (recurringDays || []).includes(dayName);
    label = isActive ? 'RICORRENTE' : 'NON ATTIVO';
    colorClass = isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50';
  }

  // 3. Controllo record manuale di oggi (se l'admin ha cliccato "Apri/Chiudi" oggi nella dashboard)
  if (manualDayRecord) {
    isActive = manualDayRecord.status === DayStatus.OPEN;
    if (!isActive) {
      label = 'CHIUSO MANUALMENTE';
      colorClass = 'text-red-500 bg-red-50';
    }
  }

  // 4. Controllo orario cutoff (solo per oggi)
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isToday = dateStr === todayStr;
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
