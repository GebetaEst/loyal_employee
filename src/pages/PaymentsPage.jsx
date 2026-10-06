import { useState, useEffect, useCallback, useMemo } from 'react';
import EmployeeLayout from '../components/EmployeeLayout';
import { useStore } from '../store/useStore';
import PaymentModal from '../components/PaymentModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import { fetchRestaurantOrderHistory } from '../api/paymentService';
import api from '../api/axios';

function formatCurrency(amount, currency = 'ETB') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

export default function PaymentsPage() {
  const activeOrders = useStore((state) => state.activeOrders);
  const setActiveOrders = useStore((state) => state.setActiveOrders);
  const restaurant = useStore((state) => state.restaurant);
  const employee = useStore((state) => state.employee);

  const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid' | 'settled'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [previewReceipt, setPreviewReceipt] = useState(null);

  // Settled history state
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const restaurantId = restaurant?._id || restaurant?.id || employee?.restaurant;

  // Initial fetch of active orders if not already loaded
  useEffect(() => {
    api.get('/api/employee/orders', { params: { status: 'active' } })
      .then((res) => {
        if (res.data?.success) {
          setActiveOrders(res.data.data?.orders || []);
        }
      })
      .catch((err) => console.error('Failed to load active cashier orders:', err));
  }, [setActiveOrders]);

  // Fetch settled order history
  const loadSettledHistory = useCallback(async (page = historyPage) => {
    setHistoryLoading(true);
    try {
      const res = await fetchRestaurantOrderHistory(restaurantId, {
        page,
        limit: 20,
        status: 'completed',
      });
      setHistoryOrders(res.orders);
      setHistoryPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load cashier payment history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [restaurantId, historyPage]);

  useEffect(() => {
    if (activeTab === 'settled') {
      loadSettledHistory(historyPage);
    }
  }, [activeTab, historyPage, loadSettledHistory]);

  // Unpaid active orders
  const unpaidOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      const isPaid = o.payment?.status === 'paid';
      const isCancelled = !!o.cancellation || (o.currentStepKey || '').toLowerCase() === 'cancelled' || (o.systemState || '').toUpperCase() === 'CANCELLED';
      return !isPaid && !isCancelled;
    });
  }, [activeOrders]);

  // Filtered unpaid orders based on search
  const filteredUnpaidOrders = useMemo(() => {
    if (!searchQuery.trim()) return unpaidOrders;
    const q = searchQuery.toLowerCase();
    return unpaidOrders.filter((order) => {
      const num = (order.orderNumber || '').toString().toLowerCase();
      const tableName = (order.table?.name || order.table?.code || (typeof order.table === 'string' ? order.table : '')).toString().toLowerCase();
      return num.includes(q) || tableName.includes(q);
    });
  }, [unpaidOrders, searchQuery]);

  // Total outstanding unpaid ETB
  const totalOutstanding = useMemo(() => {
    return unpaidOrders.reduce((sum, o) => sum + Number(o.pricing?.total || 0), 0);
  }, [unpaidOrders]);

  const handlePaymentSuccess = () => {
    setSelectedOrderForPayment(null);
    if (activeTab === 'settled') {
      loadSettledHistory(historyPage);
    }
  };

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-5 animate-fade-in max-w-lg mx-auto">
        {/* Header & Metric Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Cashier Desk</h1>
            <p className="text-xs text-slate-500 mt-0.5">Order payment processing & reconciliation</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Due Total</span>
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
            <span>💳 Unpaid Tickets</span>
            {unpaidOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                {unpaidOrders.length}
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
          </button>
        </div>

        {/* Search Input for Unpaid */}
        {activeTab === 'unpaid' && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search by order # or table name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* TAB 1: UNPAID ORDERS */}
        {activeTab === 'unpaid' && (
          <div className="flex flex-col gap-3.5">
            {filteredUnpaidOrders.length === 0 ? (
              <div className="glass bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-center my-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100 text-2xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {searchQuery ? 'No matching unpaid orders' : 'All clear! No pending payments'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {searchQuery ? 'Try clearing your search query.' : 'New orders will appear automatically via real-time updates.'}
                  </p>
                </div>
              </div>
            ) : (
              filteredUnpaidOrders.map((order) => {
                const total = order.pricing?.total || 0;
                const currency = order.pricing?.currency || 'ETB';
                const tableName = order.table?.name || (order.table?.code ? `Table ${order.table.code}` : (typeof order.table === 'string' ? `Table ${order.table}` : 'N/A'));
                const waiterName = order.service?.waiter?.name || 'Auto Assigned';

                return (
                  <div
                    key={order.id || order._id}
                    className="glass rounded-3xl p-5 border border-slate-200 bg-white shadow-sm flex flex-col gap-3 hover:border-slate-300 transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-900">#{order.orderNumber}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {tableName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Waiter: <strong className="text-slate-700">{waiterName}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total</span>
                        <span className="text-lg font-black text-indigo-950">
                          {formatCurrency(total, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Items Overview */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                      <div className="text-xs text-slate-700 space-y-1">
                        {order.items?.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="truncate">
                              <strong className="text-indigo-600">{item.quantity}×</strong> {item.name}
                            </span>
                            <span className="font-semibold text-slate-500 shrink-0 ml-2">
                              {formatCurrency(item.lineTotal || (item.quantity * item.unitPrice), currency)}
                            </span>
                          </div>
                        ))}
                        {(order.items?.length || 0) > 3 && (
                          <p className="text-[10px] text-slate-400 font-bold pt-1">
                            +{order.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Settle Action */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForPayment(order)}
                      className="w-full py-3 px-4 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
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

        {/* TAB 2: SETTLED HISTORY */}
        {activeTab === 'settled' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Payment Settlements ({historyPagination.total || historyOrders.length})
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">Cloudinary Verified</span>
            </div>

            {historyLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-3xl p-5 border border-slate-200 bg-white flex flex-col gap-3 shadow-xs">
                    <div className="skeleton h-6 w-1/3" />
                    <div className="skeleton h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="glass bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-center my-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-400 text-2xl">
                  🧾
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">No settlement history yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Completed payments and receipt proofs will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {historyOrders.map((order) => {
                  const total = order.pricing?.total || 0;
                  const currency = order.pricing?.currency || 'ETB';
                  const method = order.payment?.method || 'cash';
                  const proofUrl = order.payment?.proofUrl;
                  const paidAt = order.payment?.paidAt || order.updatedAt;

                  return (
                    <div
                      key={order.id || order._id}
                      className="glass rounded-3xl p-4 border border-slate-200 bg-white shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">#{order.orderNumber}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ✓ {method.toLowerCase() === 'cbe' ? 'CBE' : (method.charAt(0).toUpperCase() + method.slice(1))}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {paidAt ? new Date(paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Settled'}
                        </p>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            {formatCurrency(total, currency)}
                          </span>
                        </div>
                        {proofUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewReceipt({ url: proofUrl, orderNumber: order.orderNumber })}
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

                {/* History Pagination */}
                {historyPagination.pages > 1 && (
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-xs mt-2">
                    <button
                      type="button"
                      disabled={historyPage <= 1 || historyLoading}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ← Prev
                    </button>

                    <span className="text-xs font-bold text-slate-600">
                      Page {historyPagination.page} of {historyPagination.pages}
                    </span>

                    <button
                      type="button"
                      disabled={historyPage >= historyPagination.pages || historyLoading}
                      onClick={() => setHistoryPage((p) => Math.min(historyPagination.pages, p + 1))}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment Modal */}
        {selectedOrderForPayment && (
          <PaymentModal
            order={selectedOrderForPayment}
            onClose={() => setSelectedOrderForPayment(null)}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* Receipt Preview Lightbox */}
        {previewReceipt && (
          <ReceiptPreviewModal
            url={previewReceipt.url}
            orderNumber={previewReceipt.orderNumber}
            onClose={() => setPreviewReceipt(null)}
          />
        )}
      </div>
    </EmployeeLayout>
  );
}
