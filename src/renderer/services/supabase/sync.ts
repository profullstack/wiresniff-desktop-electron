/**
 * Supabase Sync Service
 * 
 * Handles synchronization between local SQLite database and Supabase cloud storage.
 */

import { supabase, isSupabaseConfigured, getCurrentUser } from './client';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
  error: string | null;
}

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  error: string | null;
}

// Table names that support sync
const SYNCABLE_TABLES = [
  'collections',
  'folders',
  'requests',
  'environments',
  'environment_variables',
  'global_variables',
  'settings',
  'websocket_connections',
  'graphql_requests',
  'sse_connections',
] as const;

type SyncableTable = typeof SYNCABLE_TABLES[number];

/**
 * Sync Service class
 */
class SyncService {
  private status: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: 0,
    error: null,
  };

  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Subscribe to status changes
   */
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((callback) => callback(status));
  }

  /**
   * Set online status
   */
  private setOnline(isOnline: boolean): void {
    this.status.isOnline = isOnline;
    this.notifyListeners();

    // Trigger sync when coming back online
    if (isOnline && this.status.pendingChanges > 0) {
      this.sync();
    }
  }

  /**
   * Start automatic sync
   */
  startAutoSync(intervalMs = 60000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.status.isOnline && !this.status.isSyncing) {
        this.sync();
      }
    }, intervalMs);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform full sync
   */
  async sync(): Promise<SyncResult> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        error: 'Supabase not configured',
      };
    }

    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        error: 'User not authenticated',
      };
    }

    if (this.status.isSyncing) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        error: 'Sync already in progress',
      };
    }

    this.status.isSyncing = true;
    this.status.error = null;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      error: null,
    };

    try {
      // Process sync queue (upload local changes)
      const uploadResult = await this.uploadChanges(user.id);
      result.uploaded = uploadResult.count;

      // Download remote changes
      const downloadResult = await this.downloadChanges(user.id);
      result.downloaded = downloadResult.count;
      result.conflicts = downloadResult.conflicts;

      this.status.lastSyncAt = new Date().toISOString();
      this.status.pendingChanges = 0;
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown sync error';
      this.status.error = result.error;
    } finally {
      this.status.isSyncing = false;
      this.notifyListeners();
    }

    return result;
  }

  /**
   * Upload local changes to Supabase
   */
  private async uploadChanges(userId: string): Promise<{ count: number }> {
    // Get pending changes from sync queue via IPC
    const syncQueue = await window.electron.invoke('db:getSyncQueue');
    let count = 0;

    for (const item of syncQueue) {
      try {
        const { table_name, record_id, operation, data } = item;
        const parsedData = JSON.parse(data);

        switch (operation) {
          case 'INSERT':
          case 'UPDATE':
            await this.upsertToSupabase(table_name, { ...parsedData, user_id: userId });
            break;
          case 'DELETE':
            await this.deleteFromSupabase(table_name, record_id);
            break;
        }

        // Mark as synced
        await window.electron.invoke('db:markSynced', item.id);
        count++;
      } catch (error) {
        console.error(`[Sync] Failed to upload change:`, error);
        await window.electron.invoke('db:markSyncError', item.id, 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    return { count };
  }

  /**
   * Download remote changes from Supabase
   */
  private async downloadChanges(userId: string): Promise<{ count: number; conflicts: number }> {
    let count = 0;
    let conflicts = 0;

    for (const table of SYNCABLE_TABLES) {
      try {
        // Get last sync timestamp for this table
        const lastSync = await window.electron.invoke('db:getLastSync', table);
        
        // Fetch changes from Supabase
        let query = supabase
          .from(table)
          .select('*')
          .eq('user_id', userId);

        if (lastSync) {
          query = query.gt('updated_at', lastSync);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`[Sync] Failed to fetch ${table}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          for (const record of data) {
            const result = await this.mergeRecord(table, record);
            if (result.merged) count++;
            if (result.conflict) conflicts++;
          }
        }
      } catch (error) {
        console.error(`[Sync] Error downloading ${table}:`, error);
      }
    }

    return { count, conflicts };
  }

  /**
   * Upsert a record to Supabase
   */
  private async upsertToSupabase(table: string, data: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from(table)
      .upsert(data, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  /**
   * Delete a record from Supabase
   */
  private async deleteFromSupabase(table: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Merge a remote record with local data
   */
  private async mergeRecord(table: string, remoteRecord: Record<string, unknown>): Promise<{
    merged: boolean;
    conflict: boolean;
  }> {
    const localRecord = await window.electron.invoke(`db:getById`, table, remoteRecord.id);

    if (!localRecord) {
      // No local record, insert remote
      await window.electron.invoke(`db:insert`, table, remoteRecord);
      return { merged: true, conflict: false };
    }

    // Check for conflicts (both modified since last sync)
    const localUpdated = new Date(localRecord.updated_at as string).getTime();
    const remoteUpdated = new Date(remoteRecord.updated_at as string).getTime();
    const localSynced = localRecord.synced_at 
      ? new Date(localRecord.synced_at as string).getTime() 
      : 0;

    if (localUpdated > localSynced && remoteUpdated > localSynced) {
      // Conflict: both modified
      // Use "last write wins" strategy by default
      if (remoteUpdated > localUpdated) {
        await window.electron.invoke(`db:update`, table, remoteRecord.id, remoteRecord);
        return { merged: true, conflict: true };
      } else {
        // Keep local, but mark as needing sync
        return { merged: false, conflict: true };
      }
    }

    if (remoteUpdated > localUpdated) {
      // Remote is newer, update local
      await window.electron.invoke(`db:update`, table, remoteRecord.id, remoteRecord);
      return { merged: true, conflict: false };
    }

    return { merged: false, conflict: false };
  }

  /**
   * Increment pending changes count
   */
  incrementPendingChanges(): void {
    this.status.pendingChanges++;
    this.notifyListeners();
  }

  /**
   * Force sync now
   */
  async forceSync(): Promise<SyncResult> {
    return this.sync();
  }

  /**
   * Reset sync state
   */
  async resetSync(): Promise<void> {
    this.status.lastSyncAt = null;
    this.status.pendingChanges = 0;
    this.status.error = null;
    this.notifyListeners();

    // Clear sync queue
    await window.electron.invoke('db:clearSyncQueue');
  }
}

// Export singleton instance
export const syncService = new SyncService();

// Export types
export type { SyncableTable };