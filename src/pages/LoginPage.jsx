import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import { useStore } from '../store/useStore';
import { applyTheme } from '../lib/theme';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, savedEmployeeId, restaurant } = useStore();

  const [employeeId, setEmployeeId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  const scannerRef = useRef(null);
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

  // Redirect if already logged in
  useEffect(() => {
    if (token) navigate('/scan', { replace: true });
  }, [token, navigate]);

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
          // console.log('QR Code scanned - Raw result:', decodedText);
          // Parse URL and extract emp param
          try {
            const url = new URL(decodedText);
            const emp = url.searchParams.get('emp') || url.searchParams.get('empId');
            // console.log('Parsed as URL, emp parameter:', emp);
            if (emp) {
              try {
                const decoded = atob(emp);
                // console.log('Decoded employee ID:', decoded || emp);
                setEmployeeId(decoded || emp);
              } catch {
                console.log('Failed to decode, using as-is:', emp);
                setEmployeeId(emp);
              }
            } else {
              // Raw ID (not a URL)
              // console.log('No emp parameter, using raw value:', decodedText);
              setEmployeeId(decodedText);
            }
          } catch {
            // Not a URL — treat raw value as ID
            console.log('Not a URL format, treating as raw ID:', decodedText);
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
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ background: 'var(--brand-primary)' }} />
        <div className="absolute -bottom-32 -right-32 w-72 h-72 rounded-full blur-3xl opacity-15"
          style={{ background: 'var(--brand-primary)' }} />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-8 animate-fade-in">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
            style={{ background: 'var(--brand-primary)', boxShadow: '0 20px 60px var(--brand-primary-ring)' }}>
            <span className="text-3xl font-black" style={{ color: 'var(--brand-primary-text)' }}>
              {logoLetter}
            </span>
          </div>

          <div className="text-center">
            {restaurant?.name ? (
              <>
                <h1 className="text-2xl font-bold text-white">{restaurant.name}</h1>
                <p className="text-sm text-white/40 mt-1">Employee Portal</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font- text-white">
                  Lets Get <span className="text-orange-500 font-extrabold">Loyal</span>
                </h1>
                <p className="text-sm text-white/40 mt-1">Employee Portal</p>
              </>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="glass w-full rounded-3xl p-7 pt-1 border-2 border- flex flex-col gap-5">

          {/* Employee badge / status */}
          {employeeId ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#4ade80' }} />
              <p className="text-sm text-green-300 flex-1 truncate">
                Employee ID detected
              </p>
              {/* Allow re-scanning */}
              <button
                onClick={startScanner}
                className="text-xs text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                aria-label="Scan a different QR code"
              >
                Re-scan
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#fca5a5" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-red-300">No employee ID found. Please scan your QR code.</p>
            </div>
          )}

          {/* QR Scanner area */}
          {scanning ? (
            <div className="flex flex-col gap-3">
              {/* Viewfinder */}
              <div className="relative rounded-2xl overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
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

              <p className="text-xs text-white/40 text-center">
                Point your camera at the QR code
              </p>

              <button
                onClick={stopScanner}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Scan QR button — shown when not scanning */
            <button
              onClick={startScanner}
              className="w-full rounded-xl py-3 flex items-center justify-center gap-2.5 text-sm font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
              }}
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
              Scan QR Code
            </button>
          )}

          {/* Camera error */}
          {scanError && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-red-300">{scanError}</p>
            </div>
          )}

          <div>
            <h2 className="text-base font-semibold text-white mb-1">Welcome back</h2>
            <p className="text-xs text-white/40">Enter your password to continue</p>
          </div>

          <LoginForm employeeId={employeeId} />
        </div>

        {/* Footer */}
        <p className="text-xs text-white/20 text-center">
          StampGo Employee · Powered by loyalty
        </p>
      </div>
    </div>
  );
}