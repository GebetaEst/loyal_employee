import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import { useStore } from '../store/useStore';
import { applyTheme } from '../lib/theme';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, savedEmployeeId, restaurant, employee } = useStore();

  const [employeeId, setEmployeeId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  const scannerInstanceRef = useRef(null);

  // Decode emp from query string (Base64)
  useEffect(() => {
    const encodedEmpId = searchParams.get('emp') || searchParams.get('empId');

    if (encodedEmpId) {
      try {
        const decodedId = atob(encodedEmpId);
        if (!decodedId) throw new Error('empty');
        setEmployeeId(decodedId);
      } catch {
        setEmployeeId(encodedEmpId);
      }
    } else {
      setEmployeeId(savedEmployeeId || null);
    }
  }, [searchParams, savedEmployeeId]);

  // Restore theme
  useEffect(() => {
    if (restaurant?.themeColor) applyTheme(restaurant.themeColor);
  }, [restaurant]);

  // Redirect if already logged in based on role
  useEffect(() => {
    if (token) {
      const role = employee?.role;
      if (role === 'chef') navigate('/profile', { replace: true });
      else if (role === 'waiter') navigate('/orders', { replace: true });
      else if (role === 'cashier') navigate('/payments', { replace: true });
      else navigate('/profile', { replace: true });
    }
  }, [token, employee, navigate]);

  // Load html5-qrcode dynamically on demand
  const loadHtml5QrCode = () =>
    new Promise((resolve, reject) => {
      if (window.Html5Qrcode) return resolve(window.Html5Qrcode);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.onload = () => resolve(window.Html5Qrcode);
      script.onerror = () => reject(new Error('Failed to load QR scanner'));
      document.head.appendChild(script);
    });

  const startScanner = async () => {
    setScanError(null);
    setScanning(true);

    try {
      const Html5Qrcode = await loadHtml5QrCode();
      const scanner = new Html5Qrcode('qr-reader');
      scannerInstanceRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          try {
            const url = new URL(decodedText);
            const emp = url.searchParams.get('emp') || url.searchParams.get('empId');
            if (emp) {
              try {
                const decoded = atob(emp);
                setEmployeeId(decoded || emp);
              } catch {
                setEmployeeId(emp);
              }
            } else {
              setEmployeeId(decodedText);
            }
          } catch {
            setEmployeeId(decodedText);
          }
          stopScanner();
        },
        () => {} // ignore per-frame errors
      );
    } catch (err) {
      setScanError(err?.message || 'Camera access denied. Please allow camera permission.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop();
        scannerInstanceRef.current.clear();
      } catch {
        // ignore stop errors
      }
      scannerInstanceRef.current = null;
    }
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => () => { stopScanner(); }, []);

  const logoLetter = restaurant?.name?.[0]?.toUpperCase() || 'S';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Soft background ambient gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: 'var(--brand-primary)' }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-10"
          style={{ background: 'var(--brand-primary)' }} />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-7 animate-fade-in">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3.5">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--brand-primary)', boxShadow: '0 12px 30px var(--brand-primary-ring)' }}>
            <span className="text-3xl font-black" style={{ color: 'var(--brand-primary-text)' }}>
              {logoLetter}
            </span>
          </div>

          <div className="text-center">
            {restaurant?.name ? (
              <>
                <h1 className="text-2xl font-black text-slate-900">{restaurant.name}</h1>
                <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Employee Portal</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-black text-slate-900">
                  Employee <span style={{ color: 'var(--brand-primary)' }}>Portal</span>
                </h1>
                <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Staff Workspace</p>
              </>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="glass w-full rounded-3xl p-6 border border-slate-200 shadow-xl bg-white flex flex-col gap-5">

          {/* Employee badge / status */}
          {employeeId ? (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-green-50 border border-green-200">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-green-500" />
              <p className="text-xs font-bold text-green-800 flex-1 truncate">
                Employee ID detected
              </p>
              {/* Allow re-scanning */}
              <button
                onClick={startScanner}
                className="text-xs font-semibold text-green-700 hover:text-green-900 transition-colors flex-shrink-0 underline"
                aria-label="Scan a different QR code"
              >
                Re-scan
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#b45309" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs font-medium text-amber-800">No employee ID found. Please scan your QR code.</p>
            </div>
          )}

          {/* QR Scanner area */}
          {scanning ? (
            <div className="flex flex-col gap-3">
              {/* Viewfinder */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-300">
                <div id="qr-reader" style={{ width: '100%' }} />

                {/* Scanning animation overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    {/* Corner brackets */}
                    {[
                      'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                      'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                      'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                      'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-6 h-6 ${cls}`}
                        style={{ borderColor: 'var(--brand-primary)' }} />
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Point your camera at the QR code
              </p>

              <button
                onClick={stopScanner}
                className="w-full rounded-xl py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Scan QR button — shown when not scanning */
            <button
              onClick={startScanner}
              className="w-full rounded-2xl py-3 flex items-center justify-center gap-2.5 text-xs font-bold transition-all active:scale-95 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800"
            >
              {/* QR code icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
                <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
                <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/>
                <path d="M14 14h3v3h-3z" fill="currentColor" stroke="none"/>
                <path d="M17 17h3v3h-3z" fill="currentColor" stroke="none"/>
                <path d="M14 17h.01"/>
                <path d="M17 14h.01"/>
              </svg>
              Scan Staff QR Code
            </button>
          )}

          {/* Camera error */}
          {scanError && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 bg-red-50 border border-red-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-red-700">{scanError}</p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <h2 className="text-base font-bold text-slate-900 mb-0.5">Welcome back</h2>
            <p className="text-xs text-slate-500">Enter your password to continue</p>
          </div>

          <LoginForm employeeId={employeeId} />
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 text-center font-medium">
          StampGo Employee · Powered by Loyalty
        </p>
      </div>
    </div>
  );
}