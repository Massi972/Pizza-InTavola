
import { Role, SlotTime, Pizza, User } from './types';

export const SLOT_TIMES: SlotTime[] = ['17:30', '18:00', '19:00'];

export const CUTOFF_TIME = '16:30';
export const TIMEZONE = 'Europe/Rome';

export const INITIAL_PIZZAS: Pizza[] = [
  {
    id: '1',
    name: 'Margherita',
    description: 'La classica intramontabile',
    ingredients: ['Pomodoro', 'Mozzarella', 'Basilico', 'Olio EVO'],
    allergens: ['Lattosio', 'Glutine'],
    active: true,
    isVegetarian: true
  },
  {
    id: '2',
    name: 'Diavola',
    description: 'Per chi ama il piccante',
    ingredients: ['Pomodoro', 'Mozzarella', 'Salame piccante', 'Olio piccante'],
    allergens: ['Lattosio', 'Glutine'],
    active: true
  },
  {
    id: '3',
    name: 'Marinara',
    description: 'Semplice e profumata',
    ingredients: ['Pomodoro', 'Aglio', 'Origano', 'Olio EVO'],
    allergens: ['Glutine'],
    active: true,
    isVegetarian: true
  },
  {
    id: '4',
    name: 'Napoli',
    description: 'Il sapore del mare',
    ingredients: ['Pomodoro', 'Mozzarella', 'Acciughe', 'Capperi', 'Origano'],
    allergens: ['Lattosio', 'Glutine', 'Pesce'],
    active: true
  },
  {
    id: '5',
    name: 'Ortolana',
    description: 'Ricca di verdure di stagione',
    ingredients: ['Pomodoro', 'Mozzarella', 'Zucchine', 'Melanzane', 'Peperoni'],
    allergens: ['Lattosio', 'Glutine'],
    active: true,
    isVegetarian: true
  },
  {
    id: '6',
    name: 'Prosciutto e Funghi',
    description: 'Un grande classico',
    ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto cotto', 'Funghi champignon'],
    allergens: ['Lattosio', 'Glutine'],
    active: true
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    firstName: 'Mario',
    lastName: 'Rossi',
    // Added missing email property
    email: 'mario.rossi@example.com',
    // Fix: Use phone_e164 instead of phone to match User interface
    phone_e164: '+393330000001',
    pin: '1234',
    role: Role.ADMIN,
    active: true
  },
  {
    id: 'u2',
    firstName: 'Luigi',
    lastName: 'Verdi',
    // Added missing email property
    email: 'luigi.verdi@example.com',
    // Fix: Use phone_e164 instead of phone to match User interface
    phone_e164: '+393330000002',
    pin: '1111',
    role: Role.SUPERVISOR,
    active: true
  },
  {
    id: 'u3',
    firstName: 'Anna',
    lastName: 'Bianchi',
    // Added missing email property
    email: 'anna.bianchi@example.com',
    // Fix: Use phone_e164 instead of phone to match User interface
    phone_e164: '+393330000003',
    pin: '0000',
    role: Role.WORKER,
    active: true
  }
];
