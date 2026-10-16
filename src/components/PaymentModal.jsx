import DiningCheckPaymentModal from './DiningCheckPaymentModal';

/**
 * PaymentModal alias for DiningCheckPaymentModal.
 * Supports canonical <PaymentModal check={check} ... />
 * Also gracefully adapts legacy { order } prop to check shape if needed.
 */
export default function PaymentModal({ check, order, onClose, onSuccess }) {
  const resolvedCheck = check || (order ? {
    id: order.diningCheckId || order.id || order._id,
    customer: {
      name: order.customer?.name || order.customerName || 'Customer',
      phone: order.customer?.phone || '',
    },
    table: order.table,
    orderCount: 1,
    orders: [
      {
        id: order.id || order._id,
        orderNumber: order.orderNumber,
        total: order.pricing?.total || 0,
      }
    ],
    totals: {
      total: order.pricing?.total || 0,
      currency: order.pricing?.currency || 'ETB',
    },
    payment: {
      isPaid: false,
    }
  } : null);

  return (
    <DiningCheckPaymentModal
      check={resolvedCheck}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export { DiningCheckPaymentModal };
