import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type {
  Collection,
  Request,
  Environment,
  HistoryEntry,
} from '../types/electron';

interface DatabaseContextType {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;

  // Collections
  collections: Collection[];
  getCollection: (id: string) => Promise<Collection | null>;
  createCollection: (data: Partial<Collection>) => Promise<Collection>;
  updateCollection: (id: string, data: Partial<Collection>) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  refreshCollections: () => Promise<void>;

  // Requests
  requests: Request[];
  getRequest: (id: string) => Promise<Request | null>;
  getRequestsByCollection: (collectionId: string) => Promise<Request[]>;
  createRequest: (data: Partial<Request>) => Promise<Request>;
  updateRequest: (id: string, data: Partial<Request>) => Promise<Request>;
  deleteRequest: (id: string) => Promise<void>;
  refreshRequests: () => Promise<void>;

  // Environments
  environments: Environment[];
  activeEnvironment: Environment | null;
  getEnvironment: (id: string) => Promise<Environment | null>;
  createEnvironment: (data: Partial<Environment>) => Promise<Environment>;
  updateEnvironment: (id: string, data: Partial<Environment>) => Promise<Environment>;
  deleteEnvironment: (id: string) => Promise<void>;
  setActiveEnvironment: (id: string | null) => Promise<void>;
  refreshEnvironments: () => Promise<void>;

  // History
  history: HistoryEntry[];
  getHistoryEntry: (id: string) => Promise<HistoryEntry | null>;
  addHistoryEntry: (data: Partial<HistoryEntry>) => Promise<HistoryEntry>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;

