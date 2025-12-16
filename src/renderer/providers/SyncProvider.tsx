import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import type { SyncStatus } from '../types/electron';

interface SyncContextType {
  status: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingChanges: number;
  error: string | null;
  startSync: () => Promise<void>;
  stopSync: () => Promise<void>;
  forceSync: () => Promise<void>;
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
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { isAuthenticated, profile } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(defaultStatus);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Check if user has sync enabled (paid tier)
  const canSync = isAuthenticated && profile?.subscriptionTier !== 'free';

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

  const value: SyncContextType = {
    status,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    lastSyncedAt,
    pendingChanges: status.pendingChanges,
    error: status.error || null,
    startSync,
    stopSync,
    forceSync,
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