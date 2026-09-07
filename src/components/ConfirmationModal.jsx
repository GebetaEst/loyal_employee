import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useStore } from '../store/useStore';

const SpinnerIcon = () => (
  <svg className="animate-spin-slow" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function ConfirmationModal({ customerId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { restaurant, token } = useStore();

  const restaurantId = restaurant?._id || restaurant?.id;
  const loyaltyProgram =
    restaurant?.loyaltyProgram?._id ||
    restaurant?.loyaltyProgram ||
    restaurant?.loyaltyProgramId;
  const restaurantName = restaurant?.name || 'Restaurant';

  const parsedCustomer = (() => {
    if (!customerId) return null;
    if (typeof customerId === 'object') return customerId;
    try {
      return JSON.parse(customerId);
    } catch {
      return null;
    }
  })();

  const displayCustomerId =
    parsedCustomer?.customerId ||
    parsedCustomer?.userId ||
    parsedCustomer?._id ||
    parsedCustomer?.id ||
    (typeof customerId === 'string' ? customerId : '');
  const customerName = parsedCustomer?.name || parsedCustomer?.fullName || 'Customer';

  const handleConfirm = async () => {
    if (!restaurantId) {
      toast.error('Restaurant data missing. Please re-login.');
      return;
    }
    if (!token) {
      toast.error('Authentication required. Please login again.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/users/stamps', {
        customerId: displayCustomerId,
        restaurantId,
        stampsToAdd: 1,
        loyaltyProgram,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      toast.success(' Stamp awarded successfully!', {
        duration: 3000,
        style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
      });
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to send stamp.';
      toast.error(msg, {
        style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="glass w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5 animate-fade-in-up bg-white shadow-2xl border border-slate-200"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Confirm Stamp</h2>
          {!loading && (
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 text-slate-500"
              aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Stamp preview */}
        <div className="rounded-2xl p-4 flex flex-col gap-3 bg-slate-50 border border-slate-100">
          {/* Stamp icon */}
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
              style={{ background: 'var(--brand-primary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="var(--brand-primary-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-2">
            <InfoRow label="Customer Name" value={customerName} />
            <InfoRow label="Restaurant" value={restaurantName} />
            <InfoRow label="Stamps to Add" value="× 1" highlight />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-2xl py-3 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            id="confirm-stamp-btn"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-[2] btn-primary rounded-2xl py-3 text-xs font-bold"
            style={{ borderRadius: '16px', width: 'auto' }}
          >
            {loading ? <><SpinnerIcon /> Sending…</> : '🎯 Award Stamp'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-sm font-bold ${mono ? 'font-mono' : ''}`}
        style={{ color: highlight ? 'var(--brand-primary)' : '#0f172a' }}>
        {value}
      </span>
    </div>
  );
}
