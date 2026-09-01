import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import OrderCard, { getAvailableAction } from '../components/OrderCard';
import { useStore } from '../store/useStore';

export default function OrdersPage() {
  const { employee } = useStore();
  const [activeOrders, setActiveOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setError('');
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/api/employee/orders', { params: { status: 'active' } }),
        api.get('/api/employee/orders', { params: { status: 'history' } })
      ]);

      if (activeRes.data?.success) {
        setActiveOrders(activeRes.data.data?.orders || []);
      }
      if (historyRes.data?.success) {
        // Limit to 5 most recent history items
        setHistoryOrders((historyRes.data.data?.orders || []).slice(0, 5));
      }
    } catch (err) {
      console.error('🔥 Error fetching waiter orders:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to sync order queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 5 seconds
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

  // Categorize active orders dynamically based on waiter actionable capability
  const readyOrders = [];
  const preparingOrders = [];

  activeOrders.forEach((order) => {
    const action = getAvailableAction(order, employee);
    // If the waiter can perform an action, or if it is already in ready/serving step
    if (action?.canAdvance || order.currentStepKey === 'ready' || order.currentStepKey === 'serving') {
      readyOrders.push(order);
    } else {
      preparingOrders.push(order);
    }
  });

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-black text-white">My Assigned Orders</h1>
          <p className="text-xs text-white/40">Assigned waiter tasks from your tables</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="glass rounded-3xl p-5 border border-white/5 flex flex-col gap-4">
                <div className="skeleton h-6 w-24" />
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-10 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Section 1: Ready Orders (Needs Action) */}
            <div>
              <h2 className="text-sm font-black text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>Ready to Serve</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">
                  {readyOrders.length}
                </span>
              </h2>
              {readyOrders.length === 0 ? (
                <div className="rounded-2xl border border-white/5 p-6 text-center text-xs text-white/30 bg-white/2">
                  No orders ready to serve right now.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {readyOrders.map((order) => (
                    <OrderCard key={order.id} order={order} onRefresh={() => fetchOrders(false)} />
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Preparing Orders (Read-Only) */}
            <div>
              <h2 className="text-sm font-black text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>Kitchen Preparing</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {preparingOrders.length}
                </span>
              </h2>
              {preparingOrders.length === 0 ? (
                <div className="rounded-2xl border border-white/5 p-6 text-center text-xs text-white/30 bg-white/2">
                  No orders currently in the kitchen.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {preparingOrders.map((order) => (
                    <OrderCard key={order.id} order={order} onRefresh={() => fetchOrders(false)} />
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Recently Completed (Read-Only) */}
            {historyOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-black text-white/50 uppercase tracking-widest mb-3">
                  Recently Completed
                </h2>
                <div className="flex flex-col gap-4 opacity-60 hover:opacity-100 transition-opacity">
                  {historyOrders.map((order) => (
                    <OrderCard key={order.id} order={order} onRefresh={() => fetchOrders(false)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
