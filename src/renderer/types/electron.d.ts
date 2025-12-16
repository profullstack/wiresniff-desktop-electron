/**
 * Type definitions for the Electron API exposed via preload script
 */

export interface WindowAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

export interface ThemeAPI {
  get: () => Promise<'dark' | 'light'>;
  set: (theme: 'dark' | 'light' | 'system') => Promise<void>;
}

export interface AppAPI {
  getVersion: () => Promise<string>;
  getName: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
}

export interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
}

export interface CollectionsAPI {
  getAll: () => Promise<Collection[]>;
  getById: (id: string) => Promise<Collection | null>;
  create: (data: Partial<Collection>) => Promise<Collection>;
  update: (id: string, data: Partial<Collection>) => Promise<Collection>;
  delete: (id: string) => Promise<void>;
}

export interface RequestsAPI {
  getAll: () => Promise<Request[]>;
  getById: (id: string) => Promise<Request | null>;
  getByCollection: (collectionId: string) => Promise<Request[]>;
  create: (data: Partial<Request>) => Promise<Request>;
  update: (id: string, data: Partial<Request>) => Promise<Request>;
  delete: (id: string) => Promise<void>;
}

export interface EnvironmentsAPI {
  getAll: () => Promise<Environment[]>;
  getById: (id: string) => Promise<Environment | null>;
  create: (data: Partial<Environment>) => Promise<Environment>;
  update: (id: string, data: Partial<Environment>) => Promise<Environment>;
  delete: (id: string) => Promise<void>;
}

export interface HistoryAPI {
  getAll: (limit?: number) => Promise<HistoryEntry[]>;
  getById: (id: string) => Promise<HistoryEntry | null>;
  create: (data: Partial<HistoryEntry>) => Promise<HistoryEntry>;
  delete: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

export interface SettingsAPI {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: <T = unknown>(key: string, value: T) => Promise<void>;
  getAll: () => Promise<Record<string, unknown>>;
}

export interface DatabaseAPI {
  collections: CollectionsAPI;
  requests: RequestsAPI;
  environments: EnvironmentsAPI;
  history: HistoryAPI;
  settings: SettingsAPI;
}

export interface HttpAPI {
  send: (request: HttpRequest) => Promise<HttpResponse>;
  cancel: (requestId: string) => Promise<void>;
}

export interface WebSocketAPI {
  connect: (url: string, options?: WebSocketOptions) => Promise<string>;
  disconnect: (connectionId: string) => Promise<void>;
  send: (connectionId: string, message: string) => Promise<void>;
  onMessage: (callback: (data: WebSocketMessage) => void) => () => void;
  onStatusChange: (callback: (data: WebSocketStatus) => void) => () => void;
}

export interface SseAPI {
  connect: (url: string, options?: SseOptions) => Promise<string>;
  disconnect: (connectionId: string) => Promise<void>;
  onEvent: (callback: (data: SseEvent) => void) => () => void;
  onStatusChange: (callback: (data: SseStatus) => void) => () => void;
}

export interface SyncAPI {
  // Basic sync controls
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getStatus: () => Promise<SyncStatus>;
  onStatusChange: (callback: (status: SyncStatus) => void) => () => void;
  
  // Capture session sync (Feature 1)
  syncCaptures?: () => Promise<void>;
  saveCapture?: (session: CaptureSession) => Promise<void>;
  getCaptures?: (workspaceId?: string) => Promise<CaptureSession[]>;
  deleteCapture?: (id: string) => Promise<void>;
  shareCapture?: (id: string, workspaceId: string) => Promise<void>;
  
  // Replay session sync (Feature 1)
  syncReplays?: () => Promise<void>;
  saveReplay?: (session: ReplaySession) => Promise<void>;
  getReplays?: (captureSessionId?: string) => Promise<ReplaySession[]>;
  deleteReplay?: (id: string) => Promise<void>;
  
  // Diff result sync (Feature 1)
  syncDiffs?: () => Promise<void>;
  saveDiff?: (diff: DiffResult) => Promise<void>;
  getDiffs?: (workspaceId?: string) => Promise<DiffResult[]>;
  deleteDiff?: (id: string) => Promise<void>;
  
