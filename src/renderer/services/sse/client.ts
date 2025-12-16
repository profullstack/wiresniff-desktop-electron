/**
 * Server-Sent Events (SSE) Client Service
 * 
 * Provides SSE connection functionality with event handling,
 * filtering, and reconnection support.
 */

import { nanoid } from 'nanoid';

// Types
export interface SSEConfig {
  connectionId?: string;
  url: string;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface SSEEvent {
  id: string;
  connectionId: string;
  eventId?: string;
  eventType: string;
  data: string;
  timestamp: number;
  retry?: number;
}

export interface SSEConnectionState {
  connectionId: string;
  url: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  eventCount: number;
  lastEventId?: string;
}

// Event listeners
type StateChangeListener = (state: SSEConnectionState) => void;
type EventListener = (event: SSEEvent) => void;
type ReconnectingListener = (data: { connectionId: string; attempt: number; maxAttempts: number }) => void;
type ErrorListener = (data: { connectionId: string; error: string }) => void;

const stateChangeListeners = new Map<string, Set<StateChangeListener>>();
const eventListeners = new Map<string, Set<EventListener>>();
const reconnectingListeners = new Map<string, Set<ReconnectingListener>>();
const errorListeners = new Map<string, Set<ErrorListener>>();

// Global listeners
const globalStateChangeListeners = new Set<StateChangeListener>();
const globalEventListeners = new Set<EventListener>();

// Active connections
interface SSEConnection {
  eventSource: EventSource;
  config: SSEConfig & { connectionId: string };
  state: SSEConnectionState;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

const connections = new Map<string, SSEConnection>();

/**
 * Connect to an SSE endpoint
 */
export function connect(config: SSEConfig): {
  success: boolean;
  connectionId: string;
  error?: string;
} {
  const connectionId = config.connectionId || nanoid();
  const fullConfig = { ...config, connectionId };

  // Close existing connection if any
  if (connections.has(connectionId)) {
    disconnect(connectionId);
  }

  // Initialize state
  const state: SSEConnectionState = {
    connectionId,
    url: config.url,
    status: 'connecting',
    reconnectAttempts: 0,
    eventCount: 0,
  };

  try {
    // Create EventSource
    // Note: EventSource doesn't support custom headers natively
    // For custom headers, we'd need to use a polyfill or fetch-based implementation
    const eventSource = new EventSource(config.url, {
      withCredentials: config.withCredentials,
    });

    // Store connection
    const connection: SSEConnection = {
      eventSource,
      config: fullConfig,
      state,
    };
    connections.set(connectionId, connection);

    // Notify listeners of connecting state
    notifyStateChange(connectionId, state);

    // Handle open
    eventSource.onopen = () => {
      const conn = connections.get(connectionId);
      if (conn) {
        conn.state = {
          ...conn.state,
          status: 'connected',
          connectedAt: Date.now(),
          reconnectAttempts: 0,
          error: undefined,
        };
        notifyStateChange(connectionId, conn.state);
      }
    };

    // Handle message (default event type)
    eventSource.onmessage = (event) => {
      handleEvent(connectionId, 'message', event);
    };

    // Handle error
    eventSource.onerror = (error) => {
      const conn = connections.get(connectionId);
      if (conn) {
        const isConnected = conn.state.status === 'connected';
        
        conn.state = {
          ...conn.state,
          status: 'error',
          error: 'Connection error',
          disconnectedAt: Date.now(),
        };
        notifyStateChange(connectionId, conn.state);

        // Notify error listeners
        const listeners = errorListeners.get(connectionId);
        if (listeners) {
          listeners.forEach((listener) =>
            listener({ connectionId, error: 'Connection error' })
          );
        }

        // Handle auto-reconnect
        if (
          conn.config.autoReconnect !== false &&
          conn.state.reconnectAttempts < (conn.config.maxReconnectAttempts || 5)
        ) {
          scheduleReconnect(connectionId);
        }
      }
    };

    return { success: true, connectionId };
  } catch (error) {
    return {
      success: false,
      connectionId,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Handle incoming SSE event
 */
function handleEvent(
  connectionId: string,
  eventType: string,
  event: MessageEvent
): void {
  const conn = connections.get(connectionId);
  if (!conn) return;

  const sseEvent: SSEEvent = {
    id: nanoid(),
    connectionId,
    eventId: event.lastEventId || undefined,
    eventType,
    data: event.data,
    timestamp: Date.now(),
  };

  // Update state
  conn.state.eventCount++;
  if (event.lastEventId) {
    conn.state.lastEventId = event.lastEventId;
  }

  // Notify event listeners
  const listeners = eventListeners.get(connectionId);
  if (listeners) {
    listeners.forEach((listener) => listener(sseEvent));
  }
  globalEventListeners.forEach((listener) => listener(sseEvent));

  // Notify state change
  notifyStateChange(connectionId, conn.state);
}

/**
 * Subscribe to a specific event type
 */
export function subscribeToEventType(
  connectionId: string,
  eventType: string
): boolean {
  const conn = connections.get(connectionId);
  if (!conn) return false;

  conn.eventSource.addEventListener(eventType, (event) => {
    handleEvent(connectionId, eventType, event as MessageEvent);
  });

  return true;
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect(connectionId: string): void {
  const conn = connections.get(connectionId);
  if (!conn) return;

  // Clear any existing reconnect timer
  if (conn.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
  }

  const { reconnectInterval = 3000 } = conn.config;

  conn.reconnectTimer = setTimeout(() => {
    const connection = connections.get(connectionId);
    if (!connection) return;

    connection.state.reconnectAttempts++;

    // Notify reconnecting listeners
    const listeners = reconnectingListeners.get(connectionId);
    if (listeners) {
      listeners.forEach((listener) =>
        listener({
          connectionId,
          attempt: connection.state.reconnectAttempts,
          maxAttempts: connection.config.maxReconnectAttempts || 5,
        })
      );
    }

    // Attempt reconnection
    disconnect(connectionId);
    const result = connect(connection.config);
    
    if (!result.success) {
      // If reconnection failed and we haven't exceeded max attempts, try again
      if (
        connection.state.reconnectAttempts <
        (connection.config.maxReconnectAttempts || 5)
      ) {
        scheduleReconnect(connectionId);
      }
    }
  }, reconnectInterval);
}

/**
 * Disconnect from an SSE endpoint
 */
export function disconnect(connectionId: string): boolean {
  const conn = connections.get(connectionId);
  if (!conn) return false;

  // Clear reconnect timer
  if (conn.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
  }

  // Close EventSource
  conn.eventSource.close();

  // Update state
  conn.state = {
    ...conn.state,
    status: 'disconnected',
    disconnectedAt: Date.now(),
  };
  notifyStateChange(connectionId, conn.state);

  // Remove connection
  connections.delete(connectionId);

  return true;
}

/**
 * Get connection state
 */
export function getState(connectionId: string): SSEConnectionState | null {
  const conn = connections.get(connectionId);
  return conn ? conn.state : null;
}

/**
 * Get all connections
 */
export function getAllConnections(): SSEConnectionState[] {
  return Array.from(connections.values()).map((c) => c.state);
}

/**
 * Close all connections
 */
export function closeAll(): void {
  connections.forEach((_, id) => disconnect(id));
}

// Event subscription functions

/**
 * Subscribe to state changes for a specific connection
 */
export function onStateChange(
  connectionId: string,
  listener: StateChangeListener
): () => void {
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
 * Subscribe to events for a specific connection
 */
export function onEvent(connectionId: string, listener: EventListener): () => void {
  if (!eventListeners.has(connectionId)) {
    eventListeners.set(connectionId, new Set());
  }
  eventListeners.get(connectionId)!.add(listener);

  return () => {
    eventListeners.get(connectionId)?.delete(listener);
  };
}

/**
 * Subscribe to events for all connections
 */
export function onGlobalEvent(listener: EventListener): () => void {
  globalEventListeners.add(listener);
  return () => {
    globalEventListeners.delete(listener);
  };
}

/**
 * Subscribe to reconnecting events for a specific connection
 */
export function onReconnecting(
  connectionId: string,
  listener: ReconnectingListener
): () => void {
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
  eventListeners.delete(connectionId);
  reconnectingListeners.delete(connectionId);
  errorListeners.delete(connectionId);
}

/**
 * Notify state change listeners
 */
function notifyStateChange(connectionId: string, state: SSEConnectionState): void {
  const listeners = stateChangeListeners.get(connectionId);
  if (listeners) {
    listeners.forEach((listener) => listener(state));
  }
  globalStateChangeListeners.forEach((listener) => listener(state));
}

/**
 * Parse SSE data
 */
export function parseSSEData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/**
 * Format SSE event for display
 */
export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];
  
  if (event.eventId) {
    lines.push(`id: ${event.eventId}`);
  }
  if (event.eventType !== 'message') {
    lines.push(`event: ${event.eventType}`);
  }
  
  // Handle multi-line data
  const dataLines = event.data.split('\n');
  dataLines.forEach((line) => {
    lines.push(`data: ${line}`);
  });
  
  return lines.join('\n');
}