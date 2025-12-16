/**
 * WebSocket Client Service
 * 
 * Handles WebSocket connections in the main process with IPC communication
 * to the renderer process. Supports connection management, message sending,
 * and auto-reconnect functionality.
 */

import { ipcMain, BrowserWindow } from 'electron';
import WebSocket from 'ws';
import { nanoid } from 'nanoid';

// Types
export interface WebSocketConfig {
  connectionId: string;
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
  data: string | Buffer;
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

// Active connections map
const connections = new Map<string, {
  ws: WebSocket;
  config: WebSocketConfig;
  state: WebSocketConnectionState;
  reconnectTimer?: NodeJS.Timeout;
}>();

/**
 * Get the main browser window for sending IPC messages
 */
function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

/**
 * Send event to renderer process
 */
function sendToRenderer(channel: string, data: unknown): void {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Update connection state and notify renderer
 */
function updateConnectionState(
  connectionId: string,
  updates: Partial<WebSocketConnectionState>
): void {
  const connection = connections.get(connectionId);
  if (connection) {
    connection.state = { ...connection.state, ...updates };
    sendToRenderer('websocket:state-change', connection.state);
  }
}

/**
 * Connect to a WebSocket server
 */
export async function connectWebSocket(config: WebSocketConfig): Promise<WebSocketConnectionState> {
  const { connectionId, url, protocols, headers, autoReconnect = true, reconnectInterval = 3000, maxReconnectAttempts = 5 } = config;

  // Close existing connection if any
  if (connections.has(connectionId)) {
    await disconnectWebSocket(connectionId);
  }

  // Initialize state
  const state: WebSocketConnectionState = {
    connectionId,
    url,
    status: 'connecting',
    reconnectAttempts: 0,
    messageCount: { sent: 0, received: 0 },
  };

  // Create WebSocket connection
  const wsOptions: WebSocket.ClientOptions = {};
  if (headers) {
    wsOptions.headers = headers;
  }

  const ws = new WebSocket(url, protocols, wsOptions);

  // Store connection
  connections.set(connectionId, {
    ws,
    config: { ...config, autoReconnect, reconnectInterval, maxReconnectAttempts },
    state,
  });

  // Send initial state
  sendToRenderer('websocket:state-change', state);

  return new Promise((resolve, reject) => {
    // Connection opened
    ws.on('open', () => {
      updateConnectionState(connectionId, {
        status: 'connected',
        connectedAt: Date.now(),
        reconnectAttempts: 0,
        error: undefined,
      });
      resolve(connections.get(connectionId)!.state);
    });

    // Message received
    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      const connection = connections.get(connectionId);
      if (connection) {
        const message: WebSocketMessage = {
          id: nanoid(),
          connectionId,
          type: 'received',
          data: isBinary ? data as Buffer : data.toString(),
          dataType: isBinary ? 'binary' : 'text',
          timestamp: Date.now(),
        };

        connection.state.messageCount.received++;
        sendToRenderer('websocket:message', message);
        sendToRenderer('websocket:state-change', connection.state);
      }
    });

    // Connection closed
    ws.on('close', (code: number, reason: Buffer) => {
      const connection = connections.get(connectionId);
      if (connection) {
        updateConnectionState(connectionId, {
          status: 'disconnected',
          disconnectedAt: Date.now(),
        });

        // Handle auto-reconnect
        if (connection.config.autoReconnect && 
            connection.state.reconnectAttempts < (connection.config.maxReconnectAttempts || 5)) {
          scheduleReconnect(connectionId);
        }
      }
    });

    // Connection error
    ws.on('error', (error: Error) => {
      const connection = connections.get(connectionId);
      if (connection) {
        updateConnectionState(connectionId, {
          status: 'error',
          error: error.message,
        });

        // Handle auto-reconnect on error
        if (connection.config.autoReconnect && 
            connection.state.reconnectAttempts < (connection.config.maxReconnectAttempts || 5)) {
          scheduleReconnect(connectionId);
        }
      }

      // Only reject if this is the initial connection attempt
      if (state.reconnectAttempts === 0) {
        reject(error);
      }
    });

    // Ping/pong for keep-alive
    ws.on('ping', (data: Buffer) => {
      ws.pong(data);
    });
  });
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect(connectionId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Clear any existing reconnect timer
  if (connection.reconnectTimer) {
    clearTimeout(connection.reconnectTimer);
  }

  const { reconnectInterval = 3000 } = connection.config;

  connection.reconnectTimer = setTimeout(async () => {
    const conn = connections.get(connectionId);
    if (!conn) return;

    conn.state.reconnectAttempts++;
    sendToRenderer('websocket:reconnecting', {
      connectionId,
      attempt: conn.state.reconnectAttempts,
      maxAttempts: conn.config.maxReconnectAttempts,
    });

    try {
      await connectWebSocket(conn.config);
    } catch (error) {
      // Error handling is done in the connect function
    }
  }, reconnectInterval);
}

/**
 * Disconnect from a WebSocket server
 */
export async function disconnectWebSocket(connectionId: string): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Clear reconnect timer
  if (connection.reconnectTimer) {
    clearTimeout(connection.reconnectTimer);
  }

