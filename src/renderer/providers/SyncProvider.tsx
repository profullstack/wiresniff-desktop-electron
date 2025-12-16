import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import type { SyncStatus } from '../types/electron';

// Types for syncable data
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

interface SyncContextType {
  status: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingChanges: number;
  error: string | null;
  
  // Basic sync controls
  startSync: () => Promise<void>;
  stopSync: () => Promise<void>;
  forceSync: () => Promise<void>;
  
  // Capture session sync
  syncCaptureSessions: () => Promise<void>;
  saveCapture: (session: CaptureSession) => Promise<{ success: boolean; error?: string }>;
  getCaptures: (workspaceId?: string) => Promise<CaptureSession[]>;
  deleteCapture: (id: string) => Promise<{ success: boolean; error?: string }>;
  shareCapture: (id: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Replay session sync
  syncReplaySessions: () => Promise<void>;
  saveReplay: (session: ReplaySession) => Promise<{ success: boolean; error?: string }>;
  getReplays: (captureSessionId?: string) => Promise<ReplaySession[]>;
  deleteReplay: (id: string) => Promise<{ success: boolean; error?: string }>;
  
  // Diff result sync
  syncDiffResults: () => Promise<void>;
  saveDiff: (diff: DiffResult) => Promise<{ success: boolean; error?: string }>;
  getDiffs: (workspaceId?: string) => Promise<DiffResult[]>;
  deleteDiff: (id: string) => Promise<{ success: boolean; error?: string }>;
  
  // Traffic session sync
  syncTrafficSessions: () => Promise<void>;
  saveTrafficSession: (session: TrafficSession) => Promise<{ success: boolean; error?: string }>;
  getTrafficSessions: (workspaceId?: string) => Promise<TrafficSession[]>;
  deleteTrafficSession: (id: string) => Promise<{ success: boolean; error?: string }>;
  shareTrafficSession: (id: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
}

const defaultStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingChanges: 0,
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

/**
 * SyncProvider Component
 * Manages data synchronization between local database and Supabase cloud
 * Supports syncing:
 * - Collections and requests
 * - Environments and variables
 * - Capture sessions (Feature 1)
 * - Replay sessions (Feature 1)
 * - Diff results (Feature 1)
 * - Traffic sessions (Feature 6)
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { isAuthenticated, profile } = useAuth();
  const { canUseCloudSync } = useSubscriptionStore();
  const [status, setStatus] = useState<SyncStatus>(defaultStatus);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Check if user has sync enabled (paid tier)
  const canSync = isAuthenticated && canUseCloudSync();

  // Check if Electron API is available
  const api = window.electronAPI?.sync;

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to sync status changes from Electron
  useEffect(() => {
    if (!api) return;

    const unsubscribe = api.onStatusChange((newStatus: SyncStatus) => {
      setStatus(newStatus);
      if (newStatus.lastSyncedAt) {
        setLastSyncedAt(new Date(newStatus.lastSyncedAt));
      }
    });

    // Get initial status
    api.getStatus().then((initialStatus: SyncStatus) => {
      setStatus(initialStatus);
      if (initialStatus.lastSyncedAt) {
        setLastSyncedAt(new Date(initialStatus.lastSyncedAt));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [api]);

  // Auto-start sync when user is authenticated and has sync enabled
  useEffect(() => {
    if (canSync && status.isOnline && api) {
      api.start().catch(console.error);
    }

    return () => {
      if (api) {
        api.stop().catch(console.error);
      }
    };
  }, [canSync, status.isOnline, api]);

  // Start sync
  const startSync = useCallback(async () => {
    if (!api || !canSync) return;
    try {
      await api.start();
    } catch (error) {
      console.error('Error starting sync:', error);
    }
  }, [api, canSync]);

  // Stop sync
  const stopSync = useCallback(async () => {
    if (!api) return;
    try {
      await api.stop();
    } catch (error) {
      console.error('Error stopping sync:', error);
    }
  }, [api]);

  // Force immediate sync
  const forceSync = useCallback(async () => {
    if (!api || !canSync || !status.isOnline) return;
    try {
      // Stop and restart to force immediate sync
      await api.stop();
      await api.start();
    } catch (error) {
      console.error('Error forcing sync:', error);
    }
  }, [api, canSync, status.isOnline]);

  // ============================================
  // CAPTURE SESSION SYNC (Feature 1)
  // ============================================
  
  const syncCaptureSessions = useCallback(async () => {
    if (!api || !canSync || !status.isOnline) return;
    try {
      await api.syncCaptures?.();
    } catch (error) {
      console.error('Error syncing capture sessions:', error);
    }
  }, [api, canSync, status.isOnline]);

  const saveCapture = useCallback(async (session: CaptureSession): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.saveCapture?.(session);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save capture';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const getCaptures = useCallback(async (workspaceId?: string): Promise<CaptureSession[]> => {
    if (!api || !canSync) return [];
    try {
      return await api.getCaptures?.(workspaceId) || [];
    } catch (error) {
      console.error('Error getting captures:', error);
      return [];
    }
  }, [api, canSync]);

  const deleteCapture = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.deleteCapture?.(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete capture';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const shareCapture = useCallback(async (id: string, workspaceId: string): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.shareCapture?.(id, workspaceId);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share capture';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  // ============================================
  // REPLAY SESSION SYNC (Feature 1)
  // ============================================

  const syncReplaySessions = useCallback(async () => {
    if (!api || !canSync || !status.isOnline) return;
    try {
      await api.syncReplays?.();
    } catch (error) {
      console.error('Error syncing replay sessions:', error);
    }
  }, [api, canSync, status.isOnline]);

  const saveReplay = useCallback(async (session: ReplaySession): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.saveReplay?.(session);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save replay';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const getReplays = useCallback(async (captureSessionId?: string): Promise<ReplaySession[]> => {
    if (!api || !canSync) return [];
    try {
      return await api.getReplays?.(captureSessionId) || [];
    } catch (error) {
      console.error('Error getting replays:', error);
      return [];
    }
  }, [api, canSync]);

  const deleteReplay = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.deleteReplay?.(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete replay';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  // ============================================
  // DIFF RESULT SYNC (Feature 1)
  // ============================================

  const syncDiffResults = useCallback(async () => {
    if (!api || !canSync || !status.isOnline) return;
    try {
      await api.syncDiffs?.();
    } catch (error) {
      console.error('Error syncing diff results:', error);
    }
  }, [api, canSync, status.isOnline]);

  const saveDiff = useCallback(async (diff: DiffResult): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.saveDiff?.(diff);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save diff';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const getDiffs = useCallback(async (workspaceId?: string): Promise<DiffResult[]> => {
    if (!api || !canSync) return [];
    try {
      return await api.getDiffs?.(workspaceId) || [];
    } catch (error) {
      console.error('Error getting diffs:', error);
      return [];
    }
  }, [api, canSync]);

  const deleteDiff = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.deleteDiff?.(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete diff';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  // ============================================
  // TRAFFIC SESSION SYNC (Feature 6)
  // ============================================

  const syncTrafficSessions = useCallback(async () => {
    if (!api || !canSync || !status.isOnline) return;
    try {
      await api.syncTrafficSessions?.();
    } catch (error) {
      console.error('Error syncing traffic sessions:', error);
    }
  }, [api, canSync, status.isOnline]);

  const saveTrafficSession = useCallback(async (session: TrafficSession): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.saveTrafficSession?.(session);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save traffic session';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const getTrafficSessions = useCallback(async (workspaceId?: string): Promise<TrafficSession[]> => {
    if (!api || !canSync) return [];
    try {
      return await api.getTrafficSessions?.(workspaceId) || [];
    } catch (error) {
      console.error('Error getting traffic sessions:', error);
      return [];
    }
  }, [api, canSync]);

  const deleteTrafficSession = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.deleteTrafficSession?.(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete traffic session';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const shareTrafficSession = useCallback(async (id: string, workspaceId: string): Promise<{ success: boolean; error?: string }> => {
    if (!api || !canSync) {
      return { success: false, error: 'Cloud sync not available' };
    }
    try {
      await api.shareTrafficSession?.(id, workspaceId);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share traffic session';
      return { success: false, error: message };
    }
  }, [api, canSync]);

  const value: SyncContextType = {
    status,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    lastSyncedAt,
    pendingChanges: status.pendingChanges,
    error: status.error || null,
    
    // Basic sync controls
    startSync,
    stopSync,
    forceSync,
    
    // Capture session sync
    syncCaptureSessions,
    saveCapture,
    getCaptures,
    deleteCapture,
    shareCapture,
    
    // Replay session sync
    syncReplaySessions,
    saveReplay,
    getReplays,
    deleteReplay,
    
    // Diff result sync
    syncDiffResults,
    saveDiff,
    getDiffs,
    deleteDiff,
    
    // Traffic session sync
    syncTrafficSessions,
    saveTrafficSession,
    getTrafficSessions,
    deleteTrafficSession,
    shareTrafficSession,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Hook to access sync context
 */
export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export default SyncProvider;