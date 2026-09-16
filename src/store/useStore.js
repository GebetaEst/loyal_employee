import { create } from 'zustand';
import api from '../api/axios';
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
      // Exclude menu, tables, and operational queues to prevent overloading localStorage
      const sessionToStore = {
        token: session.token,
        employee: session.employee ? {
          id: session.employee.id || session.employee._id,
          _id: session.employee.id || session.employee._id,
          name: session.employee.name,
          employeeId: session.employee.employeeId,
          role: session.employee.role,
          restaurant: session.employee.restaurant,
        } : null,
        restaurant: session.restaurant ? {
          id: session.restaurant.id || session.restaurant._id,
          _id: session.restaurant.id || session.restaurant._id,
          name: session.restaurant.name,
          themeColor: session.restaurant.themeColor,
        } : null,
      };
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

/**
 * Normalizes table objects to retain ONLY necessary operational data in memory,
 * discarding heavy server-side metadata to keep client state minimal.
 */
function normalizeTable(t) {
  if (!t) return null;
  return {
    id: (t.id || t._id)?.toString(),
    _id: (t.id || t._id)?.toString(),
    name: t.name || '',
    code: t.code || '',
    description: t.description || '',
    assignedWaiter: t.assignedWaiter ? {
      id: (t.assignedWaiter.id || t.assignedWaiter._id || t.assignedWaiter)?.toString(),
      _id: (t.assignedWaiter.id || t.assignedWaiter._id || t.assignedWaiter)?.toString(),
      name: t.assignedWaiter.name || '',
      role: t.assignedWaiter.role || 'waiter',
    } : null,
    isActive: t.isActive !== false,
  };
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

  // ─── Tables State (In-memory cache only, excluded from localStorage) ───
  tables: [],
  tablesLoaded: false,
  tablesLoading: false,
  tablesError: '',

  // ─── Realtime ───
  socketConnected: false,
  ordersRevision: 0,
  lastRealtimeAt: null,

  // ─── Orders State ───
  activeOrders: [],
  historyOrders: [],
  ordersLoading: true,
  ordersError: '',

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

  setActiveOrders: (activeOrders) =>
    set({ activeOrders, ordersLoading: false, ordersError: '' }),

  setHistoryOrders: (historyOrders) =>
    set({ historyOrders }),

  setOrdersLoading: (ordersLoading) =>
    set({ ordersLoading }),

  setOrdersError: (ordersError) =>
    set({ ordersError, ordersLoading: false }),

  // ─── Table Actions (Cached in Zustand, re-fetches only on explicit refresh) ───
  setTables: (rawTables) => {
    const clean = (rawTables || []).map(normalizeTable).filter(Boolean);
    set({ tables: clean, tablesLoaded: true, tablesLoading: false, tablesError: '' });
  },

  fetchTables: async (force = false) => {
    const state = get();
    // Cache guard: If tables are already loaded in memory and not forced, return cached tables
    if (!force && state.tablesLoaded) {
      return state.tables;
    }
    if (state.tablesLoading) return state.tables;

    const restaurantId = state.restaurant?._id || state.restaurant?.id || state.employee?.restaurant;
    if (!restaurantId) {
      set({ tablesLoading: false, tablesError: 'Restaurant context missing.' });
      return [];
    }

    set({ tablesLoading: true, tablesError: '' });
    try {
      const res = await api.get(`/api/restaurants/${restaurantId}/tables`);
      if (res.data?.success) {
        const clean = (res.data.data || []).map(normalizeTable).filter(Boolean);
        set({
          tables: clean,
          tablesLoaded: true,
          tablesLoading: false,
          tablesError: '',
        });
        return clean;
      } else {
        set({ tablesLoading: false, tablesError: 'Failed to load tables.' });
      }
    } catch (err) {
      console.error('🔥 Error fetching tables in useStore:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to sync tables.';
      set({ tablesLoading: false, tablesError: msg });
    }
    return get().tables;
  },

  upsertActiveOrder: (order, employee) => {
    if (!order) return;
    const currentEmployee = employee || get().employee;
    const orderId = (order.id || order._id)?.toString();
    if (!orderId) return;

    // Check terminal states
    const stepKey = (order.currentStepKey || '').toLowerCase();
    const systemState = (order.systemState || '').toUpperCase();
    const isTerminal = stepKey === 'completed' || stepKey === 'cancelled' || systemState === 'COMPLETED' || systemState === 'CANCELLED';

    if (isTerminal) {
      set((state) => {
        const filteredActive = state.activeOrders.filter((o) => (o.id || o._id)?.toString() !== orderId);
        const existsInHistory = state.historyOrders.some((o) => (o.id || o._id)?.toString() === orderId);
        const nextHistory = existsInHistory
          ? state.historyOrders.map((o) => ((o.id || o._id)?.toString() === orderId ? { ...o, ...order } : o))
          : [order, ...state.historyOrders];
        return {
          activeOrders: filteredActive,
          historyOrders: nextHistory.slice(0, 25),
        };
      });
      return;
    }

    // Role visibility check for active orders
    if (currentEmployee && currentEmployee.role === 'waiter') {
      if (order.service && order.service.waiter) {
        const waiterId = order.service.waiter.id || order.service.waiter._id || order.service.waiter;
        const empId = currentEmployee.id || currentEmployee._id;
        if (waiterId && empId && waiterId.toString() !== empId.toString()) {
          return; // Assigned to another waiter
        }
      }
    }

    set((state) => {
      const exists = state.activeOrders.some((o) => (o.id || o._id)?.toString() === orderId);
      if (exists) {
        return {
          activeOrders: state.activeOrders.map((o) => ((o.id || o._id)?.toString() === orderId ? { ...o, ...order } : o)),
        };
      }
      // New active order: active queue is sorted oldest-first, so new orders append
      return {
        activeOrders: [...state.activeOrders, order],
      };
    });
  },

  updateOrderState: (orderId, updates = {}) => {
    if (!orderId) return;
    const targetId = orderId.toString();
    const fullOrder = updates.order;
    const currentStepKey = (updates.currentStepKey || fullOrder?.currentStepKey || '').toLowerCase();
    const systemState = (updates.systemState || fullOrder?.systemState || '').toUpperCase();
    const isTerminal = currentStepKey === 'completed' || currentStepKey === 'cancelled' || systemState === 'COMPLETED' || systemState === 'CANCELLED';

    set((state) => {
      const existing = state.activeOrders.find((o) => (o.id || o._id)?.toString() === targetId);

      if (isTerminal) {
        const baseOrder = fullOrder || existing;
        if (!baseOrder) return state;
        const merged = {
          ...baseOrder,
          currentStepKey: currentStepKey || baseOrder.currentStepKey,
          systemState: systemState || baseOrder.systemState,
          updatedAt: updates.updatedAt || new Date().toISOString(),
        };
        const nextActive = state.activeOrders.filter((o) => (o.id || o._id)?.toString() !== targetId);
        const existsInHistory = state.historyOrders.some((o) => (o.id || o._id)?.toString() === targetId);
        const nextHistory = existsInHistory
          ? state.historyOrders.map((o) => ((o.id || o._id)?.toString() === targetId ? { ...o, ...merged } : o))
          : [merged, ...state.historyOrders];

        return {
          activeOrders: nextActive,
          historyOrders: nextHistory.slice(0, 25),
        };
      }

      if (!existing && !fullOrder) return state;

      const merged = {
        ...(existing || {}),
        ...(fullOrder || {}),
        currentStepKey: currentStepKey || existing?.currentStepKey,
        systemState: systemState || existing?.systemState,
        updatedAt: updates.updatedAt || new Date().toISOString(),
      };

      return {
        activeOrders: state.activeOrders.map((o) => ((o.id || o._id)?.toString() === targetId ? merged : o)),
      };
    });
  },

  cancelOrderState: (orderId, reason = 'Cancelled by staff override') => {
    if (!orderId) return;
    const targetId = orderId.toString();
    set((state) => {
      const existing = state.activeOrders.find((o) => (o.id || o._id)?.toString() === targetId);
      const nextActive = state.activeOrders.filter((o) => (o.id || o._id)?.toString() !== targetId);
      if (!existing) return { activeOrders: nextActive };

      const cancelledOrder = {
        ...existing,
        currentStepKey: 'cancelled',
        systemState: 'CANCELLED',
        cancellation: {
          reason,
          cancelledAt: new Date().toISOString(),
        },
      };

      const existsInHistory = state.historyOrders.some((o) => (o.id || o._id)?.toString() === targetId);
      const nextHistory = existsInHistory
        ? state.historyOrders.map((o) => ((o.id || o._id)?.toString() === targetId ? cancelledOrder : o))
        : [cancelledOrder, ...state.historyOrders];

      return {
        activeOrders: nextActive,
        historyOrders: nextHistory.slice(0, 5),
      };
    });
  },
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
      tables: [],
      tablesLoaded: false,
      tablesLoading: false,
      tablesError: '',
      savedEmployeeId: id,
      socketConnected: false,
      ordersRevision: 0,
      lastRealtimeAt: null,
      activeOrders: [],
      historyOrders: [],
      ordersLoading: true,
      ordersError: '',
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
      tables: [],
      tablesLoaded: false,
      tablesLoading: false,
      tablesError: '',
      socketConnected: false,
      ordersRevision: 0,
      lastRealtimeAt: null,
      activeOrders: [],
      historyOrders: [],
      ordersLoading: true,
      ordersError: '',
    });
    resetTheme();
  },
}));
