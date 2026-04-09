import { User, Pizza, Order, Day, DayStatus, SlotTime, Modification, DayOverride } from '../types';
import { INITIAL_PIZZAS, INITIAL_USERS } from '../constants';

export interface GlobalSettings {
  master_code: string;
  override_cutoff: boolean;
  manager_phone?: string;
  active_days: string[]; 
  cutoff_time: string;
}

class DB {
  private storageKey = 'pizzastaff_db';

  private getData() {
    const data = localStorage.getItem(this.storageKey);
    if (!data) {
      const initialData = {
        users: INITIAL_USERS,
        pizzas: INITIAL_PIZZAS,
        orders: [],
        days: [],
        settings: {
          master_code: 'PIZZA2025',
          override_cutoff: false,
          manager_phone: '',
          active_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          cutoff_time: '16:30'
        },
        overrides: [],
        modifications: [
          { id: 'm1', name: 'Senza Mozzarella', type: 'REMOVE', active: true, sort_order: 0 },
          { id: 'm2', name: 'Senza Pomodoro', type: 'REMOVE', active: true, sort_order: 1 },
          { id: 'm3', name: 'Doppia Mozzarella', type: 'ADD', active: true, sort_order: 2 },
          { id: 'm4', name: 'Bordo Ripieno', type: 'ADD', active: true, sort_order: 3 },
        ]
      };
      this.saveData(initialData);
      return initialData;
    }
    return JSON.parse(data);
  }

  private saveData(data: any) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // --- STANDARD DB METHODS (ASYNC FOR COMPATIBILITY) ---

  async getSettings(): Promise<GlobalSettings> {
    return this.getData().settings;
  }

  async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {
    const data = this.getData();
    data.settings = { ...data.settings, ...settings };
    this.saveData(data);
  }

  async getOverrides(): Promise<DayOverride[]> {
    return this.getData().overrides || [];
  }

  async saveOverride(override: Partial<DayOverride>): Promise<void> {
    const data = this.getData();
    const index = data.overrides.findIndex((o: any) => o.date === override.date);
    if (index >= 0) {
      data.overrides[index] = { ...data.overrides[index], ...override };
    } else {
      data.overrides.push(override);
    }
    this.saveData(data);
  }

  async deleteOverride(date: string): Promise<void> {
    const data = this.getData();
    data.overrides = data.overrides.filter((o: any) => o.date !== date);
    this.saveData(data);
  }

  async getUsers(): Promise<User[]> {
    return this.getData().users;
  }

  async getUserByPin(pin: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find(u => u.pin === pin && u.active) || null;
  }

  async isPinAvailable(pin: string, excludeUserId?: string): Promise<boolean> {
    const users = await this.getUsers();
    return !users.some(u => u.pin === pin && u.id !== excludeUserId && u.active);
  }

  async saveUser(user: Partial<User>): Promise<void> {
    const data = this.getData();
    if (user.id) {
      const index = data.users.findIndex((u: any) => u.id === user.id);
      if (index >= 0) data.users[index] = { ...data.users[index], ...user };
    } else {
      const newUser = { ...user, id: Math.random().toString(36).substr(2, 9) };
      data.users.push(newUser);
    }
    this.saveData(data);
  }

  async deleteUser(id: string): Promise<void> {
    const data = this.getData();
    data.users = data.users.filter((u: any) => u.id !== id);
    this.saveData(data);
  }

  async getPizzas(): Promise<Pizza[]> {
    return this.getData().pizzas;
  }

  async savePizza(pizza: Partial<Pizza>): Promise<void> {
    const data = this.getData();
    if (pizza.id) {
      const index = data.pizzas.findIndex((p: any) => p.id === pizza.id);
      if (index >= 0) data.pizzas[index] = { ...data.pizzas[index], ...pizza };
    } else {
      const newPizza = { ...pizza, id: Math.random().toString(36).substr(2, 9) };
      data.pizzas.push(newPizza);
    }
    this.saveData(data);
  }