  // Disable auto-reconnect for manual disconnect
  connection.config.autoReconnect = false;

  updateConnectionState(connectionId, { status: 'disconnecting' });

  return new Promise((resolve) => {
    const { ws } = connection;

    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.once('close', () => {
        connections.delete(connectionId);
        resolve();
      });
      ws.close(1000, 'Client disconnected');
    } else {
      connections.delete(connectionId);
      resolve();
    }
  });
}

/**
 * Send a message through a WebSocket connection
 */
export function sendWebSocketMessage(
  connectionId: string,
  data: string | Buffer,
  options?: { binary?: boolean }
): WebSocketMessage | null {
  const connection = connections.get(connectionId);
  if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
    return null;
  }

  const isBinary = options?.binary || Buffer.isBuffer(data);

  connection.ws.send(data, { binary: isBinary }, (error) => {
    if (error) {
      sendToRenderer('websocket:send-error', {
        connectionId,
        error: error.message,
      });
    }
  });

  const message: WebSocketMessage = {
    id: nanoid(),
    connectionId,
    type: 'sent',
    data,
    dataType: isBinary ? 'binary' : 'text',
    timestamp: Date.now(),
  };

  connection.state.messageCount.sent++;
  sendToRenderer('websocket:message', message);
  sendToRenderer('websocket:state-change', connection.state);

  return message;
}

/**
 * Get the current state of a connection
 */
export function getConnectionState(connectionId: string): WebSocketConnectionState | null {
  const connection = connections.get(connectionId);
  return connection ? connection.state : null;
}

/**
 * Get all active connections
 */
export function getAllConnections(): WebSocketConnectionState[] {
  return Array.from(connections.values()).map((c) => c.state);
}

/**
 * Close all connections
 */
export async function closeAllConnections(): Promise<void> {
  const disconnectPromises = Array.from(connections.keys()).map((id) =>
    disconnectWebSocket(id)
  );
  await Promise.all(disconnectPromises);
}

/**
 * Register IPC handlers for WebSocket operations
 */
export function registerWebSocketHandlers(): void {
  // Connect to WebSocket
  ipcMain.handle('websocket:connect', async (_event, config: WebSocketConfig) => {
    try {
      const state = await connectWebSocket(config);
      return { success: true, state };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  });

  // Disconnect from WebSocket
  ipcMain.handle('websocket:disconnect', async (_event, connectionId: string) => {
    try {
      await disconnectWebSocket(connectionId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      };
    }
  });

  // Send message
  ipcMain.handle(
    'websocket:send',
    async (_event, connectionId: string, data: string | Buffer, options?: { binary?: boolean }) => {
      const message = sendWebSocketMessage(connectionId, data, options);
      if (message) {
        return { success: true, message };
      }
      return { success: false, error: 'Connection not open' };
    }
  );

  // Get connection state
  ipcMain.handle('websocket:get-state', async (_event, connectionId: string) => {
    const state = getConnectionState(connectionId);
    return { success: true, state };
  });

  // Get all connections
  ipcMain.handle('websocket:get-all', async () => {
    const connections = getAllConnections();
    return { success: true, connections };
  });

  // Close all connections
  ipcMain.handle('websocket:close-all', async () => {
    try {
      await closeAllConnections();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close connections',
      };
    }
  });
}

/**
 * Cleanup function to be called on app quit
 */
export async function cleanupWebSocketConnections(): Promise<void> {
  await closeAllConnections();
}