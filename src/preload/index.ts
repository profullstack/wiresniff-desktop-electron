import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron API exposed to the renderer process via context bridge
 * This provides a secure way to communicate between renderer and main process
 */
const electronAPI = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // Theme
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme: 'dark' | 'light' | 'system') => ipcRenderer.invoke('theme:set', theme),
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getName: () => ipcRenderer.invoke('app:getName'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  },

  // Shell operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),
  },

  // Database operations
  db: {
    // Collections
    collections: {
      getAll: () => ipcRenderer.invoke('db:collections:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:collections:getById', id),
      create: (data: unknown) => ipcRenderer.invoke('db:collections:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:collections:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:collections:delete', id),
    },

    // Requests
    requests: {
      getAll: () => ipcRenderer.invoke('db:requests:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:requests:getById', id),
      getByCollection: (collectionId: string) => ipcRenderer.invoke('db:requests:getByCollection', collectionId),
      create: (data: unknown) => ipcRenderer.invoke('db:requests:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:requests:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:requests:delete', id),
    },

    // Environments
    environments: {
      getAll: () => ipcRenderer.invoke('db:environments:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:environments:getById', id),
      create: (data: unknown) => ipcRenderer.invoke('db:environments:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:environments:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:environments:delete', id),
    },

    // History
    history: {
      getAll: (limit?: number) => ipcRenderer.invoke('db:history:getAll', limit),
      getById: (id: string) => ipcRenderer.invoke('db:history:getById', id),
      create: (data: unknown) => ipcRenderer.invoke('db:history:create', data),
      delete: (id: string) => ipcRenderer.invoke('db:history:delete', id),
      clear: () => ipcRenderer.invoke('db:history:clear'),
    },

    // Settings
    settings: {
      get: (key: string) => ipcRenderer.invoke('db:settings:get', key),
      set: (key: string, value: unknown) => ipcRenderer.invoke('db:settings:set', key, value),
      getAll: () => ipcRenderer.invoke('db:settings:getAll'),
    },
  },

  // HTTP Client
  http: {
    send: (request: unknown) => ipcRenderer.invoke('http:send', request),
    cancel: (requestId: string) => ipcRenderer.invoke('http:cancel', requestId),
  },

  // WebSocket
  websocket: {
    connect: (url: string, options?: unknown) => ipcRenderer.invoke('websocket:connect', url, options),
    disconnect: (connectionId: string) => ipcRenderer.invoke('websocket:disconnect', connectionId),
    send: (connectionId: string, message: string) => ipcRenderer.invoke('websocket:send', connectionId, message),
    onMessage: (callback: (data: unknown) => void) => {
      const subscription = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on('websocket:message', subscription);
      return () => ipcRenderer.removeListener('websocket:message', subscription);
    },
    onStatusChange: (callback: (data: unknown) => void) => {
      const subscription = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on('websocket:status', subscription);
      return () => ipcRenderer.removeListener('websocket:status', subscription);
    },
  },

  // Server-Sent Events
  sse: {
    connect: (url: string, options?: unknown) => ipcRenderer.invoke('sse:connect', url, options),
    disconnect: (connectionId: string) => ipcRenderer.invoke('sse:disconnect', connectionId),
    onEvent: (callback: (data: unknown) => void) => {
      const subscription = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on('sse:event', subscription);
      return () => ipcRenderer.removeListener('sse:event', subscription);
    },
    onStatusChange: (callback: (data: unknown) => void) => {
      const subscription = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on('sse:status', subscription);
      return () => ipcRenderer.removeListener('sse:status', subscription);
    },
  },

  // Sync
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    stop: () => ipcRenderer.invoke('sync:stop'),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    onStatusChange: (callback: (status: unknown) => void) => {
      const subscription = (_event: unknown, status: unknown) => callback(status);
      ipcRenderer.on('sync:status', subscription);
      return () => ipcRenderer.removeListener('sync:status', subscription);
    },
  },

  // Import/Export
  importExport: {
    importPostman: (filePath: string) => ipcRenderer.invoke('import:postman', filePath),
    importOpenAPI: (filePath: string) => ipcRenderer.invoke('import:openapi', filePath),
    importCurl: (curlCommand: string) => ipcRenderer.invoke('import:curl', curlCommand),
    exportCollection: (collectionId: string, format: string) =>
      ipcRenderer.invoke('export:collection', collectionId, format),
    exportEnvironment: (environmentId: string) => ipcRenderer.invoke('export:environment', environmentId),
  },

  // File dialogs
  dialog: {
    openFile: (options?: unknown) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options?: unknown) => ipcRenderer.invoke('dialog:saveFile', options),
  },

  // Event listeners for menu actions
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'navigate',
      'new-request',
      'new-collection',
      'import',
      'export',
      'toggle-sidebar',
      'send-request',
      'cancel-request',
      'save-request',
      'save-request-as',
      'duplicate-request',
      'new-tab',
      'close-tab',
      'next-tab',
      'prev-tab',
      'show-about',
    ];

    if (validChannels.includes(channel)) {
      const subscription = (_event: unknown, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },

  // Remove event listener
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the exposed API
export type ElectronAPI = typeof electronAPI;