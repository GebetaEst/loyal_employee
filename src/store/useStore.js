import { create } from 'zustand';
import { applyTheme, resetTheme } from '../lib/theme';

const STORAGE_SESSION_KEY = 'emp_session';
const STORAGE_SAVED_ID_KEY = 'emp_saved_id';

const getStoredSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  try {
    if (session) {
      // Exclude menu from the stored localStorage JSON to keep storage clean
      const sessionToStore = { ...session };
      delete sessionToStore.menu;
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionToStore));
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
};

const storedSession = getStoredSession();
if (storedSession?.restaurant?.themeColor) {
  applyTheme(storedSession.restaurant.themeColor);
}

export const useStore = create((set, get) => ({
  // ─── Auth ───
  token: storedSession?.token || null,
  employee: storedSession?.employee || null,
  
  // Saved employeeId persists even after token expiry
  savedEmployeeId: localStorage.getItem(STORAGE_SAVED_ID_KEY) || null,

  // ─── Restaurant ───
  restaurant: storedSession?.restaurant || null,
  menu: [], // Menu is only stored in memory state, not loaded from local storage

  // ─── Realtime ───
  socketConnected: false,
  ordersRevision: 0,
  lastRealtimeAt: null,

  // ─── Computed ───
  isAuthenticated: () => !!get().token,

  // ─── Actions ───
  setSocketConnected: (socketConnected) => set({ socketConnected }),

  bumpOrdersRevision: () =>
    set((state) => ({
      ordersRevision: state.ordersRevision + 1,
      lastRealtimeAt: Date.now(),
    })),

  resetRealtime: () =>
    set({
      socketConnected: false,
      ordersRevision: 0,
      lastRealtimeAt: null,
    }),
  setAuth: ({ token, employee }) => {
    const empId = employee?.id || employee?.employeeId || employee?._id || '';
    if (empId) {
      localStorage.setItem(STORAGE_SAVED_ID_KEY, empId);
    }
    
    // Explicitly define session fields to prevent data duplication (excluding menu)
    const stored = getStoredSession();
    const nextSession = {
      token,
      employee,
      restaurant: stored?.restaurant || null
    };
    saveSession(nextSession);
    
    set({
      token,
      employee,
      savedEmployeeId: empId || get().savedEmployeeId
    });
  },

  setRestaurant: (restaurant, menu = []) => {
    if (restaurant?.themeColor) {
      applyTheme(restaurant.themeColor);
    }
    
    const stored = getStoredSession();
    const nextSession = {
      token: stored?.token || null,
      employee: stored?.employee || null,
      restaurant,
      menu
    };
    saveSession(nextSession);
    
    set({ restaurant, menu });
  },

  /** Called on 401: keep savedEmployeeId, wipe session state */
  clearAuthKeepEmployee: (employeeId) => {
    const id = employeeId || get().savedEmployeeId;
    if (id) {
      localStorage.setItem(STORAGE_SAVED_ID_KEY, id);
    }
    
    saveSession(null);
    
    set({
      token: null,
      employee: null,
      restaurant: null,
      menu: [],
      savedEmployeeId: id,
      socketConnected: false,
      ordersRevision: 0,
      lastRealtimeAt: null,
    });
    resetTheme();
  },

  /** Full logout */
  logout: () => {
    saveSession(null);
    // Purge legacy storage keys to clean up user's browser
    localStorage.removeItem('emp');
    localStorage.removeItem('emp_employee_data');
    localStorage.removeItem('emp_employee_id');
    localStorage.removeItem('emp_restaurant');
    localStorage.removeItem('emp_token');
    
    set({
      token: null,
      employee: null,
      restaurant: null,
      menu: [],
      socketConnected: false,
      ordersRevision: 0,
      lastRealtimeAt: null,
    });
    resetTheme();
  },
}));
