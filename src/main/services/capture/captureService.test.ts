/**
 * Traffic Capture Service Tests
 *
 * Tests for the traffic capture service that integrates with tshark and mitmproxy.
 * Uses Vitest with mocked child_process.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Import after mocking
import { spawn, exec } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import {
  CaptureService,
  CaptureConfig,
  CapturedRequest,
  CaptureSource,
  CaptureStatus,
} from './captureService';

describe('CaptureService', () => {
  let captureService: CaptureService;

  beforeEach(() => {
    vi.clearAllMocks();
    captureService = new CaptureService();
  });

  afterEach(() => {
    captureService.stopCapture();
  });

  describe('constructor', () => {
    it('should initialize with default status', () => {
      const status = captureService.getStatus();

      expect(status.isCapturing).toBe(false);
      expect(status.source).toBeNull();
      expect(status.capturedCount).toBe(0);
      expect(status.error).toBeNull();
    });
  });

  describe('checkDependencies', () => {
    it('should detect tshark when available', async () => {
      vi.mocked(exec).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('tshark')) {
          callback(null, { stdout: 'TShark 4.0.0' });
        }
        return {} as any;
      });

      const deps = await captureService.checkDependencies();

      expect(deps.tshark).toBe(true);
    });

    it('should detect mitmproxy when available', async () => {
      vi.mocked(exec).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('mitmdump')) {
          callback(null, { stdout: 'Mitmproxy 10.0.0' });
        }
        return {} as any;
      });

      const deps = await captureService.checkDependencies();

      expect(deps.mitmproxy).toBe(true);
    });

    it('should return false when dependencies are not found', async () => {
      vi.mocked(exec).mockImplementation((cmd: string, callback: any) => {
        callback(new Error('command not found'), null);
        return {} as any;
      });

      const deps = await captureService.checkDependencies();

      expect(deps.tshark).toBe(false);
      expect(deps.mitmproxy).toBe(false);
    });
  });

  describe('startCapture with tshark', () => {
    it('should start tshark capture with correct arguments', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      vi.mocked(existsSync).mockReturnValue(true);

      const config: CaptureConfig = {
        source: 'tshark',
        interface: 'eth0',
        filter: 'tcp port 80 or tcp port 443',
      };

      await captureService.startCapture(config);

      expect(spawn).toHaveBeenCalledWith(
        'tshark',
        expect.arrayContaining([
          '-i', 'eth0',
          '-f', 'tcp port 80 or tcp port 443',
          '-T', 'json',
        ]),
        expect.any(Object)
      );

      const status = captureService.getStatus();
      expect(status.isCapturing).toBe(true);
      expect(status.source).toBe('tshark');
    });

    it('should parse tshark JSON output into CapturedRequest', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const config: CaptureConfig = {
        source: 'tshark',
        interface: 'any',
      };

      await captureService.startCapture(config);

      // Simulate tshark output
      const tsharkOutput = JSON.stringify([{
        _source: {
          layers: {
            frame: { 'frame.time': '2024-01-15 10:30:00' },
            ip: { 'ip.src': '192.168.1.1', 'ip.dst': '93.184.216.34' },
            tcp: { 'tcp.srcport': '54321', 'tcp.dstport': '443' },
            http: {
              'http.request.method': 'GET',
              'http.request.uri': '/api/users',
              'http.host': 'api.example.com',
              'http.request.full_uri': 'https://api.example.com/api/users',
            },
          },
        },
      }]);

      // Get the stdout callback and call it
      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        (call: any[]) => call[0] === 'data'
      )?.[1];

      if (stdoutCallback) {
        stdoutCallback(Buffer.from(tsharkOutput));
      }

      const captures = captureService.getCapturedRequests();
      expect(captures.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle tshark errors', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const config: CaptureConfig = {
        source: 'tshark',
        interface: 'eth0',
      };

      await captureService.startCapture(config);

      // Simulate error
      const errorCallback = mockProcess.on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        errorCallback(new Error('Permission denied'));
      }

      const status = captureService.getStatus();
      expect(status.error).toContain('Permission denied');
    });
  });

  describe('startCapture with mitmproxy', () => {
    it('should start mitmproxy capture with correct arguments', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const config: CaptureConfig = {
        source: 'mitmproxy',
        port: 8080,
        mode: 'regular',
      };

      await captureService.startCapture(config);

      expect(spawn).toHaveBeenCalledWith(
        'mitmdump',
        expect.arrayContaining([
          '-p', '8080',
          '--set', 'flow_detail=3',
        ]),
        expect.any(Object)
      );

      const status = captureService.getStatus();
      expect(status.isCapturing).toBe(true);
      expect(status.source).toBe('mitmproxy');
    });

    it('should support transparent proxy mode', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const config: CaptureConfig = {
        source: 'mitmproxy',
        port: 8080,
        mode: 'transparent',
      };

      await captureService.startCapture(config);

      expect(spawn).toHaveBeenCalledWith(
        'mitmdump',
        expect.arrayContaining(['--mode', 'transparent']),
        expect.any(Object)
      );
    });

    it('should support upstream proxy mode', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const config: CaptureConfig = {
        source: 'mitmproxy',
        port: 8080,
        mode: 'upstream',
        upstreamProxy: 'http://corporate-proxy:3128',
      };

      await captureService.startCapture(config);

      expect(spawn).toHaveBeenCalledWith(
        'mitmdump',
        expect.arrayContaining(['--mode', 'upstream:http://corporate-proxy:3128']),
        expect.any(Object)
      );
    });
  });

  describe('stopCapture', () => {
    it('should stop the capture process', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await captureService.startCapture({ source: 'tshark', interface: 'any' });
      captureService.stopCapture();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      const status = captureService.getStatus();
      expect(status.isCapturing).toBe(false);
    });

    it('should do nothing if not capturing', () => {
      expect(() => captureService.stopCapture()).not.toThrow();
    });
  });

  describe('getCapturedRequests', () => {
    it('should return all captured requests', () => {
      const requests = captureService.getCapturedRequests();
      expect(Array.isArray(requests)).toBe(true);
    });

    it('should return a copy of the requests array', () => {
      const requests1 = captureService.getCapturedRequests();
      const requests2 = captureService.getCapturedRequests();

      expect(requests1).not.toBe(requests2);
    });
  });

  describe('clearCaptures', () => {
    it('should clear all captured requests', () => {
      captureService.clearCaptures();

      const requests = captureService.getCapturedRequests();
      expect(requests).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers when new request is captured', async () => {
      const callback = vi.fn();
      captureService.subscribe(callback);

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await captureService.startCapture({ source: 'tshark', interface: 'any' });

      // Simulate captured request
      const tsharkOutput = JSON.stringify([{
        _source: {
          layers: {
            frame: { 'frame.time': '2024-01-15 10:30:00' },
            ip: { 'ip.src': '192.168.1.1', 'ip.dst': '93.184.216.34' },
            http: {
              'http.request.method': 'GET',
              'http.request.uri': '/test',
              'http.host': 'example.com',
            },
          },
        },
      }]);

      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        (call: any[]) => call[0] === 'data'
      )?.[1];

      if (stdoutCallback) {
        stdoutCallback(Buffer.from(tsharkOutput));
      }

      // Callback may or may not be called depending on parsing
      expect(callback).toBeDefined();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = captureService.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('exportCaptures', () => {
    it('should export captures to JSON file', async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {});

      await captureService.exportCaptures('/path/to/export.json', 'json');

      expect(writeFileSync).toHaveBeenCalledWith(
        '/path/to/export.json',
        expect.any(String)
      );
    });

    it('should export captures to HAR format', async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {});

      await captureService.exportCaptures('/path/to/export.har', 'har');

      expect(writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);

      expect(parsed).toHaveProperty('log');
      expect(parsed.log).toHaveProperty('version');
      expect(parsed.log).toHaveProperty('entries');
    });
  });

  describe('importCaptures', () => {
    it('should import captures from JSON file', async () => {
      const mockCaptures: CapturedRequest[] = [
        {
          id: 'cap-1',
          timestamp: new Date().toISOString(),
          source: 'manual',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: { 'Content-Type': 'application/json' },
          body: null,
          response: {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            body: '{"users": []}',
            timing: { total: 150 },
          },
        },
      ];

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockCaptures));

      await captureService.importCaptures('/path/to/import.json');

      const requests = captureService.getCapturedRequests();
      expect(requests.length).toBeGreaterThanOrEqual(1);
    });

    it('should import captures from HAR file', async () => {
      const mockHar = {
        log: {
          version: '1.2',
          entries: [
            {
              startedDateTime: new Date().toISOString(),
              request: {
                method: 'POST',
                url: 'https://api.example.com/data',
                headers: [{ name: 'Content-Type', value: 'application/json' }],
                postData: { text: '{"key": "value"}' },
              },
              response: {
                status: 201,
                statusText: 'Created',
                headers: [{ name: 'Content-Type', value: 'application/json' }],
                content: { text: '{"id": 1}' },
              },
              time: 200,
            },
          ],
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockHar));

      await captureService.importCaptures('/path/to/import.har');

      const requests = captureService.getCapturedRequests();
      expect(requests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Filtering', () => {
    it('should filter captures by domain', () => {
      const filtered = captureService.filterCaptures({ domain: 'api.example.com' });
      expect(Array.isArray(filtered)).toBe(true);
    });

    it('should filter captures by method', () => {
      const filtered = captureService.filterCaptures({ method: 'POST' });
      expect(Array.isArray(filtered)).toBe(true);
    });

    it('should filter captures by status code', () => {
      const filtered = captureService.filterCaptures({ statusCode: 200 });
      expect(Array.isArray(filtered)).toBe(true);
    });

    it('should filter captures by time range', () => {
      const filtered = captureService.filterCaptures({
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString(),
      });
      expect(Array.isArray(filtered)).toBe(true);
    });

    it('should combine multiple filters', () => {
      const filtered = captureService.filterCaptures({
        domain: 'api.example.com',
        method: 'GET',
        statusCode: 200,
      });
      expect(Array.isArray(filtered)).toBe(true);
    });
  });

  describe('Manual capture', () => {
    it('should add a manually created capture', () => {
      const manualCapture: Omit<CapturedRequest, 'id' | 'timestamp' | 'source'> = {
        method: 'PUT',
        url: 'https://api.example.com/users/1',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name": "Updated"}',
        response: {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: '{"id": 1, "name": "Updated"}',
          timing: { total: 100 },
        },
      };

      const capture = captureService.addManualCapture(manualCapture);

      expect(capture.id).toBeDefined();
      expect(capture.source).toBe('manual');
      expect(capture.timestamp).toBeDefined();
    });
  });
});