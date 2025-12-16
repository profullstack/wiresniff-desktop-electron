/**
 * WebSocket Client Service (Renderer)
 * 
 * Provides WebSocket functionality in the renderer process through IPC
 * communication with the main process.
 */

import { nanoid } from 'nanoid';

// Types
export interface WebSocketConfig {
  connectionId?: string;
  url: string;
  protocols?: string[];
  headers?: Record<string, string>;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketMessage {
  id: string;
  connectionId: string;
  type: 'sent' | 'received';
  data: string | ArrayBuffer;
  dataType: 'text' | 'binary';
  timestamp: number;
}

export interface WebSocketConnectionState {
  connectionId: string;
  url: string;
  status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';
  error?: string;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  messageCount: {
    sent: number;
    received: number;
  };
}

// Event listeners
type StateChangeListener = (state: WebSocketConnectionState) => void;
type MessageListener = (message: WebSocketMessage) => void;
type ReconnectingListener = (data: { connectionId: string; attempt: number; maxAttempts: number }) => void;
type ErrorListener = (data: { connectionId: string; error: string }) => void;

const stateChangeListeners = new Map<string, Set<StateChangeListener>>();
const messageListeners = new Map<string, Set<MessageListener>>();
const reconnectingListeners = new Map<string, Set<ReconnectingListener>>();
const errorListeners = new Map<string, Set<ErrorListener>>();

// Global listeners (for all connections)
const globalStateChangeListeners = new Set<StateChangeListener>();
const globalMessageListeners = new Set<MessageListener>();

/**
 * Initialize WebSocket event listeners from main process
 */
export function initializeWebSocketListeners(): void {
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.warn('WebSocket listeners not initialized: electronAPI not available');
    return;
  }

  // State change events
  window.electronAPI.on('websocket:state-change', (state: WebSocketConnectionState) => {
    // Notify connection-specific listeners
    const listeners = stateChangeListeners.get(state.connectionId);
    if (listeners) {
      listeners.forEach((listener) => listener(state));
    }
    // Notify global listeners
    globalStateChangeListeners.forEach((listener) => listener(state));
  });

  // Message events
  window.electronAPI.on('websocket:message', (message: WebSocketMessage) => {
    // Notify connection-specific listeners
    const listeners = messageListeners.get(message.connectionId);
    if (listeners) {
      listeners.forEach((listener) => listener(message));
    }
    // Notify global listeners
    globalMessageListeners.forEach((listener) => listener(message));
  });

  // Reconnecting events
  window.electronAPI.on('websocket:reconnecting', (data: { connectionId: string; attempt: number; maxAttempts: number }) => {
    const listeners = reconnectingListeners.get(data.connectionId);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  });

  // Send error events
  window.electronAPI.on('websocket:send-error', (data: { connectionId: string; error: string }) => {
    const listeners = errorListeners.get(data.connectionId);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  });
}

/**
 * Connect to a WebSocket server
 */
export async function connect(config: WebSocketConfig): Promise<{
  success: boolean;
  state?: WebSocketConnectionState;
  error?: string;
}> {
  const connectionId = config.connectionId || nanoid();
  const fullConfig = { ...config, connectionId };

  if (window.electronAPI) {
    const result = await window.electronAPI.invoke<{
      success: boolean;
      state?: WebSocketConnectionState;
      error?: string;
    }>('websocket:connect', fullConfig);
    return result;
  }

  // Fallback to browser WebSocket for development
  return connectWithBrowserWebSocket(fullConfig);
}

/**
 * Disconnect from a WebSocket server
 */
export async function disconnect(connectionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (window.electronAPI) {
    return window.electronAPI.invoke('websocket:disconnect', connectionId);
  }

  // Fallback for browser WebSocket
  return disconnectBrowserWebSocket(connectionId);
}

/**
 * Send a message through a WebSocket connection
 */
