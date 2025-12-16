/**
 * Live Traffic Service
 *
 * Real-time traffic streaming service using tshark for packet capture.
 * Supports filtering by domain, method, headers, and status codes.
 * Emits events for each captured packet.
 */

import { spawn as nodeSpawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// Type for spawn function (for dependency injection in tests)
type SpawnFunction = typeof nodeSpawn;

// Types
export interface TrafficFilter {
  domains?: string[];
  domainPattern?: RegExp;
  methods?: string[];
  statusCodes?: number[];
  headers?: Record<string, string>;
  ports?: number[];
}

export interface CaptureConfig {
  interface?: string;
  ports?: number[];
  filter?: TrafficFilter;
  maxPackets?: number;
  timeout?: number;
}

export interface TrafficEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  sourceIp: string;
  destIp: string;
  sourcePort: number;
  destPort: number;
  method?: string;
  host?: string;
  path?: string;
  statusCode?: number;
  statusPhrase?: string;
  headers: Record<string, string>;
  contentType?: string;
  contentLength?: number;
  isWebSocket: boolean;
  isRequest: boolean;
  rawSize: number;
}

export interface TrafficSession {
  id: string;
  status: 'active' | 'paused' | 'stopped';
  startedAt: Date;
  stoppedAt?: Date;
  config: CaptureConfig;
  stats: SessionStats;
}

export interface SessionStats {
  totalPackets: number;
  totalBytes: number;
  requestCount: number;
  responseCount: number;
  errorCount: number;
  byMethod: Record<string, number>;
  byStatusCode: Record<number, number>;
  byDomain: Record<string, number>;
}

export class LiveTrafficService extends EventEmitter {
  private sessions: Map<string, TrafficSession> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private buffers: Map<string, string> = new Map();
  private spawn: SpawnFunction;

  constructor(spawnFn?: SpawnFunction) {
    super();
    this.spawn = spawnFn || nodeSpawn;
  }

  /**
   * Start a new traffic capture session
   */
  async startCapture(config: CaptureConfig = {}): Promise<TrafficSession> {
    // Check if there's already an active session
    const activeSessions = this.getActiveSessions();
    if (activeSessions.length > 0) {
      throw new Error('Capture session already active');
    }

    const sessionId = randomUUID();
    const session: TrafficSession = {
      id: sessionId,
      status: 'active',
      startedAt: new Date(),
      config: {
        interface: config.interface || 'any',
        ports: config.ports || [80, 443, 8080, 8443],
        filter: config.filter,
        maxPackets: config.maxPackets,
        timeout: config.timeout,
      },
      stats: {
        totalPackets: 0,
        totalBytes: 0,
        requestCount: 0,
        responseCount: 0,
        errorCount: 0,
        byMethod: {},
        byStatusCode: {},
        byDomain: {},
      },
    };

    this.sessions.set(sessionId, session);
    this.buffers.set(sessionId, '');

    // Build tshark command
    const args = this.buildTsharkArgs(session.config);

    // Spawn tshark process
    const process = this.spawn('tshark', args);
    this.processes.set(sessionId, process);

    // Handle stdout (packet data)
    process.stdout.on('data', (data: Buffer) => {
      this.handlePacketData(sessionId, data);
    });

    // Handle stderr (errors)
    process.stderr.on('data', (data: Buffer) => {
      const errorMessage = data.toString();
      this.emit('error', new Error(errorMessage));
    });

    // Handle process exit
    process.on('exit', (code: number | null) => {
      const currentSession = this.sessions.get(sessionId);
      if (currentSession && currentSession.status === 'active') {
        currentSession.status = 'stopped';
        currentSession.stoppedAt = new Date();
        this.emit('session-stopped', sessionId);
      }
    });

    return session;
  }

  /**
   * Stop a capture session
   */
  async stopCapture(sessionId: string): Promise<TrafficSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const process = this.processes.get(sessionId);
    if (process) {
      process.kill();
      this.processes.delete(sessionId);
    }

    session.status = 'stopped';
    session.stoppedAt = new Date();

    this.emit('session-stopped', sessionId);

