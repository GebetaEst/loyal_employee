import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import QRScanner from '../components/QRScanner';
import ConfirmationModal from '../components/ConfirmationModal';
import { useStore } from '../store/useStore';
import api from '../api/axios';

const LOCK_DURATION_MS = 3500;

function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden">
          <div className="skeleton h-28 w-full" />
          <div className="p-3 flex flex-col gap-2">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuItem({ item }) {
  return (
    <div className="glass rounded-2xl overflow-hidden transition-transform hover:scale-[1.02]">
      {item.image ? (
        <img src={item.image} alt={item.name} className="w-full h-28 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-28 flex items-center justify-center text-4xl"
          style={{ background: 'rgba(255,255,255,0.04)' }}>
          🍽️
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-semibold text-white/90 line-clamp-1">{item.name}</p>
        {item.price != null && (
          <p className="text-xs mt-1 font-bold" style={{ color: 'var(--brand-primary)' }}>
            ${Number(item.price).toFixed(2)}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-white/35 mt-1 line-clamp-2">{item.description}</p>
        )}
      </div>
    </div>
  );
}

export default function ScanPage() {
  const navigate = useNavigate();
  const { restaurant, employee, logout } = useStore();

  const [scanned, setScanned] = useState(null);
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef(null);

  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const restaurantId = restaurant?._id || restaurant?.id;
  const restaurantName = restaurant?.name || 'Restaurant';

  // Redirect if not authed
  useEffect(() => {
    if (!localStorage.getItem('emp_token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Fetch menu
  useEffect(() => {
    if (!restaurantId) return;
    setMenuLoading(true);
    api.get(`/api/menus/restaurant/${restaurantId}`)
      .then(res => {
        const data = res.data;
        const items = Array.isArray(data)
          ? data.flatMap(category => category.items || [category])
          : data?.items || data?.menu || [];
        setMenu(items);
      })
      .catch(() => setMenu([]))
      .finally(() => setMenuLoading(false));
  }, [restaurantId]);

  const handleScan = useCallback((text) => {
    if (locked || scanned) return;
    // Extract customerId — handle URL format or raw ID
    let customerId = text;
    try {
      const url = new URL(text);
      customerId = url.searchParams.get('customerId') || url.searchParams.get('id') || text;
    } catch {}
    setScanned(customerId);
  }, [locked, scanned]);

  const handleModalClose = () => {
    setScanned(null);
    setLocked(true);
    lockTimer.current = setTimeout(() => setLocked(false), LOCK_DURATION_MS);
  };

  const handleSuccess = () => {
    setScanned(null);
    setLocked(true);
    lockTimer.current = setTimeout(() => setLocked(false), LOCK_DURATION_MS);
  };

  useEffect(() => () => clearTimeout(lockTimer.current), []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col pb-safe">
      <Toaster position="top-center" containerStyle={{ top: 20 }} />

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-30"
        style={{ background: 'rgba(13,9,5,0.85)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}>
            {restaurantName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{restaurantName}</p>
            <p className="text-xs text-white/35 leading-tight">
              {employee?.name || employee?.fullName || 'Employee'}
            </p>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/50 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col gap-6 px-5 py-6 overflow-y-auto">

        {/* Scanner section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Scan Customer</h2>
              <p className="text-xs text-white/40 mt-0.5">Point camera at customer's QR code</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
              style={{ background: locked ? 'rgba(234,179,8,0.12)' : 'rgba(74,222,128,0.12)',
                color: locked ? '#fde047' : '#4ade80',
                border: locked ? '1px solid rgba(234,179,8,0.25)' : '1px solid rgba(74,222,128,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: locked ? '#fde047' : '#4ade80' }} />
              {locked ? 'Locked' : 'Ready'}
            </div>
          </div>
          <QRScanner onScan={handleScan} locked={locked} />
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <span className="text-xs text-white/25">menu</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
        </div>

        {/* Menu section */}
        <section>
          <button
            id="toggle-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-3 mb-4 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--brand-primary)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--brand-primary-text)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M3 2l1.5 15.5L12 20l7.5-2.5L21 2"/><path d="M3 7h18"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Restaurant Menu</p>
                <p className="text-xs text-white/35">{menu.length} items</p>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="transition-transform text-white/40"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {menuOpen && (
            <div className="animate-fade-in-up">
              {menuLoading ? (
                <MenuSkeleton />
              ) : menu.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="text-4xl">🍽️</span>
                  <p className="text-sm text-white/40">No menu items available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {menu.map((item, i) => (
                    <MenuItem key={item._id || item.id || i} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Modal */}
      {scanned && (
        <ConfirmationModal
          customerId={scanned}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
