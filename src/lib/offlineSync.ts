import { supabase } from "@/integrations/supabase/client";

export interface OfflineMutation {
  id: string; // unique ID for the offline action
  table: "transactions" | "customers" | "cashbooks";
  action: "insert" | "update" | "delete";
  payload: any;
  targetId?: string; // id of row being updated/deleted
  createdAt: string;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Low-level cache accessors
export function getOfflineCache<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(`cbc_cache_${key}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to read offline cache for key:", key, e);
    return [];
  }
}

export function setOfflineCache<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(`cbc_cache_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to write offline cache for key:", key, e);
  }
}

// Mutation queue management
export function getOfflineMutations(): OfflineMutation[] {
  try {
    const queue = localStorage.getItem("cbc_offline_mutations");
    return queue ? JSON.parse(queue) : [];
  } catch (e) {
    console.error("Failed to read offline mutations", e);
    return [];
  }
}

export function saveOfflineMutations(mutations: OfflineMutation[]): void {
  try {
    localStorage.setItem("cbc_offline_mutations", JSON.stringify(mutations));
    // Trigger custom event so components can update in real-time
    window.dispatchEvent(new Event("offline_mutations_changed"));
  } catch (e) {
    console.error("Failed to save offline mutations", e);
  }
}

export function addOfflineMutation(table: OfflineMutation["table"], action: OfflineMutation["action"], payload: any, targetId?: string): OfflineMutation {
  const mutations = getOfflineMutations();
  const id = generateUUID();
  const newMutation: OfflineMutation = {
    id,
    table,
    action,
    payload,
    targetId,
    createdAt: new Date().toISOString(),
  };
  mutations.push(newMutation);
  saveOfflineMutations(mutations);
  return newMutation;
}

export function removeOfflineMutation(id: string): void {
  const mutations = getOfflineMutations();
  const filtered = mutations.filter((m) => m.id !== id);
  saveOfflineMutations(filtered);
}

export function clearOfflineMutations(): void {
  saveOfflineMutations([]);
}

/**
 * Merges pending offline mutations onto cached database rows
 * so that they are immediately reflected on the UI.
 */
export function mergePendingMutations<T extends { id: string }>(table: "transactions" | "customers" | "cashbooks", cachedRows: T[]): T[] {
  const mutations = getOfflineMutations().filter((m) => m.table === table);
  if (mutations.length === 0) return cachedRows;

  // Clone rows to avoid direct mutation
  let result = [...cachedRows];

  for (const mut of mutations) {
    if (mut.action === "insert") {
      // Ensure we don't add duplicate IDs
      if (!result.some((r) => r.id === mut.payload.id)) {
        result.unshift(mut.payload);
      }
    } else if (mut.action === "update" && mut.targetId) {
      result = result.map((r) => {
        if (r.id === mut.targetId) {
          return { ...r, ...mut.payload };
        }
        return r;
      });
    } else if (mut.action === "delete" && mut.targetId) {
      result = result.filter((r) => r.id !== mut.targetId);
    }
  }

  return result;
}

/**
 * Executes a single mutation against Supabase.
 */
async function executeMutation(mut: OfflineMutation): Promise<boolean> {
  try {
    if (mut.action === "insert") {
      const { error } = await supabase.from(mut.table).insert(mut.payload);
      if (error) {
        console.error(`Offline sync insert error on ${mut.table}:`, error);
        // If it's a duplicate primary key, count as success because it's already there
        if (error.code === "23505") return true;
        return false;
      }
      return true;
    } else if (mut.action === "update" && mut.targetId) {
      const { error } = await supabase.from(mut.table).update(mut.payload).eq("id", mut.targetId);
      if (error) {
        console.error(`Offline sync update error on ${mut.table}:`, error);
        return false;
      }
      return true;
    } else if (mut.action === "delete" && mut.targetId) {
      const { error } = await supabase.from(mut.table).delete().eq("id", mut.targetId);
      if (error) {
        console.error(`Offline sync delete error on ${mut.table}:`, error);
        return false;
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("Exception during mutation execution:", e);
    return false;
  }
}

/**
 * Synchronizes queued offline mutations with Supabase.
 */
export async function syncOfflineMutations(): Promise<{
  success: boolean;
  syncedCount: number;
  errors: string[];
}> {
  const mutations = getOfflineMutations();
  if (mutations.length === 0) {
    return { success: true, syncedCount: 0, errors: [] };
  }

  const errors: string[] = [];
  let syncedCount = 0;

  // Process mutations in sequential order (FIFO)
  const remainingMutations: OfflineMutation[] = [];

  for (const mut of mutations) {
    const ok = await executeMutation(mut);
    if (ok) {
      syncedCount++;
    } else {
      errors.push(`Failed to sync ${mut.action} on ${mut.table}`);
      remainingMutations.push(mut);
    }
  }

  saveOfflineMutations(remainingMutations);

  return {
    success: errors.length === 0,
    syncedCount,
    errors,
  };
}
