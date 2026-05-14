import { create } from 'zustand';
import { AuthApi, setAuthToken } from '../api/client';
import { User } from '../types/auth';
import { getDatabase } from '../database/connection';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    const result = await AuthApi.login(email, password);

    if (result.success && result.data) {
      const { token, user } = result.data;
      setAuthToken(token);
      persistSession(token, user);
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({ isLoading: false, error: result.error || 'Login failed' });
    return false;
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    const result = await AuthApi.register(name, email, password);

    if (result.success && result.data) {
      const { token, user } = result.data;
      setAuthToken(token);
      persistSession(token, user);
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({ isLoading: false, error: result.error || 'Registration failed' });
    return false;
  },

  logout: () => {
    setAuthToken(null);
    clearPersistedSession();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  restoreSession: () => {
    try {
      const db = getDatabase();
      const result = db.execute(
        "SELECT value FROM sync_meta WHERE key = 'auth_session'",
      );
      if (result.rows && result.rows.length > 0) {
        const session = JSON.parse(result.rows.item(0).value as string);
        if (session.token && session.user) {
          setAuthToken(session.token);
          set({
            user: session.user,
            token: session.token,
            isAuthenticated: true,
          });
        }
      }
    } catch {
      // No session to restore
    }
  },

  clearError: () => set({ error: null }),
}));

function persistSession(token: string, user: User): void {
  try {
    const db = getDatabase();
    db.execute(
      `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auth_session', ?)`,
      [JSON.stringify({ token, user })],
    );
  } catch {
    // Silent fail — session won't persist across restarts
  }
}

function clearPersistedSession(): void {
  try {
    const db = getDatabase();
    db.execute("DELETE FROM sync_meta WHERE key = 'auth_session'");
  } catch {
    // Silent fail
  }
}
