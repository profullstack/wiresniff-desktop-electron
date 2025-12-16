/**
 * Enhanced WebSocket Service
 *
 * Advanced WebSocket client with message history, saved streams,
 * GraphQL subscription support, and export capabilities.
 */

import { v4 as uuidv4 } from 'uuid';

// Types
export interface ConnectionConfig {
  url: string;
  protocols?: string[];
  headers?: Record<string, string>;
  timeout?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  maxHistorySize?: number;
}

export interface WebSocketConnection {
  id: string;
  url: string;
  protocols?: string[];
  status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting';
  connectedAt?: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  config: ConnectionConfig;
}

export interface WebSocketMessage {
  id: string;
  connectionId: string;
  timestamp: Date;
  direction: 'sent' | 'received';
  data: string | ArrayBuffer;
  isBinary: boolean;
  parsedJson?: unknown;
  size: number;
}

export interface MessageFilter {
  direction?: 'sent' | 'received';
  searchQuery?: string;
  startTime?: Date;
  endTime?: Date;
  isBinary?: boolean;
}

export interface SavedStream {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  connectionConfig: ConnectionConfig;
  messages: WebSocketMessage[];
  tags?: string[];
}

export interface ConnectionStats {
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  connectedDuration: number;
  lastPingLatency?: number;
}

export interface GraphQLSubscription {
  id: string;
  connectionId: string;
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface HarLog {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: { name: string; value: string }[];
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: { name: string; value: string }[];
    content: { size: number; mimeType: string; text?: string };
    bodySize: number;
  };
}

export class EnhancedWebSocketService {
  private connections: Map<string, WebSocketConnection> = new Map();
  private sockets: Map<string, WebSocket> = new Map();
  private messageHistory: Map<string, WebSocketMessage[]> = new Map();
  private messageListeners: Map<string, Set<(msg: WebSocketMessage) => void>> = new Map();
  private savedStreams: Map<string, SavedStream> = new Map();
  private stats: Map<string, ConnectionStats> = new Map();
  private subscriptions: Map<string, GraphQLSubscription> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pingPromises: Map<string, { resolve: (latency: number) => void; timestamp: number }> = new Map();

