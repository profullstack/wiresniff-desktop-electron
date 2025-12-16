/**
 * Raw TCP Client Service Tests
 *
 * Tests for raw TCP socket functionality for advanced network debugging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TcpClientService, createTcpClientService } from './tcpClient';
import { EventEmitter } from 'events';

// Mock Socket class
class MockSocket extends EventEmitter {
  connecting = false;
  destroyed = false;
  remoteAddress = '127.0.0.1';
  remotePort = 8080;
  localAddress = '127.0.0.1';
  localPort = 54321;
  bytesRead = 0;
  bytesWritten = 0;

  connect = vi.fn((port: number, host: string, callback?: () => void) => {
    this.connecting = true;
    setTimeout(() => {
      this.connecting = false;
      this.emit('connect');
      if (callback) callback();
    }, 10);
    return this;
  });

  write = vi.fn((data: Buffer | string, callback?: (err?: Error) => void) => {
    const bytes = typeof data === 'string' ? Buffer.from(data).length : data.length;
    this.bytesWritten += bytes;
    if (callback) callback();
    return true;
  });

  end = vi.fn((data?: Buffer | string, callback?: () => void) => {
    if (callback) callback();
    this.emit('end');
    return this;
  });

  destroy = vi.fn((error?: Error) => {
    this.destroyed = true;
    if (error) {
      this.emit('error', error);
    }
    this.emit('close', !!error);
    return this;
  });

  setEncoding = vi.fn();
  setTimeout = vi.fn();
  setNoDelay = vi.fn();
  setKeepAlive = vi.fn();
  ref = vi.fn();
  unref = vi.fn();

  // Helper to simulate receiving data
  simulateData(data: Buffer | string) {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    this.bytesRead += buffer.length;
    this.emit('data', buffer);
  }

  // Helper to simulate error
  simulateError(error: Error) {
    this.emit('error', error);
  }

  // Helper to simulate close
  simulateClose(hadError = false) {
    this.emit('close', hadError);
  }
}

// Store reference to created mock sockets
let lastMockSocket: MockSocket | null = null;

// Mock net module factory
const createMockNet = () => ({
  Socket: vi.fn(() => {
    lastMockSocket = new MockSocket();
    return lastMockSocket;
  }),
  createConnection: vi.fn((options: { host: string; port: number }, callback?: () => void) => {
    lastMockSocket = new MockSocket();
    setTimeout(() => {
      lastMockSocket?.emit('connect');
      if (callback) callback();
    }, 10);
    return lastMockSocket;
  }),
});

describe('TcpClientService', () => {
  let service: TcpClientService;
  let mockNet: ReturnType<typeof createMockNet>;

  beforeEach(() => {
    mockNet = createMockNet();
    service = createTcpClientService(mockNet);
    lastMockSocket = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('should establish TCP connection', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.host).toBe('127.0.0.1');
      expect(connection.port).toBe(8080);
      expect(connection.status).toBe('connected');
    });

    it('should connect with custom options', async () => {
      const connection = await service.connect({
        host: 'example.com',
        port: 443,
        timeout: 5000,
        keepAlive: true,
        noDelay: true,
      });

      expect(connection.host).toBe('example.com');
      expect(connection.port).toBe(443);
      expect(lastMockSocket?.setTimeout).toHaveBeenCalledWith(5000);
      expect(lastMockSocket?.setKeepAlive).toHaveBeenCalledWith(true);
      expect(lastMockSocket?.setNoDelay).toHaveBeenCalledWith(true);
    });

    it('should handle connection timeout', async () => {
      // Override connect to simulate timeout - connection still succeeds but timeout event fires
      mockNet.Socket = vi.fn(() => {
        const socket = new MockSocket();
        const originalConnect = socket.connect;
        socket.connect = vi.fn((port: number, host: string, callback?: () => void) => {
          // First emit connect, then timeout
          setTimeout(() => {
            socket.emit('connect');
            if (callback) callback();
          }, 5);
          setTimeout(() => {
            socket.emit('timeout');
          }, 20);
          return socket;
        });
        lastMockSocket = socket;
        return socket;
      });

      service = createTcpClientService(mockNet);

      const connection = await service.connect({
        host: 'slow.example.com',
        port: 8080,
        timeout: 50,
      });

      // Connection should be created
      expect(connection).toBeDefined();
      expect(connection.status).toBe('connected');
    });

    it('should handle connection error during connect', async () => {
      mockNet.Socket = vi.fn(() => {
        const socket = new MockSocket();
        socket.connect = vi.fn(() => {
          // Emit error before connect - this should reject the promise
          setTimeout(() => {
            socket.emit('error', new Error('Connection refused'));
          }, 5);
          return socket;
        });
        lastMockSocket = socket;
        return socket;
      });

      service = createTcpClientService(mockNet);

      // The service should reject with the error
      try {
        await service.connect({
          host: 'unreachable.example.com',
          port: 8080,
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toBe('Connection refused');
      }
    });
  });

  describe('disconnect', () => {
    it('should close TCP connection', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.disconnect(connection.id);

      const updatedConnection = service.getConnection(connection.id);
      expect(updatedConnection?.status).toBe('disconnected');
    });

    it('should throw error for non-existent connection', async () => {
      await expect(service.disconnect('non-existent')).rejects.toThrow(
        'Connection not found'
      );
    });
  });

  describe('send', () => {
    it('should send string data', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Hello, TCP!');

      expect(lastMockSocket?.write).toHaveBeenCalled();
    });

    it('should send buffer data', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      await service.send(connection.id, buffer);

      expect(lastMockSocket?.write).toHaveBeenCalledWith(buffer, expect.any(Function));
    });

    it('should send hex string as binary', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.sendHex(connection.id, '48656c6c6f'); // "Hello" in hex

      expect(lastMockSocket?.write).toHaveBeenCalled();
    });

    it('should record sent data in history', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Test message');

      const history = service.getDataHistory(connection.id);
      expect(history.length).toBe(1);
      expect(history[0].direction).toBe('sent');
    });

    it('should throw error when connection is not open', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });
      await service.disconnect(connection.id);

      await expect(service.send(connection.id, 'Test')).rejects.toThrow(
        'Connection is not open'
      );
    });
  });

  describe('receive data', () => {
    it('should receive and store data', async () => {
      const receivedData: Buffer[] = [];
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      service.onData(connection.id, (data: Buffer) => {
        receivedData.push(data);
      });

      lastMockSocket?.simulateData('Hello from server');

      expect(receivedData.length).toBe(1);
      expect(receivedData[0].toString()).toBe('Hello from server');
    });

    it('should record received data in history', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      lastMockSocket?.simulateData('Response data');

      const history = service.getDataHistory(connection.id);
      expect(history.length).toBe(1);
      expect(history[0].direction).toBe('received');
    });

    it('should handle binary data', async () => {
      const receivedData: Buffer[] = [];
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      service.onData(connection.id, (data: Buffer) => {
        receivedData.push(data);
      });

      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      lastMockSocket?.simulateData(binaryData);

      expect(receivedData[0]).toEqual(binaryData);
    });
  });

  describe('data history', () => {
    it('should maintain data history', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Request 1');
      lastMockSocket?.simulateData('Response 1');
      await service.send(connection.id, 'Request 2');
      lastMockSocket?.simulateData('Response 2');

      const history = service.getDataHistory(connection.id);
      expect(history.length).toBe(4);
    });

    it('should limit history size', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
        maxHistorySize: 5,
      });

      for (let i = 0; i < 10; i++) {
        await service.send(connection.id, `Message ${i}`);
      }

      const history = service.getDataHistory(connection.id);
      expect(history.length).toBe(5);
    });

    it('should clear data history', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Test');
      service.clearHistory(connection.id);

      const history = service.getDataHistory(connection.id);
      expect(history.length).toBe(0);
    });

    it('should filter history by direction', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Sent 1');
      lastMockSocket?.simulateData('Received 1');
      await service.send(connection.id, 'Sent 2');

      const sentOnly = service.getDataHistory(connection.id, { direction: 'sent' });
      expect(sentOnly.length).toBe(2);
      expect(sentOnly.every((d: { direction: string }) => d.direction === 'sent')).toBe(true);
    });
  });

  describe('connection management', () => {
    it('should list all connections', async () => {
      await service.connect({ host: '127.0.0.1', port: 8080 });
      await service.connect({ host: '127.0.0.1', port: 8081 });

      const connections = service.getConnections();
      expect(connections.length).toBe(2);
    });

    it('should get connection by ID', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      const retrieved = service.getConnection(connection.id);
      expect(retrieved?.id).toBe(connection.id);
    });

    it('should track connection statistics', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Test message');
      lastMockSocket?.simulateData('Response');

      const stats = service.getConnectionStats(connection.id);
      expect(stats?.bytesSent).toBeGreaterThan(0);
      expect(stats?.bytesReceived).toBeGreaterThan(0);
    });
  });

  describe('data formatting', () => {
    it('should format data as hex', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      lastMockSocket?.simulateData(Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]));

      const history = service.getDataHistory(connection.id);
      const hexFormatted = service.formatAsHex(history[0].data);

      expect(hexFormatted).toBe('48 65 6c 6c 6f');
    });

    it('should format data as ASCII', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      lastMockSocket?.simulateData('Hello');

      const history = service.getDataHistory(connection.id);
      const asciiFormatted = service.formatAsAscii(history[0].data);

      expect(asciiFormatted).toBe('Hello');
    });

    it('should format data as hex dump', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      lastMockSocket?.simulateData('Hello, World!');

      const history = service.getDataHistory(connection.id);
      const hexDump = service.formatAsHexDump(history[0].data);

      expect(hexDump).toContain('48 65 6c 6c 6f');
      expect(hexDump).toContain('Hello');
    });
  });

  describe('saved sessions', () => {
    it('should save connection session', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Request');
      lastMockSocket?.simulateData('Response');

      const session = await service.saveSession(connection.id, 'Test Session');

      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.data.length).toBe(2);
    });

    it('should list saved sessions', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.saveSession(connection.id, 'Session 1');
      await service.saveSession(connection.id, 'Session 2');

      const sessions = service.getSavedSessions();
      expect(sessions.length).toBe(2);
    });

    it('should load saved session', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Test');
      const session = await service.saveSession(connection.id, 'Test Session');

      const loaded = service.loadSession(session.id);
      expect(loaded).toBeDefined();
      expect(loaded?.data.length).toBe(1);
    });

    it('should replay saved session', async () => {
      const connection1 = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection1.id, 'Message 1');
      await service.send(connection1.id, 'Message 2');

      const session = await service.saveSession(connection1.id, 'Replay Test');

      // Create new connection for replay
      const connection2 = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.replaySession(session.id, connection2.id);

      // Should have sent the same messages
      expect(lastMockSocket?.write).toHaveBeenCalled();
    });
  });

  describe('export/import', () => {
    it('should export session as pcap-like format', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Test');
      lastMockSocket?.simulateData('Response');

      const exported = service.exportSession(connection.id);

      expect(exported.connection).toBeDefined();
      expect(exported.data.length).toBe(2);
    });

    it('should export as JSON', async () => {
      const connection = await service.connect({
        host: '127.0.0.1',
        port: 8080,
      });

      await service.send(connection.id, 'Test');

      const json = service.exportAsJson(connection.id);
      const parsed = JSON.parse(json);

      expect(parsed.host).toBe('127.0.0.1');
      expect(parsed.port).toBe(8080);
      expect(parsed.data.length).toBe(1);
    });
  });
});