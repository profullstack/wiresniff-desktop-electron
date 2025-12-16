/**
 * Diff Engine Tests
 *
 * Tests for the response diff engine that compares HTTP responses.
 */

import { describe, it, expect } from 'vitest';
import {
  diffResponses,
  compareHeaders,
  compareBody,
  compareTiming,
  compareJsonSemantic,
  createDiffSummary,
  ResponseData,
  DiffOptions,
} from './diffEngine';

// Helper to create a mock response
function createMockResponse(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'abc123',
    },
    body: '{"message": "Hello"}',
    timing: {
      total: 100,
      dns: 10,
      connect: 20,
      ttfb: 50,
      download: 20,
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('DiffEngine', () => {
  describe('diffResponses', () => {
    it('should return no differences for identical responses', () => {
      const response = createMockResponse();
      const result = diffResponses(response, response);

      expect(result.summary.hasStatusDiff).toBe(false);
      expect(result.summary.hasHeaderDiff).toBe(false);
      expect(result.summary.hasBodyDiff).toBe(false);
      expect(result.summary.overallSimilarity).toBe(1);
    });

    it('should detect status code differences', () => {
      const left = createMockResponse({ status: 200, statusText: 'OK' });
      const right = createMockResponse({ status: 404, statusText: 'Not Found' });

      const result = diffResponses(left, right);

      expect(result.summary.hasStatusDiff).toBe(true);
      expect(result.statusDiff.left.status).toBe(200);
      expect(result.statusDiff.right.status).toBe(404);
    });

    it('should detect added headers', () => {
      const left = createMockResponse({
        headers: { 'content-type': 'application/json' },
      });
      const right = createMockResponse({
        headers: {
          'content-type': 'application/json',
          'x-new-header': 'value',
        },
      });

      const result = diffResponses(left, right);

      expect(result.summary.hasHeaderDiff).toBe(true);
      const addedHeader = result.headerDiff.find((d) => d.key === 'x-new-header');
      expect(addedHeader).toBeDefined();
      expect(addedHeader?.type).toBe('added');
    });

    it('should detect removed headers', () => {
      const left = createMockResponse({
        headers: {
          'content-type': 'application/json',
          'x-old-header': 'value',
        },
      });
      const right = createMockResponse({
        headers: { 'content-type': 'application/json' },
      });

      const result = diffResponses(left, right);

      expect(result.summary.hasHeaderDiff).toBe(true);
      const removedHeader = result.headerDiff.find((d) => d.key === 'x-old-header');
      expect(removedHeader).toBeDefined();
      expect(removedHeader?.type).toBe('removed');
    });

    it('should detect changed headers', () => {
      const left = createMockResponse({
        headers: { 'content-type': 'application/json' },
      });
      const right = createMockResponse({
        headers: { 'content-type': 'text/plain' },
      });

      const result = diffResponses(left, right);

      expect(result.summary.hasHeaderDiff).toBe(true);
      const changedHeader = result.headerDiff.find((d) => d.key === 'content-type');
      expect(changedHeader).toBeDefined();
      expect(changedHeader?.type).toBe('modified');
    });

    it('should detect body differences', () => {
      const left = createMockResponse({ body: '{"message": "Hello"}' });
      const right = createMockResponse({ body: '{"message": "World"}' });

      const result = diffResponses(left, right);

      expect(result.summary.hasBodyDiff).toBe(true);
      expect(result.bodyDiff.type).toBe('json-semantic');
    });

    it('should detect timing differences', () => {
      const left = createMockResponse({
        timing: { total: 100, dns: 10, connect: 20, ttfb: 50, download: 20 },
      });
      const right = createMockResponse({
        timing: { total: 200, dns: 20, connect: 40, ttfb: 100, download: 40 },
      });

      const result = diffResponses(left, right);

      expect(result.timingDiff.totalDelta).toBe(100);
      expect(result.timingDiff.percentageChange).toBe(100);
    });
  });

  describe('compareHeaders', () => {
    it('should return empty diff for identical headers', () => {
      const headers = { 'content-type': 'application/json' };
      const result = compareHeaders(headers, headers);

      expect(result).toHaveLength(0);
    });

    it('should be case-insensitive for header names', () => {
      const left = { 'Content-Type': 'application/json' };
      const right = { 'content-type': 'application/json' };

      const result = compareHeaders(left, right);

      expect(result).toHaveLength(0);
    });

    it('should ignore specified headers', () => {
      const left = { 'content-type': 'application/json', date: 'Mon, 01 Jan 2024' };
      const right = { 'content-type': 'application/json', date: 'Tue, 02 Jan 2024' };

      const result = compareHeaders(left, right, ['date']);

      expect(result).toHaveLength(0);
    });

    it('should detect multiple differences', () => {
      const left = {
        'content-type': 'application/json',
        'x-old': 'value',
      };
      const right = {
        'content-type': 'text/plain',
        'x-new': 'value',
      };

      const result = compareHeaders(left, right);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('compareBody', () => {
    it('should return no diff for identical bodies', () => {
      const body = '{"message": "Hello"}';
      const result = compareBody(body, body);

      expect(result.type).toBe('identical');
      expect(result.similarity).toBe(1);
    });

    it('should detect text differences', () => {
      const left = 'Hello World';
      const right = 'Hello Universe';

      const result = compareBody(left, right);

      expect(result.type).toBe('different');
      expect(result.similarity).toBeLessThan(1);
    });

    it('should compare JSON semantically when both are valid JSON', () => {
      const left = '{"a": 1, "b": 2}';
      const right = '{"b": 2, "a": 1}';

      const result = compareBody(left, right);

      // Same content, different order - should be identical semantically
      expect(result.type).toBe('json-semantic');
    });

    it('should detect JSON value differences', () => {
      const left = '{"message": "Hello"}';
      const right = '{"message": "World"}';

      const result = compareBody(left, right);

      expect(result.type).toBe('json-semantic');
      expect(result.jsonDiff).toBeDefined();
      expect(result.jsonDiff!.length).toBeGreaterThan(0);
    });

    it('should detect added JSON properties', () => {
      const left = '{"a": 1}';
      const right = '{"a": 1, "b": 2}';

      const result = compareBody(left, right);

      expect(result.type).toBe('json-semantic');
      const addedProp = result.jsonDiff?.find((d) => d.path === 'b');
      expect(addedProp).toBeDefined();
      expect(addedProp?.type).toBe('added');
    });

    it('should detect removed JSON properties', () => {
      const left = '{"a": 1, "b": 2}';
      const right = '{"a": 1}';

      const result = compareBody(left, right);

      expect(result.type).toBe('json-semantic');
      const removedProp = result.jsonDiff?.find((d) => d.path === 'b');
      expect(removedProp).toBeDefined();
      expect(removedProp?.type).toBe('removed');
    });

    it('should handle nested JSON objects', () => {
      const left = '{"user": {"name": "John", "age": 30}}';
      const right = '{"user": {"name": "Jane", "age": 30}}';

      const result = compareBody(left, right);

      expect(result.type).toBe('json-semantic');
      expect(result.jsonDiff).toBeDefined();
    });

    it('should handle JSON arrays', () => {
      const left = '{"items": [1, 2, 3]}';
      const right = '{"items": [1, 2, 4]}';

      const result = compareBody(left, right);

      expect(result.type).toBe('json-semantic');
      expect(result.jsonDiff).toBeDefined();
    });

    it('should generate line-by-line diff for non-JSON', () => {
      const left = 'Line 1\nLine 2\nLine 3';
      const right = 'Line 1\nLine 2 Modified\nLine 3';

      const result = compareBody(left, right);

      expect(result.type).toBe('different');
      expect(result.textDiff).toBeDefined();
    });

    it('should handle empty bodies', () => {
      const result = compareBody('', '');

      expect(result.type).toBe('identical');
      expect(result.similarity).toBe(1);
    });

    it('should detect when one body is empty', () => {
      const result = compareBody('Hello', '');

      expect(result.type).toBe('different');
      expect(result.similarity).toBe(0);
    });
  });

  describe('compareTiming', () => {
    it('should return no diff for identical timing', () => {
      const timing = { total: 100, dns: 10, connect: 20, ttfb: 50, download: 20 };
      const result = compareTiming(timing, timing);

      expect(result.totalDelta).toBe(0);
      expect(result.percentageChange).toBe(0);
    });

    it('should calculate total time difference', () => {
      const left = { total: 100 };
      const right = { total: 150 };

      const result = compareTiming(left, right);

      expect(result.totalDelta).toBe(50);
    });

    it('should calculate percentage difference', () => {
      const left = { total: 100 };
      const right = { total: 150 };

      const result = compareTiming(left, right);

      expect(result.percentageChange).toBe(50);
    });

    it('should compare individual timing phases', () => {
      const left = { total: 100, dns: 10, connect: 20, ttfb: 50, download: 20 };
      const right = { total: 150, dns: 15, connect: 30, ttfb: 75, download: 30 };

      const result = compareTiming(left, right);

      expect(result.dnsDelta).toBe(5);
      expect(result.connectDelta).toBe(10);
      expect(result.ttfbDelta).toBe(25);
      expect(result.downloadDelta).toBe(10);
    });

    it('should handle missing timing phases', () => {
      const left = { total: 100 };
      const right = { total: 150, dns: 15 };

      const result = compareTiming(left, right);

      expect(result.totalDelta).toBe(50);
      expect(result.dnsDelta).toBeUndefined();
    });
  });

  describe('compareJsonSemantic', () => {
    it('should return empty diff for identical JSON', () => {
      const json = { a: 1, b: 2 };
      const result = compareJsonSemantic(json, json);

      expect(result).toHaveLength(0);
    });

    it('should detect value changes', () => {
      const left = { a: 1 };
      const right = { a: 2 };

      const result = compareJsonSemantic(left, right);

      const change = result.find((d) => d.path === 'a');
      expect(change).toBeDefined();
      expect(change?.type).toBe('modified');
    });

    it('should detect type changes', () => {
      const left = { a: '1' };
      const right = { a: 1 };

      const result = compareJsonSemantic(left, right);

      const change = result.find((d) => d.path === 'a');
      expect(change).toBeDefined();
      expect(change?.type).toBe('type-changed');
    });

    it('should ignore specified paths', () => {
      const left = { a: 1, timestamp: '2024-01-01' };
      const right = { a: 1, timestamp: '2024-01-02' };

      const result = compareJsonSemantic(left, right, ['timestamp']);

      expect(result).toHaveLength(0);
    });
  });

  describe('createDiffSummary', () => {
    it('should generate human-readable summary', () => {
      const left = createMockResponse();
      const right = createMockResponse({ status: 404, statusText: 'Not Found' });

      const result = diffResponses(left, right);
      const summary = createDiffSummary(result);

      expect(summary).toContain('Diff ID');
      expect(summary).toContain('Status');
      expect(summary).toContain('404');
    });

    it('should indicate no differences when identical', () => {
      const response = createMockResponse();
      const result = diffResponses(response, response);
      const summary = createDiffSummary(result);

      expect(summary).toContain('100.0%');
    });

    it('should list all types of differences', () => {
      const left = createMockResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"a": 1}',
      });
      const right = createMockResponse({
        status: 404,
        headers: { 'content-type': 'text/plain' },
        body: '{"a": 2}',
      });

      const result = diffResponses(left, right);
      const summary = createDiffSummary(result);

      expect(summary).toContain('Status');
      expect(summary).toContain('Headers');
      expect(summary).toContain('Body');
    });
  });

  describe('Options', () => {
    it('should respect ignoreHeaders option', () => {
      const left = createMockResponse({
        headers: { 'content-type': 'application/json', 'x-custom': 'a' },
      });
      const right = createMockResponse({
        headers: { 'content-type': 'application/json', 'x-custom': 'b' },
      });

      const options: DiffOptions = { ignoreHeaders: ['x-custom'] };
      const result = diffResponses(left, right, options);

      expect(result.summary.hasHeaderDiff).toBe(false);
    });

    it('should respect semanticJsonDiff option', () => {
      const left = createMockResponse({ body: '{"a": 1}' });
      const right = createMockResponse({ body: '{"a": 2}' });

      const options: DiffOptions = { semanticJsonDiff: false };
      const result = diffResponses(left, right, options);

      expect(result.bodyDiff.type).toBe('different');
    });

    it('should respect timingThreshold option', () => {
      const left = createMockResponse({ timing: { total: 100 } });
      const right = createMockResponse({ timing: { total: 110 } });

      // 10% change with 5% threshold should be significant
      const options: DiffOptions = { timingThreshold: 5 };
      const result = diffResponses(left, right, options);

      expect(result.summary.hasSignificantTimingDiff).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined values gracefully', () => {
      const left = createMockResponse({ body: 'null' });
      const right = createMockResponse({ body: 'null' });

      const result = diffResponses(left, right);

      expect(result.bodyDiff.type).toBe('identical');
    });

    it('should handle very large bodies', () => {
      const largeBody = JSON.stringify({ data: 'x'.repeat(100000) });
      const left = createMockResponse({ body: largeBody });
      const right = createMockResponse({ body: largeBody });

      const result = diffResponses(left, right);

      expect(result.bodyDiff.type).toBe('identical');
    });

    it('should handle binary-like content', () => {
      // Create content with >10% non-printable characters to trigger binary detection
      // Need at least 100 chars with >10 non-printable to exceed 10% threshold
      const binaryLeft = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12' + 'a'.repeat(84);
      const binaryRight = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12' + 'b'.repeat(84);
      const left = createMockResponse({ body: binaryLeft });
      const right = createMockResponse({ body: binaryRight });

      const result = diffResponses(left, right);

      expect(result.bodyDiff.type).toBe('binary');
      expect(result.bodyDiff.similarity).toBe(0); // Different binary content
    });

    it('should handle special characters in headers', () => {
      const left = createMockResponse({
        headers: { 'x-special': 'value with "quotes" and \'apostrophes\'' },
      });
      const right = createMockResponse({
        headers: { 'x-special': 'value with "quotes" and \'apostrophes\'' },
      });

      const result = diffResponses(left, right);

      expect(result.summary.hasHeaderDiff).toBe(false);
    });
  });
});