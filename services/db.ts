import { createClient } from '@supabase/supabase-js';
import { User, Pizza, Order, Day, DayStatus, SlotTime } from '../types';

// Safe access to Vite environment variables
const getEnvVar = (name: string, fallback: string): string => {
  try {
    // Vite defines environment variables on import.meta.env
    const env = (import.meta as any).env;
    if (env && env[name]) {
      return env[name];
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'https://akifadjnpedvwesxzbsw.supabase.co');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraWZhZGpucGVkdndlc3h6YnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTUzMTAsImV4cCI6MjA4NjM5MTMxMH0.5vHJku7L7ruZApORXxJZaEJgC39EWnApyM8vbcQNKko');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class DB {
  async getMasterCode(): Promise<string> {
    const { data, error } = await supabase.from('settings').select('master_code').eq('id', 'global').maybeSingle();
    if (error || !data) return 'PIZZA2025'; 
    return data.master_code;
  }

  async updateMasterCode(newCode: string): Promise<void> {
    const { error } = await supabase.from('settings').upsert({ id: 'global', master_code: newCode });
    if (error) throw error;
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*').order('last_name', { ascending: true });
    if (error) throw error;
    return data.map(u => ({ 
      id: u.id, 
      firstName: u.first_name, 
      lastName: u.last_name, 
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
      pin: data.pin, 
      role: data.role, 
      active: data.active 
    };
  }

  async updateUserPin(userId: string, newPin: string): Promise<void> {
    const { error } = await supabase.from('users').update({ pin: newPin }).eq('id', userId);
    if (error) throw error;
  }

  async saveUser(user: Partial<User>): Promise<void> {
    const payload = { 
      first_name: user.firstName, 
      last_name: user.lastName, 
      pin: user.pin, 
      role: user.role, 
      active: user.active 
    };
    if (user.id) {
      const { error } = await supabase.from('users').update(payload).eq('id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('users').insert([payload]);
      if (error) throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  }

  async getPizzas(): Promise<Pizza[]> {
    const { data, error } = await supabase.from('pizzas').select('*').order('name', { ascending: true });
    if (error) throw error;
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
      description: pizza.description, 
      ingredients: pizza.ingredients, 
      allergens: pizza.allergens, 
      active: pizza.active, 
      is_vegetarian: pizza.isVegetarian 
    };
    if (pizza.id) {
      const { error } = await supabase.from('pizzas').update(payload).eq('id', pizza.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('pizzas').insert([payload]);
      if (error) throw error;
    }
  }

  async deletePizza(id: string): Promise<void> {
    const { error } = await supabase.from('pizzas').delete().eq('id', id);
    if (error) throw error;
  }

  async getDays(): Promise<Day[]> {
    const { data, error } = await supabase.from('days').select('*').order('date', { ascending: false });
    if (error) throw error;
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
    if (error) throw error;
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
    if (error) throw error;
  }

  async getOrdersByDay(dayId: string): Promise<Order[]> {
    const { data, error } = await supabase.from('orders').select('*').eq('day_id', dayId);
    if (error) throw error;
    return data.map(o => ({ 
      id: o.id, 
      dayId: o.day_id, 
      userId: o.user_id, 
      pizzaId: o.pizza_id, 
      slotTime: o.slot_time as SlotTime, 
      note: o.note, 
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
      note: data.note, 
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
      note: order.note, 
      updated_at: new Date().toISOString() 
    };
    const { error } = await supabase.from('orders').upsert(payload, { onConflict: 'day_id,user_id' });
    if (error) throw error;
  }
}

export const db = new DB();