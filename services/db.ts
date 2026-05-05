import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Role, Pizza, PizzaFlag, Order, Day, DayStatus, SlotTime, Modification, DayOverride } from '../types';

let supabaseInstance: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const env = (import.meta as any).env || {};
  const url = (env.VITE_SUPABASE_URL || 'https://akifadjnpedvwesxzbsw.supabase.co').trim();
  const key = (env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraWZhZGpucGVkdndlc3h6YnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTUzMTAsImV4cCI6MjA4NjM5MTMxMH0.5vHJku7L7ruZApORXxJZaEJgC39EWnApyM8vbcQNKko').trim();

  if (!url || !url.startsWith('http')) {
    throw new Error("Invalid Supabase URL. Please check your VITE_SUPABASE_URL environment variable.");
  }

  supabaseInstance = createClient(url, key);
  return supabaseInstance;
};

// Proxy to allow existing code to use 'supabase.from()' without changes
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const client = getSupabaseClient();
    return (client as any)[prop];
  }
});

export interface GlobalSettings {
  registration_pin: string;
  registration_open: boolean;
  override_cutoff: boolean;
  manager_phone?: string;
  active_days: string[]; 
  cutoff_time: string;
  pdf_title?: string;
  pdf_show_summary?: boolean;
  pdf_show_list?: boolean;
}

class DB {
  private async handleError(error: any, context: string) {
    console.error(`Dettaglio Errore [${context}]:`, error);
    const msg = error.message || "Errore sconosciuto";
    throw new Error(`${context}: ${msg}`);
  }

  // --- STANDARD DB METHODS ---

  async getSettings(): Promise<GlobalSettings> {
    const defaults: GlobalSettings = { 
      registration_pin: '0000',
      registration_open: true,
      override_cutoff: false, 
      manager_phone: '', 
      active_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      cutoff_time: '16:30',
      pdf_title: 'IN TAVOLA - PIZZA STAFF',
      pdf_show_summary: true,
      pdf_show_list: true
    };
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'global').maybeSingle();
      
      if (error) {
        console.error("Errore fetch settings:", error);
        return defaults;
      }
      
      if (!data) {
        await this.updateSettings(defaults);
        return defaults;
      }

