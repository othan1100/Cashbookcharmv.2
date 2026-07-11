// Manage payment methods in localStorage. The DB enum is fixed (Cash/Card/Bank/Mobile),
// so user-added methods are stored in a custom "note" prefix or mapped to the closest enum.
// To keep DB compatibility we only allow the fixed enum values to be saved on the transaction,
// but we let users hide/show or add display aliases here.

const KEY = "cashbook.paymentMethods";

export const BUILTIN_METHODS = ["Cash", "Card", "Bank", "Mobile"] as const;
export type DbPaymentMethod = typeof BUILTIN_METHODS[number];

export type PaymentMethod = {
  id: string;
  label: string;        // What the user sees (e.g. "Salam Bank")
  dbValue: DbPaymentMethod; // What we store in DB
};

const DEFAULTS: PaymentMethod[] = BUILTIN_METHODS.map((m) => ({
  id: m.toLowerCase(),
  label: m,
  dbValue: m,
}));

export function getPaymentMethods(): PaymentMethod[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export function savePaymentMethods(list: PaymentMethod[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
