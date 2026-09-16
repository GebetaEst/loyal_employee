import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import OrderCard from '../components/OrderCard';
import TableCard from '../components/TableCard';
import TableOrdersModal from '../components/TableOrdersModal';
import { useStore } from '../store/useStore';
/**
 * Accurately determines if an order belongs to a table, handling IDs (object or string),
 * table codes, and table names with case-insensitive and format-agnostic matching.
 */
function isOrderForTable(order, table) {
  if (!order || !order.table || !table) return false;
  const ot = order.table;

  const tId = (table.id || table._id || '').toString().toLowerCase();
  const tCode = (table.code || '').toString().trim().toLowerCase();
  const tName = (table.name || '').toString().trim().toLowerCase();

  // If order.table is a string (e.g. ObjectId, code, or name)
  if (typeof ot === 'string') {
    const s = ot.trim().toLowerCase();
    return s === tId || (tCode && s === tCode) || (tName && s === tName);
  }

  // If order.table is an object
  const oId = (ot.id || ot._id || '').toString().toLowerCase();
  const oCode = (ot.code || '').toString().trim().toLowerCase();
  const oName = (ot.name || '').toString().trim().toLowerCase();

  if (tId && oId && tId === oId) return true;
  if (tCode && oCode && tCode === oCode) return true;
  if (tName && oName && tName === oName) return true;
  return false;
}

