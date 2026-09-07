import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import OrderCard from '../components/OrderCard';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/employee/orders', {
        params: { status: 'active' }
      });
      if (res.data?.success) {
        const activeOrders = res.data.data?.orders || [];
        // Sort active kitchen orders oldest first
        const sorted = [...activeOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setOrders(sorted);
      } else {
        setError('Failed to load orders.');
      }
    } catch (err) {
      console.error('🔥 Error fetching kitchen orders:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to sync kitchen queue.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling every 5 seconds + immediate fetch on mount
  useEffect(() => {
    fetchOrders(true);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        fetchOrders(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Window Focus Refetch
  useEffect(() => {
    const handleFocus = () => {
      if (navigator.onLine) {
        fetchOrders(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchOrders]);

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-5 animate-fade-in max-w-lg mx-auto">
        {/* Title / Status */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Kitchen Queue</h1>
            <p className="text-xs text-slate-500 mt-0.5">Active food preparation orders</p>
          </div>
          <div className="text-right bg-white border border-slate-200 shadow-sm rounded-2xl px-3.5 py-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Preparing</span>
            <span className="text-sm font-black" style={{ color: 'var(--brand-primary)' }}>
              {orders.length} orders
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold bg-red-50 border border-red-200 text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Orders List */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-3xl p-5 border border-slate-200 bg-white flex flex-col gap-4 shadow-sm">
                <div className="flex justify-between">
                  <div className="skeleton h-6 w-24" />
                  <div className="skeleton h-6 w-16" />
                </div>
                <div className="skeleton h-4 w-1/3" />
                <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-5/6" />
                </div>
                <div className="skeleton h-10 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-100 border border-slate-200 text-3xl">
              🍳
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Kitchen is clear</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px] leading-relaxed">
                New incoming orders will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onRefresh={() => fetchOrders(false)}
              />
            ))}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
