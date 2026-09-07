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
        console.log('🔌 [Socket.IO] Connecting existing socket client to:', socketBaseUrl);
        socket.connect();
      }
      return socket;
    }

    // Token has changed: update auth and reconnect
    currentToken = token;
    socket.auth = { token };
    console.log('🔄 [Socket.IO] Reconnecting with updated token...');
    socket.disconnect().connect();
    return socket;
  }

  // Create new singleton socket instance
  currentToken = token;
  console.log('🔌 [Socket.IO] Initializing socket connection to:', socketBaseUrl);

  socket = io(socketBaseUrl, {
    autoConnect: false,
    auth: {
      token,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  // Global event listener: logs ANY event triggered from the backend
  socket.onAny((event, ...args) => {
    const time = new Date().toLocaleTimeString();
    const payload = args.length === 1 ? args[0] : args;
    console.log(
      `%c⚡ [Socket.IO Triggered]%c ${event} %c@ ${time}`,
      'background: #2563eb; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #0284c7; font-weight: bold;',
      'color: #64748b; font-size: 11px;',
      payload
    );
  });

  // Global outgoing event listener: logs ANY event emitted from client
  if (typeof socket.onAnyOutgoing === 'function') {
    socket.onAnyOutgoing((event, ...args) => {
      const time = new Date().toLocaleTimeString();
      const payload = args.length === 1 ? args[0] : args;
      console.log(
        `%c📤 [Socket.IO Emitted]%c ${event} %c@ ${time}`,
        'background: #7c3aed; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #7c3aed; font-weight: bold;',
        'color: #64748b; font-size: 11px;',
        payload
      );
    });
  }

  socket.on('connect', () => {
    const transport = socket.io?.engine?.transport?.name || 'websocket';
    console.log(
      `%c✅ [Socket.IO Connected]%c ID: ${socket.id} %c(${transport})`,
      'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #059669; font-weight: bold;',
      'color: #64748b; font-size: 11px;'
    );
    useStore.getState().setSocketConnected(true);
    // Connect & reconnect reconciliation: refetch authoritative REST orders
    useStore.getState().bumpOrdersRevision();
  });

  socket.on('disconnect', (reason) => {
    console.log(
      `%c❌ [Socket.IO Disconnected]%c Reason: ${reason}`,
      'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #dc2626; font-weight: bold;'
    );
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
    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(
        `%c🔄 [Socket.IO Reconnecting]%c Attempt #${attempt}...`,
        'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #2563eb; font-weight: bold;'
      );
    });

    socket.io.on('reconnect', (attempt) => {
      console.log(
        `%c✅ [Socket.IO Reconnected]%c Succeeded after ${attempt} attempt(s)`,
        'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #059669; font-weight: bold;'
      );
    });

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
      console.log(`🧪 [Socket.IO DevTools] Simulating event trigger: "${eventName}"`, payload);
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
    console.log(
      '%c🔌 [Socket.IO]%c Disconnecting socket...',
      'background: #64748b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #475569;'
    );
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