export default function OrdersPage() {
  const ordersRevision = useStore((state) => state.ordersRevision);
  const activeOrders = useStore((state) => state.activeOrders);
  const historyOrders = useStore((state) => state.historyOrders);
  const loading = useStore((state) => state.ordersLoading);
  const error = useStore((state) => state.ordersError);
  const restaurant = useStore((state) => state.restaurant);
  const employee = useStore((state) => state.employee);

  const setActiveOrders = useStore((state) => state.setActiveOrders);
  const setHistoryOrders = useStore((state) => state.setHistoryOrders);
  const setOrdersLoading = useStore((state) => state.setOrdersLoading);
  const setOrdersError = useStore((state) => state.setOrdersError);

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [now, setNow] = useState(0);

  const inFlightRef = useRef(false);
  const fetchSeqRef = useRef(0);
  const initialMountRef = useRef(true);

  const restaurantId = restaurant?._id || restaurant?.id || employee?.restaurant;
  const employeeId = employee?.id || employee?._id;

  // 60-second timer to update elapsed wait times and colors
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch tables assigned to the restaurant
  const fetchTables = useCallback(async () => {
    if (!restaurantId) {
      setTablesLoading(false);
      return;
    }
    try {
      const res = await api.get(`/api/restaurants/${restaurantId}/tables`);
      if (res.data?.success) {
        setTables(res.data.data || []);
      }
    } catch (err) {
      console.error('🔥 Error fetching tables for OrdersPage:', err);
    } finally {
      setTablesLoading(false);
    }
  }, [restaurantId]);

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
    fetchTables();
  }, [fetchOrders, fetchTables]);

  // React to realtime ordersRevision changes
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    if (navigator.onLine) {
      // console.log(`🔄 [OrdersPage] Realtime revision change detected (ordersRevision: ${ordersRevision}) -> Refetching queue via REST`);
      fetchOrders(false);
      fetchTables();
    }
  }, [ordersRevision, fetchOrders, fetchTables]);

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
        fetchTables();
      }
    };

    const handleOnline = () => {
      fetchOrders(false);
      fetchTables();
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchOrders, fetchTables]);

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
    const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 1.2;
    const isMinDistance = Math.abs(dx) > 45 || (Math.abs(dx) > 30 && duration < 250);

    if (isHorizontalSwipe && isMinDistance) {
      if (dx < 0 && activeTab === 'active') {
        switchTab('history');
      } else if (dx > 0 && activeTab === 'history') {
        switchTab('active');
      }
    }

    touchDeltaRef.current = { x: 0, y: 0 };
  };

  // Filter tables assigned to this waiter
  const assignedTables = tables.filter((table) => {
    const assignedId = table.assignedWaiter?.id || table.assignedWaiter?._id || table.assignedWaiter;
    return assignedId && employeeId && assignedId.toString() === employeeId.toString();
  });

  // Ensure any table referenced by activeOrders is also included
  const displayTables = [...assignedTables];
  activeOrders.forEach((order) => {
    if (!order.table) return;
    const exists = displayTables.some((t) => isOrderForTable(order, t));
    if (!exists) {
      const ot = order.table;
      const tid = typeof ot === 'string' ? ot : (ot.id || ot._id || ot.code || ot.name || order.id || order._id || 'tbl-active');
      displayTables.push({
        id: tid,
        _id: tid,
        name: typeof ot === 'string' ? `Table ${ot}` : (ot.name || `Table ${ot.code || tid}`),
        code: typeof ot === 'string' ? ot : ot.code,
        description: typeof ot === 'string' ? 'Active service table' : (ot.description || 'Active assigned table')
      });
    }
  });

  // Reliable helper to retrieve orders for a table
  const getOrdersForTable = useCallback(
    (table) => {
      return activeOrders.filter((o) => isOrderForTable(o, table));
    },
    [activeOrders]
  );

  // Sort tables:
  // 1. Tables with unserved waiting orders float to the top (ordered by oldest order = highest urgency)
  // 2. Tables with all orders served
  // 3. Idle tables
  displayTables.sort((a, b) => {
    const aOrders = getOrdersForTable(a);
    const bOrders = getOrdersForTable(b);
    const aUnserved = aOrders.filter((o) => (o.currentStepKey || '').toLowerCase() !== 'served');
    const bUnserved = bOrders.filter((o) => (o.currentStepKey || '').toLowerCase() !== 'served');

    if (aUnserved.length > 0 && bUnserved.length === 0) return -1;
    if (aUnserved.length === 0 && bUnserved.length > 0) return 1;

    if (aUnserved.length > 0 && bUnserved.length > 0) {
      const aOldest = Math.min(...aUnserved.map((o) => new Date(o.createdAt || 0).getTime()));
      const bOldest = Math.min(...bUnserved.map((o) => new Date(o.createdAt || 0).getTime()));
      return aOldest - bOldest;
    }

    if (aOrders.length > 0 && bOrders.length === 0) return -1;
    if (aOrders.length === 0 && bOrders.length > 0) return 1;

    return (a.name || '').localeCompare(b.name || '');
  });

  // Categorize canonical active orders for list view: placed vs served
  const newOrders = [];
  const servedOrders = [];

  activeOrders.forEach((order) => {
    if (order.currentStepKey === 'served') {
      servedOrders.push(order);
    } else {
      newOrders.push(order);
    }
  });

  // Resolved selected table object (maintains sync across refetches)
  const activeSelectedTable = selectedTable
    ? displayTables.find((t) => isOrderForTable({ table: selectedTable }, t)) || selectedTable
    : null;

  const selectedTableOrders = activeSelectedTable ? getOrdersForTable(activeSelectedTable) : [];

  const activeTablesCount = displayTables.filter(
    (t) => getOrdersForTable(t).length > 0
  ).length;

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
                TAB PANE 1: ACTIVE ORDERS (TABLE GRID + MODAL)
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
              {loading && tablesLoading ? (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="glass rounded-2xl sm:rounded-3xl p-4 aspect-[4/3] flex flex-col justify-between items-center shadow-xs">
                      <div className="skeleton h-5 w-12 rounded-lg" />
                      <div className="skeleton h-3 w-16 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : displayTables.length === 0 && activeOrders.length === 0 ? (
                /* Empty State: No tables assigned */
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center flex flex-col items-center gap-3 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 text-2xl">
                    🪑
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">No tables assigned yet</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      You do not have assigned tables. Once assigned by management, your tables will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Table Grid Control & Legend Bar */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                        Assigned Tables ({displayTables.length})
                      </span>
                      {activeTablesCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                          {activeTablesCount} active
                        </span>
                      )}
                    </div>

                    {/* View Mode Switcher (Grid vs List) */}
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-slate-600">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Grid View (Denomination Style)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="3" width="7" height="7" rx="1.5" />
                          <rect x="14" y="3" width="7" height="7" rx="1.5" />
                          <rect x="3" y="14" width="7" height="7" rx="1.5" />
                          <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="All Orders List View"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Wait-Time Urgency Color Legend */}
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-[10px] text-slate-500 font-semibold">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Status:</span>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-primary)' }} />
                      <span>&lt; 5m Fresh</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>5-12m</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      <span>&gt; 12m Urgent</span>
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────
                      MODE 1: 3-COLUMN TABLE GRID (DENOMINATION STYLE)
                      ─────────────────────────────────────────── */}
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-1">
                      {displayTables.map((table) => {
                        const tableKey = (table.id || table._id || table.code || table.name).toString();
                        const tOrders = getOrdersForTable(table);
                        return (
                          <TableCard
                            key={tableKey}
                            table={table}
                            orders={tOrders}
                            now={now}
                            onClick={() => setSelectedTable(table)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    /* ───────────────────────────────────────────
                       MODE 2: FLAT ALL ORDERS LIST
                       ─────────────────────────────────────────── */
                    <div className="flex flex-col gap-6">
                      {/* Section 1: Placed Orders */}
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

        {/* ═══════════════════════════════════════════════
            INTERACTIVE TABLE ORDERS DETAILS MODAL
            ═══════════════════════════════════════════════ */}
        {activeSelectedTable && (
          <TableOrdersModal
            table={activeSelectedTable}
            orders={selectedTableOrders}
            now={now}
            onClose={() => setSelectedTable(null)}
            onRefreshOrders={() => fetchOrders(false)}
          />
        )}
      </div>
    </EmployeeLayout>
  );
}
