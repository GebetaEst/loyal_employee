import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

const DEBOUNCE_MS = 3000;

export default function QRScanner({ onScan, locked }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const lastScanRef = useRef(0);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        readerRef.current = new BrowserQRCodeReader();
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        const backCamera = devices.find(d =>
          /back|rear|environment/i.test(d.label)
        ) || devices[devices.length - 1];
        const deviceId = backCamera?.deviceId;

        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (!mounted) return;
            if (result) {
              const now = Date.now();
              if (now - lastScanRef.current < DEBOUNCE_MS) return;
              lastScanRef.current = now;
              onScan(result.getText());
            }
          }
        );
        if (mounted) setScanning(true);
      } catch (e) {
        if (mounted) {
          setError(
            e?.name === 'NotAllowedError'
              ? 'Camera access denied. Please allow camera in browser settings.'
              : 'Could not start camera. Make sure no other app is using it.'
          );
        }
      }
    };

    start();

    return () => {
      mounted = false;
      try { controlsRef.current?.stop(); } catch {}
    };
  }, [onScan]);

  return (
    <div className="relative w-full flex flex-col items-center gap-4">
      {/* Video */}
      <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden scanner-border">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          aria-label="QR scanner camera"
        />

        {/* Scanning overlay */}
        {scanning && !locked && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner guides */}
            {['top-3 left-3', 'top-3 right-3 rotate-90', 'bottom-3 right-3 rotate-180', 'bottom-3 left-3 -rotate-90'].map((pos, i) => (
              <div key={i} className={`absolute ${pos}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round">
                  <path d="M2 8V2h6"/>
                </svg>
              </div>
            ))}
            {/* Scan line */}
            <div className="absolute left-4 right-4 h-0.5 top-1/2 -translate-y-1/2"
              style={{ background: 'var(--brand-primary)', opacity: 0.8,
                boxShadow: '0 0 8px 2px var(--brand-primary)' }} />
          </div>
        )}

        {/* Locked overlay */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl animate-fade-in"
            style={{ background: 'rgba(13,9,5,0.75)' }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'var(--brand-primary)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--brand-primary-text)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-white/70">Stamp sent!</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="w-full max-w-sm rounded-xl px-4 py-3 text-sm text-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Status */}
      {!error && (
        <p className="text-xs text-white/40 text-center">
          {locked ? 'Scanner locked · ready in a moment…' : scanning ? 'Point at customer QR code' : 'Starting camera…'}
        </p>
      )}
    </div>
  );
}
