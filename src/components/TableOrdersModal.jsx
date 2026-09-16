import { useEffect } from 'react';
import OrderCard from './OrderCard';
import { getUrgencyConfig, computeTableElapsedMinutes } from '../lib/orderUrgency';

export default function TableOrdersModal({
  table,
  orders = [],
  now = 0,
  onClose,
  onRefreshOrders
}) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  // Compute total ETB bill for this table
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.pricing?.total || 0), 0);
  const currency = orders[0]?.pricing?.currency || 'ETB';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      {/* Backdrop Click Dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Box */}
      <div className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] bg-slate-50 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col z-10 overflow-hidden border border-slate-200 animate-fade-in-up">
        {/* Modal Header */}
        <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-xs"
              style={{
                background: urgency.badgeBg,
                color: urgency.badgeText
              }}
            >
              {table.code && '🪑'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">
                  {table.name || `Table ${table.code}`}
                </h2>
                {orders.length > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-black tracking-wide"
                    style={{
                      background: urgency.badgeBg,
                      color: urgency.badgeText
                    }}
                  >
                    {urgency.badgeLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {table.code ? `Table Code: ${table.code} • ` : ''}
                {orders.length} active {orders.length === 1 ? 'order' : 'orders'}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table Description Banner */}
        <div className="px-5 py-3 bg-white/60 border-b border-slate-200/80 shrink-0">
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-amber-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-xs">
              <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-800">
                Table Description & Notes
              </span>
              <p className="mt-0.5 font-medium leading-relaxed">
                {table.description ? table.description : 'Standard dining table. No special notes assigned.'}
              </p>
            </div>
            {totalAmount > 0 && (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Table Total
                </span>
                <span className="text-xs font-black text-amber-950">
                  {currency} {totalAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Orders Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {orders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 my-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 text-2xl">
                ✨
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">No active orders</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  This table currently has no pending or unserved orders. All set for service!
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Placed / New Orders Section */}
              {placedOrders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span>Waiting Orders</span>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-amber-100 text-amber-800 font-black">
                        {placedOrders.length}
                      </span>
                    </h3>
                    <span className="text-[11px] font-semibold text-amber-700">
                      Needs attention
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
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

              {/* Served Orders Section */}
              {servedOrders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span>Served Orders</span>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-blue-100 text-blue-800 font-black">
                        {servedOrders.length}
                      </span>
                    </h3>
                    <span className="text-[11px] font-semibold text-blue-700">
                      Awaiting completion
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-5 py-3 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} for {table.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Back to Tables
          </button>
        </div>
      </div>
    </div>
  );
}
