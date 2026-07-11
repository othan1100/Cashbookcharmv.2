export type TxType = "in" | "out";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note?: string;
  customerId?: string;
  paymentMethod: "Cash" | "Card" | "Bank" | "Mobile";
  date: string; // ISO
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  balance: number;
  initial: string;
}

export interface Cashbook {
  id: string;
  name: string;
  description: string;
  entries: number;
}

export const customers: Customer[] = [
  { id: "c1", name: "yonis", phone: "61555554", email: "yonis@gmail.com", balance: 0, initial: "Y" },
  { id: "c2", name: "OSMAN GEDI", phone: "617677656", email: "osmangedi@gmail.com", balance: 600, initial: "O" },
  { id: "c3", name: "ozza", phone: "619172003", email: "othan1100@gmail.com", balance: 0, initial: "O" },
  { id: "c4", name: "Amina Hassan", phone: "615998812", email: "amina.h@gmail.com", balance: 240, initial: "A" },
];

const today = new Date();
const d = (offset: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() - offset);
  return x.toISOString();
};

export const transactions: Transaction[] = [
  { id: "t1", type: "in", amount: 600, category: "Lacag deen ah lagu lee yahey", note: "lacag bila oo lagu lee yahey", customerId: "c2", paymentMethod: "Cash", date: d(8) },
  { id: "t2", type: "in", amount: 6, category: "Food", note: "Copied entry", paymentMethod: "Cash", date: d(8) },
  { id: "t3", type: "in", amount: 6, category: "Food", note: "Cash In", paymentMethod: "Cash", date: d(12) },
  { id: "t4", type: "in", amount: 240, category: "Sales", customerId: "c4", paymentMethod: "Mobile", date: d(2) },
  { id: "t5", type: "out", amount: 80, category: "Supplies", paymentMethod: "Card", date: d(3) },
  { id: "t6", type: "out", amount: 45, category: "Transport", paymentMethod: "Cash", date: d(1) },
  { id: "t7", type: "in", amount: 320, category: "Sales", paymentMethod: "Bank", date: d(5) },
  { id: "t8", type: "out", amount: 120, category: "Rent", paymentMethod: "Bank", date: d(6) },
  { id: "t9", type: "in", amount: 90, category: "Sales", paymentMethod: "Mobile", date: d(0) },
];

export const cashbooks: Cashbook[] = [
  { id: "cb1", name: "General Ledger", description: "Default cashbook for all transactions", entries: transactions.length },
  { id: "cb2", name: "Shop Sales", description: "Daily retail sales register", entries: 12 },
  { id: "cb3", name: "Online Orders", description: "E-commerce & delivery orders", entries: 7 },
];

export const totals = {
  cashIn: transactions.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0),
  cashOut: transactions.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0),
  get net() {
    return this.cashIn - this.cashOut;
  },
  get balance() {
    return this.net;
  },
};

// Last 7 days series
export function last7DaysSeries() {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("en", { weekday: "short" });
    const dayTx = transactions.filter((t) => t.date.slice(0, 10) === key);
    return {
      day: label,
      in: dayTx.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0),
      out: dayTx.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0),
    };
  });
  return days;
}

export function last14DaysCashFlow() {
  let running = 0;
  return Array.from({ length: 14 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    const key = date.toISOString().slice(0, 10);
    const dayTx = transactions.filter((t) => t.date.slice(0, 10) === key);
    const net = dayTx.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
    running += net;
    return {
      date: date.toLocaleDateString("en", { day: "2-digit", month: "short" }),
      balance: running,
    };
  });
}

export function categoryBreakdown() {
  const map = new Map<string, number>();
  transactions
    .filter((t) => t.type === "in")
    .forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function monthlyTrend() {
  return Array.from({ length: 6 }).map((_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const label = date.toLocaleDateString("en", { month: "short", year: "2-digit" });
    // Simulated history + current month from real
    const isCurrent = i === 5;
    const cashIn = isCurrent ? totals.cashIn : Math.round(200 + Math.random() * 400);
    const cashOut = isCurrent ? totals.cashOut : Math.round(80 + Math.random() * 220);
    return { month: label, cashIn, cashOut, profit: cashIn - cashOut };
  });
}
