import { useState, useEffect, useCallback, useMemo } from 'react';
import EmployeeLayout from '../components/EmployeeLayout';
import { useStore } from '../store/useStore';
import DiningCheckPaymentModal from '../components/DiningCheckPaymentModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import {
  fetchDiningChecks,
  formatTableName,
  formatCurrency,
} from '../api/diningCheckService';

export default function PaymentsPage() {
  const checksRevision = useStore((state) => state.checksRevision);
  const bumpChecksRevision = useStore((state) => state.bumpChecksRevision);

  const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid' | 'settled'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheckForPayment, setSelectedCheckForPayment] = useState(null);
  const [previewReceipt, setPreviewReceipt] = useState(null);

  // Unpaid checks state
  const [unpaidChecks, setUnpaidChecks] = useState([]);
  const [unpaidLoading, setUnpaidLoading] = useState(true);
  const [unpaidError, setUnpaidError] = useState('');

  // Settled checks state
  const [settledChecks, setSettledChecks] = useState([]);
  const [settledLoading, setSettledLoading] = useState(false);
  const [settledError, setSettledError] = useState('');

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor connectivity
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

  // Fetch unpaid checks
  const loadUnpaidChecks = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setUnpaidLoading(true);
    setUnpaidError('');
    try {
      const res = await fetchDiningChecks({ payment: 'unpaid' });
      setUnpaidChecks(res.checks || []);
    } catch (err) {
      console.error('Failed to load unpaid dining checks:', err);
      setUnpaidError(err.response?.data?.message || err.message || 'Failed to sync unpaid bills.');
    } finally {
      setUnpaidLoading(false);
    }
  }, []);

  // Fetch settled checks
  const loadSettledChecks = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setSettledLoading(true);
    setSettledError('');
    try {
      const res = await fetchDiningChecks({ payment: 'paid' });
      setSettledChecks(res.checks || []);
    } catch (err) {
      console.error('Failed to load settled dining checks:', err);
      setSettledError(err.response?.data?.message || err.message || 'Failed to sync settled history.');
    } finally {
      setSettledLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadUnpaidChecks(true);
  }, [loadUnpaidChecks]);

  // Load settled when tab changes
  useEffect(() => {
    if (activeTab === 'settled') {
      loadSettledChecks(settledChecks.length === 0);
    }
  }, [activeTab, loadSettledChecks, settledChecks.length]);

  // React to realtime checksRevision (Socket.IO updates & reconnections)
  useEffect(() => {
    if (navigator.onLine) {
      if (activeTab === 'unpaid') {
        loadUnpaidChecks(false);
      } else {
        loadSettledChecks(false);
      }
    }
  }, [checksRevision, activeTab, loadUnpaidChecks, loadSettledChecks]);

  // Fallback slow polling: 30 seconds for visible checks list
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState !== 'hidden') {
        if (activeTab === 'unpaid') {
          loadUnpaidChecks(false);
        } else {
          loadSettledChecks(false);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, loadUnpaidChecks, loadSettledChecks]);

  // Focus, Visibility Resume, and Online recovery
  useEffect(() => {
    const handleResume = () => {
      if (navigator.onLine && document.visibilityState !== 'hidden') {
        if (activeTab === 'unpaid') {
          loadUnpaidChecks(false);
        } else {
          loadSettledChecks(false);
        }
      }
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [activeTab, loadUnpaidChecks, loadSettledChecks]);

  // Client-side search helper across check fields
  const matchesSearch = useCallback((check, query) => {
    if (!query) return true;
    const q = query.toLowerCase().trim();

    const customerName = (check.customer?.name || '').toLowerCase();
    const customerPhone = (check.customer?.phone || '').toLowerCase();
    const tableName = (check.table?.name || '').toLowerCase();
    const tableCode = (check.table?.code || '').toString().toLowerCase();

    if (customerName.includes(q)) return true;
    if (customerPhone.includes(q)) return true;
    if (tableName.includes(q)) return true;
    if (tableCode.includes(q)) return true;

    // Search contained order numbers
    if (Array.isArray(check.orders)) {
      const orderMatched = check.orders.some((o) =>
        (o.orderNumber || o.id || '').toString().toLowerCase().includes(q)
      );
      if (orderMatched) return true;
    }

    return false;
  }, []);

  // Filtered unpaid bills
  const filteredUnpaidChecks = useMemo(() => {
    return unpaidChecks.filter((c) => matchesSearch(c, searchQuery));
  }, [unpaidChecks, searchQuery, matchesSearch]);

  // Filtered settled checks
  const filteredSettledChecks = useMemo(() => {
    return settledChecks.filter((c) => matchesSearch(c, searchQuery));
  }, [settledChecks, searchQuery, matchesSearch]);

  // Total outstanding unpaid ETB across all unpaid checks
  const totalOutstanding = useMemo(() => {
    return unpaidChecks.reduce((sum, c) => sum + Number(c.totals?.total || 0), 0);
  }, [unpaidChecks]);

  const handlePaymentSuccess = () => {
    setSelectedCheckForPayment(null);
    bumpChecksRevision();
    loadUnpaidChecks(false);
    if (activeTab === 'settled') {
      loadSettledChecks(false);
    }
  };

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-5 animate-fade-in max-w-lg mx-auto">
        {/* Header & Metric Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Cashier Desk</h1>
            <p className="text-xs text-slate-500 mt-0.5">Bill settlement & payment reconciliation</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Due</span>
            <span className="text-base font-black text-slate-900">
              {formatCurrency(totalOutstanding)}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex relative shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('unpaid')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'unpaid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>💳 Unpaid Bills</span>
            {unpaidChecks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                {unpaidChecks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settled')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'settled' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🧾 Settled History</span>
            {settledChecks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                {settledChecks.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input across Customer, Table, and Orders */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by customer, table, or order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            TAB 1: UNPAID BILLS (ONE CARD PER DINING CHECK)
            ══════════════════════════════════════════════════ */}
        {activeTab === 'unpaid' && (
          <div className="flex flex-col gap-3.5">
            {unpaidError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
                <span>{unpaidError}</span>
                <button
                  type="button"
                  onClick={() => loadUnpaidChecks(true)}
                  className="px-2.5 py-1 bg-red-100 rounded-lg text-xs font-bold hover:bg-red-200 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {unpaidLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-3xl p-5 border border-slate-200 bg-white flex flex-col gap-3 shadow-xs">
                    <div className="skeleton h-6 w-1/3" />
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-10 w-full rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : filteredUnpaidChecks.length === 0 ? (
              <div className="glass bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-center my-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100 text-2xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {searchQuery ? 'No matching unpaid bills' : 'All clear! No outstanding bills'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {searchQuery
                      ? 'Try clearing your search query.'
                      : 'New guest dining checks will appear here automatically via live updates.'}
                  </p>
                </div>
              </div>
            ) : (
              filteredUnpaidChecks.map((check) => {
                const checkId = check.id || check._id;
                const total = Number(check.totals?.total ?? 0);
                const currency = check.totals?.currency || 'ETB';
                const tableName = formatTableName(check.table);
                const customerName = check.customer?.name || 'Walk-in Customer';
                const customerPhone = check.customer?.phone;
                const orderCount = check.orderCount ?? (Array.isArray(check.orders) ? check.orders.length : 1);

                return (
                  <div
                    key={checkId}
                    className="glass rounded-3xl p-5 border border-slate-200 bg-white shadow-sm flex flex-col gap-3 hover:border-slate-300 transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {tableName}
                          </span>
                          <span className="text-base font-black text-slate-900">
                            {customerName}
                          </span>
                        </div>
                        {customerPhone && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Phone: <strong className="text-slate-600">{customerPhone}</strong>
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {orderCount} {orderCount === 1 ? 'Order' : 'Orders'} in this session
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Due</span>
                        <span className="text-lg font-black text-indigo-950">
                          {formatCurrency(total, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Contained Orders Overview */}
                    {Array.isArray(check.orders) && check.orders.length > 0 && (
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                        <div className="text-xs text-slate-700 space-y-1.5">
                          {check.orders.slice(0, 4).map((ord, idx) => (
                            <div key={ord.id || ord._id || idx} className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-800">
                                #{ord.orderNumber || `Order ${idx + 1}`}
                              </span>
                              {ord.total !== undefined && (
                                <span className="font-semibold text-slate-500">
                                  {formatCurrency(ord.total, currency)}
                                </span>
                              )}
                            </div>
                          ))}
                          {check.orders.length > 4 && (
                            <p className="text-[10px] text-slate-400 font-bold pt-0.5">
                              +{check.orders.length - 4} more orders
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedCheckForPayment(check)}
                      disabled={!isOnline}
                      className="w-full py-3 px-4 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>💳</span>
                      <span>Process Payment ({formatCurrency(total, currency)})</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2: SETTLED HISTORY (DINING CHECKS)
            ══════════════════════════════════════════════════ */}
        {activeTab === 'settled' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Settled Bills ({filteredSettledChecks.length})
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">Verified Settlements</span>
            </div>

            {settledError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
                <span>{settledError}</span>
                <button
                  type="button"
                  onClick={() => loadSettledChecks(true)}
                  className="px-2.5 py-1 bg-red-100 rounded-lg text-xs font-bold hover:bg-red-200 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {settledLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-3xl p-5 border border-slate-200 bg-white flex flex-col gap-3 shadow-xs">
                    <div className="skeleton h-6 w-1/3" />
                    <div className="skeleton h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredSettledChecks.length === 0 ? (
              <div className="glass bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-center my-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-400 text-2xl">
                  🧾
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {searchQuery ? 'No matching settled bills' : 'No settlement history yet'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {searchQuery
                      ? 'Try clearing your search query.'
                      : 'Completed customer bill payments and receipt proofs will appear here.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredSettledChecks.map((check) => {
                  const checkId = check.id || check._id;
                  const total = Number(check.totals?.total ?? 0);
                  const currency = check.totals?.currency || 'ETB';
                  const tableName = formatTableName(check.table);
                  const customerName = check.customer?.name || 'Walk-in Customer';
                  const orderCount = check.orderCount ?? (Array.isArray(check.orders) ? check.orders.length : 1);
                  const method = check.payment?.method || 'cash';
                  const proofUrl = check.payment?.proofUrl;
                  const paidAt = check.payment?.paidAt || check.updatedAt;

                  const formattedMethod = method.toLowerCase() === 'cbe'
                    ? 'CBE'
                    : (method.charAt(0).toUpperCase() + method.slice(1));

                  return (
                    <div
                      key={checkId}
                      className="glass rounded-3xl p-4 border border-slate-200 bg-white shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {tableName}
                          </span>
                          <span className="text-sm font-black text-slate-900 truncate">
                            {customerName}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ✓ {formattedMethod}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {orderCount} {orderCount === 1 ? 'Order' : 'Orders'} • {paidAt ? new Date(paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Settled'}
                        </p>
                      </div>

                      <div className="text-right flex items-center gap-3 shrink-0">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            {formatCurrency(total, currency)}
                          </span>
                        </div>
                        {proofUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewReceipt({
                                url: proofUrl,
                                title: 'Payment Proof',
                                subtitle: `${customerName} • ${tableName}`,
                                details: `${formatCurrency(total, currency)} • ${formattedMethod}`,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>🧾</span>
                            <span>Proof</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DiningCheck Payment Modal */}
        {selectedCheckForPayment && (
          <DiningCheckPaymentModal
            check={selectedCheckForPayment}
            onClose={() => setSelectedCheckForPayment(null)}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* Generic Receipt Preview Lightbox */}
        {previewReceipt && (
          <ReceiptPreviewModal
            url={previewReceipt.url}
            title={previewReceipt.title}
            subtitle={previewReceipt.subtitle}
            details={previewReceipt.details}
            onClose={() => setPreviewReceipt(null)}
          />
        )}
      </div>
    </EmployeeLayout>
  );
}
