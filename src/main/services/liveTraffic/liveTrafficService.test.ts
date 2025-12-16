/**
 * Live Traffic Service Tests
 *
 * Tests for real-time traffic streaming functionality including:
 * - Starting/stopping traffic capture
 * - Filtering by domain, method, headers
 * - Event-based traffic streaming
 * - Session management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  LiveTrafficService,
  TrafficFilter,
  TrafficEvent,
} from './liveTrafficService';

describe('LiveTrafficService', () => {
  let liveTrafficService: LiveTrafficService;
  let mockProcess: {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    pid: number;
  };
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock process
    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { write: vi.fn() },
      kill: vi.fn(),
      on: vi.fn(),
      pid: 12345,
    };

    // Create mock spawn function
    mockSpawn = vi.fn().mockReturnValue(mockProcess);

    // Inject mock spawn into service via constructor
    liveTrafficService = new LiveTrafficService(mockSpawn as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startCapture', () => {
    it('should start traffic capture with default options', async () => {
      const session = await liveTrafficService.startCapture();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.startedAt).toBeDefined();
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should start capture with custom interface', async () => {
      const session = await liveTrafficService.startCapture({
        interface: 'eth0',
      });

      expect(session.config.interface).toBe('eth0');
    });

    it('should start capture with port filter', async () => {
      const session = await liveTrafficService.startCapture({
        ports: [80, 443, 8080],
      });

      expect(session.config.ports).toEqual([80, 443, 8080]);
    });

    it('should emit traffic events when packets are captured', async () => {
      const events: TrafficEvent[] = [];
      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture();

      // Simulate tshark JSON output
      const packetData = JSON.stringify({
        _source: {
          layers: {
            frame: {
              'frame.time_epoch': '1702756800.123456',
              'frame.len': '1500',
            },
            ip: {
              'ip.src': '192.168.1.100',
              'ip.dst': '93.184.216.34',
            },
            tcp: {
              'tcp.srcport': '54321',
              'tcp.dstport': '443',
            },
            http: {
              'http.request.method': 'GET',
              'http.request.uri': '/api/users',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(packetData + '\n'));

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].method).toBe('GET');
      expect(events[0].host).toBe('api.example.com');
    });

    it('should throw error if capture already running', async () => {
      await liveTrafficService.startCapture();

      await expect(liveTrafficService.startCapture()).rejects.toThrow(
        'Capture session already active'
      );
    });
  });

  describe('stopCapture', () => {
    it('should stop active capture session', async () => {
      const session = await liveTrafficService.startCapture();
      const stoppedSession = await liveTrafficService.stopCapture(session.id);

      expect(stoppedSession.status).toBe('stopped');
      expect(stoppedSession.stoppedAt).toBeDefined();
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      await expect(liveTrafficService.stopCapture('non-existent')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should emit session-stopped event', async () => {
      const stoppedSessions: string[] = [];
      liveTrafficService.on('session-stopped', (sessionId: string) => {
        stoppedSessions.push(sessionId);
      });

      const session = await liveTrafficService.startCapture();
      await liveTrafficService.stopCapture(session.id);

      expect(stoppedSessions).toContain(session.id);
    });
  });

  describe('filtering', () => {
    it('should filter traffic by domain', async () => {
      const events: TrafficEvent[] = [];
      const filter: TrafficFilter = {
        domains: ['api.example.com'],
      };

      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture({ filter });

      // Emit matching packet
      const matchingPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      // Emit non-matching packet
      const nonMatchingPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'other.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(matchingPacket + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(nonMatchingPacket + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].host).toBe('api.example.com');
    });

    it('should filter traffic by HTTP method', async () => {
      const events: TrafficEvent[] = [];
      const filter: TrafficFilter = {
        methods: ['POST', 'PUT'],
      };

      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture({ filter });

      // Emit POST request
      const postPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'POST',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      // Emit GET request (should be filtered out)
      const getPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(postPacket + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(getPacket + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].method).toBe('POST');
    });

    it('should filter traffic by status code', async () => {
      const events: TrafficEvent[] = [];
      const filter: TrafficFilter = {
        statusCodes: [400, 401, 403, 404, 500],
      };

      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture({ filter });

      // Emit 404 response
      const errorPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '93.184.216.34', 'ip.dst': '192.168.1.100' },
            tcp: { 'tcp.srcport': '443', 'tcp.dstport': '54321' },
            http: {
              'http.response.code': '404',
              'http.response.phrase': 'Not Found',
            },
          },
        },
      });

      // Emit 200 response (should be filtered out)
      const successPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '93.184.216.34', 'ip.dst': '192.168.1.100' },
            tcp: { 'tcp.srcport': '443', 'tcp.dstport': '54321' },
            http: {
              'http.response.code': '200',
              'http.response.phrase': 'OK',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(errorPacket + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(successPacket + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].statusCode).toBe(404);
    });

    it('should combine multiple filters with AND logic', async () => {
      const events: TrafficEvent[] = [];
      const filter: TrafficFilter = {
        domains: ['api.example.com'],
        methods: ['POST'],
      };

      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture({ filter });

      // Emit POST to api.example.com (matches both)
      const matchingPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'POST',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      // Emit GET to api.example.com (matches domain only)
      const partialMatch1 = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(matchingPacket + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(partialMatch1 + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].method).toBe('POST');
      expect(events[0].host).toBe('api.example.com');
    });
  });

  describe('updateFilter', () => {
    it('should update filter on active session', async () => {
      const session = await liveTrafficService.startCapture();

      const newFilter: TrafficFilter = {
        domains: ['new.example.com'],
      };

      const updatedSession = await liveTrafficService.updateFilter(
        session.id,
        newFilter
      );

      expect(updatedSession.config.filter?.domains).toContain('new.example.com');
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const session = await liveTrafficService.startCapture();
      const retrieved = liveTrafficService.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = liveTrafficService.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      // Stop any existing session first
      const existingSessions = liveTrafficService.getActiveSessions();
      for (const session of existingSessions) {
        await liveTrafficService.stopCapture(session.id);
      }

      const session = await liveTrafficService.startCapture();
      const activeSessions = liveTrafficService.getActiveSessions();

      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].id).toBe(session.id);
    });

    it('should not include stopped sessions', async () => {
      const session = await liveTrafficService.startCapture();
      await liveTrafficService.stopCapture(session.id);

      const activeSessions = liveTrafficService.getActiveSessions();
      expect(activeSessions.find((s: { id: string }) => s.id === session.id)).toBeUndefined();
    });
  });

  describe('getSessionStats', () => {
    it('should return traffic statistics for session', async () => {
      const session = await liveTrafficService.startCapture();

      // Emit some packets
      const packet = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456', 'frame.len': '1500' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(packet + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(packet + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(packet + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = liveTrafficService.getSessionStats(session.id);

      expect(stats).toBeDefined();
      expect(stats?.totalPackets).toBe(3);
      expect(stats?.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('pauseCapture', () => {
    it('should pause active capture', async () => {
      const session = await liveTrafficService.startCapture();
      const pausedSession = await liveTrafficService.pauseCapture(session.id);

      expect(pausedSession.status).toBe('paused');
    });

    it('should not emit events while paused', async () => {
      const events: TrafficEvent[] = [];
      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      const session = await liveTrafficService.startCapture();
      await liveTrafficService.pauseCapture(session.id);

      const packet = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(packet + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(0);
    });
  });

  describe('resumeCapture', () => {
    it('should resume paused capture', async () => {
      const session = await liveTrafficService.startCapture();
      await liveTrafficService.pauseCapture(session.id);
      const resumedSession = await liveTrafficService.resumeCapture(session.id);

      expect(resumedSession.status).toBe('active');
    });

    it('should emit events after resume', async () => {
      const events: TrafficEvent[] = [];
      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      const session = await liveTrafficService.startCapture();
      await liveTrafficService.pauseCapture(session.id);
      await liveTrafficService.resumeCapture(session.id);

      const packet = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'api.example.com',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(packet + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should emit error event on tshark failure', async () => {
      const errors: Error[] = [];
      liveTrafficService.on('error', (error: Error) => {
        errors.push(error);
      });

      await liveTrafficService.startCapture();

      mockProcess.stderr.emit('data', Buffer.from('tshark: Permission denied'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      const events: TrafficEvent[] = [];

      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture();

      // Emit malformed JSON
      mockProcess.stdout.emit('data', Buffer.from('not valid json\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not crash, events should be empty
      expect(events.length).toBe(0);
    });
  });

  describe('WebSocket traffic', () => {
    it('should capture WebSocket upgrade requests', async () => {
      const events: TrafficEvent[] = [];
      liveTrafficService.on('traffic', (event: TrafficEvent) => {
        events.push(event);
      });

      await liveTrafficService.startCapture();

      const wsPacket = JSON.stringify({
        _source: {
          layers: {
            frame: { 'frame.time_epoch': '1702756800.123456' },
            ip: { 'ip.src': '192.168.1.100', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.host': 'ws.example.com',
              'http.upgrade': 'websocket',
            },
          },
        },
      });

      mockProcess.stdout.emit('data', Buffer.from(wsPacket + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].isWebSocket).toBe(true);
    });
  });
});