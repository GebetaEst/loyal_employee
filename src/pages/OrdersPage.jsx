import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import OrderCard from '../components/OrderCard';
import { useStore } from '../store/useStore';

export default function OrdersPage() {
  const ordersRevision = useStore((state) => state.ordersRevision);
  const activeOrders = useStore((state) => state.activeOrders);
  const historyOrders = useStore((state) => state.historyOrders);
  const loading = useStore((state) => state.ordersLoading);
  const error = useStore((state) => state.ordersError);
  const setActiveOrders = useStore((state) => state.setActiveOrders);
  const setHistoryOrders = useStore((state) => state.setHistoryOrders);
  const setOrdersLoading = useStore((state) => state.setOrdersLoading);
  const setOrdersError = useStore((state) => state.setOrdersError);

  const inFlightRef = useRef(false);
  const fetchSeqRef = useRef(0);
  const initialMountRef = useRef(true);

  const fetchOrders = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setOrdersLoading(true);
    setOrdersError('');

    const currentSeq = ++fetchSeqRef.current;
    inFlightRef.current = true;

    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/api/employee/orders', { params: { status: 'active' } }),
        api.get('/api/employee/orders', { params: { status: 'history' } })
      ]);

      // If a newer request has already been issued, ignore this stale response
      if (currentSeq !== fetchSeqRef.current) return;

      if (activeRes.data?.success) {
        setActiveOrders(activeRes.data.data?.orders || []);
      }
      if (historyRes.data?.success) {
        // Limit to 5 most recent history items
        setHistoryOrders((historyRes.data.data?.orders || []).slice(0, 5));
      }
    } catch (err) {
      if (currentSeq !== fetchSeqRef.current) return;
      console.error('🔥 Error fetching waiter orders:', err);
      setOrdersError(err.response?.data?.message || err.response?.data?.error || 'Failed to sync order queue.');
    } finally {
      if (currentSeq === fetchSeqRef.current) {
        inFlightRef.current = false;
        setOrdersLoading(false);
      }
    }
  }, [setActiveOrders, setHistoryOrders, setOrdersLoading, setOrdersError]);

  // Initial fetch on mount
  useEffect(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  // React to realtime ordersRevision changes
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    if (navigator.onLine) {
      console.log(`🔄 [OrdersPage] Realtime revision change detected (ordersRevision: ${ordersRevision}) -> Refetching queue via REST`);
      fetchOrders(false);
    }
  }, [ordersRevision, fetchOrders]);

  // Fallback 30-second polling for reconciliation
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && !inFlightRef.current) {
        fetchOrders(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Focus, Visibility Resume, and Online recovery
  useEffect(() => {
    const handleResume = () => {
      if (navigator.onLine && document.visibilityState !== 'hidden') {
        fetchOrders(false);
      }
    };

    const handleOnline = () => {
      fetchOrders(false);
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchOrders]);

  // Categorize canonical active orders: placed vs served
  const newOrders = [];
  const servedOrders = [];

  activeOrders.forEach((order) => {
    if (order.currentStepKey === 'served') {
      servedOrders.push(order);
    } else {
      // 'placed' or default active state
      newOrders.push(order);
    }
  });

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-6 animate-fade-in max-w-lg mx-auto">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-black text-slate-900">My Assigned Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">Assigned waiter tasks from your tables</p>
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

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="glass rounded-3xl p-5 border border-slate-200 bg-white flex flex-col gap-4 shadow-sm">
                <div className="skeleton h-6 w-24" />
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-10 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Section 1: New Orders (Placed) */}
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>New Orders</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                  {newOrders.length}
                </span>
              </h2>
              {newOrders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400 bg-white shadow-sm">
                  No new orders waiting right now.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {newOrders.map((order) => (
                    <OrderCard key={order.id || order._id} order={order} onRefresh={() => fetchOrders(false)} />
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Served Orders */}
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>Served</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  {servedOrders.length}
                </span>
              </h2>
              {servedOrders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400 bg-white shadow-sm">
                  No served orders awaiting completion.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {servedOrders.map((order) => (
                    <OrderCard key={order.id || order._id} order={order} onRefresh={() => fetchOrders(false)} />
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Recently Completed (Read-Only) */}
            {historyOrders.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Recently Completed
                </h2>
                <div className="flex flex-col gap-4 opacity-75 hover:opacity-100 transition-opacity">
                  {historyOrders.map((order) => (
                    <OrderCard key={order.id || order._id} order={order} onRefresh={() => fetchOrders(false)} />
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
