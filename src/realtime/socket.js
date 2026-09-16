import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';

let socket = null;
let currentToken = null;

export function getSocketBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL || '';
  return value
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

export function getEmployeeSocket() {
  return socket;
}

export function connectEmployeeSocket(token) {
  if (!token) {
    disconnectEmployeeSocket();
    return null;
  }

  const socketBaseUrl = getSocketBaseUrl();

  // If socket already exists and token is unchanged
  if (socket) {
    if (currentToken === token) {
      if (!socket.connected) {
        // console.log('🔌 [Socket.IO] Connecting existing socket client to:', socketBaseUrl);
        socket.connect();
      }
      return socket;
    }

    // Token has changed: update auth and reconnect
    currentToken = token;
    socket.auth = { token };
    // console.log('🔄 [Socket.IO] Reconnecting with updated token...');
    socket.disconnect().connect();
    return socket;
  }

  // Create new singleton socket instance
  currentToken = token;
  // console.log('🔌 [Socket.IO] Initializing socket connection to:', socketBaseUrl);

  socket = io(socketBaseUrl, {
    autoConnect: false,
    auth: {
      token,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    transports: ['websocket'], // Direct WebSocket transport, skip polling handshake
  });

  // Global event listener
  socket.onAny(() => {});

  // Global outgoing event listener
  if (typeof socket.onAnyOutgoing === 'function') {
    socket.onAnyOutgoing(() => {});
  }

  socket.on('connect', () => {
    useStore.getState().setSocketConnected(true);
    // Connect & reconnect reconciliation: refetch authoritative REST orders
    useStore.getState().bumpOrdersRevision();
  });

  socket.on('disconnect', () => {
    useStore.getState().setSocketConnected(false);
  });

  socket.on('connect_error', (err) => {
    console.warn(
      `%c⚠️ [Socket.IO Connection Error]%c ${err?.message || 'Unknown error'}`,
      'background: #f59e0b; color: black; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #d97706; font-weight: bold;',
      err
    );
    useStore.getState().setSocketConnected(false);
  });

  // Reconnection lifecycle logging
  if (socket.io) {
    socket.io.on('reconnect_attempt', () => {});

    socket.io.on('reconnect', () => {});

    socket.io.on('reconnect_error', (err) => {
      console.warn(
        `%c⚠️ [Socket.IO Reconnect Error]%c ${err?.message || 'Failed reconnect attempt'}`,
        'background: #f59e0b; color: black; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #d97706; font-weight: bold;'
      );
    });

    socket.io.on('reconnect_failed', () => {
      console.error(
        '%c❌ [Socket.IO Reconnect Failed]%c Exhausted all reconnection attempts',
        'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #dc2626; font-weight: bold;'
      );
    });
  }

  // Expose to window for browser console inspection & testing
  if (typeof window !== 'undefined') {
    window.__employeeSocket = socket;
    window.__simulateSocketTrigger = (eventName, payload = {}) => {
      if (!socket) {
        console.warn('⚠️ [Socket.IO DevTools] No active socket instance. Log in first.');
        return;
      }
      // console.log(`🧪 [Socket.IO DevTools] Simulating event trigger: "${eventName}"`, payload);
      // Dispatch to internal callbacks if registered
      const callbacks = socket._callbacks?.[`$${eventName}`] || [];
      callbacks.forEach((cb) => cb(payload));
    };
  }

  socket.connect();
  return socket;
}

export function disconnectEmployeeSocket() {
  if (socket) {
    // console.log(
    //   '%c🔌 [Socket.IO]%c Disconnecting socket...',
    //   'background: #64748b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    //   'color: #475569;'
    // );
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    currentToken = null;
  }
  if (typeof window !== 'undefined') {
    window.__employeeSocket = null;
  }
  useStore.getState().setSocketConnected(false);
}
