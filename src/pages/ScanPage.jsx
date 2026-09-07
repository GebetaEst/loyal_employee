import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import QRScanner from '../components/QRScanner';
import ConfirmationModal from '../components/ConfirmationModal';
import EmployeeLayout from '../components/EmployeeLayout';
import { useStore } from '../store/useStore';
import api from '../api/axios';

const LOCK_DURATION_MS = 3500;

function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden bg-white border border-slate-200 p-2 shadow-sm">
          <div className="skeleton h-24 w-full rounded-xl" />
          <div className="p-2 flex flex-col gap-2">
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
    <div className="glass bg-white rounded-2xl overflow-hidden transition-all hover:scale-[1.01] flex gap-3 p-3 border border-slate-200 shadow-sm">
      <div className="flex-shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl border border-slate-100" loading="lazy" />
        ) : (
          <div className="w-16 h-16 flex items-center justify-center text-3xl rounded-xl bg-slate-100 border border-slate-200">
            🍽️
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 line-clamp-1">{item.name}</p>
        {item.price != null && (
          <p className="text-sm font-black mt-0.5" style={{ color: 'var(--brand-primary)' }}>
            ETB {Number(item.price).toFixed(2)}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-snug">{item.description}</p>
        )}
      </div>
    </div>
  );
}

export default function ScanPage() {
  const navigate = useNavigate();
  const { restaurant, token, menu: storedMenu } = useStore();

  const [scanned, setScanned] = useState(null);
  const [locked, setLocked] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const lockTimer = useRef(null);

  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const restaurantId = restaurant?._id || restaurant?.id;

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [navigate, token]);

  // Lazy load menu when accordion is toggled
  useEffect(() => {
    if (!menuOpen || menu.length > 0 || !restaurantId) return;

    if (storedMenu && storedMenu.length > 0) {
      const items = storedMenu.flatMap(category => category.items || [category]);
      setMenu(items);
      return;
    }

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
  }, [menuOpen, restaurantId, storedMenu, menu.length]);

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

    // 1. Check if the QR code payload is a JSON string
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.customerId || parsed.id || parsed._id || parsed.userId)) {
        setScanned(parsed);
        return;
      }
    } catch {
      // Not JSON, continue with URL/text parsing
    }

    // 2. Check if URL containing customer query parameter
    try {
      const url = new URL(text);
      const qId = url.searchParams.get('customerId') || url.searchParams.get('id') || url.searchParams.get('userId');
      if (qId) {
        setScanned(qId);
        return;
      }
      const match = url.pathname.match(/\/customer\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        setScanned(match[1]);
        return;
      }
    } catch {
      // Not a valid URL
    }

    // 3. Fallback to raw scanned text
    if (text && text.trim()) {
      setScanned(text.trim());
    }
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

  return (
    <EmployeeLayout>
      <Toaster position="top-center" containerStyle={{ top: 20 }} />

      <div className="flex flex-col gap-6 animate-fade-in max-w-md mx-auto">
        {/* Scanner section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Scan Customer</h1>
              <p className="text-xs text-slate-500 mt-0.5">Point camera at customer's loyalty QR code</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold"
              style={{
                background: locked ? '#fef3c7' : '#dcfce7',
                color: locked ? '#b45309' : '#15803d',
                border: locked ? '1px solid #fde68a' : '1px solid #bbf7d0'
              }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: locked ? '#f59e0b' : '#22c55e' }} />
              {locked ? 'Locked' : 'Ready'}
            </div>
          </div>

          {cameraGranted ? (
            /* Camera is live — show scanner + a reset button */
            <div className="flex flex-col items-center gap-3">
              <QRScanner onScan={handleScan} locked={locked} />
              <button
                type="button"
                onClick={handleGrantCamera}
                className="self-center flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all bg-slate-100 border border-slate-200 shadow-sm"
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
            /* Camera not yet granted — tap-to-enable block */
            <div className="flex flex-col gap-4">
              <button
                id="request-camera-btn"
                type="button"
                onClick={handleGrantCamera}
                className="flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all active:scale-95 shadow-md"
                style={{
                  background: 'var(--brand-primary)',
                  color: 'var(--brand-primary-text)',
                  boxShadow: '0 4px 20px var(--brand-primary-ring)'
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
                <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed bg-red-50 border border-red-200 text-red-700">
                  {permissionError}
                </div>
              ) : (
                <p className="text-xs text-slate-400 leading-relaxed px-1 text-center">
                  Tap the button above to allow camera access to scan customer loyalty QR codes.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">menu</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Menu accordion section */}
        <section>
          <button
            id="toggle-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-3 mb-4 transition-all bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
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
                <p className="text-sm font-bold text-slate-900">Restaurant Menu</p>
                <p className="text-xs text-slate-500">View restaurant items</p>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="transition-transform text-slate-400"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {menuOpen && (
            <div className="animate-fade-in-up">
              {menuLoading ? (
                <MenuSkeleton />
              ) : menu.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
                  <span className="text-4xl">🍽️</span>
                  <p className="text-sm text-slate-400">No menu items available</p>
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
      </div>

      {scanned && (
        <ConfirmationModal
          customerId={scanned}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}
    </EmployeeLayout>
  );
}