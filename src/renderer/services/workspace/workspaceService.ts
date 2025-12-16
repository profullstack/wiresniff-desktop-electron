/**
 * Workspace Service
 *
 * Manages team workspaces including CRUD operations, member management,
 * and role-based access control (RBAC).
 */

import { supabase } from '../supabase/client';

// Types
export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

export type Permission = 'read' | 'write' | 'delete' | 'manage';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  email?: string;
  joinedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

// Role permission matrix
const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  admin: ['read', 'write', 'delete', 'manage'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

export class WorkspaceService {
  /**
   * Get the current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }
    return user.id;
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    // Validate input
    if (!input.name || input.name.trim() === '') {
      throw new Error('Workspace name is required');
    }
    if (input.name.length > 255) {
      throw new Error('Workspace name must be 255 characters or less');
    }

    const userId = await this.getCurrentUserId();

    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim(),
        owner_id: userId,
      })
      .select()
      .single();

    if (workspaceError) {
      throw new Error(`Failed to create workspace: ${workspaceError.message}`);
    }

    // Add owner as admin member
    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'admin',
    });

    if (memberError) {
      // Rollback workspace creation
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      throw new Error(`Failed to add owner as member: ${memberError.message}`);
    }

    return this.mapWorkspace(workspace);
  }

  /**
   * Get a workspace by ID
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get workspace: ${error.message}`);
    }

    return this.mapWorkspace(data);
  }

  /**
   * Get all workspaces the current user is a member of
   */
  async getUserWorkspaces(): Promise<Workspace[]> {
    const userId = await this.getCurrentUserId();

    const { data, error } = await supabase
      .from('workspace_members')
      .select(
        `
        workspace:workspaces(*)
      `
      )
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get user workspaces: ${error.message}`);
    }

    return (data || [])
      .map((item: { workspace: Record<string, unknown> }) => item.workspace)
      .filter(Boolean)
      .map((ws: Record<string, unknown>) => this.mapWorkspace(ws));
  }

  /**
   * Update a workspace
   */
  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    const userId = await this.getCurrentUserId();

    // Check permission
    const role = await this.getUserRole(workspaceId, userId);
    if (!role || !ROLE_PERMISSIONS[role].includes('manage')) {
      throw new Error('Insufficient permissions');
    }

    // Validate input
    if (input.name !== undefined) {
      if (input.name.trim() === '') {
        throw new Error('Workspace name cannot be empty');
      }
      if (input.name.length > 255) {
        throw new Error('Workspace name must be 255 characters or less');
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name.trim();
    }
    if (input.description !== undefined) {
      updateData.description = input.description?.trim();
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspaceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update workspace: ${error.message}`);
    }

    return this.mapWorkspace(data);
  }

  /**
   * Delete a workspace (owner only)
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const userId = await this.getCurrentUserId();

    // Check if user is owner
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch workspace: ${fetchError.message}`);
    }

    if (workspace.owner_id !== userId) {
      throw new Error('Only workspace owner can delete');
    }

    // Delete workspace (cascade will handle members)
    const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);

    if (error) {
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }
  }

  /**
   * Get all members of a workspace
   */
  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(
        `
        *,
        user:users(email)
      `
      )
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new Error(`Failed to get workspace members: ${error.message}`);
    }

    return (data || []).map((member: Record<string, unknown>) => this.mapMember(member));
  }

  /**
   * Add a member to a workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<WorkspaceMember> {
    const currentUserId = await this.getCurrentUserId();

    // Check if current user is admin
    const currentRole = await this.getUserRole(workspaceId, currentUserId);
    if (currentRole !== 'admin') {
      throw new Error('Only admins can add members');
    }

    // Check if user is already a member
    const existingRole = await this.getUserRole(workspaceId, userId);
    if (existingRole) {
      throw new Error('User is already a member of this workspace');
    }

    const { data, error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add member: ${error.message}`);
    }

    return this.mapMember(data);
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: WorkspaceRole
  ): Promise<WorkspaceMember> {
    const currentUserId = await this.getCurrentUserId();

    // Check if current user is admin
    const currentRole = await this.getUserRole(workspaceId, currentUserId);
    if (currentRole !== 'admin') {
      throw new Error('Only admins can update member roles');
    }

    // Check if this would remove the last admin
    if (newRole !== 'admin') {
      const members = await this.getWorkspaceMembers(workspaceId);
      const adminCount = members.filter((m) => m.role === 'admin').length;
      const targetMember = members.find((m) => m.userId === userId);

      if (targetMember?.role === 'admin' && adminCount <= 1) {
        throw new Error('Cannot demote the last admin');
      }
    }

    const { data, error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`);
    }

    return this.mapMember(data);
  }

  /**
   * Remove a member from a workspace
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const currentUserId = await this.getCurrentUserId();

    // Check if trying to remove workspace owner
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (wsError) {
      throw new Error(`Failed to fetch workspace: ${wsError.message}`);
    }

    if (workspace.owner_id === userId) {
      throw new Error('Cannot remove workspace owner');
    }

    // Allow self-removal or admin removal
    const isSelfRemoval = currentUserId === userId;
    if (!isSelfRemoval) {
      const currentRole = await this.getUserRole(workspaceId, currentUserId);
      if (currentRole !== 'admin') {
        throw new Error('Only admins can remove other members');
      }
    }

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }
  }

  /**
   * Get user's role in a workspace
   */
  async getUserRole(workspaceId: string, userId?: string): Promise<WorkspaceRole | null> {
    const targetUserId = userId || (await this.getCurrentUserId());

    const { data, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user role: ${error.message}`);
    }

    return data?.role as WorkspaceRole;
  }

  /**
   * Check if user has a specific permission in a workspace
   */
  async hasPermission(workspaceId: string, permission: Permission): Promise<boolean> {
    const role = await this.getUserRole(workspaceId);
    if (!role) {
      return false;
    }
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  /**
   * Transfer workspace ownership to another member
   */
  async transferOwnership(workspaceId: string, newOwnerId: string): Promise<void> {
    const currentUserId = await this.getCurrentUserId();

    // Check if current user is owner
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (wsError) {
      throw new Error(`Failed to fetch workspace: ${wsError.message}`);
    }

    if (workspace.owner_id !== currentUserId) {
      throw new Error('Only owner can transfer ownership');
    }

    // Check if new owner is a member
    const newOwnerRole = await this.getUserRole(workspaceId, newOwnerId);
    if (!newOwnerRole) {
      throw new Error('Target user must be a workspace member');
    }

    // Update workspace owner
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ owner_id: newOwnerId, updated_at: new Date().toISOString() })
      .eq('id', workspaceId);

    if (updateError) {
      throw new Error(`Failed to transfer ownership: ${updateError.message}`);
    }

    // Ensure new owner is admin
    if (newOwnerRole !== 'admin') {
      await this.updateMemberRole(workspaceId, newOwnerId, 'admin');
    }
  }

  /**
   * Map database workspace to Workspace type
   */
  private mapWorkspace(data: Record<string, unknown>): Workspace {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | undefined,
      ownerId: (data.owner_id || data.ownerId) as string,
      createdAt: (data.created_at || data.createdAt) as string,
      updatedAt: (data.updated_at || data.updatedAt) as string,
    };
  }

  /**
   * Map database member to WorkspaceMember type
   */
  private mapMember(data: Record<string, unknown>): WorkspaceMember {
    const user = data.user as { email?: string } | undefined;
    return {
      id: data.id as string,
      workspaceId: (data.workspace_id || data.workspaceId) as string,
      userId: (data.user_id || data.userId) as string,
      role: data.role as WorkspaceRole,
      email: user?.email || (data.email as string | undefined),
      joinedAt: (data.joined_at || data.joinedAt || data.created_at) as string,
    };
  }
}

// Export singleton instance
export const workspaceService = new WorkspaceService();