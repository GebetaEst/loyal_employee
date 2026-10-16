import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import OrderCard from './OrderCard';
import DiningCheckPaymentModal from './DiningCheckPaymentModal';
import ReceiptPreviewModal from './ReceiptPreviewModal';
import { getUrgencyConfig, computeTableElapsedMinutes } from '../lib/orderUrgency';
import {
  fetchDiningChecks,
  formatTableName,
  formatCurrency,
} from '../api/diningCheckService';
import { useStore } from '../store/useStore';

export default function TableOrdersModal({
  table,
  orders = [],
  now = 0,
  onClose,
  onRefreshOrders,
}) {
  const checksRevision = useStore((state) => state.checksRevision);
  const bumpChecksRevision = useStore((state) => state.bumpChecksRevision);

  const [tableChecks, setTableChecks] = useState([]);
  const [checksLoading, setChecksLoading] = useState(true);
  const [checksError, setChecksError] = useState('');

  const [paymentCheck, setPaymentCheck] = useState(null);
  const [receiptProof, setReceiptProof] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
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

  const tableId = table?.id || table?._id;

  // Fetch dining checks for this table
  const loadTableChecks = useCallback(async (showLoading = false) => {
    if (!tableId) return;
    if (showLoading) setChecksLoading(true);
    setChecksError('');

    try {
      const res = await fetchDiningChecks({ tableId });
      // Sort checks: unpaid first, then paid
      const sorted = (res.checks || []).sort((a, b) => {
        const aPaid = !!a.payment?.isPaid;
        const bPaid = !!b.payment?.isPaid;
        if (aPaid === bPaid) {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        return aPaid ? 1 : -1;
      });
      setTableChecks(sorted);
    } catch (err) {
      console.error(`Failed to load checks for table ${tableId}:`, err);
      setChecksError(err.response?.data?.message || err.message || 'Failed to load table bill.');
    } finally {
      setChecksLoading(false);
    }
  }, [tableId]);

  // Initial load
  useEffect(() => {
    loadTableChecks(true);
  }, [loadTableChecks]);

  // React to realtime checksRevision
  useEffect(() => {
    if (navigator.onLine) {
      loadTableChecks(false);
    }
  }, [checksRevision, loadTableChecks]);

  // Refetch on window focus / resume / online
  useEffect(() => {
    const handleResume = () => {
      if (navigator.onLine && document.visibilityState !== 'hidden') {
        loadTableChecks(false);
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
  }, [loadTableChecks]);

  // Smooth animated exit handler
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 220);
  }, [isClosing, onClose]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !paymentCheck && !receiptProof) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, paymentCheck, receiptProof]);

  if (!table) return null;

  const unservedOrders = orders.filter((o) => {
    const step = (o.currentStepKey || '').toLowerCase();
    return step !== 'served' && step !== 'completed' && step !== 'cancelled';
  });
  const unservedOrdersCount = unservedOrders.length;
  const elapsedMinutes = computeTableElapsedMinutes(orders, now);
  const urgency = getUrgencyConfig(elapsedMinutes, orders.length, unservedOrdersCount);

  // Split orders into Placed vs Served
  const placedOrders = unservedOrders;
  const servedOrders = orders.filter((o) => (o.currentStepKey || '').toLowerCase() === 'served');

  const tableName = formatTableName(table);

  const handlePaymentSuccess = () => {
    setPaymentCheck(null);
    toast.success('Bill payment recorded successfully!');
    // Refresh table dining checks
    loadTableChecks(false);
    // Bump revision so other views refresh
    bumpChecksRevision();
    if (onRefreshOrders) {
      onRefreshOrders();
    }
  };

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 ${
        isClosing ? 'animate-fade-out opacity-0 pointer-events-none' : 'animate-fade-in'
      }`}
    >
      {/* Backdrop Click Dismiss */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Modal / Bottom Sheet Box */}
      <div
        className={`relative w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] bg-slate-50 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col z-10 overflow-hidden sm:border sm:border-slate-200 ${
          isClosing
            ? 'animate-slide-down-out sm:animate-pop-out'
            : 'animate-slide-up-in sm:animate-pop-in'
        }`}
      >
        {/* Modal Header */}
        <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-xs"
              style={{
                background: urgency.badgeBg,
                color: urgency.badgeText,
              }}
            >
              🪑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">{tableName}</h2>
                {orders.length > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-black tracking-wide"
                    style={{
                      background: urgency.badgeBg,
                      color: urgency.badgeText,
                    }}
                  >
                    {urgency.badgeLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {table.code ? `Code: ${table.code} • ` : ''}
                {orders.length} active {orders.length === 1 ? 'order' : 'orders'} in kitchen
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content: Operational Orders + Authoritative Bill Section */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* ══════════════════════════════════════════════════
              SECTION 1: BILLING / DINING CHECKS (FINANCIAL)
              ══════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <span>Billing & Settlement</span>
                {tableChecks.length > 0 && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                    {tableChecks.length}
                  </span>
                )}
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">Session Bill</span>
            </div>

            {checksLoading ? (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ) : checksError ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                <span>{checksError}</span>
                <button
                  type="button"
                  onClick={() => loadTableChecks(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 font-bold text-[11px] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : tableChecks.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-400 shadow-xs">
                No billing check created for this table yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tableChecks.map((check) => {
                  const checkKey = check.id || check._id;
                  const isPaid = !!check.payment?.isPaid;
                  const customerName = check.customer?.name || 'Walk-in Customer';
                  const orderCount = check.orderCount ?? (Array.isArray(check.orders) ? check.orders.length : 1);
                  const total = Number(check.totals?.total ?? 0);
                  const currency = check.totals?.currency || 'ETB';
                  const method = check.payment?.method;
                  const proofUrl = check.payment?.proofUrl;

                  const formattedMethod = method
                    ? (method.toLowerCase() === 'cbe' ? 'CBE' : (method.charAt(0).toUpperCase() + method.slice(1)))
                    : '';

                  return (
                    <div
                      key={checkKey}
                      className={`rounded-2xl p-4 border bg-white shadow-xs flex flex-col gap-3 transition-all ${
                        isPaid ? 'border-emerald-200 bg-emerald-50/20' : 'border-indigo-100 ring-1 ring-indigo-50/50'
                      }`}
                    >
                      {/* Check Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">{customerName}</span>
                            {check.customer?.phone && (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {check.customer.phone}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {orderCount} {orderCount === 1 ? 'Order total' : 'Orders total'}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Bill Total
                          </span>
                          <span className="text-base font-black text-slate-900">
                            {formatCurrency(total, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Payment Status & Action Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                              <span>✓ Paid</span>
                              {formattedMethod && (
                                <span className="font-semibold text-emerald-700">
                                  • {formattedMethod}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                              Unpaid
                            </span>
                          )}
                        </div>

                        <div>
                          {isPaid ? (
                            proofUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReceiptProof({
                                    url: proofUrl,
                                    title: 'Payment Proof',
                                    subtitle: `${customerName} • ${tableName}`,
                                    details: `${formatCurrency(total, currency)} • ${formattedMethod || 'Settled'}`,
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <span>🧾</span>
                                <span>View Proof</span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPaymentCheck(check)}
                              disabled={!isOnline}
                              className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <span>💳</span>
                              <span>Collect Payment</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="border-slate-200" />

          {/* ══════════════════════════════════════════════════
              SECTION 2: OPERATIONAL ORDERS (WAITING / SERVED)
              ══════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span>Active Orders Queue</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-200 text-slate-700 font-bold">
                  {orders.length}
                </span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">Kitchen Operations</span>
            </div>

            {orders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 my-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 text-2xl">
                  ✨
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">No active kitchen orders</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    This table has no pending orders waiting in the queue.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Placed / New Orders */}
                {placedOrders.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Waiting to be Served ({placedOrders.length})</span>
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {placedOrders.map((order) => (
                        <OrderCard
                          key={order.id || order._id}
                          order={order}
                          onRefresh={onRefreshOrders}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Served Orders */}
                {servedOrders.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Served Orders ({servedOrders.length})</span>
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {servedOrders.map((order) => (
                        <OrderCard
                          key={order.id || order._id}
                          order={order}
                          onRefresh={onRefreshOrders}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-5 py-3 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {tableName}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Back to Tables
          </button>
        </div>
      </div>

      {/* Payment Settlement Modal for Selected Dining Check */}
      {paymentCheck && (
        <DiningCheckPaymentModal
          check={paymentCheck}
          onClose={() => setPaymentCheck(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Receipt Proof Lightbox Modal */}
      {receiptProof && (
        <ReceiptPreviewModal
          url={receiptProof.url}
          title={receiptProof.title}
          subtitle={receiptProof.subtitle}
          details={receiptProof.details}
          onClose={() => setReceiptProof(null)}
        />
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
