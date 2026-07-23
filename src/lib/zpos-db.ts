// Offline-first local store backed by localStorage.
// Ships EMPTY except for the real Super Admin account.
// Owners and cashiers are created inside the app.

export type UserRole = "super_admin" | "owner" | "cashier";

export interface Organization {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  status: "active" | "suspended";
  createdAt: number;
  currency: string;
  logo?: string; // data URL or remote URL
  receiptFooter?: string;
  // Optional receipt / tax details — all optional so any business fits.
  tin?: string;
  vatNumber?: string;
  vatRate?: number; // percent, e.g. 18
  website?: string;
  receiptHeader?: string;
}

export interface AppUser {
  id: string;
  email: string;
  phone?: string;
  name: string;
  password: string;
  role: UserRole;
  orgId?: string;
  disabled?: boolean;
}

export interface Product {
  id: string;
  orgId: string;
  name: string;
  category: string;
  barcode?: string;
  costPrice: number;
  price: number;
  stock: number;
  minStock: number;
  unit?: string; // pcs, kg, ltr, box... — universal & optional
  image?: string;
  description?: string;
  updatedAt: number;
}

export interface Customer {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

export interface Sale {
  id: string;
  orgId: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  profit: number;
  payment: "cash" | "mobile" | "bank";
  customerId?: string;
  customerName?: string;
  cashierId: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  orgId: string;
  category: "Rent" | "Salaries" | "Electricity" | "Transport" | "Others";
  amount: number;
  note?: string;
  createdAt: number;
}

export interface StockMovement {
  id: string;
  orgId: string;
  productId: string;
  productName: string;
  type: "in" | "out" | "adjust" | "sale";
  qty: number; // signed change or new value for adjust
  before: number;
  after: number;
  userId: string;
  note?: string;
  createdAt: number;
}

interface DB {
  orgs: Organization[];
  users: AppUser[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
  stockMovements: StockMovement[];
}

// v2 = clean-slate reset (removes any legacy demo data from prior installs)
const KEY = "zpos:db:v2";
const LEGACY_KEYS = ["zpos:db:v1"];

const seed = (): DB => ({
  orgs: [],
  users: [
    {
      id: "u_root_admin",
      email: "zetioraaitechnologies@gmail.com",
      name: "Zetiora AI Technologies",
      password: "92Elly..!",
      role: "super_admin",
    },
  ],
  products: [],
  customers: [],
  sales: [],
  expenses: [],
  stockMovements: [],
});

const listeners = new Set<() => void>();

function read(): DB {
  if (typeof window === "undefined") return seed();
  for (const legacy of LEGACY_KEYS) localStorage.removeItem(legacy);

  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  try {
    const db = JSON.parse(raw) as DB;
    if (!db.users.some((u) => u.role === "super_admin")) {
      db.users.push(seed().users[0]);
    }
    if (!db.stockMovements) db.stockMovements = [];
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  } catch {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

function write(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((l) => l());
}

export const zdb = {
  get: read,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  update(fn: (db: DB) => void) {
    const db = read();
    fn(db);
    write(db);
  },
  reset() {
    localStorage.removeItem(KEY);
    write(seed());
  },
};

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function fmtMoney(n: number, currency = "TZS") {
  return `${currency} ${Math.round(n).toLocaleString()}`;
}
