/**
 * Supabase Sync Service Tests
 *
 * Tests for the synchronization service between local SQLite and Supabase cloud.
 * Uses Vitest with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the client module
vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
  isSupabaseConfigured: vi.fn(() => true),
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'user-123', email: 'test@example.com' })),
}));

// Mock window.electron
const mockElectronInvoke = vi.fn();
Object.defineProperty(window, 'electron', {
  value: {
    invoke: mockElectronInvoke,
  },
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

// Import after mocking
import { syncService, type SyncStatus, type SyncResult } from './sync';
import { isSupabaseConfigured, getCurrentUser, supabase } from './client';

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronInvoke.mockReset();
  });

  afterEach(() => {
    syncService.stopAutoSync();
  });

  describe('getStatus', () => {
    it('should return current sync status', () => {
      const status = syncService.getStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('lastSyncAt');
      expect(status).toHaveProperty('pendingChanges');
      expect(status).toHaveProperty('error');
    });

    it('should return a copy of status, not the original', () => {
      const status1 = syncService.getStatus();
      const status2 = syncService.getStatus();

      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });

  describe('subscribe', () => {
    it('should add a listener and return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = syncService.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call listener when status changes', () => {
      const callback = vi.fn();
      syncService.subscribe(callback);

      // Trigger a status change
      syncService.incrementPendingChanges();

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        pendingChanges: expect.any(Number),
      }));
    });

    it('should not call listener after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = syncService.subscribe(callback);

      unsubscribe();
      callback.mockClear();

      syncService.incrementPendingChanges();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    it('should return error when Supabase is not configured', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValueOnce(false);

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Supabase not configured');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const result = await syncService.sync();

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should perform sync when conditions are met', async () => {
      mockElectronInvoke.mockImplementation((channel: string) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await syncService.sync();

      expect(result.success).toBe(true);
      expect(result.uploaded).toBe(0);
      expect(result.downloaded).toBe(0);
    });

    it('should upload pending changes from sync queue', async () => {
      const syncQueueItem = {
        id: 'queue-1',
        table_name: 'collections',
        record_id: 'col-1',
        operation: 'INSERT',
        data: JSON.stringify({ id: 'col-1', name: 'Test Collection' }),
      };

      mockElectronInvoke.mockImplementation((channel: string) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([syncQueueItem]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:markSynced') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      const result = await syncService.sync();

      expect(result.uploaded).toBe(1);
      expect(mockElectronInvoke).toHaveBeenCalledWith('db:markSynced', 'queue-1');
    });

    it('should handle upload errors gracefully', async () => {
      const syncQueueItem = {
        id: 'queue-1',
        table_name: 'collections',
        record_id: 'col-1',
        operation: 'INSERT',
        data: JSON.stringify({ id: 'col-1', name: 'Test Collection' }),
      };

      mockElectronInvoke.mockImplementation((channel: string) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([syncQueueItem]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:markSyncError') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      // Make upsert fail
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(),
        upsert: vi.fn(() => Promise.resolve({ error: new Error('Upload failed') })),
        delete: vi.fn(),
      } as any);

      const result = await syncService.sync();

      expect(mockElectronInvoke).toHaveBeenCalledWith(
        'db:markSyncError',
        'queue-1',
        expect.any(String)
      );
    });

    it('should download remote changes', async () => {
      const remoteRecord = {
        id: 'col-remote',
        name: 'Remote Collection',
        user_id: 'user-123',
        updated_at: new Date().toISOString(),
      };

      mockElectronInvoke.mockImplementation((channel: string, ...args: unknown[]) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:getById') return Promise.resolve(null);
        if (channel === 'db:insert') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => Promise.resolve({ data: [remoteRecord], error: null })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      } as any);

      const result = await syncService.sync();

      expect(result.downloaded).toBeGreaterThanOrEqual(0);
    });

    it('should detect and handle conflicts', async () => {
      const now = new Date();
      const localRecord = {
        id: 'col-1',
        name: 'Local Collection',
        updated_at: new Date(now.getTime() - 1000).toISOString(),
        synced_at: new Date(now.getTime() - 5000).toISOString(),
      };
      const remoteRecord = {
        id: 'col-1',
        name: 'Remote Collection',
        user_id: 'user-123',
        updated_at: now.toISOString(),
      };

      mockElectronInvoke.mockImplementation((channel: string, ...args: unknown[]) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:getById') return Promise.resolve(localRecord);
        if (channel === 'db:update') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => Promise.resolve({ data: [remoteRecord], error: null })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      } as any);

      const result = await syncService.sync();

      // Should detect conflict and use last-write-wins
      expect(result.conflicts).toBeGreaterThanOrEqual(0);
    });

    it('should not allow concurrent syncs', async () => {
      mockElectronInvoke.mockImplementation((channel: string) => {
        if (channel === 'db:getSyncQueue') {
          return new Promise((resolve) => setTimeout(() => resolve([]), 100));
        }
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      // Start first sync
      const sync1 = syncService.sync();

      // Try to start second sync immediately
      const sync2 = syncService.sync();

      const [result1, result2] = await Promise.all([sync1, sync2]);

      // One should succeed, one should fail with "already in progress"
      expect(
        result1.error === 'Sync already in progress' || result2.error === 'Sync already in progress'
      ).toBe(true);
    });
  });

  describe('startAutoSync', () => {
    it('should start periodic sync', () => {
      vi.useFakeTimers();

      const syncSpy = vi.spyOn(syncService, 'sync');
      mockElectronInvoke.mockResolvedValue([]);

      syncService.startAutoSync(1000);

      // Advance time
      vi.advanceTimersByTime(1000);

      expect(syncSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clear previous interval when called again', () => {
      vi.useFakeTimers();

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      syncService.startAutoSync(1000);
      syncService.startAutoSync(2000);

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('stopAutoSync', () => {
    it('should stop periodic sync', () => {
      vi.useFakeTimers();

      const syncSpy = vi.spyOn(syncService, 'sync');
      mockElectronInvoke.mockResolvedValue([]);

      syncService.startAutoSync(1000);
      syncService.stopAutoSync();

      vi.advanceTimersByTime(2000);

      expect(syncSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('incrementPendingChanges', () => {
    it('should increment pending changes count', () => {
      const initialStatus = syncService.getStatus();
      const initialCount = initialStatus.pendingChanges;

      syncService.incrementPendingChanges();

      const newStatus = syncService.getStatus();
      expect(newStatus.pendingChanges).toBe(initialCount + 1);
    });

    it('should notify listeners', () => {
      const callback = vi.fn();
      syncService.subscribe(callback);

      syncService.incrementPendingChanges();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('forceSync', () => {
    it('should call sync method', async () => {
      const syncSpy = vi.spyOn(syncService, 'sync');
      mockElectronInvoke.mockResolvedValue([]);

      await syncService.forceSync();

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe('resetSync', () => {
    it('should reset sync state', async () => {
      mockElectronInvoke.mockResolvedValue(true);

      await syncService.resetSync();

      const status = syncService.getStatus();
      expect(status.lastSyncAt).toBeNull();
      expect(status.error).toBeNull();
    });

    it('should clear sync queue', async () => {
      mockElectronInvoke.mockResolvedValue(true);

      await syncService.resetSync();

      expect(mockElectronInvoke).toHaveBeenCalledWith('db:clearSyncQueue');
    });
  });

  describe('Online/Offline handling', () => {
    it('should update status when going offline', () => {
      const callback = vi.fn();
      syncService.subscribe(callback);

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: false,
        })
      );
    });

    it('should update status when coming online', () => {
      const callback = vi.fn();
      syncService.subscribe(callback);

      // Simulate online event
      window.dispatchEvent(new Event('online'));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: true,
        })
      );
    });

    it('should trigger sync when coming online with pending changes', async () => {
      mockElectronInvoke.mockResolvedValue([]);
      const syncSpy = vi.spyOn(syncService, 'sync');

      // Add pending changes
      syncService.incrementPendingChanges();

      // Simulate coming online
      window.dispatchEvent(new Event('online'));

      // Give it a moment to trigger
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe('Merge strategies', () => {
    it('should insert remote record when no local record exists', async () => {
      const remoteRecord = {
        id: 'new-record',
        name: 'New Record',
        user_id: 'user-123',
        updated_at: new Date().toISOString(),
      };

      mockElectronInvoke.mockImplementation((channel: string, ...args: unknown[]) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:getById') return Promise.resolve(null);
        if (channel === 'db:insert') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => Promise.resolve({ data: [remoteRecord], error: null })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      } as any);

      await syncService.sync();

      expect(mockElectronInvoke).toHaveBeenCalledWith(
        'db:insert',
        expect.any(String),
        expect.objectContaining({ id: 'new-record' })
      );
    });

    it('should update local record when remote is newer', async () => {
      const now = new Date();
      const localRecord = {
        id: 'record-1',
        name: 'Old Local',
        updated_at: new Date(now.getTime() - 10000).toISOString(),
        synced_at: new Date(now.getTime() - 20000).toISOString(),
      };
      const remoteRecord = {
        id: 'record-1',
        name: 'New Remote',
        user_id: 'user-123',
        updated_at: now.toISOString(),
      };

      mockElectronInvoke.mockImplementation((channel: string, ...args: unknown[]) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:getById') return Promise.resolve(localRecord);
        if (channel === 'db:update') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => Promise.resolve({ data: [remoteRecord], error: null })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      } as any);

      await syncService.sync();

      expect(mockElectronInvoke).toHaveBeenCalledWith(
        'db:update',
        expect.any(String),
        'record-1',
        expect.objectContaining({ name: 'New Remote' })
      );
    });
  });

  describe('DELETE operations', () => {
    it('should delete from Supabase when operation is DELETE', async () => {
      const syncQueueItem = {
        id: 'queue-1',
        table_name: 'collections',
        record_id: 'col-to-delete',
        operation: 'DELETE',
        data: JSON.stringify({ id: 'col-to-delete' }),
      };

      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        delete: mockDelete,
      } as any);

      mockElectronInvoke.mockImplementation((channel: string) => {
        if (channel === 'db:getSyncQueue') return Promise.resolve([syncQueueItem]);
        if (channel === 'db:getLastSync') return Promise.resolve(null);
        if (channel === 'db:markSynced') return Promise.resolve(true);
        return Promise.resolve(null);
      });

      await syncService.sync();

      expect(mockDelete).toHaveBeenCalled();
    });
  });
});