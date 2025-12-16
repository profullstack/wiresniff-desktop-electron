/**
 * Traffic Capture Service
 *
 * Captures network traffic using tshark or mitmproxy.
 * Converts captured packets into replayable request objects.
 */

import { spawn, exec, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { ipcMain } from 'electron';

// Types
export type CaptureSource = 'tshark' | 'mitmproxy' | 'manual';

export interface CaptureConfig {
  source: CaptureSource;
  interface?: string;
  filter?: string;
  port?: number;
  mode?: 'regular' | 'transparent' | 'upstream';
  upstreamProxy?: string;
}

export interface CapturedRequest {
  id: string;
  timestamp: string;
  source: CaptureSource;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timing: {
      total: number;
      dns?: number;
      tcp?: number;
      tls?: number;
      firstByte?: number;
      download?: number;
    };
  };
}

export interface CaptureStatus {
  isCapturing: boolean;
  source: CaptureSource | null;
  capturedCount: number;
  error: string | null;
  startedAt: string | null;
}

export interface CaptureFilter {
  domain?: string;
  method?: string;
  statusCode?: number;
  startTime?: string;
  endTime?: string;
}

export interface Dependencies {
  tshark: boolean;
  mitmproxy: boolean;
}

/**
 * Capture Service class
 */
export class CaptureService {
  private status: CaptureStatus = {
    isCapturing: false,
    source: null,
    capturedCount: 0,
    error: null,
    startedAt: null,
  };

  private capturedRequests: CapturedRequest[] = [];
  private process: ChildProcess | null = null;
  private listeners: Set<(request: CapturedRequest) => void> = new Set();
  private statusListeners: Set<(status: CaptureStatus) => void> = new Set();
  private buffer: string = '';

  /**
   * Get current capture status
   */
  getStatus(): CaptureStatus {
    return { ...this.status };
  }

  /**
   * Check if required dependencies are available
   */
  async checkDependencies(): Promise<Dependencies> {
    const deps: Dependencies = {
      tshark: false,
      mitmproxy: false,
    };

    // Check tshark
    try {
      await this.execCommand('tshark --version');
      deps.tshark = true;
    } catch {
      deps.tshark = false;
    }

    // Check mitmproxy
    try {
      await this.execCommand('mitmdump --version');
      deps.mitmproxy = true;
    } catch {
      deps.mitmproxy = false;
    }

    return deps;
  }

  /**
   * Execute a command and return promise
   */
  private execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Start capturing traffic
   */
  async startCapture(config: CaptureConfig): Promise<void> {
    if (this.status.isCapturing) {
      throw new Error('Capture already in progress');
    }

    this.status.isCapturing = true;
    this.status.source = config.source;
    this.status.error = null;
    this.status.startedAt = new Date().toISOString();
    this.notifyStatusListeners();

    try {
      if (config.source === 'tshark') {
        await this.startTsharkCapture(config);
      } else if (config.source === 'mitmproxy') {
        await this.startMitmproxyCapture(config);
      }
    } catch (error) {
      this.status.isCapturing = false;
      this.status.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyStatusListeners();
      throw error;
    }
  }

