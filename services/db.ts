
import { createClient } from '@supabase/supabase-js';
import { User, Pizza, Order, Day, DayStatus, SlotTime, Modification } from '../types';

/**
 * SCHEMA SQL SUGGERITO (da eseguire nel pannello SQL di Supabase):
 * 
 * -- 1. Tabella Modifiche
 * CREATE TABLE modifications (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   type TEXT CHECK (type IN ('ADD', 'REMOVE')),
 *   active BOOLEAN DEFAULT true,
 *   sort_order INT DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- 2. Aggiornamento Ordini
 * ALTER TABLE orders ADD COLUMN add_modification_id UUID REFERENCES modifications(id) ON DELETE SET NULL;
 * ALTER TABLE orders ADD COLUMN remove_modification_id UUID REFERENCES modifications(id) ON DELETE SET NULL;
 * 
 * -- 3. Vincolo Unicità Ordine (fondamentale per UPSERT)
 * ALTER TABLE orders ADD CONSTRAINT unique_day_user UNIQUE (day_id, user_id);
 */

const getEnvVar = (name: string, fallback: string): string => {
  try {
    const env = (import.meta as any).env;
    return env && env[name] ? env[name] : fallback;
  } catch (e) {
    return fallback;
  }
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'https://akifadjnpedvwesxzbsw.supabase.co');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraWZhZGpucGVkdndlc3h6YnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTUzMTAsImV4cCI6MjA4NjM5MTMxMH0.5vHJku7L7ruZApORXxJZaEJgC39EWnApyM8vbcQNKko');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface GlobalSettings {
  master_code: string;
  override_cutoff: boolean;
  manager_phone?: string; 
}