export async function send(
  connectionId: string,
  data: string | ArrayBuffer,
  options?: { binary?: boolean }
): Promise<{
  success: boolean;
  message?: WebSocketMessage;
  error?: string;
}> {
  if (window.electronAPI) {
    return window.electronAPI.invoke('websocket:send', connectionId, data, options);
  }

  // Fallback for browser WebSocket
  return sendBrowserWebSocket(connectionId, data, options);
}

/**
 * Get the current state of a connection
 */
export async function getState(connectionId: string): Promise<{
  success: boolean;
  state?: WebSocketConnectionState | null;
}> {
  if (window.electronAPI) {
    return window.electronAPI.invoke('websocket:get-state', connectionId);
  }

  // Fallback for browser WebSocket
  const state = browserConnections.get(connectionId)?.state || null;
  return { success: true, state };
}

/**
 * Get all active connections
 */
export async function getAllConnections(): Promise<{
  success: boolean;
  connections: WebSocketConnectionState[];
}> {
  if (window.electronAPI) {
    return window.electronAPI.invoke('websocket:get-all');
  }

  // Fallback for browser WebSocket
  const connections = Array.from(browserConnections.values()).map((c) => c.state);
  return { success: true, connections };
}

/**
 * Close all connections
 */
export async function closeAll(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (window.electronAPI) {
    return window.electronAPI.invoke('websocket:close-all');
  }

  // Fallback for browser WebSocket
  browserConnections.forEach((_, id) => disconnectBrowserWebSocket(id));
  return { success: true };
}

// Event subscription functions

/**
 * Subscribe to state changes for a specific connection
 */
export function onStateChange(connectionId: string, listener: StateChangeListener): () => void {
  if (!stateChangeListeners.has(connectionId)) {
    stateChangeListeners.set(connectionId, new Set());
  }
  stateChangeListeners.get(connectionId)!.add(listener);

  return () => {
    stateChangeListeners.get(connectionId)?.delete(listener);
  };
}

/**
 * Subscribe to state changes for all connections
 */
export function onGlobalStateChange(listener: StateChangeListener): () => void {
  globalStateChangeListeners.add(listener);
  return () => {
    globalStateChangeListeners.delete(listener);
  };
}

/**
 * Subscribe to messages for a specific connection
 */
export function onMessage(connectionId: string, listener: MessageListener): () => void {
  if (!messageListeners.has(connectionId)) {
    messageListeners.set(connectionId, new Set());
  }
  messageListeners.get(connectionId)!.add(listener);

  return () => {
    messageListeners.get(connectionId)?.delete(listener);
  };
}

/**
 * Subscribe to messages for all connections
 */
export function onGlobalMessage(listener: MessageListener): () => void {
  globalMessageListeners.add(listener);
  return () => {
    globalMessageListeners.delete(listener);
  };
}

/**
 * Subscribe to reconnecting events for a specific connection
 */
export function onReconnecting(connectionId: string, listener: ReconnectingListener): () => void {
  if (!reconnectingListeners.has(connectionId)) {
    reconnectingListeners.set(connectionId, new Set());
  }
  reconnectingListeners.get(connectionId)!.add(listener);

  return () => {
    reconnectingListeners.get(connectionId)?.delete(listener);
  };
}

/**
 * Subscribe to error events for a specific connection
 */
export function onError(connectionId: string, listener: ErrorListener): () => void {
  if (!errorListeners.has(connectionId)) {
    errorListeners.set(connectionId, new Set());
  }
  errorListeners.get(connectionId)!.add(listener);

  return () => {
    errorListeners.get(connectionId)?.delete(listener);
  };
}

/**
 * Remove all listeners for a connection
 */
export function removeAllListeners(connectionId: string): void {
  stateChangeListeners.delete(connectionId);
  messageListeners.delete(connectionId);
  reconnectingListeners.delete(connectionId);
  errorListeners.delete(connectionId);
}

// Browser WebSocket fallback for development

interface BrowserConnection {
  ws: WebSocket;
  state: WebSocketConnectionState;
  config: WebSocketConfig & { connectionId: string };
}

