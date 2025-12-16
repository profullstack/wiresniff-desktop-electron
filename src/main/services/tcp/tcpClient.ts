/**
 * Raw TCP Client Service
 *
 * Provides raw TCP socket functionality for advanced network debugging.
 * Uses dependency injection for testability.
 */

import { Socket } from 'net';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Types
export interface TcpConnectionConfig {
  host: string;
  port: number;
  timeout?: number;
  keepAlive?: boolean;
  noDelay?: boolean;
  maxHistorySize?: number;
}

export interface TcpConnection {
  id: string;
  host: string;
  port: number;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
  config: TcpConnectionConfig;
}

export interface DataEntry {
  id: string;
  direction: 'sent' | 'received';
  data: Buffer;
  timestamp: Date;
  size: number;
}

export interface DataFilter {
  direction?: 'sent' | 'received';
  startTime?: Date;
  endTime?: Date;
}

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  connectedAt?: Date;
  duration?: number;
}

export interface SavedSession {
  id: string;
  name: string;
  host: string;
  port: number;
  data: DataEntry[];
  createdAt: Date;
}

export interface ExportedSession {
  connection: {
    host: string;
    port: number;
    connectedAt?: Date;
  };
  data: Array<{
    direction: string;
    data: string;
    timestamp: string;
    size: number;
  }>;
}

// Net module interface for dependency injection
export interface NetModule {
  Socket: new () => Socket;
  createConnection?: (options: { host: string; port: number }, callback?: () => void) => Socket;
}

/**
 * TCP Client Service
 */
export class TcpClientService extends EventEmitter {
  private connections: Map<string, TcpConnection> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private dataHistory: Map<string, DataEntry[]> = new Map();
  private savedSessions: Map<string, SavedSession> = new Map();
  private stats: Map<string, ConnectionStats> = new Map();
  private dataListeners: Map<string, ((data: Buffer) => void)[]> = new Map();
  private netModule: NetModule;

  constructor(netModule?: NetModule) {
    super();
    // Use provided net module or default to Node.js net
    this.netModule = netModule || { Socket };
  }

  /**
   * Connect to TCP server
   */
  async connect(config: TcpConnectionConfig): Promise<TcpConnection> {
    const id = uuidv4();
    const socket = new this.netModule.Socket();

    const connection: TcpConnection = {
      id,
      host: config.host,
      port: config.port,
      status: 'connecting',
      config,
    };

    this.connections.set(id, connection);
    this.sockets.set(id, socket);
    this.dataHistory.set(id, []);
    this.dataListeners.set(id, []);
    this.stats.set(id, {
      bytesSent: 0,
      bytesReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
    });

    return new Promise((resolve, reject) => {
      // Set up event handlers
      socket.on('connect', () => {
        connection.status = 'connected';
        connection.connectedAt = new Date();
        const stats = this.stats.get(id);
        if (stats) {
          stats.connectedAt = connection.connectedAt;
        }
        this.connections.set(id, connection);
        resolve(connection);
      });

      socket.on('data', (data: Buffer) => {
        this.handleData(id, data);
      });

      socket.on('error', (error: Error) => {
        connection.status = 'error';
        this.connections.set(id, connection);
        if (connection.status === 'connecting') {
          reject(error);
        }
        this.emit('error', { connectionId: id, error });
      });

      socket.on('close', (hadError: boolean) => {
        connection.status = 'disconnected';
        this.connections.set(id, connection);
        this.emit('close', { connectionId: id, hadError });
      });

      socket.on('timeout', () => {
        this.emit('timeout', { connectionId: id });
      });

      // Apply options
      if (config.timeout) {
        socket.setTimeout(config.timeout);
      }
      if (config.keepAlive !== undefined) {
        socket.setKeepAlive(config.keepAlive);
      }
      if (config.noDelay !== undefined) {
        socket.setNoDelay(config.noDelay);
      }

      // Connect
      socket.connect(config.port, config.host);
    });
  }

  /**
   * Handle received data
   */
  private handleData(connectionId: string, data: Buffer): void {
    const entry: DataEntry = {
      id: uuidv4(),
      direction: 'received',
      data,
      timestamp: new Date(),
      size: data.length,
    };

    // Add to history
    const history = this.dataHistory.get(connectionId) || [];
    const config = this.connections.get(connectionId)?.config;
    const maxSize = config?.maxHistorySize || 1000;

    history.push(entry);
    if (history.length > maxSize) {
      history.shift();
    }
    this.dataHistory.set(connectionId, history);

    // Update stats
    const stats = this.stats.get(connectionId);
    if (stats) {
      stats.bytesReceived += data.length;
      stats.messagesReceived++;
    }

    // Notify listeners
    const listeners = this.dataListeners.get(connectionId) || [];
    for (const listener of listeners) {
      listener(data);
    }

    this.emit('data', { connectionId, data });
  }

