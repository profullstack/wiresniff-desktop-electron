/**
 * Replay Service
 *
 * Replays captured requests against different target environments.
 * Supports staging, production, mock servers, and custom URLs.
 */

import { nanoid } from 'nanoid';
import { ipcMain } from 'electron';
import { makeHttpRequest, type HttpRequestConfig, type HttpResponseData } from '../httpClient';
import type { CapturedRequest } from '../capture/captureService';

// Types
export type ReplayTarget = 'original' | 'staging' | 'production' | 'mock' | 'custom';

export interface EnvironmentConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'basic' | 'bearer' | 'api-key';
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
}

export interface EnvironmentMapping {
  staging?: EnvironmentConfig;
  production?: EnvironmentConfig;
  mock?: EnvironmentConfig;
  [key: string]: EnvironmentConfig | undefined;
}

export interface ReplayConfig {
  capturedRequest: CapturedRequest;
  target: ReplayTarget;
  customUrl?: string;
  environmentMapping?: EnvironmentMapping;
  headerOverrides?: Record<string, string>;
  bodyOverride?: string;
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
}

export interface ReplayResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  timing: {
    total: number;
    dns?: number;
    tcp?: number;
    tls?: number;
    firstByte?: number;
    download?: number;
  };
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: string;
    httpOnly: boolean;
    secure: boolean;
  }>;
}

export interface ReplayResult {
  id: string;
  captureId: string;
  target: ReplayTarget;
  targetUrl: string;
  timestamp: string;
  success: boolean;
  error?: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string | null;
  };
  response?: ReplayResponse;
  originalResponse?: CapturedRequest['response'];
}

export interface ReplayMultipleOptions {
  continueOnError?: boolean;
  delayMs?: number;
}

/**
 * Replay Service class
 */
export class ReplayService {
  private replayHistory: ReplayResult[] = [];
  private listeners: Set<(result: ReplayResult) => void> = new Set();

  /**
   * Replay a captured request
   */
  async replay(config: ReplayConfig): Promise<ReplayResult> {
    const {
      capturedRequest,
      target,
      customUrl,
      environmentMapping,
      headerOverrides,
      bodyOverride,
      timeout,
      followRedirects,
      validateSSL,
    } = config;

    const targetUrl = this.resolveTargetUrl(
      capturedRequest.url,
      target,
      customUrl,
      environmentMapping
    );

    const headers = this.buildHeaders(
      capturedRequest.headers,
      headerOverrides,
      target,
      environmentMapping
    );

    const body = bodyOverride ?? capturedRequest.body;

    const result: ReplayResult = {
      id: nanoid(),
      captureId: capturedRequest.id,
      target,
      targetUrl,
      timestamp: new Date().toISOString(),
      success: false,
      request: {
        method: capturedRequest.method,
        url: targetUrl,
        headers,
        body,
      },
      originalResponse: capturedRequest.response,
    };

    try {
      const httpConfig: HttpRequestConfig = {
        id: result.id,
        method: capturedRequest.method as HttpRequestConfig['method'],
        url: targetUrl,
        headers,
        body: body ?? undefined,
        timeout,
        followRedirects,
        validateSSL,
      };

      // Add auth from environment if configured
      const envConfig = this.getEnvironmentConfig(target, environmentMapping);
      if (envConfig?.auth) {
        httpConfig.auth = envConfig.auth;
      }

      const response = await makeHttpRequest(httpConfig);

      result.success = true;
      result.response = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        size: response.size,
        timing: response.timing,
        cookies: response.cookies,
      };
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.replayHistory.push(result);
    this.notifyListeners(result);

    return result;
  }

