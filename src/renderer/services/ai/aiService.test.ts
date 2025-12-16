/**
 * AI Service Tests
 *
 * Tests for AI-powered analysis features including:
 * - Capture Explainer: Auth flow detection, JWT analysis, cookie analysis
 * - Diff Explainer: Header/body/timing differences
 * - Auto-Test Generator: Generate test cases from captured traffic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, CapturedRequest, CapturedResponse } from './aiService';

// Mock Supabase
vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    vi.clearAllMocks();
  });

  describe('explainCapture', () => {
    describe('auth flow detection', () => {
      it('should detect bearer token authentication', async () => {
        const request: CapturedRequest = {
          id: 'test-1',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.authFlow).toBeDefined();
        expect(explanation.authFlow?.type).toBe('bearer');
        expect(explanation.authFlow?.location).toBe('header');
        expect(explanation.authFlow?.headerName).toBe('Authorization');
      });

      it('should detect basic authentication', async () => {
        const request: CapturedRequest = {
          id: 'test-2',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.authFlow?.type).toBe('basic');
        expect(explanation.authFlow?.description).toContain('Basic authentication');
      });

      it('should detect API key in header', async () => {
        const request: CapturedRequest = {
          id: 'test-3',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            'x-api-key': 'sk-1234567890abcdef',
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.authFlow?.type).toBe('api_key');
        expect(explanation.authFlow?.location).toBe('header');
      });

      it('should detect API key in query parameter', async () => {
        const request: CapturedRequest = {
          id: 'test-4',
          method: 'GET',
          url: 'https://api.example.com/users?api_key=sk-1234567890',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.authFlow?.type).toBe('api_key');
        expect(explanation.authFlow?.location).toBe('query');
      });

      it('should detect session-based authentication', async () => {
        const request: CapturedRequest = {
          id: 'test-5',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            Cookie: 'sessionid=abc123; other=value',
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.authFlow?.type).toBe('session');
        expect(explanation.authFlow?.location).toBe('cookie');
      });

      it('should detect no authentication', async () => {
        const request: CapturedRequest = {
          id: 'test-6',
          method: 'GET',
          url: 'https://api.example.com/public',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.authFlow?.type).toBe('none');
      });
    });

    describe('JWT analysis', () => {
      it('should decode and analyze valid JWT', async () => {
        const validJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

        const request: CapturedRequest = {
          id: 'test-jwt-1',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            Authorization: `Bearer ${validJwt}`,
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.jwt).toBeDefined();
        expect(explanation.jwt?.isValid).toBe(true);
        expect(explanation.jwt?.algorithm).toBe('HS256');
        expect(explanation.jwt?.payload).toHaveProperty('sub', '1234567890');
        expect(explanation.jwt?.payload).toHaveProperty('name', 'John Doe');
        expect(explanation.jwt?.claims).toContain('sub');
        expect(explanation.jwt?.claims).toContain('name');
        expect(explanation.jwt?.claims).toContain('iat');
      });

      it('should detect expired JWT', async () => {
        const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

        const request: CapturedRequest = {
          id: 'test-jwt-2',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            Authorization: `Bearer ${expiredJwt}`,
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.jwt?.isExpired).toBe(true);
        expect(explanation.recommendations).toContain('JWT token has expired - refresh the token');
      });

      it('should not analyze non-JWT bearer tokens', async () => {
        const request: CapturedRequest = {
          id: 'test-jwt-3',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {
            Authorization: 'Bearer not-a-jwt-token',
          },
          timestamp: new Date().toISOString(),
        };

        const explanation = await aiService.explainCapture(request);

        expect(explanation.jwt).toBeUndefined();
      });
    });

    describe('cookie analysis', () => {
      it('should analyze Set-Cookie headers from response', async () => {
        const request: CapturedRequest = {
          id: 'test-cookie-1',
          method: 'POST',
          url: 'https://api.example.com/login',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Set-Cookie': 'sessionid=abc123; HttpOnly; Secure; SameSite=Strict; Path=/',
          },
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.cookies).toBeDefined();
        expect(explanation.cookies?.length).toBeGreaterThan(0);
        expect(explanation.cookies?.[0].name).toBe('sessionid');
        expect(explanation.cookies?.[0].httpOnly).toBe(true);
        expect(explanation.cookies?.[0].secure).toBe(true);
        expect(explanation.cookies?.[0].sameSite).toBe('strict');
      });

      it('should infer cookie purpose', async () => {
        const request: CapturedRequest = {
          id: 'test-cookie-2',
          method: 'POST',
          url: 'https://api.example.com/login',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Set-Cookie': 'csrf_token=xyz789; Path=/',
          },
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.cookies?.[0].purpose).toBe('CSRF protection');
      });

      it('should recommend HttpOnly for session cookies', async () => {
        const request: CapturedRequest = {
          id: 'test-cookie-3',
          method: 'POST',
          url: 'https://api.example.com/login',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Set-Cookie': 'session=abc123; Path=/',
          },
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.recommendations).toContain('Cookie "session" should have HttpOnly flag');
        expect(explanation.recommendations).toContain('Cookie "session" should have Secure flag');
      });
    });

    describe('CORS analysis', () => {
      it('should detect CORS headers', async () => {
        const request: CapturedRequest = {
          id: 'test-cors-1',
          method: 'OPTIONS',
          url: 'https://api.example.com/users',
          headers: {
            Origin: 'https://app.example.com',
          },
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Access-Control-Allow-Origin': 'https://app.example.com',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
          },
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.cors).toBeDefined();
        expect(explanation.cors?.isEnabled).toBe(true);
        expect(explanation.cors?.allowedOrigins).toContain('https://app.example.com');
        expect(explanation.cors?.allowedMethods).toContain('GET');
        expect(explanation.cors?.allowCredentials).toBe(true);
      });

      it('should warn about wildcard origin with credentials', async () => {
        const request: CapturedRequest = {
          id: 'test-cors-2',
          method: 'OPTIONS',
          url: 'https://api.example.com/users',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          },
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.cors?.issues).toContain('Cannot use credentials with wildcard origin');
      });
    });

    describe('security header analysis', () => {
      it('should analyze security headers and calculate score', async () => {
        const request: CapturedRequest = {
          id: 'test-security-1',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'",
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1; mode=block',
          },
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.security).toBeDefined();
        expect(explanation.security?.hsts).toBe(true);
        expect(explanation.security?.csp).toBeDefined();
        expect(explanation.security?.xFrameOptions).toBe('DENY');
        expect(explanation.security?.xContentTypeOptions).toBe(true);
        expect(explanation.security?.score).toBe(100);
      });

      it('should identify missing security headers', async () => {
        const request: CapturedRequest = {
          id: 'test-security-2',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.security?.issues).toContain('Missing Strict-Transport-Security header');
        expect(explanation.security?.issues).toContain('Missing Content-Security-Policy header');
        expect(explanation.security?.issues).toContain('Missing X-Frame-Options header');
        expect(explanation.security?.score).toBeLessThan(100);
      });
    });

    describe('summary generation', () => {
      it('should generate accurate summary', async () => {
        const request: CapturedRequest = {
          id: 'test-summary-1',
          method: 'POST',
          url: 'https://api.example.com/users/create',
          headers: {},
          timestamp: new Date().toISOString(),
        };

        const response: CapturedResponse = {
          statusCode: 201,
          statusText: 'Created',
          headers: {},
        };

        const explanation = await aiService.explainCapture(request, response);

        expect(explanation.summary).toContain('POST');
        expect(explanation.summary).toContain('/users/create');
        expect(explanation.summary).toContain('201');
      });
    });
  });

  describe('explainDiff', () => {
    describe('header differences', () => {
      it('should detect added headers', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': 'abc123',
          },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.headerDifferences).toBeDefined();
        const addedHeader = explanation.headerDifferences?.find((d) => d.header === 'X-Request-Id');
        expect(addedHeader?.type).toBe('added');
      });

      it('should detect removed headers', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=3600',
          },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        const removedHeader = explanation.headerDifferences?.find((d) => d.header === 'Cache-Control');
        expect(removedHeader?.type).toBe('removed');
      });

      it('should detect modified headers', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Cache-Control': 'max-age=3600',
          },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Cache-Control': 'no-cache',
          },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        const modifiedHeader = explanation.headerDifferences?.find((d) => d.header === 'Cache-Control');
        expect(modifiedHeader?.type).toBe('modified');
        expect(modifiedHeader?.leftValue).toBe('max-age=3600');
        expect(modifiedHeader?.rightValue).toBe('no-cache');
      });

      it('should assign correct significance to headers', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'value1',
          },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'text/html',
            'X-Custom-Header': 'value2',
          },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        const contentType = explanation.headerDifferences?.find((d) => d.header === 'Content-Type');
        const customHeader = explanation.headerDifferences?.find((d) => d.header === 'X-Custom-Header');

        expect(contentType?.significance).toBe('high');
        expect(customHeader?.significance).toBe('low');
      });
    });

    describe('body differences', () => {
      it('should detect JSON body differences', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'John', age: 30 }),
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Jane', age: 25 }),
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.bodyDifferences).toBeDefined();
        expect(explanation.bodyDifferences?.type).toBe('json');
        expect(explanation.bodyDifferences?.changes).toBeGreaterThan(0);
      });

      it('should identify key differences in JSON', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'John', phone: '555-1234' }),
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.bodyDifferences?.keyDifferences).toBeDefined();
        expect(explanation.bodyDifferences?.keyDifferences).toContain('email: removed');
        expect(explanation.bodyDifferences?.keyDifferences).toContain('phone: added');
      });

      it('should handle identical bodies', async () => {
        const body = JSON.stringify({ name: 'John' });
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body,
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body,
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.bodyDifferences).toBeUndefined();
      });
    });

    describe('timing differences', () => {
      it('should detect significant timing differences', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          timing: { total: 100 },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          timing: { total: 200 },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.timingDifferences).toBeDefined();
        expect(explanation.timingDifferences?.totalDiff).toBe(100);
        expect(explanation.timingDifferences?.percentChange).toBe(100);
      });

      it('should ignore minor timing differences', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          timing: { total: 100 },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          timing: { total: 102 },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.timingDifferences).toBeUndefined();
      });

      it('should identify possible causes for timing changes', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          timing: { dns: 10, connect: 20, ttfb: 50, download: 20, total: 100 },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          timing: { dns: 10, connect: 20, ttfb: 150, download: 20, total: 200 },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.timingDifferences?.possibleCauses).toContain('Server processing time increased');
      });
    });

    describe('summary and recommendations', () => {
      it('should generate comprehensive summary', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'John' }),
          timing: { total: 100 },
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html' },
          body: JSON.stringify({ name: 'Jane' }),
          timing: { total: 200 },
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse, {
          leftLabel: 'Staging',
          rightLabel: 'Production',
        });

        expect(explanation.summary).toContain('Staging');
        expect(explanation.summary).toContain('Production');
        expect(explanation.summary).toContain('header');
        expect(explanation.summary).toContain('body');
      });

      it('should provide actionable recommendations', async () => {
        const leftResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }),
        };

        const rightResponse: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: 10, b: 20, c: 30, d: 40, e: 50, f: 60 }),
        };

        const explanation = await aiService.explainDiff(leftResponse, rightResponse);

        expect(explanation.recommendations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generateTests', () => {
    const sampleRequest: CapturedRequest = {
      id: 'test-gen-1',
      method: 'GET',
      url: 'https://api.example.com/users/123',
      headers: {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      },
      timestamp: new Date().toISOString(),
    };

    const sampleResponse: CapturedResponse = {
      statusCode: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600',
      },
      body: JSON.stringify({ id: 123, name: 'John Doe', email: 'john@example.com' }),
      timing: { total: 150 },
    };

    describe('status tests', () => {
      it('should generate vitest status test', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
        });

        const statusTest = tests.find((t) => t.assertions.some((a) => a.type === 'status'));
        expect(statusTest).toBeDefined();
        expect(statusTest?.framework).toBe('vitest');
        expect(statusTest?.code).toContain("import { describe, it, expect } from 'vitest'");
        expect(statusTest?.code).toContain('expect(response.status).toBe(200)');
      });

      it('should generate jest status test', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'jest',
        });

        const statusTest = tests.find((t) => t.assertions.some((a) => a.type === 'status'));
        expect(statusTest?.code).toContain("import { describe, it, expect } from 'jest'");
      });

      it('should generate mocha status test', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'mocha',
        });

        const statusTest = tests.find((t) => t.assertions.some((a) => a.type === 'status'));
        expect(statusTest?.code).toContain("import { expect } from 'chai'");
        expect(statusTest?.code).toContain('expect(response.status).to.equal(200)');
      });

      it('should generate playwright status test', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'playwright',
        });

        const statusTest = tests.find((t) => t.assertions.some((a) => a.type === 'status'));
        expect(statusTest?.code).toContain("import { test, expect } from '@playwright/test'");
        expect(statusTest?.code).toContain('expect(response.status()).toBe(200)');
      });
    });

    describe('header tests', () => {
      it('should generate tests for important headers when present', async () => {
        const responseWithHeaders: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
            'cache-control': 'max-age=3600',
            'x-request-id': 'abc123',
          },
          body: JSON.stringify({ id: 123 }),
        };

        const tests = await aiService.generateTests(sampleRequest, responseWithHeaders, {
          framework: 'vitest',
        });

        const headerTests = tests.filter((t) => t.assertions.some((a) => a.type === 'header'));
        expect(headerTests.length).toBeGreaterThan(0);

        const contentTypeTest = headerTests.find((t) => t.name.includes('content-type'));
        expect(contentTypeTest).toBeDefined();
      });

      it('should not generate header tests when no important headers present', async () => {
        const responseWithoutImportantHeaders: CapturedResponse = {
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'x-custom': 'value',
          },
        };

        const tests = await aiService.generateTests(sampleRequest, responseWithoutImportantHeaders, {
          framework: 'vitest',
        });

        const headerTests = tests.filter((t) => t.assertions.some((a) => a.type === 'header'));
        expect(headerTests.length).toBe(0);
      });
    });

    describe('body tests', () => {
      it('should generate JSON body tests', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
        });

        const bodyTest = tests.find((t) => t.assertions.some((a) => a.type === 'body'));
        expect(bodyTest).toBeDefined();
        expect(bodyTest?.code).toContain('response.json()');
      });

      it('should include schema assertions when requested', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
          includeSchema: true,
        });

        const bodyTest = tests.find((t) => t.assertions.some((a) => a.type === 'body'));
        expect(bodyTest?.code).toContain('typeof data');
      });

      it('should not generate body tests for empty body', async () => {
        const responseWithoutBody: CapturedResponse = {
          statusCode: 204,
          statusText: 'No Content',
          headers: {},
        };

        const tests = await aiService.generateTests(sampleRequest, responseWithoutBody, {
          framework: 'vitest',
        });

        const bodyTest = tests.find((t) => t.assertions.some((a) => a.type === 'body'));
        expect(bodyTest).toBeUndefined();
      });
    });

    describe('timing tests', () => {
      it('should generate timing test when requested', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
          includeTiming: true,
        });

        const timingTest = tests.find((t) => t.assertions.some((a) => a.type === 'timing'));
        expect(timingTest).toBeDefined();
        expect(timingTest?.code).toContain('performance.now()');
        expect(timingTest?.code).toContain('toBeLessThan');
      });

      it('should not generate timing test by default', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
        });

        const timingTest = tests.find((t) => t.assertions.some((a) => a.type === 'timing'));
        expect(timingTest).toBeUndefined();
      });
    });

    describe('test metadata', () => {
      it('should include descriptive test names', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
        });

        expect(tests.length).toBeGreaterThan(0);
        tests.forEach((test) => {
          expect(test.name).toBeTruthy();
          expect(test.description).toBeTruthy();
        });
      });

      it('should include assertions metadata', async () => {
        const tests = await aiService.generateTests(sampleRequest, sampleResponse, {
          framework: 'vitest',
        });

        tests.forEach((test) => {
          expect(test.assertions.length).toBeGreaterThan(0);
          test.assertions.forEach((assertion) => {
            expect(assertion.type).toBeTruthy();
            expect(assertion.description).toBeTruthy();
          });
        });
      });
    });
  });

  describe('saveInsight', () => {
    it('should require authentication', async () => {
      const { supabase } = await import('../supabase/client');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        aiService.saveInsight('capture', { summary: 'test', recommendations: [] })
      ).rejects.toThrow('User must be authenticated');
    });
  });
});