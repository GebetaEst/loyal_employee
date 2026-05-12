import { create } from 'zustand';
import { applyTheme, resetTheme } from '../lib/theme';

const STORAGE_TOKEN_KEY = 'emp_token';
const STORAGE_EMPLOYEE_KEY = 'emp_employee_id';
const STORAGE_RESTAURANT_KEY = 'emp_restaurant';

export const useStore = create((set, get) => ({
  // ─── Auth ───
  token: localStorage.getItem(STORAGE_TOKEN_KEY) || null,
  employee: null,
  // Saved employeeId persists even after token expiry
  savedEmployeeId: localStorage.getItem(STORAGE_EMPLOYEE_KEY) || null,

  // ─── Restaurant ───
  restaurant: (() => {
    try {
      const raw = localStorage.getItem(STORAGE_RESTAURANT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })(),

  // ─── Computed ───
  isAuthenticated: () => !!get().token,

  // ─── Actions ───
  setAuth: ({ token, employee }) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_EMPLOYEE_KEY, employee?.employeeId || employee?._id || '');
    set({ token, employee, savedEmployeeId: employee?.employeeId || employee?._id });
  },

  setRestaurant: (restaurant) => {
    try {
      localStorage.setItem(STORAGE_RESTAURANT_KEY, JSON.stringify(restaurant));
    } catch {}
    if (restaurant?.themeColor) {
      applyTheme(restaurant.themeColor);
    }
    set({ restaurant });
  },

  /** Called on 401: keep savedEmployeeId, wipe token + employee */
  clearAuthKeepEmployee: (employeeId) => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    const id = employeeId || get().savedEmployeeId;
    if (id) localStorage.setItem(STORAGE_EMPLOYEE_KEY, id);
    set({ token: null, employee: null });
    resetTheme();
  },

  /** Full logout */
  logout: () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_RESTAURANT_KEY);
    // Keep savedEmployeeId so next login is password-only
    set({ token: null, employee: null, restaurant: null });
    resetTheme();
  },
}));