  /**
   * Replay multiple captured requests
   */
  async replayMultiple(
    requests: CapturedRequest[],
    target: ReplayTarget,
    options: ReplayMultipleOptions = {}
  ): Promise<ReplayResult[]> {
    const { continueOnError = true, delayMs = 0 } = options;
    const results: ReplayResult[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];

      const result = await this.replay({
        capturedRequest: request,
        target,
      });

      results.push(result);

      if (!result.success && !continueOnError) {
        break;
      }

      // Add delay between requests if specified
      if (delayMs > 0 && i < requests.length - 1) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  /**
   * Resolve the target URL based on configuration
   */
  private resolveTargetUrl(
    originalUrl: string,
    target: ReplayTarget,
    customUrl?: string,
    environmentMapping?: EnvironmentMapping
  ): string {
    if (target === 'original') {
      return originalUrl;
    }

    if (target === 'custom' && customUrl) {
      return customUrl;
    }

    const envConfig = this.getEnvironmentConfig(target, environmentMapping);
    if (!envConfig?.baseUrl) {
      return originalUrl;
    }

    // Parse original URL to extract path and query
    try {
      const original = new URL(originalUrl);
      const base = new URL(envConfig.baseUrl);

      // Combine base URL with original path and query
      return `${base.origin}${original.pathname}${original.search}`;
    } catch {
      return originalUrl;
    }
  }

  /**
   * Get environment configuration for a target
   */
  private getEnvironmentConfig(
    target: ReplayTarget,
    environmentMapping?: EnvironmentMapping
  ): EnvironmentConfig | undefined {
    if (!environmentMapping) return undefined;

    switch (target) {
      case 'staging':
        return environmentMapping.staging;
      case 'production':
        return environmentMapping.production;
      case 'mock':
        return environmentMapping.mock;
      default:
        return undefined;
    }
  }

  /**
   * Build headers for the replay request
   */
  private buildHeaders(
    originalHeaders: Record<string, string>,
    overrides?: Record<string, string>,
    target?: ReplayTarget,
    environmentMapping?: EnvironmentMapping
  ): Record<string, string> {
    const headers = { ...originalHeaders };

    // Add environment-specific headers
    const envConfig = target ? this.getEnvironmentConfig(target, environmentMapping) : undefined;
    if (envConfig?.headers) {
      Object.assign(headers, envConfig.headers);
    }

    // Apply overrides
    if (overrides) {
      Object.assign(headers, overrides);
    }

    return headers;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get replay history
   */
  getReplayHistory(): ReplayResult[] {
    return [...this.replayHistory];
  }

  /**
   * Get a specific replay by ID
   */
  getReplayById(id: string): ReplayResult | undefined {
    return this.replayHistory.find((r) => r.id === id);
  }

  /**
   * Get replays for a specific capture
   */
  getReplaysByCaptureId(captureId: string): ReplayResult[] {
    return this.replayHistory.filter((r) => r.captureId === captureId);
  }

  /**
   * Clear replay history
   */
  clearHistory(): void {
    this.replayHistory = [];
  }

  /**
   * Delete a specific replay
   */
  deleteReplay(id: string): boolean {
    const index = this.replayHistory.findIndex((r) => r.id === id);
    if (index === -1) return false;

    this.replayHistory.splice(index, 1);
    return true;
  }

  /**
   * Subscribe to replay results
   */
  subscribe(callback: (result: ReplayResult) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of new replay result
   */
  private notifyListeners(result: ReplayResult): void {
    this.listeners.forEach((callback) => callback(result));
  }

  /**
   * Compare replay response with original
   */
  compareWithOriginal(replayId: string): {
    statusMatch: boolean;
    headersDiff: { added: string[]; removed: string[]; changed: string[] };
    bodyMatch: boolean;
    timingDiff: number;
  } | null {
    const replay = this.getReplayById(replayId);
    if (!replay || !replay.response || !replay.originalResponse) {
      return null;
    }

    const original = replay.originalResponse;
    const response = replay.response;

    // Compare status
    const statusMatch = original.status === response.status;

    // Compare headers
    const originalHeaders = Object.keys(original.headers);
    const responseHeaders = Object.keys(response.headers);

    const added = responseHeaders.filter((h) => !originalHeaders.includes(h));
    const removed = originalHeaders.filter((h) => !responseHeaders.includes(h));
    const changed = originalHeaders.filter(
      (h) =>
        responseHeaders.includes(h) &&
        original.headers[h] !== response.headers[h]
    );

    // Compare body
    const bodyMatch = original.body === response.body;

    // Compare timing
    const timingDiff = response.timing.total - original.timing.total;

    return {
      statusMatch,
      headersDiff: { added, removed, changed },
      bodyMatch,
      timingDiff,
    };
  }
}

// Singleton instance
export const replayService = new ReplayService();

/**
 * Register IPC handlers for replay service
 */
export function registerReplayHandlers(): void {
  ipcMain.handle(
    'replay:single',
    async (event: Electron.IpcMainInvokeEvent, config: ReplayConfig) => {
      try {
        const result = await replayService.replay(config);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    'replay:multiple',
    async (
      event: Electron.IpcMainInvokeEvent,
      requests: CapturedRequest[],
      target: ReplayTarget,
      options?: ReplayMultipleOptions
    ) => {
      try {
        const results = await replayService.replayMultiple(requests, target, options);
        return { success: true, data: results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle('replay:getHistory', async () => {
    return replayService.getReplayHistory();
  });

  ipcMain.handle('replay:getById', async (event: Electron.IpcMainInvokeEvent, id: string) => {
    return replayService.getReplayById(id);
  });

  ipcMain.handle(
    'replay:getByCaptureId',
    async (event: Electron.IpcMainInvokeEvent, captureId: string) => {
      return replayService.getReplaysByCaptureId(captureId);
    }
  );

  ipcMain.handle('replay:clearHistory', async () => {
    replayService.clearHistory();
    return { success: true };
  });

  ipcMain.handle('replay:delete', async (event: Electron.IpcMainInvokeEvent, id: string) => {
    const deleted = replayService.deleteReplay(id);
    return { success: deleted };
  });

  ipcMain.handle(
    'replay:compareWithOriginal',
    async (event: Electron.IpcMainInvokeEvent, replayId: string) => {
      return replayService.compareWithOriginal(replayId);
    }
  );
}

export default {
  ReplayService,
  replayService,
  registerReplayHandlers,
};