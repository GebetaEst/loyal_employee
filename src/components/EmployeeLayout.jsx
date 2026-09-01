import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function EmployeeLayout({ children }) {
  const navigate = useNavigate();
  const { restaurant, employee, logout } = useStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const role = employee?.role || 'employee';
  const employeeName = employee?.name || 'Staff';
  const restaurantName = restaurant?.name || 'Restaurant';

  // Navigation config per role
  const getNavItems = () => {
    switch (role) {
      case 'chef':
        return [
          {
            to: '/kitchen',
            label: 'Kitchen',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            )
          },
          {
            to: '/profile',
            label: 'Profile',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )
          }
        ];
      case 'waiter':
        return [
          {
            to: '/orders',
            label: 'My Orders',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            )
          },
          {
            to: '/my-tables',
            label: 'My Tables',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )
          },
          {
            to: '/profile',
            label: 'Profile',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )
          }
        ];
      case 'cashier':
        return [
          {
            to: '/scan',
            label: 'Add Stamp',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            )
          },
          {
            to: '/payments',
            label: 'Payments',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            )
          },
          {
            to: '/profile',
            label: 'Profile',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )
          }
        ];
      default:
        return [
          {
            to: '/profile',
            label: 'Profile',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )
          }
        ];
    }
  };

  const logoLetter = restaurantName[0]?.toUpperCase() || 'R';

  return (
    <div className="min-h-screen flex flex-col pb-safe bg-[#0d0905] text-[#f5f0eb]">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-30"
        style={{
          background: 'rgba(13,9,5,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}
          >
            {logoLetter}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">{restaurantName}</p>
            <p className="text-xs text-white/35 leading-tight truncate capitalize">
              {employeeName} • {role}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/50 hover:text-white transition-all bg-white/5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </header>

      {/* Offline Status Warning */}
      {!isOnline && (
        <div className="bg-red-500/25 border-b border-red-500/40 text-red-200 text-center py-2.5 px-4 text-xs font-semibold animate-fade-in">
          ⚠️ You're offline. Order actions are temporarily unavailable.
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-5 py-4 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center border-t border-white/5"
        style={{
          background: 'rgba(13,9,5,0.92)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          paddingTop: '8px'
        }}
      >
        {getNavItems().map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 py-1 px-4 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-white/40 hover:text-white/60'
              }`
            }
            style={({ isActive }) => (isActive ? { color: 'var(--brand-primary)' } : {})}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
