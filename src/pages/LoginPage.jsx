import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import { useStore } from '../store/useStore';
import { applyTheme } from '../lib/theme';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, savedEmployeeId, restaurant } = useStore();

  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Decode empId from QR Code (Base64)
  useEffect(() => {
    const encodedEmpId = searchParams.get('empId');   // ← Updated key

    if (encodedEmpId) {
      try {
        const decodedId = atob(encodedEmpId);        // Decode Base64
        setEmployeeId(decodedId);
      } catch (error) {
        console.error("Failed to decode employee ID:", error);
        setEmployeeId(null);
      }
    } else {
      // Fallback to saved employeeId from localStorage
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
                <h1 className="text-2xl font-bold text-white">StampGo</h1>
                <p className="text-sm text-white/40 mt-1">Employee Portal</p>
              </>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="glass w-full rounded-3xl p-7 flex flex-col gap-5">
          {/* Employee badge */}
          {employeeId ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--brand-primary)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--brand-primary-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/40">Employee ID</p>
                <p className="text-sm font-semibold font-mono text-white/90 truncate">{employeeId}</p>
              </div>
              <div className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#fca5a5" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-red-300">No employee ID found. Please scan your QR code.</p>
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