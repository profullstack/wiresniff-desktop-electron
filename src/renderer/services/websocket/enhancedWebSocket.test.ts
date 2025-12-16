/**
 * Enhanced WebSocket Service Tests
 *
 * Tests for WebSocket functionality with saved streams, message history,
 * and websocat integration for advanced features.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EnhancedWebSocketService,
  WebSocketConnection,
  WebSocketMessage,
  ConnectionConfig,
  MessageFilter,
} from './enhancedWebSocket';

// Mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN; // Start as OPEN for most tests
  url: string;
  protocol: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string, protocol?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocol) ? protocol[0] : protocol || '';
    // Simulate immediate connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 5);
  }

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }));
    }
  });

  // Helper to simulate receiving a message
  simulateMessage(data: string | ArrayBuffer) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // Helper to simulate error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Store reference to created mock WebSocket
let lastMockWs: MockWebSocket | null = null;

describe('EnhancedWebSocketService', () => {
  let service: EnhancedWebSocketService;

  beforeEach(() => {
    // Mock global WebSocket
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = vi.fn((url: string, protocol?: string | string[]) => {
      lastMockWs = new MockWebSocket(url, protocol);
      return lastMockWs;
    }) as unknown as typeof MockWebSocket;
    
    // Copy static properties
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket.CONNECTING = 0;
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket.OPEN = 1;
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket.CLOSING = 2;
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket.CLOSED = 3;

    service = new EnhancedWebSocketService();
    lastMockWs = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('should establish WebSocket connection', async () => {
      const config: ConnectionConfig = {
        url: 'wss://echo.websocket.org',
      };

      const connection = await service.connect(config);

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.url).toBe('wss://echo.websocket.org');
      expect(connection.status).toBe('connected');
    });

    it('should connect with custom protocols', async () => {
      const config: ConnectionConfig = {
        url: 'wss://api.example.com/ws',
        protocols: ['graphql-ws'],
      };

      const connection = await service.connect(config);

      expect(connection.protocols).toContain('graphql-ws');
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.disconnect(connection.id);

      const updatedConnection = service.getConnection(connection.id);
      expect(updatedConnection?.status).toBe('disconnected');
    });

    it('should close with custom code and reason', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.disconnect(connection.id, 1000, 'Normal closure');

      expect(lastMockWs?.close).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should throw error for non-existent connection', async () => {
      await expect(service.disconnect('non-existent')).rejects.toThrow(
        'Connection not found'
      );
    });
  });

  describe('send', () => {
    it('should send text message', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Hello, WebSocket!');

      expect(lastMockWs?.send).toHaveBeenCalledWith('Hello, WebSocket!');
    });

    it('should send JSON message', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });
      const data = { type: 'ping', timestamp: Date.now() };

      await service.sendJson(connection.id, data);

      expect(lastMockWs?.send).toHaveBeenCalledWith(JSON.stringify(data));
    });

    it('should send binary message', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });
      const buffer = new ArrayBuffer(8);

      await service.send(connection.id, buffer);

      expect(lastMockWs?.send).toHaveBeenCalledWith(buffer);
    });

    it('should record sent message in history', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Test message');

      const history = service.getMessageHistory(connection.id);
      expect(history.length).toBe(1);
      expect(history[0].direction).toBe('sent');
      expect(history[0].data).toBe('Test message');
    });

    it('should throw error when connection is not open', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });
      await service.disconnect(connection.id);

      await expect(service.send(connection.id, 'Test')).rejects.toThrow(
        'Connection is not open'
      );
    });
  });

  describe('message handling', () => {
    it('should receive and store text messages', async () => {
      const messages: WebSocketMessage[] = [];
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      service.onMessage(connection.id, (msg: WebSocketMessage) => messages.push(msg));

      lastMockWs?.simulateMessage('Hello from server');

      expect(messages.length).toBe(1);
      expect(messages[0].data).toBe('Hello from server');
      expect(messages[0].direction).toBe('received');
    });

    it('should receive and parse JSON messages', async () => {
      const messages: WebSocketMessage[] = [];
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      service.onMessage(connection.id, (msg: WebSocketMessage) => messages.push(msg));

      const jsonData = { type: 'response', payload: { id: 1 } };
      lastMockWs?.simulateMessage(JSON.stringify(jsonData));

      expect(messages[0].parsedJson).toEqual(jsonData);
    });

    it('should handle binary messages', async () => {
      const messages: WebSocketMessage[] = [];
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      service.onMessage(connection.id, (msg: WebSocketMessage) => messages.push(msg));

      const buffer = new ArrayBuffer(8);
      lastMockWs?.simulateMessage(buffer);

      expect(messages[0].data).toBe(buffer);
      expect(messages[0].isBinary).toBe(true);
    });
  });

  describe('message history', () => {
    it('should maintain message history', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Message 1');
      await service.send(connection.id, 'Message 2');
      lastMockWs?.simulateMessage('Response 1');

      const history = service.getMessageHistory(connection.id);
      expect(history.length).toBe(3);
    });

    it('should limit history size', async () => {
      const connection = await service.connect({
        url: 'wss://echo.websocket.org',
        maxHistorySize: 5,
      });

      for (let i = 0; i < 10; i++) {
        await service.send(connection.id, `Message ${i}`);
      }

      const history = service.getMessageHistory(connection.id);
      expect(history.length).toBe(5);
    });

    it('should clear message history', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Test');
      service.clearHistory(connection.id);

      const history = service.getMessageHistory(connection.id);
      expect(history.length).toBe(0);
    });

    it('should filter message history', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Sent 1');
      lastMockWs?.simulateMessage('Received 1');
      await service.send(connection.id, 'Sent 2');
      lastMockWs?.simulateMessage('Received 2');

      const filter: MessageFilter = { direction: 'sent' };
      const filtered = service.getMessageHistory(connection.id, filter);

      expect(filtered.length).toBe(2);
      expect(filtered.every((m: WebSocketMessage) => m.direction === 'sent')).toBe(true);
    });

    it('should filter by search query', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Hello world');
      await service.send(connection.id, 'Goodbye world');
      await service.send(connection.id, 'Hello again');

      const filter: MessageFilter = { searchQuery: 'Hello' };
      const filtered = service.getMessageHistory(connection.id, filter);

      expect(filtered.length).toBe(2);
    });
  });

  describe('saved streams', () => {
    it('should save connection stream', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Message 1');
      lastMockWs?.simulateMessage('Response 1');

      const savedStream = await service.saveStream(connection.id, 'Test Stream');

      expect(savedStream.id).toBeDefined();
      expect(savedStream.name).toBe('Test Stream');
      expect(savedStream.messages.length).toBe(2);
      expect(savedStream.connectionConfig.url).toBe('wss://echo.websocket.org');
    });

    it('should list saved streams', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.saveStream(connection.id, 'Stream 1');
      await service.saveStream(connection.id, 'Stream 2');

      const streams = service.getSavedStreams();
      expect(streams.length).toBe(2);
    });

    it('should load saved stream', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });
      await service.send(connection.id, 'Test message');

      const savedStream = await service.saveStream(connection.id, 'Test Stream');
      const loaded = service.loadStream(savedStream.id);

      expect(loaded).toBeDefined();
      expect(loaded?.messages.length).toBe(1);
    });

    it('should delete saved stream', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });
      const savedStream = await service.saveStream(connection.id, 'Test Stream');

      service.deleteStream(savedStream.id);

      const streams = service.getSavedStreams();
      expect(streams.find((s: { id: string }) => s.id === savedStream.id)).toBeUndefined();
    });

    it('should replay saved stream', async () => {
      const connection1 = await service.connect({ url: 'wss://echo.websocket.org' });
      await service.send(connection1.id, 'Message 1');
      await service.send(connection1.id, 'Message 2');

      const savedStream = await service.saveStream(connection1.id, 'Replay Test');

      // Create new connection for replay
      const connection2 = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.replayStream(savedStream.id, connection2.id);

      // Should have sent the same messages
      expect(lastMockWs?.send).toHaveBeenCalledWith('Message 1');
      expect(lastMockWs?.send).toHaveBeenCalledWith('Message 2');
    });
  });

  describe('connection management', () => {
    it('should list all connections', async () => {
      await service.connect({ url: 'wss://server1.example.com' });
      await service.connect({ url: 'wss://server2.example.com' });

      const connections = service.getConnections();
      expect(connections.length).toBe(2);
    });

    it('should get connection by ID', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      const retrieved = service.getConnection(connection.id);
      expect(retrieved?.id).toBe(connection.id);
    });

    it('should track connection statistics', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Test 1');
      await service.send(connection.id, 'Test 2');
      lastMockWs?.simulateMessage('Response');

      const stats = service.getConnectionStats(connection.id);
      expect(stats?.messagesSent).toBe(2);
      expect(stats?.messagesReceived).toBe(1);
      expect(stats?.bytesSent).toBeGreaterThan(0);
    });
  });

  describe('GraphQL subscriptions', () => {
    it('should subscribe to GraphQL operation', async () => {
      const connection = await service.connect({
        url: 'wss://api.example.com/graphql',
        protocols: ['graphql-ws'],
      });

      const subscription = await service.subscribeGraphQL(connection.id, {
        query: 'subscription { messageAdded { id content } }',
        variables: {},
      });

      expect(subscription.id).toBeDefined();
      expect(lastMockWs?.send).toHaveBeenCalled();
    });

    it('should unsubscribe from GraphQL operation', async () => {
      const connection = await service.connect({
        url: 'wss://api.example.com/graphql',
        protocols: ['graphql-ws'],
      });

      const subscription = await service.subscribeGraphQL(connection.id, {
        query: 'subscription { messageAdded { id } }',
      });

      await service.unsubscribeGraphQL(connection.id, subscription.id);

      // Should have sent complete message
      expect(lastMockWs?.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"complete"')
      );
    });
  });

  describe('export/import', () => {
    it('should export connection history as HAR', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Test message');
      lastMockWs?.simulateMessage('Response');

      const har = service.exportAsHar(connection.id);

      expect(har.log.entries.length).toBeGreaterThan(0);
      expect(har.log.creator.name).toBe('WireSniff');
    });

    it('should export messages as JSON', async () => {
      const connection = await service.connect({ url: 'wss://echo.websocket.org' });

      await service.send(connection.id, 'Message 1');
      await service.send(connection.id, 'Message 2');

      const json = service.exportAsJson(connection.id);
      const parsed = JSON.parse(json);

      expect(parsed.messages.length).toBe(2);
      expect(parsed.connectionUrl).toBe('wss://echo.websocket.org');
    });
  });
});