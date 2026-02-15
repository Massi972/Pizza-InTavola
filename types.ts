
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
  phone_e164: string;
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

export interface Modification {
  id: string;
  name: string;
  type: 'ADD' | 'REMOVE';
  active: boolean;
  sort_order?: number;
}

export enum DayStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export enum OverrideType {
  EXTRA = 'EXTRA',
  DISABLED = 'DISABLED',
  FORCE_OPEN = 'FORCE_OPEN',
  FORCE_CLOSED = 'FORCE_CLOSED'
}

export interface DayOverride {
  id: string;
  date: string;
  type: OverrideType;
  note?: string;
}

export interface Day {
  id: string;
  date: string;
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
  addModificationIds: string[];
  removeModificationIds: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