  /**
   * Connect to a WebSocket server
   */
  async connect(config: ConnectionConfig): Promise<WebSocketConnection> {
    const connectionId = uuidv4();
    const timeout = config.timeout || 30000;

    const connection: WebSocketConnection = {
      id: connectionId,
      url: config.url,
      protocols: config.protocols,
      status: 'connecting',
      reconnectAttempts: 0,
      config,
    };

    this.connections.set(connectionId, connection);
    this.messageHistory.set(connectionId, []);
    this.messageListeners.set(connectionId, new Set());
    this.stats.set(connectionId, {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      connectedDuration: 0,
    });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.cleanupConnection(connectionId);
      }, timeout);

      try {
        const ws = new WebSocket(config.url, config.protocols);
        this.sockets.set(connectionId, ws);

        ws.onopen = () => {
          clearTimeout(timeoutId);
          connection.status = 'connected';
          connection.connectedAt = new Date();
          connection.reconnectAttempts = 0;
          resolve(connection);
        };

        ws.onerror = (event) => {
          clearTimeout(timeoutId);
          if (connection.status === 'connecting') {
            reject(new Error('WebSocket connection failed'));
            this.cleanupConnection(connectionId);
          }
        };

        ws.onclose = (event) => {
          connection.status = 'disconnected';
          connection.disconnectedAt = new Date();

          // Handle auto-reconnect
          if (config.autoReconnect && event.code !== 1000) {
            this.attemptReconnect(connectionId);
          }
        };

        ws.onmessage = (event) => {
          this.handleMessage(connectionId, event);
        };
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
        this.cleanupConnection(connectionId);
      }
    });
  }

  /**
   * Disconnect from a WebSocket server
   */
  async disconnect(connectionId: string, code?: number, reason?: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const ws = this.sockets.get(connectionId);
    if (ws) {
      connection.status = 'disconnecting';
      ws.close(code || 1000, reason);
    }

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(connectionId);
    }
  }

  /**
   * Send a message
   */
  async send(connectionId: string, data: string | ArrayBuffer): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const ws = this.sockets.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection is not open');
    }

    ws.send(data);

    // Record message
    const message: WebSocketMessage = {
      id: uuidv4(),
      connectionId,
      timestamp: new Date(),
      direction: 'sent',
      data,
      isBinary: data instanceof ArrayBuffer,
      size: typeof data === 'string' ? data.length : data.byteLength,
    };

    // Try to parse JSON
    if (typeof data === 'string') {
      try {
        message.parsedJson = JSON.parse(data);
      } catch {
        // Not JSON
      }
    }

    this.addToHistory(connectionId, message);

    // Update stats
    const stats = this.stats.get(connectionId);
    if (stats) {
      stats.messagesSent++;
      stats.bytesSent += message.size;
    }
  }

  /**
   * Send JSON data
   */
  async sendJson(connectionId: string, data: unknown): Promise<void> {
    await this.send(connectionId, JSON.stringify(data));
  }

  /**
   * Register message listener
   */
  onMessage(connectionId: string, callback: (msg: WebSocketMessage) => void): () => void {
    const listeners = this.messageListeners.get(connectionId);
    if (listeners) {
      listeners.add(callback);
    }

    // Return unsubscribe function
    return () => {
      listeners?.delete(callback);
    };
  }

  /**
   * Get message history
   */
  getMessageHistory(connectionId: string, filter?: MessageFilter): WebSocketMessage[] {
    let history = this.messageHistory.get(connectionId) || [];

    if (filter) {
      if (filter.direction) {
        history = history.filter((m) => m.direction === filter.direction);
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        history = history.filter((m) => {
          if (typeof m.data === 'string') {
            return m.data.toLowerCase().includes(query);
          }
          return false;
        });
      }
      if (filter.startTime) {
        history = history.filter((m) => m.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        history = history.filter((m) => m.timestamp <= filter.endTime!);
      }
      if (filter.isBinary !== undefined) {
        history = history.filter((m) => m.isBinary === filter.isBinary);
      }
    }

    return history;
  }

  /**
   * Clear message history
   */
  clearHistory(connectionId: string): void {
    this.messageHistory.set(connectionId, []);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(connectionId: string): ConnectionStats | undefined {
    const stats = this.stats.get(connectionId);
    if (stats) {
      const connection = this.connections.get(connectionId);
      if (connection?.connectedAt) {
        stats.connectedDuration = Date.now() - connection.connectedAt.getTime();
      }
    }
    return stats;
  }

  /**
   * Save current stream
   */
  async saveStream(connectionId: string, name: string, description?: string): Promise<SavedStream> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const messages = this.messageHistory.get(connectionId) || [];

    const savedStream: SavedStream = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date(),
      connectionConfig: connection.config,
      messages: [...messages],
    };

    this.savedStreams.set(savedStream.id, savedStream);
    return savedStream;
  }

  /**
   * Get all saved streams
   */
  getSavedStreams(): SavedStream[] {
    return Array.from(this.savedStreams.values());
  }

  /**
   * Load a saved stream
   */
  loadStream(streamId: string): SavedStream | undefined {
    return this.savedStreams.get(streamId);
  }

  /**
   * Delete a saved stream
   */
  deleteStream(streamId: string): void {
    this.savedStreams.delete(streamId);
  }

  /**
   * Replay saved stream messages
   */
  async replayStream(streamId: string, connectionId: string, delay = 0): Promise<void> {
    const stream = this.savedStreams.get(streamId);
    if (!stream) {
      throw new Error('Stream not found');
    }

    const sentMessages = stream.messages.filter((m) => m.direction === 'sent');

    for (const message of sentMessages) {
      await this.send(connectionId, message.data);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Send ping and measure latency
   */
  async ping(connectionId: string): Promise<number> {
    const pingId = uuidv4();
    const timestamp = Date.now();

    return new Promise((resolve, reject) => {
      this.pingPromises.set(pingId, { resolve, timestamp });

      // Send ping message
      this.sendJson(connectionId, { type: 'ping', id: pingId, timestamp }).catch(reject);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pingPromises.has(pingId)) {
          this.pingPromises.delete(pingId);
          reject(new Error('Ping timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Subscribe to GraphQL operation
   */
  async subscribeGraphQL(
    connectionId: string,
    options: { query: string; variables?: Record<string, unknown>; operationName?: string }
  ): Promise<GraphQLSubscription> {
    const subscriptionId = uuidv4();

    const subscription: GraphQLSubscription = {
      id: subscriptionId,
      connectionId,
      query: options.query,
      variables: options.variables,
      operationName: options.operationName,
    };

    // Send subscribe message (graphql-ws protocol)
    await this.sendJson(connectionId, {
      id: subscriptionId,
      type: 'subscribe',
      payload: {
        query: options.query,
        variables: options.variables,
        operationName: options.operationName,
      },
    });

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  /**
   * Unsubscribe from GraphQL operation
   */
  async unsubscribeGraphQL(connectionId: string, subscriptionId: string): Promise<void> {
    await this.sendJson(connectionId, {
      id: subscriptionId,
      type: 'complete',
    });

    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Export connection history as HAR format
   */
  exportAsHar(connectionId: string): HarLog {
    const messages = this.messageHistory.get(connectionId) || [];
    const connection = this.connections.get(connectionId);

    const entries: HarEntry[] = messages.map((msg) => ({
      startedDateTime: msg.timestamp.toISOString(),
      time: 0,
      request: {
        method: msg.direction === 'sent' ? 'SEND' : 'RECEIVE',
        url: connection?.url || '',
        httpVersion: 'WebSocket',
        headers: [],
        bodySize: msg.size,
      },
      response: {
        status: 0,
        statusText: '',
        httpVersion: 'WebSocket',
        headers: [],
        content: {
          size: msg.size,
          mimeType: msg.isBinary ? 'application/octet-stream' : 'text/plain',
          text: typeof msg.data === 'string' ? msg.data : undefined,
        },
        bodySize: msg.size,
      },
    }));

    return {
      log: {
        version: '1.2',
        creator: { name: 'WireSniff', version: '1.0.0' },
        entries,
      },
    };
  }

  /**
   * Export messages as JSON
   */
  exportAsJson(connectionId: string): string {
    const messages = this.messageHistory.get(connectionId) || [];
    const connection = this.connections.get(connectionId);

    return JSON.stringify(
      {
        connectionUrl: connection?.url,
        exportedAt: new Date().toISOString(),
        messages: messages.map((m) => ({
          id: m.id,
          timestamp: m.timestamp.toISOString(),
          direction: m.direction,
          data: typeof m.data === 'string' ? m.data : '[Binary Data]',
          isBinary: m.isBinary,
          size: m.size,
        })),
      },
      null,
      2
    );
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, event: MessageEvent): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      connectionId,
      timestamp: new Date(),
      direction: 'received',
      data: event.data,
      isBinary: event.data instanceof ArrayBuffer,
      size: typeof event.data === 'string' ? event.data.length : event.data.byteLength,
    };

    // Try to parse JSON
    if (typeof event.data === 'string') {
      try {
        message.parsedJson = JSON.parse(event.data);

        // Check for pong response
        if (message.parsedJson && typeof message.parsedJson === 'object') {
          const parsed = message.parsedJson as Record<string, unknown>;
          if (parsed.type === 'pong' && parsed.id) {
            const pingPromise = this.pingPromises.get(parsed.id as string);
            if (pingPromise) {
              const latency = Date.now() - pingPromise.timestamp;
              pingPromise.resolve(latency);
              this.pingPromises.delete(parsed.id as string);

              // Update stats
              const stats = this.stats.get(connectionId);
              if (stats) {
                stats.lastPingLatency = latency;
              }
            }
          }
        }
      } catch {
        // Not JSON
      }
    }

    this.addToHistory(connectionId, message);

    // Update stats
    const stats = this.stats.get(connectionId);
    if (stats) {
      stats.messagesReceived++;
      stats.bytesReceived += message.size;
    }

    // Notify listeners
    const listeners = this.messageListeners.get(connectionId);
    if (listeners) {
      listeners.forEach((callback) => callback(message));
    }
  }

  /**
   * Add message to history
   */
  private addToHistory(connectionId: string, message: WebSocketMessage): void {
    const history = this.messageHistory.get(connectionId) || [];
    const connection = this.connections.get(connectionId);
    const maxSize = connection?.config.maxHistorySize || 1000;

    history.push(message);

    // Trim if exceeds max size
    if (history.length > maxSize) {
      history.splice(0, history.length - maxSize);
    }

    this.messageHistory.set(connectionId, history);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const maxAttempts = connection.config.maxReconnectAttempts || 5;
    const interval = connection.config.reconnectInterval || 1000;

    if (connection.reconnectAttempts >= maxAttempts) {
      return;
    }

    connection.status = 'reconnecting';
    connection.reconnectAttempts++;

    const timer = setTimeout(async () => {
      try {
        const ws = new WebSocket(connection.url, connection.protocols);
        this.sockets.set(connectionId, ws);

        ws.onopen = () => {
          connection.status = 'connected';
          connection.connectedAt = new Date();
          connection.reconnectAttempts = 0;
        };

        ws.onerror = () => {
          this.attemptReconnect(connectionId);
        };

        ws.onclose = (event) => {
          connection.status = 'disconnected';
          if (connection.config.autoReconnect && event.code !== 1000) {
            this.attemptReconnect(connectionId);
          }
        };

        ws.onmessage = (event) => {
          this.handleMessage(connectionId, event);
        };
      } catch {
        this.attemptReconnect(connectionId);
      }
    }, interval * connection.reconnectAttempts);

    this.reconnectTimers.set(connectionId, timer);
  }

  /**
   * Cleanup connection resources
   */
  private cleanupConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    this.sockets.delete(connectionId);
    this.messageHistory.delete(connectionId);
    this.messageListeners.delete(connectionId);
    this.stats.delete(connectionId);

    const timer = this.reconnectTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(connectionId);
    }
  }
}

export default EnhancedWebSocketService;