    return session;
  }

  /**
   * Pause a capture session
   */
  async pauseCapture(sessionId: string): Promise<TrafficSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'paused';
    return session;
  }

  /**
   * Resume a paused capture session
   */
  async resumeCapture(sessionId: string): Promise<TrafficSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'active';
    return session;
  }

  /**
   * Update filter on active session
   */
  async updateFilter(sessionId: string, filter: TrafficFilter): Promise<TrafficSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.config.filter = filter;
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): TrafficSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TrafficSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.status === 'active'
    );
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): SessionStats | undefined {
    const session = this.sessions.get(sessionId);
    return session?.stats;
  }

  /**
   * Build tshark command arguments
   */
  private buildTsharkArgs(config: CaptureConfig): string[] {
    const args: string[] = [
      '-i', config.interface || 'any',
      '-T', 'json',
      '-l', // Line-buffered output
    ];

    // Add port filter
    if (config.ports && config.ports.length > 0) {
      const portFilter = config.ports.map((p) => `tcp port ${p}`).join(' or ');
      args.push('-f', portFilter);
    }

    // Add packet limit
    if (config.maxPackets) {
      args.push('-c', config.maxPackets.toString());
    }

    // Add timeout
    if (config.timeout) {
      args.push('-a', `duration:${config.timeout}`);
    }

    return args;
  }

  /**
   * Handle incoming packet data from tshark
   */
  private handlePacketData(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    // Append to buffer
    let buffer = this.buffers.get(sessionId) || '';
    buffer += data.toString();

    // Process complete JSON objects (line by line)
    const lines = buffer.split('\n');
    this.buffers.set(sessionId, lines.pop() || '');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const packet = JSON.parse(line);
        const event = this.parsePacket(sessionId, packet);

        if (event && this.matchesFilter(event, session.config.filter)) {
          // Update stats
          this.updateStats(session, event);

          // Emit event
          this.emit('traffic', event);
        }
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  /**
   * Parse tshark JSON packet into TrafficEvent
   */
  private parsePacket(sessionId: string, packet: TsharkPacket): TrafficEvent | null {
    try {
      const layers = packet._source?.layers;
      if (!layers) return null;

      const frame = layers.frame || {};
      const ip = layers.ip || {};
      const tcp = layers.tcp || {};
      const http = layers.http || {};
      const websocket = layers.websocket;

      const event: TrafficEvent = {
        id: randomUUID(),
        sessionId,
        timestamp: new Date(parseFloat(frame['frame.time_epoch'] || '0') * 1000),
        sourceIp: ip['ip.src'] || '',
        destIp: ip['ip.dst'] || '',
        sourcePort: parseInt(tcp['tcp.srcport'] || '0', 10),
        destPort: parseInt(tcp['tcp.dstport'] || '0', 10),
        headers: {},
        isWebSocket: !!http['http.upgrade'] || !!websocket,
        isRequest: !!http['http.request.method'],
        rawSize: parseInt(frame['frame.len'] || '0', 10),
      };

      // Parse HTTP request
      if (http['http.request.method']) {
        event.method = http['http.request.method'];
        event.host = http['http.host'];
        event.path = http['http.request.uri'];
      }

      // Parse HTTP response
      if (http['http.response.code']) {
        event.statusCode = parseInt(http['http.response.code'], 10);
        event.statusPhrase = http['http.response.phrase'];
      }

      // Parse headers
      if (http['http.content_type']) {
        event.contentType = http['http.content_type'];
        event.headers['Content-Type'] = http['http.content_type'];
      }
      if (http['http.authorization']) {
        event.headers['Authorization'] = http['http.authorization'];
      }

      return event;
    } catch {
      return null;
    }
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: TrafficEvent, filter?: TrafficFilter): boolean {
    if (!filter) return true;

    // Domain filter
    if (filter.domains && filter.domains.length > 0) {
      if (!event.host || !filter.domains.includes(event.host)) {
        return false;
      }
    }

    // Domain pattern filter
    if (filter.domainPattern) {
      if (!event.host || !filter.domainPattern.test(event.host)) {
        return false;
      }
    }

    // Method filter
    if (filter.methods && filter.methods.length > 0) {
      if (!event.method || !filter.methods.includes(event.method)) {
        return false;
      }
    }

    // Status code filter
    if (filter.statusCodes && filter.statusCodes.length > 0) {
      if (!event.statusCode || !filter.statusCodes.includes(event.statusCode)) {
        return false;
      }
    }

    // Header filter
    if (filter.headers) {
      for (const [key, value] of Object.entries(filter.headers)) {
        const headerKey = Object.keys(event.headers).find(
          (k) => k.toLowerCase() === key.toLowerCase()
        );
        if (!headerKey) return false;
        if (value !== '*' && event.headers[headerKey] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Update session statistics
   */
  private updateStats(session: TrafficSession, event: TrafficEvent): void {
    session.stats.totalPackets++;
    session.stats.totalBytes += event.rawSize;

    if (event.isRequest) {
      session.stats.requestCount++;
      if (event.method) {
        session.stats.byMethod[event.method] =
          (session.stats.byMethod[event.method] || 0) + 1;
      }
      if (event.host) {
        session.stats.byDomain[event.host] =
          (session.stats.byDomain[event.host] || 0) + 1;
      }
    } else {
      session.stats.responseCount++;
      if (event.statusCode) {
        session.stats.byStatusCode[event.statusCode] =
          (session.stats.byStatusCode[event.statusCode] || 0) + 1;
        if (event.statusCode >= 400) {
          session.stats.errorCount++;
        }
      }
    }
  }
}

// Internal types for tshark JSON output
interface TsharkPacket {
  _source?: {
    layers?: {
      frame?: Record<string, string>;
      ip?: Record<string, string>;
      tcp?: Record<string, string>;
      http?: Record<string, string>;
      websocket?: Record<string, string>;
    };
  };
}

export default LiveTrafficService;