const browserConnections = new Map<string, BrowserConnection>();

async function connectWithBrowserWebSocket(config: WebSocketConfig & { connectionId: string }): Promise<{
  success: boolean;
  state?: WebSocketConnectionState;
  error?: string;
}> {
  const { connectionId, url, protocols } = config;

  // Close existing connection if any
  if (browserConnections.has(connectionId)) {
    await disconnectBrowserWebSocket(connectionId);
  }

  const state: WebSocketConnectionState = {
    connectionId,
    url,
    status: 'connecting',
    reconnectAttempts: 0,
    messageCount: { sent: 0, received: 0 },
  };

  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url, protocols);

      browserConnections.set(connectionId, { ws, state, config });

      // Notify listeners of connecting state
      notifyStateChange(connectionId, state);

      ws.onopen = () => {
        const connection = browserConnections.get(connectionId);
        if (connection) {
          connection.state = {
            ...connection.state,
            status: 'connected',
            connectedAt: Date.now(),
            error: undefined,
          };
          notifyStateChange(connectionId, connection.state);
          resolve({ success: true, state: connection.state });
        }
      };

      ws.onmessage = (event) => {
        const connection = browserConnections.get(connectionId);
        if (connection) {
          const message: WebSocketMessage = {
            id: nanoid(),
            connectionId,
            type: 'received',
            data: event.data,
            dataType: typeof event.data === 'string' ? 'text' : 'binary',
            timestamp: Date.now(),
          };
          connection.state.messageCount.received++;
          notifyMessage(connectionId, message);
          notifyStateChange(connectionId, connection.state);
        }
      };

      ws.onclose = () => {
        const connection = browserConnections.get(connectionId);
        if (connection) {
          connection.state = {
            ...connection.state,
            status: 'disconnected',
            disconnectedAt: Date.now(),
          };
          notifyStateChange(connectionId, connection.state);
        }
      };

      ws.onerror = (error) => {
        const connection = browserConnections.get(connectionId);
        if (connection) {
          connection.state = {
            ...connection.state,
            status: 'error',
            error: 'WebSocket error',
          };
          notifyStateChange(connectionId, connection.state);
        }
        resolve({ success: false, error: 'WebSocket connection failed' });
      };
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  });
}

async function disconnectBrowserWebSocket(connectionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const connection = browserConnections.get(connectionId);
  if (!connection) {
    return { success: true };
  }

  return new Promise((resolve) => {
    const { ws } = connection;

    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.onclose = () => {
        browserConnections.delete(connectionId);
        resolve({ success: true });
      };
      ws.close(1000, 'Client disconnected');
    } else {
      browserConnections.delete(connectionId);
      resolve({ success: true });
    }
  });
}

function sendBrowserWebSocket(
  connectionId: string,
  data: string | ArrayBuffer,
  options?: { binary?: boolean }
): {
  success: boolean;
  message?: WebSocketMessage;
  error?: string;
} {
  const connection = browserConnections.get(connectionId);
  if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
    return { success: false, error: 'Connection not open' };
  }

  try {
    connection.ws.send(data);

    const message: WebSocketMessage = {
      id: nanoid(),
      connectionId,
      type: 'sent',
      data,
      dataType: typeof data === 'string' ? 'text' : 'binary',
      timestamp: Date.now(),
    };

    connection.state.messageCount.sent++;
    notifyMessage(connectionId, message);
    notifyStateChange(connectionId, connection.state);

    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
}

function notifyStateChange(connectionId: string, state: WebSocketConnectionState): void {
  const listeners = stateChangeListeners.get(connectionId);
  if (listeners) {
    listeners.forEach((listener) => listener(state));
  }
  globalStateChangeListeners.forEach((listener) => listener(state));
}

function notifyMessage(connectionId: string, message: WebSocketMessage): void {
  const listeners = messageListeners.get(connectionId);
  if (listeners) {
    listeners.forEach((listener) => listener(message));
  }
  globalMessageListeners.forEach((listener) => listener(message));
}