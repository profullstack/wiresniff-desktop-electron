/**
 * Invitation Service Tests
 *
 * TDD tests for workspace invitation management including
 * creating, sending, accepting, and declining invitations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn(),
};

vi.mock('../supabase/client', () => ({
  supabase: mockSupabase,
}));

// Import after mocking
import {
  InvitationService,
  type WorkspaceInvitation,
  type CreateInvitationInput,
  type InvitationStatus,
} from './invitationService';

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvitationService();

    // Default mock for authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createInvitation', () => {
    it('should create a new invitation with pending status', async () => {
      const input: CreateInvitationInput = {
        workspaceId: 'ws-123',
        email: 'newuser@example.com',
        role: 'editor',
      };

      const mockInvitation: WorkspaceInvitation = {
        id: 'inv-123',
        workspaceId: 'ws-123',
        email: 'newuser@example.com',
        role: 'editor',
        invitedBy: 'user-123',
        status: 'pending',
        token: 'abc123token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Mock admin check
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
        if (table === 'workspace_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockInvitation,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await service.createInvitation(input);

      expect(result.email).toBe('newuser@example.com');
      expect(result.role).toBe('editor');
      expect(result.status).toBe('pending');
    });

    it('should throw error if user is not admin', async () => {
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
        service.createInvitation({
          workspaceId: 'ws-123',
          email: 'test@example.com',
          role: 'editor',
        })
      ).rejects.toThrow('Only admins can send invitations');
    });

    it('should throw error if email is invalid', async () => {
      await expect(
        service.createInvitation({
          workspaceId: 'ws-123',
          email: 'invalid-email',
          role: 'editor',
        })
      ).rejects.toThrow('Invalid email address');
    });

    it('should throw error if user is already a member', async () => {
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
                  };
                }
                return {
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'existing-member' },
                    error: null,
                  }),
                };
              }),
            })),
          };
        }
        return {};
      });

      await expect(
        service.createInvitation({
          workspaceId: 'ws-123',
          email: 'existing@example.com',
          role: 'editor',
        })
      ).rejects.toThrow('User is already a member');
    });

    it('should throw error if pending invitation already exists', async () => {
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
        if (table === 'workspace_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [{ id: 'existing-inv' }],
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
        service.createInvitation({
          workspaceId: 'ws-123',
          email: 'pending@example.com',
          role: 'editor',
        })
      ).rejects.toThrow('Pending invitation already exists');
    });
  });

  describe('getInvitation', () => {
    it('should return invitation by ID', async () => {
      const mockInvitation: WorkspaceInvitation = {
        id: 'inv-123',
        workspaceId: 'ws-123',
        email: 'user@example.com',
        role: 'editor',
        invitedBy: 'user-456',
        status: 'pending',
        token: 'token123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getInvitation('inv-123');

      expect(result).toEqual(mockInvitation);
    });

    it('should return null if invitation not found', async () => {
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

      const result = await service.getInvitation('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getInvitationByToken', () => {
    it('should return invitation by token', async () => {
      const mockInvitation: WorkspaceInvitation = {
        id: 'inv-123',
        workspaceId: 'ws-123',
        email: 'user@example.com',
        role: 'editor',
        invitedBy: 'user-456',
        status: 'pending',
        token: 'secret-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getInvitationByToken('secret-token');

      expect(result?.token).toBe('secret-token');
    });
  });

  describe('getWorkspaceInvitations', () => {
    it('should return all invitations for a workspace', async () => {
      const mockInvitations: WorkspaceInvitation[] = [
        {
          id: 'inv-1',
          workspaceId: 'ws-123',
          email: 'user1@example.com',
          role: 'editor',
          invitedBy: 'user-123',
          status: 'pending',
          token: 'token1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: 'inv-2',
          workspaceId: 'ws-123',
          email: 'user2@example.com',
          role: 'viewer',
          invitedBy: 'user-123',
          status: 'accepted',
          token: 'token2',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockInvitations,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getWorkspaceInvitations('ws-123');

      expect(result).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'inv-1', status: 'pending' }],
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await service.getWorkspaceInvitations('ws-123', 'pending');

      expect(result).toHaveLength(1);
    });
  });

  describe('getUserInvitations', () => {
    it('should return all pending invitations for current user email', async () => {
      const mockInvitations: WorkspaceInvitation[] = [
        {
          id: 'inv-1',
          workspaceId: 'ws-123',
          email: 'admin@example.com',
          role: 'editor',
          invitedBy: 'user-456',
          status: 'pending',
          token: 'token1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getUserInvitations();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@example.com');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation and add user as member', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'member-123',
        error: null,
      });

      const result = await service.acceptInvitation('valid-token');

      expect(result).toBe('member-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_workspace_invitation', {
        invitation_token: 'valid-token',
      });
    });

    it('should throw error for invalid token', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Invalid or expired invitation' },
      });

      await expect(service.acceptInvitation('invalid-token')).rejects.toThrow(
        'Invalid or expired invitation'
      );
    });
  });

  describe('declineInvitation', () => {
    it('should decline invitation', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'admin@example.com',
        status: 'pending',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockInvitation,
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
        return {};
      });

      await expect(service.declineInvitation('inv-123')).resolves.not.toThrow();
    });

    it('should throw error if invitation email does not match user', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'other@example.com',
        status: 'pending',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          }),
        }),
      });

      await expect(service.declineInvitation('inv-123')).rejects.toThrow(
        'Cannot decline invitation for another user'
      );
    });
  });

  describe('cancelInvitation', () => {
    it('should cancel invitation if user is admin', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inv-123', workspace_id: 'ws-123', status: 'pending' },
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

      await expect(service.cancelInvitation('inv-123')).resolves.not.toThrow();
    });

    it('should throw error if user is not admin', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inv-123', workspace_id: 'ws-123', status: 'pending' },
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
                    data: { role: 'viewer' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.cancelInvitation('inv-123')).rejects.toThrow(
        'Only admins can cancel invitations'
      );
    });
  });

  describe('resendInvitation', () => {
    it('should resend invitation with new expiry', async () => {
      const mockInvitation = {
        id: 'inv-123',
        workspace_id: 'ws-123',
        status: 'pending',
        token: 'new-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workspace_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inv-123', workspace_id: 'ws-123', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockInvitation,
                    error: null,
                  }),
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

      const result = await service.resendInvitation('inv-123');

      expect(result.token).toBe('new-token');
    });

    it('should throw error if invitation is not pending', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'inv-123', workspace_id: 'ws-123', status: 'accepted' },
              error: null,
            }),
          }),
        }),
      });

      await expect(service.resendInvitation('inv-123')).rejects.toThrow(
        'Can only resend pending invitations'
      );
    });
  });

  describe('isInvitationValid', () => {
    it('should return true for valid pending invitation', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { status: 'pending', expires_at: futureDate },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.isInvitationValid('valid-token');

      expect(result).toBe(true);
    });

    it('should return false for expired invitation', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { status: 'pending', expires_at: pastDate },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.isInvitationValid('expired-token');

      expect(result).toBe(false);
    });

    it('should return false for non-pending invitation', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { status: 'accepted', expires_at: futureDate },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.isInvitationValid('accepted-token');

      expect(result).toBe(false);
    });
  });
});