  /**
   * Disconnect from TCP server
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const socket = this.sockets.get(connectionId);
    if (socket) {
      socket.destroy();
    }

    connection.status = 'disconnected';
    this.connections.set(connectionId, connection);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): TcpConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getConnections(): TcpConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Send data
   */
  async send(connectionId: string, data: string | Buffer): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not open');
    }

    const socket = this.sockets.get(connectionId);
    if (!socket) {
      throw new Error('Socket not found');
    }

    const buffer = typeof data === 'string' ? Buffer.from(data) : data;

    return new Promise((resolve, reject) => {
      socket.write(buffer, (error) => {
        if (error) {
          reject(error);
          return;
        }

        // Record in history
        const entry: DataEntry = {
          id: uuidv4(),
          direction: 'sent',
          data: buffer,
          timestamp: new Date(),
          size: buffer.length,
        };

        const history = this.dataHistory.get(connectionId) || [];
        const config = connection.config;
        const maxSize = config?.maxHistorySize || 1000;

        history.push(entry);
        if (history.length > maxSize) {
          history.shift();
        }
        this.dataHistory.set(connectionId, history);

        // Update stats
        const stats = this.stats.get(connectionId);
        if (stats) {
          stats.bytesSent += buffer.length;
          stats.messagesSent++;
        }

        resolve();
      });
    });
  }

  /**
   * Send hex string as binary data
   */
  async sendHex(connectionId: string, hexString: string): Promise<void> {
    const cleanHex = hexString.replace(/\s/g, '');
    const buffer = Buffer.from(cleanHex, 'hex');
    return this.send(connectionId, buffer);
  }

  /**
   * Register data listener
   */
  onData(connectionId: string, callback: (data: Buffer) => void): void {
    const listeners = this.dataListeners.get(connectionId) || [];
    listeners.push(callback);
    this.dataListeners.set(connectionId, listeners);
  }

  /**
   * Get data history
   */
  getDataHistory(connectionId: string, filter?: DataFilter): DataEntry[] {
    let history = this.dataHistory.get(connectionId) || [];

    if (filter) {
      if (filter.direction) {
        history = history.filter((e) => e.direction === filter.direction);
      }
      if (filter.startTime) {
        history = history.filter((e) => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        history = history.filter((e) => e.timestamp <= filter.endTime!);
      }
    }

    return history;
  }

  /**
   * Clear data history
   */
  clearHistory(connectionId: string): void {
    this.dataHistory.set(connectionId, []);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(connectionId: string): ConnectionStats | undefined {
    const stats = this.stats.get(connectionId);
    if (stats && stats.connectedAt) {
      stats.duration = Date.now() - stats.connectedAt.getTime();
    }
    return stats;
  }

  /**
   * Format data as hex string
   */
  formatAsHex(data: Buffer): string {
    return Array.from(data)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  }

  /**
   * Format data as ASCII string
   */
  formatAsAscii(data: Buffer): string {
    return data.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
  }

  /**
   * Format data as hex dump (hex + ASCII)
   */
  formatAsHexDump(data: Buffer, bytesPerLine = 16): string {
    const lines: string[] = [];

    for (let i = 0; i < data.length; i += bytesPerLine) {
      const slice = data.slice(i, i + bytesPerLine);
      const hex = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(bytesPerLine * 3 - 1, ' ');
      const ascii = Array.from(slice)
        .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
        .join('');
      const offset = i.toString(16).padStart(8, '0');
      lines.push(`${offset}  ${hex}  ${ascii}`);
    }

    return lines.join('\n');
  }

  /**
   * Save connection session
   */
  async saveSession(connectionId: string, name: string): Promise<SavedSession> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const history = this.dataHistory.get(connectionId) || [];

    const session: SavedSession = {
      id: uuidv4(),
      name,
      host: connection.host,
      port: connection.port,
      data: [...history],
      createdAt: new Date(),
    };

    this.savedSessions.set(session.id, session);
    return session;
  }

  /**
   * Get saved sessions
   */
  getSavedSessions(): SavedSession[] {
    return Array.from(this.savedSessions.values());
  }

  /**
   * Load saved session
   */
  loadSession(sessionId: string): SavedSession | undefined {
    return this.savedSessions.get(sessionId);
  }

  /**
   * Delete saved session
   */
  deleteSession(sessionId: string): void {
    this.savedSessions.delete(sessionId);
  }

  /**
   * Replay saved session
   */
  async replaySession(sessionId: string, connectionId: string): Promise<void> {
    const session = this.savedSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not open');
    }

    // Replay only sent messages
    const sentMessages = session.data.filter((d) => d.direction === 'sent');

    for (const entry of sentMessages) {
      await this.send(connectionId, entry.data);
    }
  }

  /**
   * Export session data
   */
  exportSession(connectionId: string): ExportedSession {
    const connection = this.connections.get(connectionId);
    const history = this.dataHistory.get(connectionId) || [];

    return {
      connection: {
        host: connection?.host || '',
        port: connection?.port || 0,
        connectedAt: connection?.connectedAt,
      },
      data: history.map((entry) => ({
        direction: entry.direction,
        data: entry.data.toString('base64'),
        timestamp: entry.timestamp.toISOString(),
        size: entry.size,
      })),
    };
  }

  /**
   * Export as JSON
   */
  exportAsJson(connectionId: string): string {
    const connection = this.connections.get(connectionId);
    const history = this.dataHistory.get(connectionId) || [];

    return JSON.stringify(
      {
        host: connection?.host,
        port: connection?.port,
        connectedAt: connection?.connectedAt?.toISOString(),
        data: history.map((entry) => ({
          direction: entry.direction,
          data: entry.data.toString('base64'),
          hex: this.formatAsHex(entry.data),
          ascii: this.formatAsAscii(entry.data),
          timestamp: entry.timestamp.toISOString(),
          size: entry.size,
        })),
      },
      null,
      2
    );
  }
}

/**
 * Factory function for creating TCP client service with dependency injection
 */
export function createTcpClientService(netModule?: NetModule): TcpClientService {
  return new TcpClientService(netModule);
}

// Export singleton instance using default net module
export const tcpClient = new TcpClientService();