      // Mapping: usiamo 'emergency_pin' dal DB per popolare 'registration_pin' nel codice
      return {
        registration_pin: data.emergency_pin !== undefined ? String(data.emergency_pin) : defaults.registration_pin,
        registration_open: data.registration_open !== undefined ? !!data.registration_open : defaults.registration_open,
        override_cutoff: !!data.override_cutoff,
        manager_phone: data.manager_phone || '',
        active_days: Array.isArray(data.active_days) ? data.active_days : defaults.active_days,
        cutoff_time: data.cutoff_time || defaults.cutoff_time,
        pdf_title: data.pdf_title || defaults.pdf_title,
        pdf_show_summary: data.pdf_show_summary !== undefined ? !!data.pdf_show_summary : defaults.pdf_show_summary,
        pdf_show_list: data.pdf_show_list !== undefined ? !!data.pdf_show_list : defaults.pdf_show_list
      };
    } catch (err: any) {
      console.error("Eccezione getSettings:", err);
      return defaults;
    }
  }

  async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {
    try {
      // Mapping: convertiamo 'registration_pin' in 'emergency_pin' per Supabase
      const payload: any = { id: 'global', ...settings };
      
      if (settings.hasOwnProperty('registration_pin')) {
        payload.emergency_pin = settings.registration_pin;
        delete payload.registration_pin; 
      }

      // Rimuoviamo temporaneamente 'registration_open' se presente, finché l'utente non aggiorna lo schema
      if (payload.hasOwnProperty('registration_open')) {
        delete payload.registration_open;
      }
      
      const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'id' });
      
      if (error) {
        console.error("Errore Supabase updateSettings:", error);
        
        if (error.code === '42703') {
           throw new Error("SCHEMA_ERROR: La tabella 'settings' non ha tutte le colonne necessarie.");
        }
        
        await this.handleError(error, "Salvataggio impostazioni");
      }
    } catch (err) {
      await this.handleError(err, "Aggiornamento impostazioni");
    }
  }

  async getOverrides(): Promise<DayOverride[]> {
    const { data, error } = await supabase.from('day_overrides').select('*').order('date', { ascending: true });
    if (error) return [];
    return data || [];
  }

  async saveOverride(override: Partial<DayOverride>): Promise<void> {
    const { error } = await supabase.from('day_overrides').upsert(override, { onConflict: 'date' });
    if (error) await this.handleError(error, "Salvataggio eccezione");
  }

  async deleteOverride(date: string): Promise<void> {
    const { error } = await supabase.from('day_overrides').delete().eq('date', date);
    if (error) await this.handleError(error, "Eliminazione eccezione");
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*').order('last_name', { ascending: true });
    if (error) await this.handleError(error, "Caricamento utenti");
    return (data || []).map(u => ({ 
      id: u.id, firstName: u.first_name, lastName: u.last_name, 
      phone_e164: u.phone_e164 || '', email: u.email || '', pin: u.pin, role: u.role, active: u.active 
    }));
  }

  async getUserByPin(pin: string): Promise<User | null> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('pin', pin).eq('active', true).maybeSingle();
      if (error || !data) return null;
      return { 
        id: data.id, firstName: data.first_name, lastName: data.last_name, 
        phone_e164: data.phone_e164 || '', email: data.email || '', pin: data.pin, role: data.role, active: data.active 
      };
    } catch (err) {
      console.error("Errore durante il recupero dell'utente per PIN:", err);
      return null;
    }
  }

  async verifyUserForPinRecovery(email: string, phone: string): Promise<string | null> {
    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      const { data, error } = await supabase
        .from('users')
        .select('pin')
        .eq('email', email.trim().toLowerCase())
        .eq('phone_e164', cleanPhone)
        .eq('active', true)
        .maybeSingle();
      
      if (error || !data) return null;
      return data.pin;
    } catch (err) {
      console.error("Errore verifica recupero PIN:", err);
      return null;
    }
  }

  async isPinAvailable(pin: string, excludeUserId?: string): Promise<boolean> {
    try {
      // 1. Controllo che non sia il PIN di Registrazione
      const settings = await this.getSettings();
      if (pin === settings.registration_pin) return false;

      // 2. Controllo che non sia usato da altri utenti attivi
      let query = supabase.from('users').select('id').eq('pin', pin).eq('active', true);
      if (excludeUserId) query = query.neq('id', excludeUserId);
      const { data } = await query.maybeSingle();
      return !data;
    } catch (err) {
      return false;
    }
  }

  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    if (!email) return true;
    try {
      let query = supabase.from('users').select('id').eq('email', email.trim().toLowerCase());
      if (excludeUserId) query = query.neq('id', excludeUserId);
      const { data } = await query.maybeSingle();
      return !data;
    } catch (err) {
      return false;
    }
  }

  async isPhoneAvailable(phone: string, excludeUserId?: string): Promise<boolean> {
    if (!phone) return true;
    try {
      // Pulizia basica del numero per confronto
      const cleanPhone = phone.replace(/\s+/g, '');
      let query = supabase.from('users').select('id').eq('phone_e164', cleanPhone);
      if (excludeUserId) query = query.neq('id', excludeUserId);
      const { data } = await query.maybeSingle();
      return !data;
    } catch (err) {
      return false;
    }
  }

  async saveUser(user: Partial<User>): Promise<void> {
    const payload = { 
      first_name: user.firstName, last_name: user.lastName, 
      phone_e164: user.phone_e164, email: user.email, pin: user.pin, role: user.role, active: user.active 
    };
    const { error } = user.id 
      ? await supabase.from('users').update(payload).eq('id', user.id)
      : await supabase.from('users').insert([payload]);
    if (error) await this.handleError(error, "Salvataggio utente");
  }

  async saveUsersBulk(users: Partial<User>[]): Promise<void> {
    const payloads = users.map(u => ({
      first_name: u.firstName,
      last_name: u.lastName,
      phone_e164: u.phone_e164,
      email: u.email,
      pin: u.pin,
      role: u.role || Role.WORKER,
      active: u.active !== false
    }));
    const { error } = await supabase.from('users').insert(payloads);
    if (error) await this.handleError(error, "Salvataggio bulk utenti");
  }

  async setUsersStatus(ids: string[], active: boolean): Promise<void> {
    const { error } = await supabase.from('users').update({ active }).in('id', ids);
    if (error) await this.handleError(error, "Aggiornamento stato bulk");
  }

  async deleteUser(id: string): Promise<void> {
    try {
      console.log(`Eliminazione utente in corso: ${id}`);
      // 1. Elimina gli ordini associati per evitare vincoli di integrità referenziale
      // Questo assicura che l'utente possa essere eliminato anche se ha effettuato ordini
      // Se il database ha ON DELETE CASCADE, questo è ridondante ma sicuro.
      await supabase.from('orders').delete().eq('user_id', id);

      // 2. Elimina l'utente
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      
      console.log(`Utente ${id} eliminato con successo.`);
    } catch (err) {
      await this.handleError(err, "Cancellazione utente");
    }
  }

  async deleteUsersBulk(ids: string[]): Promise<void> {
    try {
      console.log(`Eliminazione bulk utenti in corso: ${ids.length} utenti`);
      // 1. Elimina ordini bulk per evitare vincoli di integrità
      await supabase.from('orders').delete().in('user_id', ids);
      
      // 2. Elimina utenti bulk
      const { error } = await supabase.from('users').delete().in('id', ids);
      if (error) throw error;

      console.log(`Eliminazione bulk completata.`);
    } catch (err) {
      await this.handleError(err, "Cancellazione bulk utenti");
    }
  }

  async getPizzas(): Promise<Pizza[]> {
    const { data, error } = await supabase.from('pizzas').select('*').order('name', { ascending: true });
    if (error) await this.handleError(error, "Caricamento pizze");
    return (data || []).map(p => ({ 
      id: p.id, name: p.name, description: p.description || '', 
      ingredients: p.ingredients || [], allergens: p.allergens || [], 
      active: p.active, isVegetarian: p.is_vegetarian 
    }));
  }

  async savePizza(pizza: Partial<Pizza>): Promise<void> {
    const payload = { 
      name: pizza.name, description: pizza.description || '', 
      ingredients: pizza.ingredients || [], allergens: pizza.allergens || [], 
      active: pizza.active !== false, is_vegetarian: pizza.isVegetarian || false 
    };
    const { error } = pizza.id
      ? await supabase.from('pizzas').update(payload).eq('id', pizza.id)
      : await supabase.from('pizzas').insert([payload]);
    if (error) await this.handleError(error, "Salvataggio pizza");
  }

  async deletePizza(id: string): Promise<void> {
    const { error } = await supabase.from('pizzas').delete().eq('id', id);
    if (error) await this.handleError(error, "Cancellazione pizza");
  }

  async getModifications(): Promise<Modification[]> {
    const { data, error } = await supabase.from('modifications').select('*').order('sort_order', { ascending: true });
    if (error) return [];
    return (data || []).map(m => ({
      id: m.id, name: m.name, type: m.type as 'ADD' | 'REMOVE', active: m.active, sort_order: m.sort_order
    }));
  }

  async saveModification(mod: Partial<Modification>): Promise<void> {
    const payload = { name: mod.name, type: mod.type, active: mod.active !== false, sort_order: mod.sort_order || 0 };
    const { error } = mod.id
      ? await supabase.from('modifications').update(payload).eq('id', mod.id)
      : await supabase.from('modifications').insert([payload]);
    if (error) await this.handleError(error, "Salvataggio variante");
  }

  async deleteModification(id: string): Promise<void> {
    const { error } = await supabase.from('modifications').delete().eq('id', id);
    if (error) await this.handleError(error, "Cancellazione variante");
  }

  async getPizzaFlags(): Promise<PizzaFlag[]> {
    const { data, error } = await supabase.from('pizza_flags').select('*').order('sort_order', { ascending: true });
    if (error) return [];
    return (data || []).map(f => ({
      id: f.id, name: f.name, active: f.active, sort_order: f.sort_order
    }));
  }

  async savePizzaFlag(flag: Partial<PizzaFlag>): Promise<void> {
    const payload = { name: flag.name, active: flag.active !== false, sort_order: flag.sort_order || 0 };
    const { error } = flag.id
      ? await supabase.from('pizza_flags').update(payload).eq('id', flag.id)
      : await supabase.from('pizza_flags').insert([payload]);
    if (error) await this.handleError(error, "Salvataggio flag");
  }

  async deletePizzaFlag(id: string): Promise<void> {
    const { error } = await supabase.from('pizza_flags').delete().eq('id', id);
    if (error) await this.handleError(error, "Cancellazione flag");
  }

  async getDays(): Promise<Day[]> {
    const { data, error } = await supabase.from('days').select('*').order('date', { ascending: false });
    if (error) return [];
    return data.map(d => ({ 
      id: d.id, date: d.date, status: d.status, openedAt: d.opened_at, closedAt: d.closed_at 
    }));
  }

  async getCurrentDay(): Promise<Day | null> {
    const today = new Date().toLocaleDateString('en-CA'); 
    const { data, error } = await supabase.from('days').select('*').eq('date', today).maybeSingle();
    if (error || !data) return null;
    return { 
      id: data.id, date: data.date, status: data.status, openedAt: data.opened_at, closedAt: data.closed_at 
    };
  }

  async openDay(): Promise<Day> {
    const today = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase.from('days').upsert({ 
      date: today, status: 'OPEN', opened_at: new Date().toISOString() 
    }, { onConflict: 'date' }).select().single();
    if (error) await this.handleError(error, "Apertura giornata");
    return { 
      id: data.id, date: data.date, status: data.status, openedAt: data.opened_at, closedAt: data.closed_at 
    };
  }

  async closeDay(): Promise<void> {
    const today = new Date().toLocaleDateString('en-CA');
    const { error } = await supabase.from('days').update({ 
      status: 'CLOSED', closed_at: new Date().toISOString() 
    }).eq('date', today);
    if (error) await this.handleError(error, "Chiusura giornata");
  }

  async getOrdersByDay(dayId: string): Promise<Order[]> {
    const { data, error } = await supabase.from('orders').select('*').eq('day_id', dayId);
    if (error) return [];
    return (data || []).map(o => ({ 
      id: o.id, dayId: o.day_id, userId: o.user_id, pizzaId: o.pizza_id, slotTime: o.slot_time as SlotTime,
      addModificationIds: Array.isArray(o.add_modification_ids) ? o.add_modification_ids : [],
      removeModificationIds: Array.isArray(o.remove_modification_ids) ? o.remove_modification_ids : [],
      flagIds: Array.isArray(o.flag_ids) ? o.flag_ids : [],
      note: o.note || '', createdAt: o.created_at, updatedAt: o.updated_at 
    }));
  }

  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(o => ({ 
      id: o.id, dayId: o.day_id, userId: o.user_id, pizzaId: o.pizza_id, slotTime: o.slot_time as SlotTime,
      addModificationIds: Array.isArray(o.add_modification_ids) ? o.add_modification_ids : [],
      removeModificationIds: Array.isArray(o.remove_modification_ids) ? o.remove_modification_ids : [],
      flagIds: Array.isArray(o.flag_ids) ? o.flag_ids : [],
      note: o.note || '', createdAt: o.created_at, updatedAt: o.updated_at 
    }));
  }

  async getUserOrderToday(userId: string): Promise<Order | null> {
    const today = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase.from('orders').select('*, days!inner(date)').eq('user_id', userId).eq('days.date', today).maybeSingle();
    if (error || !data) return null;
    return { 
      id: data.id, dayId: data.day_id, userId: data.user_id, pizzaId: data.pizza_id, slotTime: data.slot_time as SlotTime,
      addModificationIds: Array.isArray(data.add_modification_ids) ? data.add_modification_ids : [],
      removeModificationIds: Array.isArray(data.remove_modification_ids) ? data.remove_modification_ids : [],
      flagIds: Array.isArray(data.flag_ids) ? data.flag_ids : [],
      note: data.note || '', createdAt: data.created_at, updatedAt: data.updated_at 
    };
  }

  async saveOrder(order: Partial<Order>): Promise<void> {
    const todayDate = new Date().toLocaleDateString('en-CA');
    let dayId = order.dayId;
    if (!dayId) {
      const { data: dayData, error: dayError } = await supabase.from('days').upsert({ date: todayDate, status: 'OPEN' }, { onConflict: 'date' }).select().single();
      if (dayError) throw dayError;
      dayId = dayData.id;
    }
    const payload = { 
      day_id: dayId, user_id: order.userId, pizza_id: order.pizzaId, slot_time: order.slotTime, 
      add_modification_ids: order.addModificationIds || [], remove_modification_ids: order.removeModificationIds || [],
      flag_ids: order.flagIds || [],
      note: order.note || '', updated_at: new Date().toISOString() 
    };
    const { error } = await supabase.from('orders').upsert(payload, { onConflict: 'day_id,user_id' });
    if (error) await this.handleError(error, "Salvataggio ordine");
  }

  async resetSeasonalData(): Promise<void> {
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('days').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

export const db = new DB();