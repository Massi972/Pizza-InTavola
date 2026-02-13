
export enum Role {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  WORKER = 'WORKER'
}

export type SlotTime = '17:30' | '18:00' | '19:00';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone_e164: string; // Formato internazionale obbligatorio es. +39...
  pin: string;
  role: Role;
  active: boolean;
}

export interface Pizza {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  active: boolean;
  isVegetarian?: boolean;
}

export enum DayStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export interface Day {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  status: DayStatus;
  openedAt: string;
  closedAt?: string;
}

export interface Order {
  id: string;
  dayId: string;
  userId: string;
  pizzaId: string;
  slotTime: SlotTime;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
