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

  upsertActiveOrder: (order, employee) => {
    if (!order) return;
    const currentEmployee = employee || get().employee;
    const orderId = order.id || order._id;

    // Check terminal states
    const stepKey = (order.currentStepKey || '').toLowerCase();
    const systemState = (order.systemState || '').toUpperCase();
    const isTerminal = stepKey === 'completed' || stepKey === 'cancelled' || systemState === 'COMPLETED' || systemState === 'CANCELLED';

    if (isTerminal) {
      set((state) => {
        const filteredActive = state.activeOrders.filter((o) => (o.id || o._id) !== orderId);
        const existsInHistory = state.historyOrders.some((o) => (o.id || o._id) === orderId);
        const nextHistory = existsInHistory
          ? state.historyOrders.map((o) => ((o.id || o._id) === orderId ? { ...o, ...order } : o))
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
      const exists = state.activeOrders.some((o) => (o.id || o._id) === orderId);
      if (exists) {
        return {
          activeOrders: state.activeOrders.map((o) => ((o.id || o._id) === orderId ? { ...o, ...order } : o)),
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
    const fullOrder = updates.order;
    const currentStepKey = (updates.currentStepKey || fullOrder?.currentStepKey || '').toLowerCase();
    const systemState = (updates.systemState || fullOrder?.systemState || '').toUpperCase();
    const isTerminal = currentStepKey === 'completed' || currentStepKey === 'cancelled' || systemState === 'COMPLETED' || systemState === 'CANCELLED';

    set((state) => {
      const existing = state.activeOrders.find((o) => (o.id || o._id) === orderId);

      if (isTerminal) {
        const baseOrder = fullOrder || existing;
        if (!baseOrder) return state;
        const merged = {
          ...baseOrder,
          currentStepKey: currentStepKey || baseOrder.currentStepKey,
          systemState: systemState || baseOrder.systemState,
          updatedAt: updates.updatedAt || new Date().toISOString(),
        };
        const nextActive = state.activeOrders.filter((o) => (o.id || o._id) !== orderId);
        const existsInHistory = state.historyOrders.some((o) => (o.id || o._id) === orderId);
        const nextHistory = existsInHistory
          ? state.historyOrders.map((o) => ((o.id || o._id) === orderId ? { ...o, ...merged } : o))
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
        activeOrders: state.activeOrders.map((o) => ((o.id || o._id) === orderId ? merged : o)),
      };
    });
  },

  cancelOrderState: (orderId, reason = 'Cancelled by staff override') => {
    if (!orderId) return;
    set((state) => {
      const existing = state.activeOrders.find((o) => (o.id || o._id) === orderId);
      const nextActive = state.activeOrders.filter((o) => (o.id || o._id) !== orderId);
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

      const existsInHistory = state.historyOrders.some((o) => (o.id || o._id) === orderId);
      const nextHistory = existsInHistory
        ? state.historyOrders.map((o) => ((o.id || o._id) === orderId ? cancelledOrder : o))
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
