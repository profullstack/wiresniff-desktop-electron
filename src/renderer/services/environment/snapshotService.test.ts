/**
 * Tests for Environment Snapshot Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client - must be hoisted
vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { SnapshotService } from './snapshotService';
import { supabase } from '../supabase/client';

// Cast to mocked type
const mockSupabase = vi.mocked(supabase);

describe('SnapshotService', () => {
  let service: SnapshotService;
  const mockUserId = 'user-123';
  const mockEnvironmentId = 'env-456';
  const mockWorkspaceId = 'ws-789';
  const mockSnapshotId = 'snap-001';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SnapshotService();

    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } as never },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with current environment variables', async () => {
      const mockVariables = { API_URL: 'https://api.example.com', DEBUG: 'true' };
      const mockSnapshot = {
        id: mockSnapshotId,
        environment_id: mockEnvironmentId,
        workspace_id: mockWorkspaceId,
        user_id: mockUserId,
        name: 'Pre-deployment snapshot',
        description: 'Before v2.0 release',
        variables: mockVariables,
        version: 1,
        is_auto_snapshot: false,
        trigger_type: 'manual',
        created_at: '2024-01-15T10:00:00Z',
      };

      // Mock environment fetch
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'environments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { variables: mockVariables, workspace_id: mockWorkspaceId },
              error: null,
            }),
          } as never;
        }
        if (table === 'environment_snapshots') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockSnapshot,
              error: null,
            }),
          } as never;
        }
        return {} as never;
      });

      // Mock version RPC
      mockSupabase.rpc.mockResolvedValue({ data: 1, error: null } as never);

      const result = await service.createSnapshot({
        environmentId: mockEnvironmentId,
        name: 'Pre-deployment snapshot',
        description: 'Before v2.0 release',
        triggerType: 'manual',
      });

      expect(result.id).toBe(mockSnapshotId);
      expect(result.name).toBe('Pre-deployment snapshot');
      expect(result.variables).toEqual(mockVariables);
      expect(result.version).toBe(1);
    });

    it('should throw error if environment ID is missing', async () => {
      await expect(
        service.createSnapshot({
          environmentId: '',
          name: 'Test',
        })
      ).rejects.toThrow('Environment ID is required');
    });

    it('should throw error if name is missing', async () => {
      await expect(
        service.createSnapshot({
          environmentId: mockEnvironmentId,
          name: '',
        })
      ).rejects.toThrow('Snapshot name is required');
    });

    it('should throw error if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        service.createSnapshot({
          environmentId: mockEnvironmentId,
          name: 'Test',
        })
      ).rejects.toThrow('User must be authenticated');
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshot by ID', async () => {
      const mockSnapshot = {
        id: mockSnapshotId,
        environment_id: mockEnvironmentId,
        user_id: mockUserId,
        name: 'Test Snapshot',
        variables: { KEY: 'value' },
        version: 1,
        is_auto_snapshot: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSnapshot,
          error: null,
        }),
      } as never);

      const result = await service.getSnapshot(mockSnapshotId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockSnapshotId);
      expect(result?.name).toBe('Test Snapshot');
    });

    it('should return null if snapshot not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      } as never);

      const result = await service.getSnapshot('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getEnvironmentSnapshots', () => {
    it('should return all snapshots for an environment', async () => {
      const mockSnapshots = [
        {
          id: 'snap-001',
          environment_id: mockEnvironmentId,
          name: 'Snapshot 1',
          version: 2,
          is_auto_snapshot: false,
          created_at: '2024-01-15T12:00:00Z',
        },
        {
          id: 'snap-002',
          environment_id: mockEnvironmentId,
          name: 'Snapshot 2',
          version: 1,
          is_auto_snapshot: true,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      // Create a chainable mock that resolves when awaited
      const createChainableMock = (data: unknown) => {
        const mock: Record<string, unknown> = {
          data,
          error: null,
        };
        mock.select = vi.fn().mockReturnValue(mock);
        mock.eq = vi.fn().mockReturnValue(mock);
        mock.order = vi.fn().mockReturnValue(mock);
        mock.limit = vi.fn().mockReturnValue(mock);
        mock.range = vi.fn().mockReturnValue(mock);
        // Make it thenable for await
        mock.then = (resolve: (value: { data: unknown; error: null }) => void) => {
          resolve({ data, error: null });
          return mock;
        };
        return mock;
      };

      mockSupabase.from.mockReturnValue(createChainableMock(mockSnapshots) as never);

      const result = await service.getEnvironmentSnapshots(mockEnvironmentId, {
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Snapshot 1');
    });

    it('should filter out auto snapshots when requested', async () => {
      const mockData = [
        {
          id: 'snap-001',
          environment_id: mockEnvironmentId,
          name: 'Manual Snapshot',
          is_auto_snapshot: false,
          version: 1,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      // Create a chainable mock that resolves when awaited
      const createChainableMock = (data: unknown) => {
        const mock: Record<string, unknown> = {
          data,
          error: null,
        };
        mock.select = vi.fn().mockReturnValue(mock);
        mock.eq = vi.fn().mockReturnValue(mock);
        mock.order = vi.fn().mockReturnValue(mock);
        mock.limit = vi.fn().mockReturnValue(mock);
        mock.range = vi.fn().mockReturnValue(mock);
        // Make it thenable for await
        mock.then = (resolve: (value: { data: unknown; error: null }) => void) => {
          resolve({ data, error: null });
          return mock;
        };
        return mock;
      };

      mockSupabase.from.mockReturnValue(createChainableMock(mockData) as never);

      const result = await service.getEnvironmentSnapshots(mockEnvironmentId, {
        includeAutoSnapshots: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].isAutoSnapshot).toBe(false);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the most recent snapshot', async () => {
      const mockSnapshot = {
        id: 'snap-latest',
        environment_id: mockEnvironmentId,
        name: 'Latest',
        version: 5,
        created_at: '2024-01-15T15:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockSnapshot,
          error: null,
        }),
      } as never);

      const result = await service.getLatestSnapshot(mockEnvironmentId);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(5);
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot if user is owner', async () => {
      // Mock delete chain
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
        delete: deleteMock,
      } as never);

      await expect(service.deleteSnapshot(mockSnapshotId)).resolves.not.toThrow();
    });

    it('should throw error if user is not owner', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'other-user' },
          error: null,
        }),
      } as never);

      await expect(service.deleteSnapshot(mockSnapshotId)).rejects.toThrow(
        'Only snapshot creator can delete'
      );
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore environment to snapshot state', async () => {
      const mockVariables = { API_URL: 'https://old-api.example.com' };

      // Mock getSnapshot
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'environment_snapshots') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockSnapshotId,
                environment_id: mockEnvironmentId,
                variables: mockVariables,
              },
              error: null,
            }),
          } as never;
        }
        if (table === 'environments') {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          } as never;
        }
        return {} as never;
      });

      await expect(service.restoreSnapshot(mockSnapshotId)).resolves.not.toThrow();
    });

    it('should throw error if snapshot not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      } as never);

      await expect(service.restoreSnapshot('non-existent')).rejects.toThrow('Snapshot not found');
    });
  });

  describe('compareSnapshots', () => {
    it('should compare two snapshots and return differences', async () => {
      const mockDiffs = [
        {
          variable_key: 'API_URL',
          change_type: 'modified',
          baseline_value: 'https://old.api.com',
          compared_value: 'https://new.api.com',
        },
        {
          variable_key: 'NEW_VAR',
          change_type: 'added',
          baseline_value: null,
          compared_value: 'new-value',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockDiffs,
        error: null,
      } as never);

      const result = await service.compareSnapshots('snap-baseline', 'snap-compared');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('API_URL');
      expect(result[0].type).toBe('modified');
      expect(result[1].type).toBe('added');
    });
  });

  describe('compareEnvironments', () => {
    it('should compare two environments and save comparison', async () => {
      const leftVars = { API_URL: 'https://staging.api.com', DEBUG: 'true' };
      const rightVars = { API_URL: 'https://prod.api.com', CACHE: 'enabled' };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'environments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((_field: string, value: string) => ({
              single: vi.fn().mockResolvedValue({
                data: { variables: value === 'left-env' ? leftVars : rightVars },
                error: null,
              }),
            })),
          } as never;
        }
        if (table === 'environment_comparisons') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'comp-001',
                left_environment_id: 'left-env',
                right_environment_id: 'right-env',
                total_differences: 3,
                added_count: 1,
                removed_count: 1,
                modified_count: 1,
                diff_details: [
                  { key: 'API_URL', type: 'modified', leftValue: leftVars.API_URL, rightValue: rightVars.API_URL },
                  { key: 'DEBUG', type: 'removed', leftValue: 'true' },
                  { key: 'CACHE', type: 'added', rightValue: 'enabled' },
                ],
                compared_by: mockUserId,
                created_at: '2024-01-15T10:00:00Z',
              },
              error: null,
            }),
          } as never;
        }
        return {} as never;
      });

      const result = await service.compareEnvironments('left-env', 'right-env');

      expect(result.totalDifferences).toBe(3);
      expect(result.addedCount).toBe(1);
      expect(result.removedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
    });
  });

  describe('detectDrift', () => {
    it('should detect drift between current state and latest snapshot', async () => {
      const mockDriftData = [
        {
          variable_key: 'API_URL',
          drift_type: 'modified',
          snapshot_value: 'https://old.api.com',
          current_value: 'https://new.api.com',
          severity: 'warning',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockDriftData,
        error: null,
      } as never);

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'drift-001',
            environment_id: mockEnvironmentId,
            category: 'variable_modified',
            severity: 'warning',
            variable_key: 'API_URL',
            baseline_value: 'https://old.api.com',
            current_value: 'https://new.api.com',
            is_resolved: false,
            detected_at: '2024-01-15T10:00:00Z',
            created_at: '2024-01-15T10:00:00Z',
          },
          error: null,
        }),
      } as never);

      const result = await service.detectDrift(mockEnvironmentId);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('variable_modified');
      expect(result[0].severity).toBe('warning');
    });
  });

  describe('getDriftRecords', () => {
    it('should return drift records for an environment', async () => {
      const mockRecords = [
        {
          id: 'drift-001',
          environment_id: mockEnvironmentId,
          category: 'variable_modified',
          severity: 'warning',
          is_resolved: false,
          detected_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'drift-002',
          environment_id: mockEnvironmentId,
          category: 'auth_changed',
          severity: 'critical',
          is_resolved: true,
          detected_at: '2024-01-14T10:00:00Z',
        },
      ];

      // Create a chainable mock that resolves when awaited
      const createChainableMock = (data: unknown) => {
        const mock: Record<string, unknown> = {
          data,
          error: null,
        };
        mock.select = vi.fn().mockReturnValue(mock);
        mock.eq = vi.fn().mockReturnValue(mock);
        mock.order = vi.fn().mockReturnValue(mock);
        mock.limit = vi.fn().mockReturnValue(mock);
        // Make it thenable for await
        mock.then = (resolve: (value: { data: unknown; error: null }) => void) => {
          resolve({ data, error: null });
          return mock;
        };
        return mock;
      };

      mockSupabase.from.mockReturnValue(createChainableMock(mockRecords) as never);

      const result = await service.getDriftRecords(mockEnvironmentId);

      expect(result).toHaveLength(2);
    });

    it('should filter by severity', async () => {
      const mockData = [
        {
          id: 'drift-001',
          environment_id: mockEnvironmentId,
          category: 'auth_changed',
          severity: 'critical',
          is_resolved: false,
        },
      ];

      // Create a chainable mock that resolves when awaited
      const createChainableMock = (data: unknown) => {
        const mock: Record<string, unknown> = {
          data,
          error: null,
        };
        mock.select = vi.fn().mockReturnValue(mock);
        mock.eq = vi.fn().mockReturnValue(mock);
        mock.order = vi.fn().mockReturnValue(mock);
        mock.limit = vi.fn().mockReturnValue(mock);
        // Make it thenable for await
        mock.then = (resolve: (value: { data: unknown; error: null }) => void) => {
          resolve({ data, error: null });
          return mock;
        };
        return mock;
      };

      mockSupabase.from.mockReturnValue(createChainableMock(mockData) as never);

      const result = await service.getDriftRecords(mockEnvironmentId, {
        severity: 'critical',
      });

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('critical');
    });
  });

  describe('resolveDrift', () => {
    it('should mark drift record as resolved', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null } as never);

      await expect(service.resolveDrift('drift-001')).resolves.not.toThrow();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_drift_record', {
        p_drift_id: 'drift-001',
      });
    });
  });

  describe('getTimeline', () => {
    it('should return combined timeline of snapshots and drift events', async () => {
      const mockEvents = [
        {
          event_type: 'snapshot',
          event_id: 'snap-001',
          environment_id: mockEnvironmentId,
          event_name: 'Pre-deployment',
          event_time: '2024-01-15T12:00:00Z',
          trigger_type: 'manual',
        },
        {
          event_type: 'drift',
          event_id: 'drift-001',
          environment_id: mockEnvironmentId,
          event_name: 'API_URL modified',
          event_time: '2024-01-15T11:00:00Z',
          severity: 'warning',
          category: 'variable_modified',
        },
      ];

      // Create a chainable mock that resolves when awaited
      const createChainableMock = (data: unknown) => {
        const mock: Record<string, unknown> = {
          data,
          error: null,
        };
        mock.select = vi.fn().mockReturnValue(mock);
        mock.eq = vi.fn().mockReturnValue(mock);
        mock.order = vi.fn().mockReturnValue(mock);
        mock.limit = vi.fn().mockReturnValue(mock);
        mock.range = vi.fn().mockReturnValue(mock);
        // Make it thenable for await
        mock.then = (resolve: (value: { data: unknown; error: null }) => void) => {
          resolve({ data, error: null });
          return mock;
        };
        return mock;
      };

      mockSupabase.from.mockReturnValue(createChainableMock(mockEvents) as never);

      const result = await service.getTimeline(mockEnvironmentId, { limit: 20 });

      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('snapshot');
      expect(result[1].eventType).toBe('drift');
    });
  });
});