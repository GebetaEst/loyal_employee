import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import { applyTheme } from './lib/theme';
import EmployeeRealtimeManager from './realtime/EmployeeRealtimeManager';
import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import MyTablesPage from './pages/MyTablesPage';
import PaymentsPage from './pages/PaymentsPage';
import ProfilePage from './pages/ProfilePage';
import ScanPage from './pages/ScanPage';
import InstallPrompt from './components/InstallPrompt';

// Role Guard Component
function RoleGuard({ children, allowedRoles }) {
  const token = useStore((s) => s.token);
  const employee = useStore((s) => s.employee);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex items-center justify-center font-bold text-sm">
        Loading employee profile...
      </div>
    );
  }

  if (!allowedRoles.includes(employee.role)) {
    // Redirect to default route based on employee's actual role
    if (employee.role === 'chef') return <Navigate to="/profile" replace />;
    if (employee.role === 'waiter') return <Navigate to="/orders" replace />;
    if (employee.role === 'cashier') return <Navigate to="/payments" replace />;
    return <Navigate to="/profile" replace />;
  }

  return children;
}

// Redirect helper based on logged-in role
function RoleRedirect() {
  const token = useStore((s) => s.token);
  const employee = useStore((s) => s.employee);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex items-center justify-center font-bold text-sm">
        Loading employee profile...
      </div>
    );
  }

  // Chef has no operational order queue; redirected to profile
  if (employee.role === 'chef') return <Navigate to="/profile" replace />;
  if (employee.role === 'waiter') return <Navigate to="/orders" replace />;
  if (employee.role === 'cashier') return <Navigate to="/payments" replace />;
  return <Navigate to="/profile" replace />;
}

export default function App() {
  const { restaurant } = useStore();

  // Re-apply theme on hot reload / mount from cached restaurant
  useEffect(() => {
    if (restaurant?.themeColor) applyTheme(restaurant.themeColor);
  }, [restaurant]);

  return (
    <BrowserRouter>
      {/* Global Non-Visual Employee Realtime Manager */}
      <EmployeeRealtimeManager />

      {/* Global Toaster for notifications across all pages */}
      <Toaster position="top-center" reverseOrder={false} />

      <Routes>
        {/* Unauthenticated Login page */}
        <Route
          path="/login"
          element={
            useStore.getState().token ? <RoleRedirect /> : <LoginPage />
          }
        />

        {/* Legacy /kitchen route redirects to /profile */}
        <Route
          path="/kitchen"
          element={<Navigate to="/profile" replace />}
        />

        {/* Waiter routes */}
        <Route
          path="/orders"
          element={
            <RoleGuard allowedRoles={['waiter']}>
              <OrdersPage />
            </RoleGuard>
          }
        />
        <Route
          path="/my-tables"
          element={
            <RoleGuard allowedRoles={['waiter']}>
              <MyTablesPage />
            </RoleGuard>
          }
        />

        {/* Cashier routes */}
        <Route
          path="/payments"
          element={
            <RoleGuard allowedRoles={['cashier']}>
              <PaymentsPage />
            </RoleGuard>
          }
        />

        {/* Shared Authenticated Profile route */}
        <Route
          path="/profile"
          element={
            <RoleGuard allowedRoles={['chef', 'waiter', 'cashier']}>
              <ProfilePage />
            </RoleGuard>
          }
        />

        {/* Cashier & Waiter scanner route */}
        <Route
          path="/scan"
          element={
            <RoleGuard allowedRoles={['cashier', 'waiter']}>
              <ScanPage />
            </RoleGuard>
          }
        />

        {/* Fallbacks */}
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  );
}
