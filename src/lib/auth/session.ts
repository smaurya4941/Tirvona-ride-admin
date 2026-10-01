import { useSyncExternalStore } from "react";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  role: "CUSTOMER" | "DRIVER" | "ADMIN";
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

// sessionStorage, not localStorage: an ops-panel session should end with the
// tab, and it keeps tokens out of storage shared by every tab on the origin.
const STORAGE_KEY = "tirvona-ride-admin.session";

const listeners = new Set<() => void>();

function read(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

let current: StoredSession | null = read();

function emit(): void {
  for (const listener of listeners) listener();
}

export const session = {
  get(): StoredSession | null {
    return current;
  },
  set(next: StoredSession): void {
    current = next;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked (private mode) — the in-memory session still works.
    }
    emit();
  },
  updateTokens(accessToken: string, refreshToken: string): void {
    if (!current) return;
    session.set({ ...current, accessToken, refreshToken });
  },
  clear(): void {
    current = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSession(): StoredSession | null {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
