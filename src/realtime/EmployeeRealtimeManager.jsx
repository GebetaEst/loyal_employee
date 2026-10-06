import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { connectEmployeeSocket, disconnectEmployeeSocket, joinEmployeeRooms } from './socket';
import { REALTIME_EVENTS } from './realtimeEvents';
import { playNotificationChime } from '../lib/sound';

const MAX_SEEN_EVENT_IDS = 150;

export default function EmployeeRealtimeManager() {
  const token = useStore((state) => state.token);
  const employee = useStore((state) => state.employee);
  const restaurant = useStore((state) => state.restaurant);

  const seenEventIdsRef = useRef(new Set());
  const debounceTimerRef = useRef(null);

  // Debounced invalidation scheduler (batches events within 300ms into a single revision bump)
  const scheduleOrdersRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      useStore.getState().bumpOrdersRevision();
    }, 300);
  }, []);

  // Event ID deduplicator: returns true if already seen
  const isDuplicateEvent = useCallback((eventId) => {
    if (!eventId) return false;
    if (seenEventIdsRef.current.has(eventId)) {
      return true;
    }
    seenEventIdsRef.current.add(eventId);
    if (seenEventIdsRef.current.size > MAX_SEEN_EVENT_IDS) {
      const oldestId = seenEventIdsRef.current.keys().next().value;
      seenEventIdsRef.current.delete(oldestId);
    }
    return false;
  }, []);

  // Re-join rooms when restaurant or employee changes while connected
  useEffect(() => {
    if (token) {
      joinEmployeeRooms();
    }
  }, [token, employee, restaurant]);

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

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      // 1. Immediately prepend/upsert new order in central store (0ms UI update)
      if (order && (order.id || order._id)) {
        useStore.getState().upsertActiveOrder(order, employee);
      }

      // 2. Play audible notification chime
      playNotificationChime();

      // 3. Show notification and optional vibration for waiters & cashiers
      if (employee?.role === 'waiter' || employee?.role === 'cashier') {
        const title = tableName
          ? `New order — Table ${tableName}`
          : orderNumber
          ? `New order — #${orderNumber}`
          : 'New order received';
        toast.success(title, { id: `order-created-${orderNumber || tableName || Date.now()}` });

        try {
          navigator.vibrate?.([150, 80, 150]);
        } catch {
          // Vibration not supported; safely ignore
        }
      }

      // 4. Schedule debounced background sync as secondary safety net
      scheduleOrdersRefresh();
    };

    // Handle order:updated
    const handleOrderUpdated = (payload = {}) => {
      const order = payload?.data?.order || payload?.order || (payload?.id || payload?._id ? payload : null);
      const orderId = payload?.data?.orderId || payload?.orderId || order?.id || order?._id;
      const currentStep = payload?.data?.currentStepKey || payload?.currentStepKey || order?.currentStepKey || order?.status;
      const payment = payload?.data?.payment || payload?.payment || order?.payment;

      if (!orderId) {
        scheduleOrdersRefresh();
        return;
      }

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      // 1. Direct state update
      useStore.getState().updateOrderState(orderId, {
        order,
        payment,
        currentStepKey: currentStep,
        systemState: payload?.data?.systemState || payload?.systemState || order?.systemState,
        updatedAt: payload?.data?.updatedAt || payload?.updatedAt || order?.updatedAt,
      });

      // Notify if payment was completed
      if (payment?.status === 'paid') {
        const orderNum = order?.orderNumber || payload?.orderNumber || payload?.data?.orderNumber;
        const msg = orderNum ? `Order #${orderNum} payment marked as paid!` : 'Order payment marked as paid!';
        toast.success(msg, { id: `order-paid-${orderId}` });
      }

      // 2. Schedule debounced background sync
      scheduleOrdersRefresh();
    };

    // Handle order:cancelled
    const handleOrderCancelled = (payload = {}) => {
      const orderId = payload?.data?.orderId || payload?.orderId;
      const reason = payload?.data?.reason || payload?.reason || 'Cancelled';
      const orderNum = payload?.data?.orderNumber || payload?.orderNumber;

      if (!orderId) {
        scheduleOrdersRefresh();
        return;
      }

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      // 1. Direct state update
      useStore.getState().cancelOrderState(orderId, reason);

      // 2. Schedule debounced background sync
      scheduleOrdersRefresh();

      if (orderNum) {
        toast(`Order #${orderNum} was cancelled.`, { icon: 'ℹ️', id: `order-cancel-${orderId}` });
      }
    };

    // Handle orders:invalidate
    const handleOrdersInvalidate = (payload = {}) => {
      const order = payload?.data?.order || payload?.order;

      if (isDuplicateEvent(payload?.eventId)) {
        return;
      }

      if (order && (order.id || order._id)) {
        useStore.getState().upsertActiveOrder(order, employee);
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
  }, [token, employee, isDuplicateEvent, scheduleOrdersRefresh]);

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