  // Traffic session sync (Feature 6)
  syncTrafficSessions?: () => Promise<void>;
  saveTrafficSession?: (session: TrafficSession) => Promise<void>;
  getTrafficSessions?: (workspaceId?: string) => Promise<TrafficSession[]>;
  deleteTrafficSession?: (id: string) => Promise<void>;
  shareTrafficSession?: (id: string, workspaceId: string) => Promise<void>;
}

export interface ImportExportAPI {
  importPostman: (filePath: string) => Promise<ImportResult>;
  importOpenAPI: (filePath: string) => Promise<ImportResult>;
  importCurl: (curlCommand: string) => Promise<Request>;
  exportCollection: (collectionId: string, format: string) => Promise<string>;
  exportEnvironment: (environmentId: string) => Promise<string>;
}

export interface DialogAPI {
  openFile: (options?: OpenFileOptions) => Promise<string[] | null>;
  saveFile: (options?: SaveFileOptions) => Promise<string | null>;
}

export interface SecretsAPI {
  encryptString: (value: string) => Promise<string>;
  decryptString: (encrypted: string) => Promise<string>;
  isEncryptionAvailable: () => boolean;
}

export interface ElectronAPI {
  window: WindowAPI;
  theme: ThemeAPI;
  app: AppAPI;
  shell: ShellAPI;
  db: DatabaseAPI;
  http: HttpAPI;
  websocket: WebSocketAPI;
  sse: SseAPI;
  sync: SyncAPI;
  importExport: ImportExportAPI;
  dialog: DialogAPI;
  secrets: SecretsAPI;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

// Data models
export interface Collection {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface Request {
  id: string;
  collectionId?: string;
  folderId?: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body?: RequestBody;
  auth?: RequestAuth;
  preRequestScript?: string;
  testScript?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  isSecret: boolean;
}

export interface HistoryEntry {
  id: string;
  requestId?: string;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  size: number;
  timestamp: string;
  request: HttpRequest;
  response: HttpResponse;
}

// HTTP types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface RequestBody {
  type: 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'graphql';
  content?: string;
  formData?: KeyValuePair[];
}

export interface RequestAuth {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2';
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: OAuth2Config;
}

export interface OAuth2Config {
  grantType: 'authorization_code' | 'client_credentials' | 'password';
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface HttpRequest {
  id: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  time: number;
  timing?: RequestTiming;
}

export interface RequestTiming {
  dns: number;
  tcp: number;
  tls: number;
  firstByte: number;
  download: number;
  total: number;
}

// WebSocket types
export interface WebSocketOptions {
  headers?: Record<string, string>;
  protocols?: string[];
}

export interface WebSocketMessage {
  connectionId: string;
  type: 'text' | 'binary';
  data: string;
  timestamp: string;
  direction: 'sent' | 'received';
}

export interface WebSocketStatus {
  connectionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
}

// SSE types
export interface SseOptions {
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

export interface SseEvent {
  connectionId: string;
  event: string;
  data: string;
  id?: string;
  timestamp: string;
}

export interface SseStatus {
  connectionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
}

// Sync types
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt?: string;
  pendingChanges: number;
  error?: string;
}

// Capture session types (Feature 1)
export interface CaptureSession {
  id: string;
  name: string;
  description?: string;
  requests: CapturedRequest[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  workspaceId?: string;
  isShared?: boolean;
}

export interface CapturedRequest {
  id: string;
  sessionId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: string;
  response?: CapturedResponse;
}

export interface CapturedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  timing?: {
    dns: number;
    connect: number;
    ttfb: number;
    download: number;
    total: number;
  };
}

// Replay session types (Feature 1)
export interface ReplaySession {
  id: string;
  captureSessionId: string;
  name: string;
  targetEnvironment: string;
  results: ReplayResult[];
  createdAt: string;
  userId: string;
  workspaceId?: string;
}

export interface ReplayResult {
  id: string;
  replaySessionId: string;
  originalRequestId: string;
  response: CapturedResponse;
  timestamp: string;
}

// Diff result types (Feature 1)
export interface DiffResult {
  id: string;
  name: string;
  originalSessionId: string;
  replaySessionId: string;
  diffs: RequestDiff[];
  createdAt: string;
  userId: string;
  workspaceId?: string;
}

export interface RequestDiff {
  requestId: string;
  statusDiff?: { original: number; replay: number };
  headerDiffs: Array<{ key: string; original?: string; replay?: string; type: 'added' | 'removed' | 'changed' }>;
  bodyDiff?: { type: 'json' | 'text'; changes: unknown };
  timingDiff?: { original: number; replay: number; percentChange: number };
}

// Traffic session types (Feature 6)
export interface TrafficSession {
  id: string;
  name: string;
  description?: string;
  filters: TrafficFilter[];
  packets: TrafficPacket[];
  startedAt: string;
  endedAt?: string;
  userId: string;
  workspaceId?: string;
  isShared?: boolean;
}

export interface TrafficFilter {
  type: 'domain' | 'method' | 'status' | 'header' | 'body';
  value: string;
  operator: 'equals' | 'contains' | 'regex' | 'startsWith' | 'endsWith';
}

export interface TrafficPacket {
  id: string;
  sessionId: string;
  timestamp: string;
  direction: 'request' | 'response';
  protocol: 'http' | 'https' | 'ws' | 'wss';
  method?: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  status?: number;
}

// Import/Export types
export interface ImportResult {
  success: boolean;
  collections: number;
  requests: number;
  environments: number;
  errors: string[];
}

// Dialog types
export interface OpenFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
  multiSelections?: boolean;
}

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

// Declare global window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};