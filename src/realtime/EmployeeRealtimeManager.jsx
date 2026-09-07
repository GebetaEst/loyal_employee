import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { connectEmployeeSocket, disconnectEmployeeSocket } from './socket';
import { REALTIME_EVENTS } from './realtimeEvents';

const MAX_SEEN_EVENT_IDS = 150;

export default function EmployeeRealtimeManager() {
  const token = useStore((state) => state.token);
  const employee = useStore((state) => state.employee);

  const seenEventIdsRef = useRef(new Set());
  const debounceTimerRef = useRef(null);

  // Debounced invalidation scheduler (batches events within 250ms into a single revision bump)
  const scheduleOrdersRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      console.log(
        '%c⏳ [Socket.IO Debounce]%c Refresh already scheduled, coalescing event within active 250ms window',
        'background: #64748b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #475569;'
      );
      return;
    }
    console.log(
      '%c⏳ [Socket.IO Debounce]%c Scheduling orders revision bump in 250ms...',
      'background: #64748b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #475569;'
    );
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      console.log(
        '%c🚀 [Socket.IO Action]%c Debounce elapsed: incrementing ordersRevision to trigger REST refetch',
        'background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #4338ca; font-weight: bold;'
      );
      useStore.getState().bumpOrdersRevision();
    }, 250);
  }, []);

  // Event ID deduplicator: returns true if already seen
  const isDuplicateEvent = useCallback((eventId) => {
    if (!eventId) return false;
    if (seenEventIdsRef.current.has(eventId)) {
      console.log(
        `%c🛡️ [Socket.IO Deduplication]%c Duplicate event detected and ignored (eventId: ${eventId})`,
        'background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #ea580c;'
      );
      return true;
    }
    seenEventIdsRef.current.add(eventId);
    if (seenEventIdsRef.current.size > MAX_SEEN_EVENT_IDS) {
      const oldestId = seenEventIdsRef.current.keys().next().value;
      seenEventIdsRef.current.delete(oldestId);
    }
    return false;
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectEmployeeSocket();
      return;
    }

    const socket = connectEmployeeSocket(token);
    if (!socket) return;

    // Handle order:created
    const handleOrderCreated = (payload = {}) => {
      const order = payload?.order || payload?.data?.order || payload?.data || payload;
      const tableName = order?.table?.name || order?.tableName || (typeof order?.table === 'string' ? order.table : null);
      const orderNumber = order?.orderNumber;

      console.log(
        `%c⚡ [Socket.IO Event: order:created]%c Table: ${tableName || 'N/A'} | Order #${orderNumber || 'N/A'}`,
        'background: #16a34a; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #15803d; font-weight: bold;',
        {
          event: 'order:created',
          orderNumber,
          table: tableName,
          total: order?.totalAmount,
          status: order?.status,
          eventId: payload?.eventId,
          waiterRole: employee?.role,
          payload
        }
      );

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      // Schedule debounced REST refetch
      scheduleOrdersRefresh();

      // Show toast and optional vibration for assigned waiter
      if (employee?.role === 'waiter') {
        if (tableName) {
          toast.success(`New order received — Table ${tableName}`, { id: `order-created-${orderNumber || tableName}` });
        } else if (orderNumber) {
          toast.success(`New order received — #${orderNumber}`, { id: `order-created-${orderNumber}` });
        } else {
          toast.success('New order received', { id: 'order-created-generic' });
        }

        try {
          navigator.vibrate?.([150, 80, 150]);
        } catch {
          // Vibration not supported or allowed; safely ignore
        }
      }
    };

    // Handle order:updated
    const handleOrderUpdated = (payload = {}) => {
      const order = payload?.order || payload?.data?.order || payload?.data || payload;
      const orderNum = order?.orderNumber || payload?.orderNumber || payload?.data?.orderNumber;
      const currentStep = payload?.data?.currentStepKey || payload?.currentStepKey || order?.currentStepKey || order?.status;

      console.log(
        `%c⚡ [Socket.IO Event: order:updated]%c Order #${orderNum || 'N/A'} -> Step: ${currentStep || 'updated'}`,
        'background: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #0369a1; font-weight: bold;',
        {
          event: 'order:updated',
          orderNumber: orderNum,
          currentStepKey: currentStep,
          eventId: payload?.eventId,
          payload
        }
      );

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      // Silently schedule debounced refetch to refresh order state across devices
      scheduleOrdersRefresh();
    };

    // Handle order:cancelled
    const handleOrderCancelled = (payload = {}) => {
      const order = payload?.order || payload?.data?.order || payload?.data || payload;
      const orderNum = order?.orderNumber || payload?.orderNumber || payload?.data?.orderNumber;
      const reason = payload?.data?.reason || payload?.reason || order?.cancellation?.reason || 'Cancelled';

      console.log(
        `%c⚡ [Socket.IO Event: order:cancelled]%c Order #${orderNum || 'N/A'} -> Reason: "${reason}"`,
        'background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #b91c1c; font-weight: bold;',
        {
          event: 'order:cancelled',
          orderNumber: orderNum,
          reason,
          eventId: payload?.eventId,
          payload
        }
      );

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      scheduleOrdersRefresh();

      if (orderNum) {
        toast(`Order #${orderNum} was cancelled.`, { icon: 'ℹ️' });
      }
    };

    // Handle orders:invalidate
    const handleOrdersInvalidate = (payload = {}) => {
      const reason = payload?.data?.reason || payload?.reason || 'sync';
      const orderId = payload?.data?.orderId || payload?.orderId;

      console.log(
        `%c⚡ [Socket.IO Event: orders:invalidate]%c Reason: ${reason} ${orderId ? `(Order: ${orderId})` : ''}`,
        'background: #d97706; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #b45309; font-weight: bold;',
        {
          event: 'orders:invalidate',
          reason,
          orderId,
          eventId: payload?.eventId,
          payload
        }
      );

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      scheduleOrdersRefresh();
    };

    socket.on(REALTIME_EVENTS.ORDER_CREATED, handleOrderCreated);
    socket.on(REALTIME_EVENTS.ORDER_UPDATED, handleOrderUpdated);
    socket.on(REALTIME_EVENTS.ORDER_CANCELLED, handleOrderCancelled);
    socket.on(REALTIME_EVENTS.ORDERS_INVALIDATE, handleOrdersInvalidate);

    return () => {
      socket.off(REALTIME_EVENTS.ORDER_CREATED, handleOrderCreated);
      socket.off(REALTIME_EVENTS.ORDER_UPDATED, handleOrderUpdated);
      socket.off(REALTIME_EVENTS.ORDER_CANCELLED, handleOrderCancelled);
      socket.off(REALTIME_EVENTS.ORDERS_INVALIDATE, handleOrdersInvalidate);
    };
  }, [token, employee?.role, isDuplicateEvent, scheduleOrdersRefresh]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return null;
}
