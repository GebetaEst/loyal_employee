import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useStore } from '../store/useStore';

// Helper to format ETB currency
export function formatCurrency(amount, currency = 'ETB') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

// Helper to compute available action based on dynamic workflow configuration
export function getAvailableAction(order, employee) {
  if (!order || !employee) return null;

  const steps = order.workflow?.steps;
  if (!Array.isArray(steps)) return null;

  // 1. Get enabled workflow steps sorted by order
  const enabledSteps = steps.filter(step => step.enabled).sort((a, b) => a.order - b.order);

  // 2. Find current step configuration
  const currentStep = enabledSteps.find(s => s.key === order.currentStepKey);
  if (!currentStep) return null;

  // 3. Find next enabled step in sequence
  const currentIndex = enabledSteps.findIndex(s => s.key === order.currentStepKey);
  if (currentIndex === -1 || currentIndex === enabledSteps.length - 1) {
    return null; // Terminal state (e.g. completed)
  }
  const nextStep = enabledSteps[currentIndex + 1];

  // 4. Verify role is in actionRoles
  const actionRoles = currentStep.actionRoles || [];
  if (!actionRoles.includes(employee.role)) {
    return null;
  }

  // 5. Verify waiter assignment restriction for waiter role
  if (employee.role === 'waiter' && order.service && order.service.waiter) {
    const waiterId = order.service.waiter.id || order.service.waiter._id || order.service.waiter;
    const employeeId = employee.id || employee._id;
    if (waiterId && employeeId && waiterId.toString() !== employeeId.toString()) {
      return null; // Not assigned to this waiter
    }
  }

  // 6. Action label - use backend's actionLabel or compute a fallback
  const label = currentStep.actionLabel || `Mark ${nextStep.label}`;

  return {
    canAdvance: true,
    label,
    nextStep: {
      key: nextStep.key,
      label: nextStep.label
    }
  };
}

export default function OrderCard({ order, onRefresh }) {
  const { employee } = useStore();
  const [elapsed, setElapsed] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Update connectivity
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

  // Update elapsed time periodically
  useEffect(() => {
    const calculateElapsed = () => {
      if (!order.createdAt) return;
      const createdDate = new Date(order.createdAt);
      const diffMs = Date.now() - createdDate.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / 60000));
      setElapsed(`${diffMins} min`);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 10000); // update every 10 seconds
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const availableAction = getAvailableAction(order, employee);

  const handleAdvance = async () => {
    if (!isOnline) {
      toast.error("You're offline. Order actions are temporarily unavailable.");
      return;
    }
    if (loading || !availableAction) return;

    setLoading(true);
    try {
      const response = await api.post(`/api/employee/orders/${order.id}/advance`, {
        expectedStep: order.currentStepKey
      });
      if (response.data?.success) {
        toast.success(`Order successfully transitioned to ${availableAction.nextStep.label}!`);
        if (onRefresh) onRefresh();
      } else {
        throw new Error('Transition failed');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toast.error("This order was already updated. Refreshing queue...");
      } else {
        const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to update order.';
        toast.error(msg);
      }
      if (onRefresh) onRefresh();
    } finally {
      setLoading(false);
    }
  };

  // Status badges
  const getStatusBadge = () => {
    const status = order.currentStepKey || 'placed';
    switch (status) {
      case 'preparing':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">Preparing</span>;
      case 'ready':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">Ready</span>;
      case 'serving':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">Serving</span>;
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-500/10 text-gray-400 border border-gray-500/20">Completed</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 capitalize">{status}</span>;
    }
  };

  return (
    <div className="glass rounded-3xl p-5 border border-white/10 flex flex-col gap-4">
      {/* Top Header Row */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold text-white/30 tracking-wider uppercase block">Order</span>
          <span className="text-lg font-black text-white">#{order.orderNumber}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-white/30 tracking-wider uppercase block">Table</span>
          <span className="text-base font-bold text-white">{order.table?.name || 'N/A'}</span>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-xs font-bold text-white/30 tracking-wider uppercase block">Elapsed</span>
          <span className="text-xs font-medium text-white/70 bg-white/5 px-2 py-0.5 rounded-md mt-0.5">{elapsed || '0 min'}</span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        {order.cancellation && (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">Cancelled</span>
        )}
      </div>

      {/* Items Section */}
      <div className="border-t border-white/5 pt-3">
        <ul className="flex flex-col gap-2">
          {order.items?.map((item, idx) => (
            <li key={idx} className="text-sm">
              <div className="flex justify-between items-start">
                <span className="text-white/90 font-medium">
                  <strong className="text-white font-black" style={{ color: 'var(--brand-primary)' }}>{item.quantity} ×</strong> {item.name}
                </span>
                {employee?.role !== 'chef' && (
                  <span className="text-xs font-semibold text-white/40">{formatCurrency(item.lineTotal || (item.quantity * item.unitPrice), order.pricing?.currency)}</span>
                )}
              </div>
              {item.notes && (
                <div className="text-xs text-orange-300 font-semibold bg-orange-500/5 border border-orange-500/10 rounded-md px-2 py-1 mt-1">
                  Item Note: {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Order Notes / Special Request */}
      {order.customerNotes && (
        <div className="rounded-xl px-3 py-2.5 bg-yellow-500/5 border border-yellow-500/15 flex flex-col gap-1">
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Special Request</span>
          <p className="text-sm text-yellow-200 font-bold leading-relaxed">{order.customerNotes}</p>
        </div>
      )}

      {/* Waiter Details & Total Row */}
      <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs text-white/40">
        <span>
          Waiter: <strong className="text-white/80">{order.service?.waiter?.name || 'Auto Assigned'}</strong>
        </span>
        {employee?.role !== 'chef' && order.pricing && (
          <span className="text-sm font-black text-white">
            Total: {formatCurrency(order.pricing.total, order.pricing.currency)}
          </span>
        )}
      </div>

      {/* Dynamic Action Button */}
      {availableAction && !order.cancellation && (
        <button
          onClick={handleAdvance}
          disabled={loading || !isOnline}
          className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
          style={{
            height: '48px', // min 44-48px touch target
            borderRadius: '16px',
            background: loading ? 'rgba(255,255,255,0.05)' : 'var(--brand-primary)',
            border: loading ? '1px solid rgba(255,255,255,0.1)' : 'none'
          }}
        >
          {loading ? (
            <>
              <svg className="animate-spin-slow h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Updating order...
            </>
          ) : (
            availableAction.label
          )}
        </button>
      )}
    </div>
  );
}
