import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's already installed (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (isStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDetected = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDetected);

    if (iosDetected) {
      // Show iOS prompt after a short delay so it doesn't interrupt immediate login
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android / Desktop Chrome support
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in-up">
      <div className="glass bg-white rounded-2xl p-4 shadow-2xl border border-slate-200 flex flex-col gap-3 max-w-sm mx-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                 style={{ background: 'var(--brand-primary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="var(--brand-primary-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Install StampGo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isIOS 
                  ? 'Add to Home Screen for the best experience.' 
                  : 'Install this app for faster access and offline support.'}
              </p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-700 shrink-0 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {isIOS ? (
          <div className="flex items-center justify-center gap-2 mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-600">Tap</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="text-xs text-slate-600">then <strong>"Add to Home Screen"</strong></span>
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            className="w-full btn-primary py-2.5 mt-1 text-xs font-bold"
            style={{ borderRadius: '12px' }}
          >
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
