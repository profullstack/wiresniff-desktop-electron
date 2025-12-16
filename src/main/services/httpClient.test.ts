/**
 * HTTP Client Service Tests
 *
 * Tests for the HTTP client service that handles requests from the renderer process.
 * Uses Vitest with mocked Electron APIs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Electron modules before importing the service
vi.mock('electron', () => {
  const mockRequest = {
    setHeader: vi.fn(),
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    abort: vi.fn(),
    followRedirect: vi.fn(),
  };

  const mockResponse = {
    statusCode: 200,
    statusMessage: 'OK',
    headers: {
      'content-type': 'application/json',
      'set-cookie': ['session=abc123; Path=/; HttpOnly'],
    },
    on: vi.fn(),
  };

  return {
    net: {
      request: vi.fn(() => mockRequest),
    },
    session: {
      fromPartition: vi.fn(() => ({
        setCertificateVerifyProc: vi.fn(),
      })),
    },
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

// Import after mocking
import {
  makeHttpRequest,
  cancelRequest,
  registerHttpClientHandlers,
  type HttpRequestConfig,
  type HttpResponseData,
} from './httpClient';
import { net, session, ipcMain } from 'electron';

describe('httpClient Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('makeHttpRequest', () => {
    it('should make a basic GET request', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();
      const responseData = { message: 'success' };

      // Setup response simulation
      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: { 'content-type': 'application/json' },
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') {
                setTimeout(() => cb(Buffer.from(JSON.stringify(responseData))), 0);
              }
              if (evt === 'end') {
                setTimeout(() => cb(), 10);
              }
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-1',
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
      };

      const response = await makeHttpRequest(config);

      expect(net.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/data',
        })
      );
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.body).toBe(JSON.stringify(responseData));
    });

    it('should add Basic auth header when auth type is basic', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-2',
        method: 'GET',
        url: 'https://api.example.com/secure',
        headers: {},
        auth: {
          type: 'basic',
          username: 'user',
          password: 'pass',
        },
      };

      await makeHttpRequest(config);

      const expectedAuth = Buffer.from('user:pass').toString('base64');
      expect(mockRequest.setHeader).toHaveBeenCalledWith(
        'Authorization',
        `Basic ${expectedAuth}`
      );
    });

    it('should add Bearer token header when auth type is bearer', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-3',
        method: 'GET',
        url: 'https://api.example.com/secure',
        headers: {},
        auth: {
          type: 'bearer',
          token: 'my-jwt-token',
        },
      };

      await makeHttpRequest(config);

      expect(mockRequest.setHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer my-jwt-token'
      );
    });

    it('should add API key header when auth type is api-key', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-4',
        method: 'GET',
        url: 'https://api.example.com/secure',
        headers: {},
        auth: {
          type: 'api-key',
          apiKey: 'secret-key-123',
          apiKeyHeader: 'X-API-Key',
        },
      };

      await makeHttpRequest(config);

      expect(mockRequest.setHeader).toHaveBeenCalledWith('X-API-Key', 'secret-key-123');
    });

    it('should send request body for POST requests', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 201,
            statusMessage: 'Created',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-5',
        method: 'POST',
        url: 'https://api.example.com/data',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      };

      await makeHttpRequest(config);

      expect(mockRequest.write).toHaveBeenCalledWith(JSON.stringify({ name: 'test' }));
      expect(mockRequest.end).toHaveBeenCalled();
    });

    it('should handle request timeout', async () => {
      vi.useFakeTimers();
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      // Don't trigger any response - let it timeout
      mockRequest.on.mockReturnValue(mockRequest);

      const config: HttpRequestConfig = {
        id: 'test-request-6',
        method: 'GET',
        url: 'https://api.example.com/slow',
        headers: {},
        timeout: 5000,
      };

      const requestPromise = makeHttpRequest(config);

      // Advance timers past the timeout
      vi.advanceTimersByTime(6000);

      await expect(requestPromise).rejects.toThrow('Request timeout after 5000ms');

      vi.useRealTimers();
    });

    it('should disable SSL validation when validateSSL is false', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-7',
        method: 'GET',
        url: 'https://self-signed.example.com/data',
        headers: {},
        validateSSL: false,
      };

      await makeHttpRequest(config);

      expect(session.fromPartition).toHaveBeenCalledWith('http-client-insecure');
    });

    it('should parse cookies from Set-Cookie header', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {
              'set-cookie': [
                'session=abc123; Domain=example.com; Path=/; HttpOnly; Secure',
                'user=john; Path=/; Expires=Wed, 09 Jun 2025 10:18:14 GMT',
              ],
            },
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-8',
        method: 'GET',
        url: 'https://api.example.com/login',
        headers: {},
      };

      const response = await makeHttpRequest(config);

      expect(response.cookies).toHaveLength(2);
      expect(response.cookies[0]).toMatchObject({
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        httpOnly: true,
        secure: true,
      });
      expect(response.cookies[1]).toMatchObject({
        name: 'user',
        value: 'john',
        path: '/',
      });
    });

    it('should handle redirect when followRedirects is false', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'redirect') {
          setTimeout(() => callback(302, 'GET', 'https://api.example.com/new-location'), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-9',
        method: 'GET',
        url: 'https://api.example.com/old-location',
        headers: {},
        followRedirects: false,
      };

      const response = await makeHttpRequest(config);

      expect(response.status).toBe(302);
      expect(response.headers['Location']).toBe('https://api.example.com/new-location');
    });

    it('should handle request errors', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Network error')), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-10',
        method: 'GET',
        url: 'https://api.example.com/error',
        headers: {},
      };

      await expect(makeHttpRequest(config)).rejects.toThrow('Network error');
    });

    it('should reject invalid URLs', async () => {
      const config: HttpRequestConfig = {
        id: 'test-request-11',
        method: 'GET',
        url: 'not-a-valid-url',
        headers: {},
      };

      await expect(makeHttpRequest(config)).rejects.toThrow();
    });

    it('should calculate timing metrics', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from('test')), 50);
              if (evt === 'end') setTimeout(() => cb(), 100);
            }),
          };
          setTimeout(() => callback(mockResponse), 25);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'test-request-12',
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
      };

      const response = await makeHttpRequest(config);

      expect(response.timing).toBeDefined();
      expect(response.timing.start).toBeGreaterThan(0);
      expect(response.timing.total).toBeGreaterThan(0);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel an active request', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

      // Don't resolve the request - keep it pending
      mockRequest.on.mockReturnValue(mockRequest);

      const config: HttpRequestConfig = {
        id: 'cancel-test-1',
        method: 'GET',
        url: 'https://api.example.com/slow',
        headers: {},
      };

      // Start the request but don't await it
      makeHttpRequest(config);

      // Give it a moment to register
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cancelled = cancelRequest('cancel-test-1');

      expect(cancelled).toBe(true);
      expect(mockRequest.abort).toHaveBeenCalled();
    });

    it('should return false for non-existent request', () => {
      const cancelled = cancelRequest('non-existent-request');
      expect(cancelled).toBe(false);
    });
  });

  describe('registerHttpClientHandlers', () => {
    it('should register IPC handlers', () => {
      registerHttpClientHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('http:request', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('http:cancel', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('http:activeCount', expect.any(Function));
    });
  });

  describe('HTTP methods', () => {
    const methods: Array<HttpRequestConfig['method']> = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ];

    methods.forEach((method) => {
      it(`should support ${method} method`, async () => {
        const mockRequest = (net.request as ReturnType<typeof vi.fn>)();

        mockRequest.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'response') {
            const mockResponse = {
              statusCode: 200,
              statusMessage: 'OK',
              headers: {},
              on: vi.fn((evt: string, cb: Function) => {
                if (evt === 'data') setTimeout(() => cb(Buffer.from('')), 0);
                if (evt === 'end') setTimeout(() => cb(), 10);
              }),
            };
            setTimeout(() => callback(mockResponse), 0);
          }
          return mockRequest;
        });

        const config: HttpRequestConfig = {
          id: `method-test-${method}`,
          method,
          url: 'https://api.example.com/data',
          headers: {},
        };

        await makeHttpRequest(config);

        expect(net.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method,
          })
        );
      });
    });
  });

  describe('Response size calculation', () => {
    it('should calculate response size in bytes', async () => {
      const mockRequest = (net.request as ReturnType<typeof vi.fn>)();
      const responseBody = 'Hello, World! 🌍'; // Contains multi-byte character

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'response') {
          const mockResponse = {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            on: vi.fn((evt: string, cb: Function) => {
              if (evt === 'data') setTimeout(() => cb(Buffer.from(responseBody)), 0);
              if (evt === 'end') setTimeout(() => cb(), 10);
            }),
          };
          setTimeout(() => callback(mockResponse), 0);
        }
        return mockRequest;
      });

      const config: HttpRequestConfig = {
        id: 'size-test-1',
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
      };

      const response = await makeHttpRequest(config);

      expect(response.size).toBe(Buffer.byteLength(responseBody, 'utf8'));
    });
  });
});