  /**
   * Start tshark capture
   */
  private async startTsharkCapture(config: CaptureConfig): Promise<void> {
    const args: string[] = [
      '-i', config.interface || 'any',
      '-T', 'json',
      '-l', // Line-buffered output
    ];

    if (config.filter) {
      args.push('-f', config.filter);
    }

    // Add HTTP dissector
    args.push('-Y', 'http');

    this.process = spawn('tshark', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleTsharkOutput(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[tshark stderr]', data.toString());
    });

    this.process.on('error', (error) => {
      this.status.error = error.message;
      this.status.isCapturing = false;
      this.notifyStatusListeners();
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        this.status.error = `tshark exited with code ${code}`;
      }
      this.status.isCapturing = false;
      this.notifyStatusListeners();
    });
  }

  /**
   * Handle tshark JSON output
   */
  private handleTsharkOutput(data: string): void {
    this.buffer += data;

    // Try to parse complete JSON objects
    try {
      // tshark outputs JSON array, try to parse
      const packets = JSON.parse(this.buffer);
      this.buffer = '';

      if (Array.isArray(packets)) {
        for (const packet of packets) {
          const request = this.parseTsharkPacket(packet);
          if (request) {
            this.addCapturedRequest(request);
          }
        }
      }
    } catch {
      // Incomplete JSON, wait for more data
    }
  }

  /**
   * Parse a tshark packet into CapturedRequest
   */
  private parseTsharkPacket(packet: any): CapturedRequest | null {
    try {
      const layers = packet._source?.layers;
      if (!layers?.http) return null;

      const http = layers.http;
      const frame = layers.frame;

      // Only process HTTP requests
      if (!http['http.request.method']) return null;

      const method = http['http.request.method'];
      const uri = http['http.request.uri'] || '/';
      const host = http['http.host'] || '';
      const fullUri = http['http.request.full_uri'] || `http://${host}${uri}`;

      // Parse headers
      const headers: Record<string, string> = {};
      if (http['http.request.line']) {
        const headerLines = Array.isArray(http['http.request.line'])
          ? http['http.request.line']
          : [http['http.request.line']];

        for (const line of headerLines) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            headers[key] = value;
          }
        }
      }

      return {
        id: nanoid(),
        timestamp: frame?.['frame.time'] || new Date().toISOString(),
        source: 'tshark',
        method,
        url: fullUri,
        headers,
        body: http['http.file_data'] || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Start mitmproxy capture
   */
  private async startMitmproxyCapture(config: CaptureConfig): Promise<void> {
    const args: string[] = [
      '-p', String(config.port || 8080),
      '--set', 'flow_detail=3',
      '--showhost',
    ];

    if (config.mode === 'transparent') {
      args.push('--mode', 'transparent');
    } else if (config.mode === 'upstream' && config.upstreamProxy) {
      args.push('--mode', `upstream:${config.upstreamProxy}`);
    }

    // Use a script to output JSON
    args.push('-s', this.getMitmproxyScript());

    this.process = spawn('mitmdump', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleMitmproxyOutput(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[mitmproxy stderr]', data.toString());
    });

    this.process.on('error', (error) => {
      this.status.error = error.message;
      this.status.isCapturing = false;
      this.notifyStatusListeners();
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        this.status.error = `mitmproxy exited with code ${code}`;
      }
      this.status.isCapturing = false;
      this.notifyStatusListeners();
    });
  }

  /**
   * Get mitmproxy addon script path
   */
  private getMitmproxyScript(): string {
    // In production, this would be a bundled script
    // For now, return inline script path
    return `${__dirname}/mitmproxy_addon.py`;
  }

  /**
   * Handle mitmproxy output
   */
  private handleMitmproxyOutput(data: string): void {
    const lines = data.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        // Try to parse as JSON (from our addon script)
        const flow = JSON.parse(line);
        const request = this.parseMitmproxyFlow(flow);
        if (request) {
          this.addCapturedRequest(request);
        }
      } catch {
        // Not JSON, might be regular mitmproxy output
        // Parse text format
        const request = this.parseMitmproxyText(line);
        if (request) {
          this.addCapturedRequest(request);
        }
      }
    }
  }

  /**
   * Parse mitmproxy JSON flow
   */
  private parseMitmproxyFlow(flow: any): CapturedRequest | null {
    try {
      const req = flow.request;
      const res = flow.response;

      const headers: Record<string, string> = {};
      if (req.headers) {
        for (const [key, value] of req.headers) {
          headers[key] = value;
        }
      }

      const request: CapturedRequest = {
        id: nanoid(),
        timestamp: new Date(flow.timestamp_start * 1000).toISOString(),
        source: 'mitmproxy',
        method: req.method,
        url: `${req.scheme}://${req.host}:${req.port}${req.path}`,
        headers,
        body: req.content || null,
      };

      if (res) {
        const responseHeaders: Record<string, string> = {};
        if (res.headers) {
          for (const [key, value] of res.headers) {
            responseHeaders[key] = value;
          }
        }

        request.response = {
          status: res.status_code,
          statusText: res.reason || '',
          headers: responseHeaders,
          body: res.content || '',
          timing: {
            total: (flow.timestamp_end - flow.timestamp_start) * 1000,
          },
        };
      }

      return request;
    } catch {
      return null;
    }
  }

  /**
   * Parse mitmproxy text output
   */
  private parseMitmproxyText(line: string): CapturedRequest | null {
    // Parse format: "GET https://example.com/path"
    const match = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/);
    if (!match) return null;

    return {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      source: 'mitmproxy',
      method: match[1],
      url: match[2],
      headers: {},
      body: null,
    };
  }

  /**
   * Add a captured request
   */
  private addCapturedRequest(request: CapturedRequest): void {
    this.capturedRequests.push(request);
    this.status.capturedCount++;
    this.notifyListeners(request);
    this.notifyStatusListeners();
  }

  /**
   * Stop capturing traffic
   */
  stopCapture(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    this.status.isCapturing = false;
    this.notifyStatusListeners();
  }

  /**
   * Get all captured requests
   */
  getCapturedRequests(): CapturedRequest[] {
    return [...this.capturedRequests];
  }

  /**
   * Clear all captured requests
   */
  clearCaptures(): void {
    this.capturedRequests = [];
    this.status.capturedCount = 0;
    this.notifyStatusListeners();
  }

  /**
   * Subscribe to new captured requests
   */
  subscribe(callback: (request: CapturedRequest) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to status changes
   */
  subscribeStatus(callback: (status: CaptureStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Notify listeners of new request
   */
  private notifyListeners(request: CapturedRequest): void {
    this.listeners.forEach((callback) => callback(request));
  }

  /**
   * Notify status listeners
   */
  private notifyStatusListeners(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((callback) => callback(status));
  }

  /**
   * Export captures to file
   */
  async exportCaptures(filePath: string, format: 'json' | 'har'): Promise<void> {
    let content: string;

    if (format === 'har') {
      content = JSON.stringify(this.toHar(), null, 2);
    } else {
      content = JSON.stringify(this.capturedRequests, null, 2);
    }

    writeFileSync(filePath, content);
  }

  /**
   * Convert captures to HAR format
   */
  private toHar(): object {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'WireSniff',
          version: '1.0.0',
        },
        entries: this.capturedRequests.map((req) => ({
          startedDateTime: req.timestamp,
          time: req.response?.timing.total || 0,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(req.headers).map(([name, value]) => ({
              name,
              value,
            })),
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: req.body ? req.body.length : 0,
            postData: req.body
              ? {
                  mimeType: req.headers['Content-Type'] || 'text/plain',
                  text: req.body,
                }
              : undefined,
          },
          response: req.response
            ? {
                status: req.response.status,
                statusText: req.response.statusText,
                httpVersion: 'HTTP/1.1',
                headers: Object.entries(req.response.headers).map(
                  ([name, value]) => ({ name, value })
                ),
                cookies: [],
                content: {
                  size: req.response.body.length,
                  mimeType:
                    req.response.headers['Content-Type'] || 'text/plain',
                  text: req.response.body,
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: req.response.body.length,
              }
            : {
                status: 0,
                statusText: '',
                httpVersion: 'HTTP/1.1',
                headers: [],
                cookies: [],
                content: { size: 0, mimeType: 'text/plain' },
                redirectURL: '',
                headersSize: -1,
                bodySize: 0,
              },
          cache: {},
          timings: {
            send: 0,
            wait: req.response?.timing.firstByte || 0,
            receive: req.response?.timing.download || 0,
          },
        })),
      },
    };
  }

  /**
   * Import captures from file
   */
  async importCaptures(filePath: string): Promise<void> {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Check if HAR format
    if (data.log?.entries) {
      this.importFromHar(data);
    } else if (Array.isArray(data)) {
      // JSON array of CapturedRequest
      for (const req of data) {
        this.capturedRequests.push({
          ...req,
          id: req.id || nanoid(),
        });
      }
    }

    this.status.capturedCount = this.capturedRequests.length;
    this.notifyStatusListeners();
  }

  /**
   * Import from HAR format
   */
  private importFromHar(har: any): void {
    for (const entry of har.log.entries) {
      const headers: Record<string, string> = {};
      for (const header of entry.request.headers || []) {
        headers[header.name] = header.value;
      }

      const responseHeaders: Record<string, string> = {};
      for (const header of entry.response?.headers || []) {
        responseHeaders[header.name] = header.value;
      }

      const request: CapturedRequest = {
        id: nanoid(),
        timestamp: entry.startedDateTime,
        source: 'manual',
        method: entry.request.method,
        url: entry.request.url,
        headers,
        body: entry.request.postData?.text || null,
      };

      if (entry.response?.status) {
        request.response = {
          status: entry.response.status,
          statusText: entry.response.statusText,
          headers: responseHeaders,
          body: entry.response.content?.text || '',
          timing: {
            total: entry.time || 0,
          },
        };
      }

      this.capturedRequests.push(request);
    }
  }

  /**
   * Filter captures
   */
  filterCaptures(filter: CaptureFilter): CapturedRequest[] {
    return this.capturedRequests.filter((req) => {
      if (filter.domain) {
        try {
          const url = new URL(req.url);
          if (!url.hostname.includes(filter.domain)) return false;
        } catch {
          return false;
        }
      }

      if (filter.method && req.method !== filter.method) {
        return false;
      }

      if (filter.statusCode && req.response?.status !== filter.statusCode) {
        return false;
      }

      if (filter.startTime) {
        const reqTime = new Date(req.timestamp).getTime();
        const startTime = new Date(filter.startTime).getTime();
        if (reqTime < startTime) return false;
      }

      if (filter.endTime) {
        const reqTime = new Date(req.timestamp).getTime();
        const endTime = new Date(filter.endTime).getTime();
        if (reqTime > endTime) return false;
      }

      return true;
    });
  }

  /**
   * Add a manually created capture
   */
  addManualCapture(
    capture: Omit<CapturedRequest, 'id' | 'timestamp' | 'source'>
  ): CapturedRequest {
    const request: CapturedRequest = {
      ...capture,
      id: nanoid(),
      timestamp: new Date().toISOString(),
      source: 'manual',
    };

    this.capturedRequests.push(request);
    this.status.capturedCount++;
    this.notifyListeners(request);
    this.notifyStatusListeners();

    return request;
  }

  /**
   * Get a single capture by ID
   */
  getCaptureById(id: string): CapturedRequest | undefined {
    return this.capturedRequests.find((req) => req.id === id);
  }

  /**
   * Delete a capture by ID
   */
  deleteCapture(id: string): boolean {
    const index = this.capturedRequests.findIndex((req) => req.id === id);
    if (index === -1) return false;

    this.capturedRequests.splice(index, 1);
    this.status.capturedCount--;
    this.notifyStatusListeners();
    return true;
  }
}

