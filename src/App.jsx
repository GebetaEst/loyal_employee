import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { applyTheme } from './lib/theme';
import LoginPage from './pages/LoginPage';
import ScanPage from './pages/ScanPage';
import InstallPrompt from './components/InstallPrompt';

function ProtectedRoute({ children }) {
  const token = useStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { restaurant } = useStore();

  // Re-apply theme on hot reload / mount from cached restaurant
  useEffect(() => {
    if (restaurant?.themeColor) applyTheme(restaurant.themeColor);
  }, [restaurant]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/scan" element={
          <ProtectedRoute>
            <ScanPage />
          </ProtectedRoute>
        } />
        {/* Default redirect based on auth state */}
        <Route path="*" element={<Navigate to="/scan" replace />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  );
}