class DB {
  private async handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    const msg = error.message || "Errore sconosciuto";
    throw new Error(`${context}: ${msg}`);
  }

  async getSettings(): Promise<GlobalSettings> {
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'global').maybeSingle();
      if (error || !data) return { master_code: 'PIZZA2025', override_cutoff: false, manager_phone: '' }; 
      return {
        master_code: data.master_code,
        override_cutoff: !!data.override_cutoff,
        manager_phone: data.manager_phone || ''
      };
    } catch {
      return { master_code: 'PIZZA2025', override_cutoff: false, manager_phone: '' };
    }
  }

  async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {
    const { error } = await supabase.from('settings').upsert({ id: 'global', ...settings }, { onConflict: 'id' });
    if (error) await this.handleError(error, "Aggiornamento impostazioni");
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*').order('last_name', { ascending: true });
    if (error) await this.handleError(error, "Caricamento utenti");
    return data.map(u => ({ 
      id: u.id, 
      firstName: u.first_name, 
      lastName: u.last_name, 
      email: u.email || '', 
      phone_e164: u.phone_e164 || '',
      pin: u.pin, 
      role: u.role, 
      active: u.active 
    }));
  }

  async getUserByPin(pin: string): Promise<User | null> {
    if (!pin) return null;
    const { data, error } = await supabase.from('users').select('*').eq('pin', pin).eq('active', true).maybeSingle();
    if (error || !data) return null;
    return { 
      id: data.id, 
      firstName: data.first_name, 
      lastName: data.last_name, 
      email: data.email || '',
      phone_e164: data.phone_e164 || '',
      pin: data.pin, 
      role: data.role, 
      active: data.active 
    };
  }

  async isPinAvailable(pin: string, excludeUserId?: string): Promise<boolean> {
    let query = supabase.from('users').select('id').eq('pin', pin).eq('active', true);
    if (excludeUserId) query = query.neq('id', excludeUserId);
    const { data, error } = await query.maybeSingle();
    return error ? true : !data;
  }

  async saveUser(user: Partial<User>): Promise<void> {
    const payload = { 
      first_name: user.firstName, 
      last_name: user.lastName, 
      email: user.email?.toLowerCase().trim(), 
      phone_e164: user.phone_e164?.replace(/\s/g, ''),
      pin: user.pin, 
      role: user.role, 
      active: user.active 
    };
    const { error } = user.id 
      ? await supabase.from('users').update(payload).eq('id', user.id)
      : await supabase.from('users').insert([payload]);
    if (error) await this.handleError(error, "Salvataggio utente");
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) await this.handleError(error, "Cancellazione utente");
  }

  async getPizzas(): Promise<Pizza[]> {
    const { data, error } = await supabase.from('pizzas').select('*').order('name', { ascending: true });
    if (error) await this.handleError(error, "Caricamento pizze");
    return data.map(p => ({ 
      id: p.id, 
      name: p.name, 
      description: p.description, 
      ingredients: p.ingredients, 
      allergens: p.allergens, 
      active: p.active, 
      isVegetarian: p.is_vegetarian 
    }));
  }

  async savePizza(pizza: Partial<Pizza>): Promise<void> {
    const payload = { 
      name: pizza.name, 
      description: pizza.description || '', 
      ingredients: pizza.ingredients || [], 
      allergens: pizza.allergens || [], 
      active: pizza.active !== false, 
      is_vegetarian: pizza.isVegetarian || false 
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
    try {
      const { data, error } = await supabase.from('modifications').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type as 'ADD' | 'REMOVE',
        active: m.active,
        sort_order: m.sort_order
      }));
    } catch (err) {
      console.warn("Tabella modifications non trovata o errore query:", err);
      return []; // Ritorna lista vuota invece di bloccare tutto
    }
  }

  async saveModification(mod: Partial<Modification>): Promise<void> {
    const payload = {
      name: mod.name,
      type: mod.type,
      active: mod.active !== false,
      sort_order: mod.sort_order || 0
    };
    const { error } = mod.id
      ? await supabase.from('modifications').update(payload).eq('id', mod.id)
      : await supabase.from('modifications').insert([payload]);
    if (error) await this.handleError(error, "Salvataggio variante");
  }

  async deleteModification(id: string): Promise<void> {
    const { error } = await supabase.from('modifications').delete().eq('id', id);
    if (error) await this.handleError(error, "Cancellazione variante");
  }

  async getDays(): Promise<Day[]> {
    const { data, error } = await supabase.from('days').select('*').order('date', { ascending: false });
    if (error) await this.handleError(error, "Caricamento giorni");
    return data.map(d => ({ 
      id: d.id, 
      date: d.date, 
      status: d.status, 
      openedAt: d.opened_at, 
      closedAt: d.closed_at 
    }));
  }

  async getCurrentDay(): Promise<Day | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('days').select('*').eq('date', today).maybeSingle();
    if (error || !data) return null;
    return { 
      id: data.id, 
      date: data.date, 
      status: data.status, 
      openedAt: data.opened_at, 
      closedAt: data.closed_at 
    };
  }

  async openDay(): Promise<Day> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('days').upsert({ 
      date: today, 
      status: 'OPEN', 
      opened_at: new Date().toISOString() 
    }, { onConflict: 'date' }).select().single();
    if (error) await this.handleError(error, "Apertura giornata");
    return { 
      id: data.id, 
      date: data.date, 
      status: data.status, 
      openedAt: data.opened_at, 
      closedAt: data.closed_at 
    };
  }

  async closeDay(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('days').update({ 
      status: 'CLOSED', 
      closed_at: new Date().toISOString() 
    }).eq('date', today);
    if (error) await this.handleError(error, "Chiusura giornata");
  }

  async getOrdersByDay(dayId: string): Promise<Order[]> {
    const { data, error } = await supabase.from('orders').select('*').eq('day_id', dayId);
    if (error) await this.handleError(error, "Caricamento ordini");
    return (data || []).map(o => ({ 
      id: o.id, 
      dayId: o.day_id, 
      userId: o.user_id, 
      pizzaId: o.pizza_id, 
      slotTime: o.slot_time as SlotTime,
      addModificationId: o.add_modification_id,
      removeModificationId: o.remove_modification_id,
      note: o.note || '', 
      createdAt: o.created_at, 
      updatedAt: o.updated_at 
    }));
  }

  async getUserOrderToday(userId: string): Promise<Order | null> {
    const currentDay = await this.getCurrentDay();
    if (!currentDay) return null;
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).eq('day_id', currentDay.id).maybeSingle();
    if (error || !data) return null;
    return { 
      id: data.id, 
      dayId: data.day_id, 
      userId: data.user_id, 
      pizzaId: data.pizza_id, 
      slotTime: data.slot_time as SlotTime,
      addModificationId: data.add_modification_id,
      removeModificationId: data.remove_modification_id,
      note: data.note || '', 
      createdAt: data.created_at, 
      updatedAt: data.updated_at 
    };
  }

  async saveOrder(order: Partial<Order>): Promise<void> {
    const payload = { 
      day_id: order.dayId, 
      user_id: order.userId, 
      pizza_id: order.pizzaId, 
      slot_time: order.slotTime, 
      add_modification_id: order.addModificationId || null, // Importante: null invece di ""
      remove_modification_id: order.removeModificationId || null, // Importante: null invece di ""
      note: order.note || '',
      updated_at: new Date().toISOString() 
    };
    
    // NOTA: Richiede un vincolo di unicità su (day_id, user_id) nella tabella orders
    const { error } = await supabase.from('orders').upsert(payload, { onConflict: 'day_id,user_id' });
    if (error) await this.handleError(error, "Salvataggio ordine");
  }
}

export const db = new DB();
