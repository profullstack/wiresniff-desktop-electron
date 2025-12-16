/**
 * Replay Service Tests
 *
 * Tests for the replay service that replays captured requests against different targets.
 * Uses Vitest with mocked HTTP client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the HTTP client
vi.mock('../httpClient', () => ({
  makeHttpRequest: vi.fn(),
}));

// Import after mocking
import { makeHttpRequest } from '../httpClient';
import {
  ReplayService,
  ReplayConfig,
  ReplayResult,
  ReplayTarget,
  EnvironmentMapping,
} from './replayService';
import type { CapturedRequest } from '../capture/captureService';

describe('ReplayService', () => {
  let replayService: ReplayService;

  const mockCapturedRequest: CapturedRequest = {
    id: 'cap-1',
    timestamp: '2024-01-15T10:30:00Z',
    source: 'tshark',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
    },
    body: null,
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
      body: '{"users": []}',
      timing: { total: 150 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    replayService = new ReplayService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty replay history', () => {
      const history = replayService.getReplayHistory();
      expect(history).toEqual([]);
    });
  });

  describe('replay', () => {
    it('should replay a captured request to the same URL', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"users": []}',
        size: 15,
        timing: {
          start: Date.now(),
          dns: 10,
          tcp: 20,
          tls: 30,
          firstByte: 50,
          download: 10,
          total: 120,
        },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'original',
      };

      const result = await replayService.replay(config);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.status).toBe(200);
      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/users',
        })
      );
    });

    it('should replay to a staging environment', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"users": []}',
        size: 15,
        timing: {
          start: Date.now(),
          dns: 10,
          tcp: 20,
          tls: 30,
          firstByte: 50,
          download: 10,
          total: 120,
        },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'staging',
        environmentMapping: {
          staging: {
            baseUrl: 'https://staging-api.example.com',
          },
        },
      };

      const result = await replayService.replay(config);

      expect(result.success).toBe(true);
      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://staging-api.example.com/users',
        })
      );
    });

    it('should replay to a production environment', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'production',
        environmentMapping: {
          production: {
            baseUrl: 'https://prod-api.example.com',
          },
        },
      };

      const result = await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://prod-api.example.com/users',
        })
      );
    });

    it('should replay to a mock server', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{"mocked": true}',
        size: 16,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 50 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'mock',
        environmentMapping: {
          mock: {
            baseUrl: 'http://localhost:3001',
          },
        },
      };

      const result = await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3001/users',
        })
      );
    });

    it('should replay to a custom URL', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'custom',
        customUrl: 'https://custom-server.example.com/api/users',
      };

      const result = await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://custom-server.example.com/api/users',
        })
      );
    });

    it('should handle request errors', async () => {
      vi.mocked(makeHttpRequest).mockRejectedValue(new Error('Network error'));

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'original',
      };

      const result = await replayService.replay(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should include original headers by default', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'original',
      };

      await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123',
          }),
        })
      );
    });

    it('should allow header overrides', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'original',
        headerOverrides: {
          'Authorization': 'Bearer new-token',
          'X-Custom-Header': 'custom-value',
        },
      };

      await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-token',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should allow body overrides', async () => {
      const capturedWithBody: CapturedRequest = {
        ...mockCapturedRequest,
        method: 'POST',
        body: '{"original": true}',
      };

      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 201,
        statusText: 'Created',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: capturedWithBody,
        target: 'original',
        bodyOverride: '{"modified": true}',
      };

      await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: '{"modified": true}',
        })
      );
    });

    it('should store replay result in history', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'original',
      };

      await replayService.replay(config);

      const history = replayService.getReplayHistory();
      expect(history).toHaveLength(1);
      expect(history[0].captureId).toBe('cap-1');
    });

    it('should generate unique replay IDs', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const config: ReplayConfig = {
        capturedRequest: mockCapturedRequest,
        target: 'original',
      };

      const result1 = await replayService.replay(config);
      const result2 = await replayService.replay(config);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('replayMultiple', () => {
    it('should replay multiple requests in sequence', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const requests: CapturedRequest[] = [
        { ...mockCapturedRequest, id: 'cap-1' },
        { ...mockCapturedRequest, id: 'cap-2', url: 'https://api.example.com/posts' },
        { ...mockCapturedRequest, id: 'cap-3', url: 'https://api.example.com/comments' },
      ];

      const results = await replayService.replayMultiple(requests, 'original');

      expect(results).toHaveLength(3);
      expect(makeHttpRequest).toHaveBeenCalledTimes(3);
    });

    it('should continue on error when continueOnError is true', async () => {
      vi.mocked(makeHttpRequest)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '{}',
          size: 2,
          timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
          cookies: [],
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '{}',
          size: 2,
          timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
          cookies: [],
        });

      const requests: CapturedRequest[] = [
        { ...mockCapturedRequest, id: 'cap-1' },
        { ...mockCapturedRequest, id: 'cap-2' },
        { ...mockCapturedRequest, id: 'cap-3' },
      ];

      const results = await replayService.replayMultiple(requests, 'original', {
        continueOnError: true,
      });

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should stop on error when continueOnError is false', async () => {
      vi.mocked(makeHttpRequest)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '{}',
          size: 2,
          timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
          cookies: [],
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const requests: CapturedRequest[] = [
        { ...mockCapturedRequest, id: 'cap-1' },
        { ...mockCapturedRequest, id: 'cap-2' },
        { ...mockCapturedRequest, id: 'cap-3' },
      ];

      const results = await replayService.replayMultiple(requests, 'original', {
        continueOnError: false,
      });

      expect(results).toHaveLength(2);
      expect(makeHttpRequest).toHaveBeenCalledTimes(2);
    });

    it('should add delay between requests', async () => {
      vi.useFakeTimers();

      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const requests: CapturedRequest[] = [
        { ...mockCapturedRequest, id: 'cap-1' },
        { ...mockCapturedRequest, id: 'cap-2' },
      ];

      const replayPromise = replayService.replayMultiple(requests, 'original', {
        delayMs: 1000,
      });

      // First request should be made immediately
      expect(makeHttpRequest).toHaveBeenCalledTimes(1);

      // Advance time
      await vi.advanceTimersByTimeAsync(1000);

      // Second request should now be made
      expect(makeHttpRequest).toHaveBeenCalledTimes(2);

      await replayPromise;

      vi.useRealTimers();
    });
  });

  describe('getReplayHistory', () => {
    it('should return all replay results', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      await replayService.replay({
        capturedRequest: mockCapturedRequest,
        target: 'original',
      });

      await replayService.replay({
        capturedRequest: { ...mockCapturedRequest, id: 'cap-2' },
        target: 'staging',
        environmentMapping: { staging: { baseUrl: 'https://staging.example.com' } },
      });

      const history = replayService.getReplayHistory();

      expect(history).toHaveLength(2);
    });

    it('should return a copy of the history', () => {
      const history1 = replayService.getReplayHistory();
      const history2 = replayService.getReplayHistory();

      expect(history1).not.toBe(history2);
    });
  });

  describe('getReplayById', () => {
    it('should return a specific replay result', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const result = await replayService.replay({
        capturedRequest: mockCapturedRequest,
        target: 'original',
      });

      const retrieved = replayService.getReplayById(result.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(result.id);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = replayService.getReplayById('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear all replay history', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      await replayService.replay({
        capturedRequest: mockCapturedRequest,
        target: 'original',
      });

      replayService.clearHistory();

      const history = replayService.getReplayHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Environment URL mapping', () => {
    it('should correctly map URLs with path preservation', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const capturedWithPath: CapturedRequest = {
        ...mockCapturedRequest,
        url: 'https://api.example.com/v1/users/123/posts?page=1&limit=10',
      };

      const config: ReplayConfig = {
        capturedRequest: capturedWithPath,
        target: 'staging',
        environmentMapping: {
          staging: {
            baseUrl: 'https://staging-api.example.com',
          },
        },
      };

      await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://staging-api.example.com/v1/users/123/posts?page=1&limit=10',
        })
      );
    });

    it('should handle URL with different ports', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: { start: Date.now(), dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 100 },
        cookies: [],
      });

      const capturedWithPort: CapturedRequest = {
        ...mockCapturedRequest,
        url: 'https://api.example.com:8443/users',
      };

      const config: ReplayConfig = {
        capturedRequest: capturedWithPort,
        target: 'staging',
        environmentMapping: {
          staging: {
            baseUrl: 'http://localhost:3000',
          },
        },
      };

      await replayService.replay(config);

      expect(makeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/users',
        })
      );
    });
  });

  describe('Timing comparison', () => {
    it('should include timing data in replay result', async () => {
      vi.mocked(makeHttpRequest).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        size: 2,
        timing: {
          start: Date.now(),
          dns: 10,
          tcp: 20,
          tls: 30,
          firstByte: 50,
          download: 10,
          total: 120,
        },
        cookies: [],
      });

      const result = await replayService.replay({
        capturedRequest: mockCapturedRequest,
        target: 'original',
      });

      expect(result.response?.timing).toBeDefined();
      expect(result.response?.timing.total).toBe(120);
    });
  });
});