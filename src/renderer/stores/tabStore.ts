/**
 * Tab Store
 * 
 * Manages the state of open request tabs in the workspace.
 * Supports multiple tabs, tab ordering, active tab tracking,
 * and persistence of tab state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

// Tab types
export type TabType = 'http' | 'websocket' | 'graphql' | 'sse' | 'grpc';

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Request body types
export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';

// Auth types
export type AuthType = 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'aws-sig' | 'digest';

// Key-value pair for params, headers, form data
export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

// Request body configuration
export interface RequestBody {
  type: BodyType;
  raw?: string;
  rawType?: 'text' | 'json' | 'xml' | 'html' | 'javascript';
  formData?: KeyValuePair[];
  urlencoded?: KeyValuePair[];
  binary?: {
    filename: string;
    path: string;
  };
  graphql?: {
    query: string;
    variables: string;
  };
}

// Auth configuration
export interface AuthConfig {
  type: AuthType;
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
    prefix?: string;
  };
  apiKey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
  oauth2?: {
    grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit';
    accessToken?: string;
    refreshToken?: string;
    tokenUrl?: string;
    authUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
  };
}

// HTTP Request configuration
export interface HttpRequest {
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
  settings?: {
    timeout?: number;
    followRedirects?: boolean;
    maxRedirects?: number;
    validateSSL?: boolean;
  };
}

// WebSocket configuration
export interface WebSocketRequest {
  url: string;
  protocols?: string[];
  headers: KeyValuePair[];
  messages: Array<{
    id: string;
    direction: 'sent' | 'received';
    data: string;
    timestamp: number;
    type: 'text' | 'binary';
  }>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

// GraphQL configuration
export interface GraphQLRequest {
  url: string;
  query: string;
  variables: string;
  operationName?: string;
  headers: KeyValuePair[];
  auth: AuthConfig;
}

// SSE configuration
export interface SSERequest {
  url: string;
  headers: KeyValuePair[];
  events: Array<{
    id: string;
    eventType: string;
    data: string;
    timestamp: number;
  }>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastEventId?: string;
}

// Response data
export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyType: 'json' | 'xml' | 'html' | 'text' | 'binary' | 'image';
  size: number;
  time: number;
  timing?: {
    dns: number;
    tcp: number;
    tls: number;
    firstByte: number;
    download: number;
    total: number;
  };
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: string;
    httpOnly: boolean;
    secure: boolean;
  }>;
}

// Tab data structure
export interface Tab {
  id: string;
  type: TabType;
  name: string;
  icon?: string;
  isDirty: boolean;
  isPinned: boolean;
  collectionId?: string;
  folderId?: string;
  requestId?: string; // Reference to saved request
  createdAt: number;
  lastAccessedAt: number;
  
  // Request data based on type
  httpRequest?: HttpRequest;
  websocketRequest?: WebSocketRequest;
  graphqlRequest?: GraphQLRequest;
  sseRequest?: SSERequest;
  
  // Response data
  response?: ResponseData;
  isLoading: boolean;
  error?: string;
}

// Tab store state
interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  maxTabs: number;
  
  // Tab actions
  createTab: (type: TabType, options?: Partial<Tab>) => string;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  closeTabsToLeft: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  duplicateTab: (tabId: string) => string | null;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  
  // Tab data updates
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  updateHttpRequest: (tabId: string, updates: Partial<HttpRequest>) => void;
  updateWebSocketRequest: (tabId: string, updates: Partial<WebSocketRequest>) => void;
  updateGraphQLRequest: (tabId: string, updates: Partial<GraphQLRequest>) => void;
  updateSSERequest: (tabId: string, updates: Partial<SSERequest>) => void;
  setResponse: (tabId: string, response: ResponseData) => void;
  clearResponse: (tabId: string) => void;
  setLoading: (tabId: string, isLoading: boolean) => void;
  setError: (tabId: string, error: string | null) => void;
  markDirty: (tabId: string, isDirty: boolean) => void;
  
  // Utility
  getTab: (tabId: string) => Tab | undefined;
  getActiveTab: () => Tab | undefined;
  hasUnsavedChanges: () => boolean;
}

// Default HTTP request
const createDefaultHttpRequest = (): HttpRequest => ({
  method: 'GET',
  url: '',
  params: [],
  headers: [
    { id: nanoid(), key: 'Content-Type', value: 'application/json', enabled: true },
  ],
  body: {
    type: 'none',
    raw: '',
    rawType: 'json',
    formData: [],
    urlencoded: [],
  },
  auth: {
    type: 'none',
  },
  preRequestScript: '',
  testScript: '',
  settings: {
    timeout: 30000,
    followRedirects: true,
    maxRedirects: 10,
    validateSSL: true,
  },
});

// Default WebSocket request
const createDefaultWebSocketRequest = (): WebSocketRequest => ({
  url: '',
  protocols: [],
  headers: [],
  messages: [],
  connectionStatus: 'disconnected',
});

// Default GraphQL request
const createDefaultGraphQLRequest = (): GraphQLRequest => ({
  url: '',
  query: '',
  variables: '{}',
  headers: [
    { id: nanoid(), key: 'Content-Type', value: 'application/json', enabled: true },
  ],
  auth: {
    type: 'none',
  },
});

// Default SSE request
const createDefaultSSERequest = (): SSERequest => ({
  url: '',
  headers: [],
  events: [],
  connectionStatus: 'disconnected',
});

// Tab name generators
const getDefaultTabName = (type: TabType): string => {
  switch (type) {
    case 'http':
      return 'New Request';
    case 'websocket':
      return 'New WebSocket';
    case 'graphql':
      return 'New GraphQL';
    case 'sse':
      return 'New SSE';
    case 'grpc':
      return 'New gRPC';
    default:
      return 'New Tab';
  }
};

// Create the tab store
export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      maxTabs: 50,

      createTab: (type, options = {}) => {
        const { tabs, maxTabs, activeTabId } = get();
        
        // Check max tabs limit
        if (tabs.length >= maxTabs) {
          // Close oldest non-pinned tab
          const oldestNonPinned = tabs
            .filter(t => !t.isPinned)
            .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)[0];
          
          if (oldestNonPinned) {
            get().closeTab(oldestNonPinned.id);
          }
        }

        const id = nanoid();
        const now = Date.now();
        
        const newTab: Tab = {
          id,
          type,
          name: options.name || getDefaultTabName(type),
          isDirty: false,
          isPinned: false,
          createdAt: now,
          lastAccessedAt: now,
          isLoading: false,
          ...options,
        };

        // Add default request data based on type
        if (type === 'http' && !newTab.httpRequest) {
          newTab.httpRequest = createDefaultHttpRequest();
        } else if (type === 'websocket' && !newTab.websocketRequest) {
          newTab.websocketRequest = createDefaultWebSocketRequest();
        } else if (type === 'graphql' && !newTab.graphqlRequest) {
          newTab.graphqlRequest = createDefaultGraphQLRequest();
        } else if (type === 'sse' && !newTab.sseRequest) {
          newTab.sseRequest = createDefaultSSERequest();
        }

        // Insert after active tab or at end
        const activeIndex = tabs.findIndex(t => t.id === activeTabId);
        const insertIndex = activeIndex >= 0 ? activeIndex + 1 : tabs.length;
        
        const newTabs = [...tabs];
        newTabs.splice(insertIndex, 0, newTab);

        set({
          tabs: newTabs,
          activeTabId: id,
        });

        return id;
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        
        if (tabIndex === -1) return;

        const newTabs = tabs.filter(t => t.id !== tabId);
        
        // Determine new active tab
        let newActiveTabId = activeTabId;
        if (activeTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveTabId = null;
          } else if (tabIndex >= newTabs.length) {
            newActiveTabId = newTabs[newTabs.length - 1].id;
          } else {
            newActiveTabId = newTabs[tabIndex].id;
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveTabId,
        });
      },

      closeAllTabs: () => {
        const { tabs } = get();
        const pinnedTabs = tabs.filter(t => t.isPinned);
        
        set({
          tabs: pinnedTabs,
          activeTabId: pinnedTabs.length > 0 ? pinnedTabs[0].id : null,
        });
      },

      closeOtherTabs: (tabId) => {
        const { tabs } = get();
        const tab = tabs.find(t => t.id === tabId);
        
        if (!tab) return;

        const remainingTabs = tabs.filter(t => t.id === tabId || t.isPinned);
        
        set({
          tabs: remainingTabs,
          activeTabId: tabId,
        });
      },

      closeTabsToRight: (tabId) => {
        const { tabs, activeTabId } = get();
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        
        if (tabIndex === -1) return;

        const remainingTabs = tabs.filter((t, i) => i <= tabIndex || t.isPinned);
        const activeStillExists = remainingTabs.some(t => t.id === activeTabId);
        
        set({
          tabs: remainingTabs,
          activeTabId: activeStillExists ? activeTabId : tabId,
        });
      },

      closeTabsToLeft: (tabId) => {
        const { tabs, activeTabId } = get();
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        
        if (tabIndex === -1) return;

        const remainingTabs = tabs.filter((t, i) => i >= tabIndex || t.isPinned);
        const activeStillExists = remainingTabs.some(t => t.id === activeTabId);
        
        set({
          tabs: remainingTabs,
          activeTabId: activeStillExists ? activeTabId : tabId,
        });
      },

      setActiveTab: (tabId) => {
        const { tabs } = get();
        const tab = tabs.find(t => t.id === tabId);
        
        if (!tab) return;

        set({
          activeTabId: tabId,
          tabs: tabs.map(t => 
            t.id === tabId 
              ? { ...t, lastAccessedAt: Date.now() }
              : t
          ),
        });
      },

      reorderTabs: (fromIndex, toIndex) => {
        const { tabs } = get();
        
        if (fromIndex < 0 || fromIndex >= tabs.length) return;
        if (toIndex < 0 || toIndex >= tabs.length) return;

        const newTabs = [...tabs];
        const [movedTab] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, movedTab);

        set({ tabs: newTabs });
      },

      duplicateTab: (tabId) => {
        const { tabs } = get();
        const tab = tabs.find(t => t.id === tabId);
        
        if (!tab) return null;

        const newTabId = get().createTab(tab.type, {
          name: `${tab.name} (Copy)`,
          httpRequest: tab.httpRequest ? { ...tab.httpRequest } : undefined,
          websocketRequest: tab.websocketRequest ? { ...tab.websocketRequest } : undefined,
          graphqlRequest: tab.graphqlRequest ? { ...tab.graphqlRequest } : undefined,
          sseRequest: tab.sseRequest ? { ...tab.sseRequest } : undefined,
          collectionId: tab.collectionId,
          folderId: tab.folderId,
        });

        return newTabId;
      },

      pinTab: (tabId) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId ? { ...t, isPinned: true } : t
          ),
        });
      },

      unpinTab: (tabId) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId ? { ...t, isPinned: false } : t
          ),
        });
      },

      updateTab: (tabId, updates) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId ? { ...t, ...updates } : t
          ),
        });
      },

      updateHttpRequest: (tabId, updates) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId && t.httpRequest
              ? { 
                  ...t, 
                  httpRequest: { ...t.httpRequest, ...updates },
                  isDirty: true,
                }
              : t
          ),
        });
      },

      updateWebSocketRequest: (tabId, updates) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId && t.websocketRequest
              ? { 
                  ...t, 
                  websocketRequest: { ...t.websocketRequest, ...updates },
                  isDirty: true,
                }
              : t
          ),
        });
      },

      updateGraphQLRequest: (tabId, updates) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId && t.graphqlRequest
              ? { 
                  ...t, 
                  graphqlRequest: { ...t.graphqlRequest, ...updates },
                  isDirty: true,
                }
              : t
          ),
        });
      },

      updateSSERequest: (tabId, updates) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId && t.sseRequest
              ? { 
                  ...t, 
                  sseRequest: { ...t.sseRequest, ...updates },
                  isDirty: true,
                }
              : t
          ),
        });
      },

      setResponse: (tabId, response) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId
              ? { ...t, response, isLoading: false, error: undefined }
              : t
          ),
        });
      },

      clearResponse: (tabId) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId
              ? { ...t, response: undefined, error: undefined }
              : t
          ),
        });
      },

      setLoading: (tabId, isLoading) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId ? { ...t, isLoading } : t
          ),
        });
      },

      setError: (tabId, error) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId
              ? { ...t, error: error || undefined, isLoading: false }
              : t
          ),
        });
      },

      markDirty: (tabId, isDirty) => {
        const { tabs } = get();
        
        set({
          tabs: tabs.map(t => 
            t.id === tabId ? { ...t, isDirty } : t
          ),
        });
      },

      getTab: (tabId) => {
        return get().tabs.find(t => t.id === tabId);
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find(t => t.id === activeTabId);
      },

      hasUnsavedChanges: () => {
        return get().tabs.some(t => t.isDirty);
      },
    }),
    {
      name: 'wiresniff-tabs',
      partialize: (state) => ({
        tabs: state.tabs.map(tab => ({
          ...tab,
          // Don't persist response data or loading state
          response: undefined,
          isLoading: false,
          error: undefined,
          // Don't persist WebSocket/SSE connection state
          websocketRequest: tab.websocketRequest 
            ? { ...tab.websocketRequest, connectionStatus: 'disconnected' as const, messages: [] }
            : undefined,
          sseRequest: tab.sseRequest
            ? { ...tab.sseRequest, connectionStatus: 'disconnected' as const, events: [] }
            : undefined,
        })),
        activeTabId: state.activeTabId,
      }),
    }
  )
);

export default useTabStore;