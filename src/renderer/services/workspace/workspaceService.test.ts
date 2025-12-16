/**
 * Workspace Service Tests
 *
 * TDD tests for team workspace management including CRUD operations,
 * member management, and role-based access control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('../supabase/client', () => ({
  supabase: mockSupabase,
}));

// Import after mocking
import {
  WorkspaceService,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from './workspaceService';

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceService();

    // Default mock for authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createWorkspace', () => {
    it('should create a new workspace with owner as first member', async () => {
      const input: CreateWorkspaceInput = {
        name: 'My Team',
        description: 'A test workspace',
      };

      const mockWorkspace: Workspace = {
        id: 'ws-123',
        name: 'My Team',
        description: 'A test workspace',
        ownerId: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock workspace insert
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockWorkspace,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'workspace_members') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {};
      });

      const result = await service.createWorkspace(input);

      expect(result).toEqual(mockWorkspace);
    });

    it('should throw error if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        service.createWorkspace({ name: 'Test' })
      ).rejects.toThrow('User must be authenticated');
    });

    it('should throw error if workspace name is empty', async () => {
      await expect(
        service.createWorkspace({ name: '' })
      ).rejects.toThrow('Workspace name is required');
    });

    it('should throw error if workspace name exceeds max length', async () => {
      const longName = 'a'.repeat(256);
      await expect(
        service.createWorkspace({ name: longName })
      ).rejects.toThrow('Workspace name must be 255 characters or less');
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace by ID', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws-123',
        name: 'My Team',
        description: 'A test workspace',
        ownerId: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockWorkspace,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getWorkspace('ws-123');

      expect(result).toEqual(mockWorkspace);
    });

    it('should return null if workspace not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      const result = await service.getWorkspace('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserWorkspaces', () => {
    it('should return all workspaces user is a member of', async () => {
      const mockWorkspaces: Workspace[] = [
        {
          id: 'ws-1',
          name: 'Team A',
          ownerId: 'user-123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'ws-2',
          name: 'Team B',
          ownerId: 'user-456',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockWorkspaces.map((ws) => ({ workspace: ws })),
            error: null,
          }),
        }),
      });

      const result = await service.getUserWorkspaces();

      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no workspaces', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await service.getUserWorkspaces();

      expect(result).toEqual([]);
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace name and description', async () => {
      const input: UpdateWorkspaceInput = {
        name: 'Updated Team',
        description: 'Updated description',
      };

      const mockUpdatedWorkspace: Workspace = {
        id: 'ws-123',
        name: 'Updated Team',
        description: 'Updated description',
        ownerId: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock permission check
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockUpdatedWorkspace,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.updateWorkspace('ws-123', input);

      expect(result.name).toBe('Updated Team');
      expect(result.description).toBe('Updated description');
    });

    it('should throw error if user lacks permission', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'viewer' },
                error: null,
              }),
            }),
          }),
        }),
      });

      await expect(
        service.updateWorkspace('ws-123', { name: 'New Name' })
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace if user is owner', async () => {
      // Mock ownership check
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ownerId: 'user-123' },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.deleteWorkspace('ws-123')).resolves.not.toThrow();
    });

    it('should throw error if user is not owner', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ownerId: 'other-user' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.deleteWorkspace('ws-123')
      ).rejects.toThrow('Only workspace owner can delete');
    });
  });

  describe('getWorkspaceMembers', () => {
    it('should return all members of a workspace', async () => {
      const mockMembers: WorkspaceMember[] = [
        {
          id: 'member-1',
          workspaceId: 'ws-123',
          userId: 'user-123',
          role: 'admin',
          email: 'admin@example.com',
          joinedAt: new Date().toISOString(),
        },
        {
          id: 'member-2',
          workspaceId: 'ws-123',
          userId: 'user-456',
          role: 'editor',
          email: 'editor@example.com',
          joinedAt: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockMembers,
            error: null,
          }),
        }),
      });

      const result = await service.getWorkspaceMembers('ws-123');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('admin');
      expect(result[1].role).toBe('editor');
    });
  });

  describe('addMember', () => {
    it('should add a new member with specified role', async () => {
      const mockMember: WorkspaceMember = {
        id: 'member-new',
        workspaceId: 'ws-123',
        userId: 'user-789',
        role: 'editor',
        email: 'new@example.com',
        joinedAt: new Date().toISOString(),
      };

      // Mock permission check and insert
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockMember,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.addMember('ws-123', 'user-789', 'editor');

      expect(result.userId).toBe('user-789');
      expect(result.role).toBe('editor');
    });

    it('should throw error if adding member without admin permission', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'viewer' },
                error: null,
              }),
            }),
          }),
        }),
      });

      await expect(
        service.addMember('ws-123', 'user-789', 'editor')
      ).rejects.toThrow('Only admins can add members');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const mockUpdatedMember: WorkspaceMember = {
        id: 'member-1',
        workspaceId: 'ws-123',
        userId: 'user-456',
        role: 'admin',
        email: 'user@example.com',
        joinedAt: new Date().toISOString(),
      };

      // Mock permission check and update
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: mockUpdatedMember,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.updateMemberRole('ws-123', 'user-456', 'admin');

      expect(result.role).toBe('admin');
    });

    it('should throw error when demoting the only admin', async () => {
      // Mock: user is admin, but is the only admin
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((field: string) => {
                if (field === 'workspace_id') {
                  return {
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: { role: 'admin' },
                        error: null,
                      }),
                    }),
                    // Count admins
                    mockResolvedValue: vi.fn().mockResolvedValue({
                      data: [{ role: 'admin' }],
                      error: null,
                    }),
                  };
                }
                return {
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                };
              }),
            })),
          };
        }
        return {};
      });

      // This test verifies the business logic - implementation will handle this
      await expect(
        service.updateMemberRole('ws-123', 'user-123', 'viewer')
      ).rejects.toThrow();
    });
  });

  describe('removeMember', () => {
    it('should remove member from workspace', async () => {
      // Mock permission check and delete
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.removeMember('ws-123', 'user-456')).resolves.not.toThrow();
    });

    it('should allow member to remove themselves', async () => {
      // Mock: user is removing themselves (viewer role)
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'viewer' },
                error: null,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      });

      // User removing themselves should work
      await expect(service.removeMember('ws-123', 'user-123')).resolves.not.toThrow();
    });

    it('should throw error when removing workspace owner', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ownerId: 'user-456' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.removeMember('ws-123', 'user-456')
      ).rejects.toThrow('Cannot remove workspace owner');
    });
  });

  describe('getUserRole', () => {
    it('should return user role in workspace', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'editor' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.getUserRole('ws-123');

      expect(result).toBe('editor');
    });

    it('should return null if user is not a member', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      });

      const result = await service.getUserRole('ws-123');

      expect(result).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin with any permission', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      });

      expect(await service.hasPermission('ws-123', 'read')).toBe(true);
      expect(await service.hasPermission('ws-123', 'write')).toBe(true);
      expect(await service.hasPermission('ws-123', 'delete')).toBe(true);
      expect(await service.hasPermission('ws-123', 'manage')).toBe(true);
    });

    it('should return correct permissions for editor', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'editor' },
                error: null,
              }),
            }),
          }),
        }),
      });

      expect(await service.hasPermission('ws-123', 'read')).toBe(true);
      expect(await service.hasPermission('ws-123', 'write')).toBe(true);
      expect(await service.hasPermission('ws-123', 'delete')).toBe(false);
      expect(await service.hasPermission('ws-123', 'manage')).toBe(false);
    });

    it('should return correct permissions for viewer', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'viewer' },
                error: null,
              }),
            }),
          }),
        }),
      });

      expect(await service.hasPermission('ws-123', 'read')).toBe(true);
      expect(await service.hasPermission('ws-123', 'write')).toBe(false);
      expect(await service.hasPermission('ws-123', 'delete')).toBe(false);
      expect(await service.hasPermission('ws-123', 'manage')).toBe(false);
    });

    it('should return false for non-member', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      });

      expect(await service.hasPermission('ws-123', 'read')).toBe(false);
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership to another admin', async () => {
      // Mock: current user is owner, target is admin
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ownerId: 'user-123' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: null,
              }),
            }),
          };
        }
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.transferOwnership('ws-123', 'user-456')
      ).resolves.not.toThrow();
    });

    it('should throw error if current user is not owner', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ownerId: 'other-user' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.transferOwnership('ws-123', 'user-456')
      ).rejects.toThrow('Only owner can transfer ownership');
    });

    it('should throw error if target is not a member', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ownerId: 'user-123' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.transferOwnership('ws-123', 'non-member')
      ).rejects.toThrow('Target user must be a workspace member');
    });
  });
});