  async deletePizza(id: string): Promise<void> {
    const data = this.getData();
    data.pizzas = data.pizzas.filter((p: any) => p.id !== id);
    this.saveData(data);
  }

  async getModifications(): Promise<Modification[]> {
    return this.getData().modifications || [];
  }

  async saveModification(mod: Partial<Modification>): Promise<void> {
    const data = this.getData();
    if (mod.id) {
      const index = data.modifications.findIndex((m: any) => m.id === mod.id);
      if (index >= 0) data.modifications[index] = { ...data.modifications[index], ...mod };
    } else {
      const newMod = { ...mod, id: Math.random().toString(36).substr(2, 9) };
      data.modifications.push(newMod);
    }
    this.saveData(data);
  }

  async deleteModification(id: string): Promise<void> {
    const data = this.getData();
    data.modifications = data.modifications.filter((m: any) => m.id !== id);
    this.saveData(data);
  }

  async getDays(): Promise<Day[]> {
    return this.getData().days;
  }

  async getCurrentDay(): Promise<Day | null> {
    const today = new Date().toLocaleDateString('en-CA');
    const days = await this.getDays();
    return days.find(d => d.date === today) || null;
  }

  async openDay(): Promise<Day> {
    const data = this.getData();
    const today = new Date().toLocaleDateString('en-CA');
    let day = data.days.find((d: any) => d.date === today);
    
    if (day) {
      day.status = 'OPEN';
      day.openedAt = new Date().toISOString();
    } else {
      day = {
        id: Math.random().toString(36).substr(2, 9),
        date: today,
        status: 'OPEN',
        openedAt: new Date().toISOString()
      };
      data.days.push(day);
    }
    this.saveData(data);
    return day;
  }

  async closeDay(): Promise<void> {
    const data = this.getData();
    const today = new Date().toLocaleDateString('en-CA');
    const day = data.days.find((d: any) => d.date === today);
    if (day) {
      day.status = 'CLOSED';
      day.closedAt = new Date().toISOString();
      this.saveData(data);
    }
  }

  async getOrdersByDay(dayId: string): Promise<Order[]> {
    const orders = this.getData().orders;
    return orders.filter((o: any) => o.dayId === dayId);
  }

  async getAllOrders(): Promise<Order[]> {
    return this.getData().orders;
  }

  async getUserOrderToday(userId: string): Promise<Order | null> {
    const today = new Date().toLocaleDateString('en-CA');
    const data = this.getData();
    const day = data.days.find((d: any) => d.date === today);
    if (!day) return null;
    return data.orders.find((o: any) => o.dayId === day.id && o.userId === userId) || null;
  }

  async saveOrder(order: Partial<Order>): Promise<void> {
    const data = this.getData();
    const today = new Date().toLocaleDateString('en-CA');
    let day = data.days.find((d: any) => d.date === today);
    
    if (!day) {
      day = await this.openDay();
      // Ricarichiamo i dati perché openDay ha salvato su localStorage
      const updatedData = this.getData();
      const orderIndex = updatedData.orders.findIndex((o: any) => o.dayId === day.id && o.userId === order.userId);
      if (orderIndex >= 0) {
        updatedData.orders[orderIndex] = { ...updatedData.orders[orderIndex], ...order, dayId: day.id, updatedAt: new Date().toISOString() };
      } else {
        updatedData.orders.push({ ...order, id: Math.random().toString(36).substr(2, 9), dayId: day.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      this.saveData(updatedData);
      return;
    }

    const index = data.orders.findIndex((o: any) => o.dayId === day.id && o.userId === order.userId);
    if (index >= 0) {
      data.orders[index] = { ...data.orders[index], ...order, dayId: day.id, updatedAt: new Date().toISOString() };
    } else {
      data.orders.push({ ...order, id: Math.random().toString(36).substr(2, 9), dayId: day.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveData(data);
  }

  async resetSeasonalData(): Promise<void> {
    const data = this.getData();
    data.orders = [];
    data.days = [];
    this.saveData(data);
  }
}

export const db = new DB();
