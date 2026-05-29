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
    <div className="glass rounded-2xl overflow-hidden transition-all hover:scale-[1.01] flex gap-3 p-3">
      <div className="flex-shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl" loading="lazy" />
        ) : (
          <div className="w-16 h-16 flex items-center justify-center text-3xl rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            🍽️
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 line-clamp-1">{item.name}</p>
        {item.price != null && (
          <p className="text-base font-bold mt-0.5" style={{ color: 'var(--brand-primary)' }}>
            ${Number(item.price).toFixed(2)}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-snug">{item.description}</p>
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
  const [cameraGranted, setCameraGranted] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const lockTimer = useRef(null);

  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const restaurantId = restaurant?._id || restaurant?.id;
  const restaurantName = restaurant?.name || 'Restaurant';

  useEffect(() => {
    if (!localStorage.getItem('emp_token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

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

  // Called only from a direct user tap — required for PWA permission dialog to fire
  const handleGrantCamera = useCallback(async () => {
    setPermissionError('');

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissionError('Camera not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
      setCameraGranted(true);
    } catch (err) {
      setCameraGranted(false);
      if (err?.name === 'NotAllowedError') {
        setPermissionError('Permission denied. Open your phone Settings → App → Camera and allow access, then tap the button again.');
      } else if (err?.name === 'NotFoundError') {
        setPermissionError('No camera found on this device.');
      } else {
        setPermissionError('Could not access camera. Please try again.');
      }
    }
  }, []);

  const handleScan = useCallback((text) => {
    if (locked || scanned) return;
    let customerId = text;
    try {
      const url = new URL(text);
      customerId = url.searchParams.get('customerId') || url.searchParams.get('id') || text;
    } catch { }
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
        style={{
          background: 'rgba(13,9,5,0.85)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}>
            {restaurantName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{restaurantName}</p>
            <p className="text-xs text-white/35 leading-tight">
              {employee?.employee?.name || employee?.fullName || 'Employee'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/50 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </header>

      <main className="flex-1 flex flex-col gap-6 px-5 py-6 overflow-y-auto">

        {/* Scanner section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Scan Customer</h2>
              <p className="text-xs text-white/40 mt-0.5">Point camera at customer's QR code</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
              style={{
                background: locked ? 'rgba(234,179,8,0.12)' : 'rgba(74,222,128,0.12)',
                color: locked ? '#fde047' : '#4ade80',
                border: locked ? '1px solid rgba(234,179,8,0.25)' : '1px solid rgba(74,222,128,0.25)'
              }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: locked ? '#fde047' : '#4ade80' }} />
              {locked ? 'Locked' : 'Ready'}
            </div>
          </div>

          {cameraGranted ? (
            /* Camera is live — show scanner + a small "revoke/reset" button in case they need to re-prompt */
            <div className="flex flex-col gap-3">
              <QRScanner onScan={handleScan} locked={locked} />
              <button
                type="button"
                onClick={handleGrantCamera}
                className="self-start flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Re-enable camera
              </button>
            </div>
          ) : (
            /* Camera not yet granted — big tap-to-enable block */
            <div className="flex flex-col gap-4 max-w-sm">
              <button
                id="request-camera-btn"
                type="button"
                onClick={handleGrantCamera}
                className="flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-semibold text-white transition-all active:scale-95"
                style={{
                  background: 'var(--brand-primary)',
                  color: 'var(--brand-primary-text)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Enable Camera to Scan
              </button>

              {permissionError ? (
                <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  {permissionError}
                </div>
              ) : (
                <p className="text-xs text-white/30 leading-relaxed px-1">
                  Tap the button above to allow camera access. You'll see a system prompt — choose <strong className="text-white/50">Allow</strong>.
                </p>
              )}
            </div>
          )}
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
                  <path d="M3 2l1.5 15.5L12 20l7.5-2.5L21 2" /><path d="M3 7h18" />
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
              <polyline points="6 9 12 15 18 9" />
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