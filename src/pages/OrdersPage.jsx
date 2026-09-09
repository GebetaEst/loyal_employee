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
        // Limit to 25 most recent history items
        setHistoryOrders((historyRes.data.data?.orders || []).slice(0, 25));
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

  // Tab state & smooth transitions
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef(null);

  const switchTab = useCallback((tab) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setActiveTab(tab);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 320);
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  // Touch swipe gesture handling
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const touchDeltaRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchDeltaRef.current = { x: 0, y: 0 };
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchDeltaRef.current = { x: dx, y: dy };
  };

  const handleTouchEnd = () => {
    const { x: dx, y: dy } = touchDeltaRef.current;
    const duration = Date.now() - touchStartRef.current.time;

    // Minimum movement of 45px or fast flick (30px within 250ms)
    // Horizontal direction must clearly dominate vertical movement (1.2x)
    const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 1.2;
    const isMinDistance = Math.abs(dx) > 45 || (Math.abs(dx) > 30 && duration < 250);

    if (isHorizontalSwipe && isMinDistance) {
      if (dx < 0 && activeTab === 'active') {
        // Swiped left -> Go to Order History
        switchTab('history');
      } else if (dx > 0 && activeTab === 'history') {
        // Swiped right -> Go to Active Orders
        switchTab('active');
      }
    }

    touchDeltaRef.current = { x: 0, y: 0 };
  };

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
      <div className="flex flex-col gap-4 animate-fade-in max-w-lg mx-auto select-none">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">My Orders</h1>
            <p className="text-xs text-slate-500 mt-0.5">Assigned waiter tasks from your tables</p>
          </div>
          {/* Active indicator pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${activeOrders.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-xs font-bold text-slate-700">
              {activeOrders.length} active
            </span>
          </div>
        </div>

        {/* Top Tab Bar (Segmented Control) */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex relative shadow-inner">
          {/* Sliding active pill indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-xs transition-all duration-300 ease-out"
            style={{
              width: 'calc(50% - 4px)',
              left: activeTab === 'active' ? '4px' : 'calc(50%)',
            }}
          />

          {/* Active Orders Tab Button */}
          <button
            type="button"
            onClick={() => switchTab('active')}
            className={`flex-1 relative z-10 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors duration-200 cursor-pointer ${
              activeTab === 'active' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Active Orders</span>
            {activeOrders.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                  activeTab === 'active'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-300/80 text-slate-700'
                }`}
              >
                {activeOrders.length}
              </span>
            )}
          </button>

          {/* Order History Tab Button */}
          <button
            type="button"
            onClick={() => switchTab('history')}
            className={`flex-1 relative z-10 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors duration-200 cursor-pointer ${
              activeTab === 'history' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Order History</span>
            {historyOrders.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                  activeTab === 'history'
                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                    : 'bg-slate-300/80 text-slate-700'
                }`}
              >
                {historyOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Swipe Hint Indicator */}
        {/* <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 -mt-1">
          <span>
            {activeTab === 'active' ? 'Swipe left for history ←' : '→ Swipe right for active orders'}
          </span>
        </div> */}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold bg-red-50 border border-red-200 text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Swipeable Tab Panels Container */}
        <div
          className="w-full overflow-hidden touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`flex w-[200%] transition-transform duration-300 ease-out items-start ${
              activeTab === 'active' ? 'translate-x-0' : '-translate-x-1/2'
            }`}
          >
            {/* ═══════════════════════════════════════════════
                TAB PANE 1: ACTIVE ORDERS
                ═══════════════════════════════════════════════ */}
            <div
              className={`w-1/2 px-0.5 transition-opacity duration-200 ${
                activeTab === 'active'
                  ? 'opacity-100 h-auto'
                  : isTransitioning
                  ? 'opacity-40 h-auto'
                  : 'opacity-0 h-0 overflow-hidden'
              }`}
            >
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
              ) : activeOrders.length === 0 ? (
                /* Empty State for Active Orders */
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center flex flex-col items-center gap-3 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">No active orders right now</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      All placed orders from your assigned tables have been served and completed.
                    </p>
                  </div>
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
                      <div className="rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400 bg-white shadow-xs">
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
                      <div className="rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400 bg-white shadow-xs">
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
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════
                TAB PANE 2: ORDER HISTORY
                ═══════════════════════════════════════════════ */}
            <div
              className={`w-1/2 px-0.5 transition-opacity duration-200 ${
                activeTab === 'history'
                  ? 'opacity-100 h-auto'
                  : isTransitioning
                  ? 'opacity-40 h-auto'
                  : 'opacity-0 h-0 overflow-hidden'
              }`}
            >
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
              ) : historyOrders.length === 0 ? (
                /* Empty State for Order History */
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center flex flex-col items-center gap-3 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">No order history yet</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Completed and closed orders from your shift will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center px-1">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Completed Shift Orders ({historyOrders.length})
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400">Read-Only</span>
                  </div>
                  <div className="flex flex-col gap-4 opacity-90 hover:opacity-100 transition-opacity">
                    {historyOrders.map((order) => (
                      <OrderCard key={order.id || order._id} order={order} onRefresh={() => fetchOrders(false)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