  // Settings
  getSetting: <T = unknown>(key: string) => Promise<T | null>;
  setSetting: <T = unknown>(key: string, value: T) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * DatabaseProvider Component
 * Provides access to local database operations via Electron IPC
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironment, setActiveEnvironmentState] = useState<Environment | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Check if Electron API is available
  const api = window.electronAPI?.db;

  // Initialize database
  useEffect(() => {
    const initDatabase = async () => {
      if (!api) {
        // Running in browser mode (development)
        console.warn('Electron API not available, using mock data');
        setIsReady(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Load initial data
        const [collectionsData, requestsData, environmentsData, historyData] = await Promise.all([
          api.collections.getAll(),
          api.requests.getAll(),
          api.environments.getAll(),
          api.history.getAll(100),
        ]);

        setCollections(collectionsData);
        setRequests(requestsData);
        setEnvironments(environmentsData);
        setHistory(historyData);

        // Get active environment
        const activeEnvId = await api.settings.get<string>('activeEnvironmentId');
        if (activeEnvId) {
          const activeEnv = environmentsData.find((e: Environment) => e.id === activeEnvId);
          setActiveEnvironmentState(activeEnv || null);
        }

        setIsReady(true);
      } catch (err) {
        console.error('Error initializing database:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    initDatabase();
  }, []);

  // Collection operations
  const getCollection = async (id: string): Promise<Collection | null> => {
    if (!api) return null;
    return api.collections.getById(id);
  };

  const createCollection = async (data: Partial<Collection>): Promise<Collection> => {
    if (!api) throw new Error('Database not available');
    const collection = await api.collections.create(data);
    setCollections((prev) => [...prev, collection]);
    return collection;
  };

  const updateCollection = async (id: string, data: Partial<Collection>): Promise<Collection> => {
    if (!api) throw new Error('Database not available');
    const collection = await api.collections.update(id, data);
    setCollections((prev) => prev.map((c) => (c.id === id ? collection : c)));
    return collection;
  };

  const deleteCollection = async (id: string): Promise<void> => {
    if (!api) throw new Error('Database not available');
    await api.collections.delete(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
    // Also remove requests in this collection
    setRequests((prev) => prev.filter((r) => r.collectionId !== id));
  };

  const refreshCollections = async (): Promise<void> => {
    if (!api) return;
    const data = await api.collections.getAll();
    setCollections(data);
  };

  // Request operations
  const getRequest = async (id: string): Promise<Request | null> => {
    if (!api) return null;
    return api.requests.getById(id);
  };

  const getRequestsByCollection = async (collectionId: string): Promise<Request[]> => {
    if (!api) return [];
    return api.requests.getByCollection(collectionId);
  };

  const createRequest = async (data: Partial<Request>): Promise<Request> => {
    if (!api) throw new Error('Database not available');
    const request = await api.requests.create(data);
    setRequests((prev) => [...prev, request]);
    return request;
  };

  const updateRequest = async (id: string, data: Partial<Request>): Promise<Request> => {
    if (!api) throw new Error('Database not available');
    const request = await api.requests.update(id, data);
    setRequests((prev) => prev.map((r) => (r.id === id ? request : r)));
    return request;
  };

  const deleteRequest = async (id: string): Promise<void> => {
    if (!api) throw new Error('Database not available');
    await api.requests.delete(id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const refreshRequests = async (): Promise<void> => {
    if (!api) return;
    const data = await api.requests.getAll();
    setRequests(data);
  };

  // Environment operations
  const getEnvironment = async (id: string): Promise<Environment | null> => {
    if (!api) return null;
    return api.environments.getById(id);
  };

  const createEnvironment = async (data: Partial<Environment>): Promise<Environment> => {
    if (!api) throw new Error('Database not available');
    const environment = await api.environments.create(data);
    setEnvironments((prev) => [...prev, environment]);
    return environment;
  };

  const updateEnvironment = async (id: string, data: Partial<Environment>): Promise<Environment> => {
    if (!api) throw new Error('Database not available');
    const environment = await api.environments.update(id, data);
    setEnvironments((prev) => prev.map((e) => (e.id === id ? environment : e)));
    if (activeEnvironment?.id === id) {
      setActiveEnvironmentState(environment);
    }
    return environment;
  };

  const deleteEnvironment = async (id: string): Promise<void> => {
    if (!api) throw new Error('Database not available');
    await api.environments.delete(id);
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
    if (activeEnvironment?.id === id) {
      setActiveEnvironmentState(null);
      await api.settings.set('activeEnvironmentId', null);
    }
  };

  const setActiveEnvironment = async (id: string | null): Promise<void> => {
    if (!api) return;
    await api.settings.set('activeEnvironmentId', id);
    if (id) {
      const env = environments.find((e) => e.id === id);
      setActiveEnvironmentState(env || null);
    } else {
      setActiveEnvironmentState(null);
    }
  };

  const refreshEnvironments = async (): Promise<void> => {
    if (!api) return;
    const data = await api.environments.getAll();
    setEnvironments(data);
  };

  // History operations
  const getHistoryEntry = async (id: string): Promise<HistoryEntry | null> => {
    if (!api) return null;
    return api.history.getById(id);
  };

  const addHistoryEntry = async (data: Partial<HistoryEntry>): Promise<HistoryEntry> => {
    if (!api) throw new Error('Database not available');
    const entry = await api.history.create(data);
    setHistory((prev) => [entry, ...prev].slice(0, 100)); // Keep last 100 entries
    return entry;
  };

  const deleteHistoryEntry = async (id: string): Promise<void> => {
    if (!api) throw new Error('Database not available');
    await api.history.delete(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const clearHistory = async (): Promise<void> => {
    if (!api) throw new Error('Database not available');
    await api.history.clear();
    setHistory([]);
  };

  const refreshHistory = async (): Promise<void> => {
    if (!api) return;
    const data = await api.history.getAll(100);
    setHistory(data);
  };

  // Settings operations
  const getSetting = async <T = unknown>(key: string): Promise<T | null> => {
    if (!api) return null;
    return api.settings.get<T>(key);
  };

  const setSetting = async <T = unknown>(key: string, value: T): Promise<void> => {
    if (!api) return;
    await api.settings.set(key, value);
  };

  const value: DatabaseContextType = {
    isReady,
    isLoading,
    error,
    collections,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    refreshCollections,
    requests,
    getRequest,
    getRequestsByCollection,
    createRequest,
    updateRequest,
    deleteRequest,
    refreshRequests,
    environments,
    activeEnvironment,
    getEnvironment,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    refreshEnvironments,
    history,
    getHistoryEntry,
    addHistoryEntry,
    deleteHistoryEntry,
    clearHistory,
    refreshHistory,
    getSetting,
    setSetting,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to access database context
 */
export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export default DatabaseProvider;