// Singleton instance
export const captureService = new CaptureService();

/**
 * Register IPC handlers for capture service
 */
export function registerCaptureHandlers(): void {
  ipcMain.handle('capture:checkDependencies', async () => {
    return captureService.checkDependencies();
  });

  ipcMain.handle('capture:start', async (event, config: CaptureConfig) => {
    try {
      await captureService.startCapture(config);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('capture:stop', async () => {
    captureService.stopCapture();
    return { success: true };
  });

  ipcMain.handle('capture:getStatus', async () => {
    return captureService.getStatus();
  });

  ipcMain.handle('capture:getAll', async () => {
    return captureService.getCapturedRequests();
  });

  ipcMain.handle('capture:getById', async (event, id: string) => {
    return captureService.getCaptureById(id);
  });

  ipcMain.handle('capture:clear', async () => {
    captureService.clearCaptures();
    return { success: true };
  });

  ipcMain.handle('capture:delete', async (event, id: string) => {
    const deleted = captureService.deleteCapture(id);
    return { success: deleted };
  });

  ipcMain.handle(
    'capture:export',
    async (event, filePath: string, format: 'json' | 'har') => {
      try {
        await captureService.exportCaptures(filePath, format);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle('capture:import', async (event, filePath: string) => {
    try {
      await captureService.importCaptures(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('capture:filter', async (event, filter: CaptureFilter) => {
    return captureService.filterCaptures(filter);
  });

  ipcMain.handle(
    'capture:addManual',
    async (
      event,
      capture: Omit<CapturedRequest, 'id' | 'timestamp' | 'source'>
    ) => {
      return captureService.addManualCapture(capture);
    }
  );
}

export default {
  CaptureService,
  captureService,
  registerCaptureHandlers,
};