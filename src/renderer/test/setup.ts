import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock Electron API
const mockElectronAPI = {
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
  },
  theme: {
    get: vi.fn().mockResolvedValue('dark'),
    set: vi.fn(),
  },
  app: {
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
    getName: vi.fn().mockResolvedValue('WireSniff'),
    getPath: vi.fn().mockResolvedValue('/mock/path'),
  },
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
  },
  db: {
    collections: {
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    requests: {
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      getByCollection: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    environments: {
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    history: {
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      getAll: vi.fn().mockResolvedValue({}),
    },
  },
  http: {
    send: vi.fn(),
    cancel: vi.fn(),
  },
  websocket: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    onMessage: vi.fn().mockReturnValue(() => {}),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
  },
  sse: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onEvent: vi.fn().mockReturnValue(() => {}),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
  },
  sync: {
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({
      isOnline: true,
      isSyncing: false,
      pendingChanges: 0,
    }),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
  },
  importExport: {
    importPostman: vi.fn(),
    importOpenAPI: vi.fn(),
    importCurl: vi.fn(),
    exportCollection: vi.fn(),
    exportEnvironment: vi.fn(),
  },
  dialog: {
    openFile: vi.fn(),
    saveFile: vi.fn(),
  },
  on: vi.fn().mockReturnValue(() => {}),
  off: vi.fn(),
};

// Expose mock Electron API to window
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Export mock for use in tests
export { mockElectronAPI };