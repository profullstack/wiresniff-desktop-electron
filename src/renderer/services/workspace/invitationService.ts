/**
 * Invitation Service
 *
 * Manages workspace invitations including creating, sending,
 * accepting, declining, and canceling invitations.
 */

import { supabase } from '../supabase/client';
import type { WorkspaceRole } from './workspaceService';

// Types
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface CreateInvitationInput {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvitationService {
  /**
   * Get the current authenticated user
   */
  private async getCurrentUser(): Promise<{ id: string; email: string }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('User must be authenticated');
    }
    return { id: user.id, email: user.email };
  }

  /**
   * Check if user is admin of workspace
   */
  private async isAdmin(workspaceId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.role === 'admin';
  }

  /**
   * Generate a secure invitation token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a new invitation
   */
  async createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
    // Validate email
    if (!EMAIL_REGEX.test(input.email)) {
      throw new Error('Invalid email address');
    }

    const user = await this.getCurrentUser();

    // Check if user is admin
    const isAdmin = await this.isAdmin(input.workspaceId, user.id);
    if (!isAdmin) {
      throw new Error('Only admins can send invitations');
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', input.workspaceId)
      .eq('user_id', input.email) // This would need a join with users table
      .single();

    if (existingMember) {
      throw new Error('User is already a member');
    }

    // Check for existing pending invitation
    const { data: existingInvitations } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', input.workspaceId)
      .eq('email', input.email)
      .eq('status', 'pending');

    if (existingInvitations && existingInvitations.length > 0) {
      throw new Error('Pending invitation already exists');
    }

    // Create invitation
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: input.workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        invited_by: user.id,
        status: 'pending',
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    return this.mapInvitation(data);
  }

  /**
   * Get invitation by ID
   */
  async getInvitation(invitationId: string): Promise<WorkspaceInvitation | null> {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get invitation: ${error.message}`);
    }

    return this.mapInvitation(data);
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<WorkspaceInvitation | null> {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get invitation: ${error.message}`);
    }

    return this.mapInvitation(data);
  }

  /**
   * Get all invitations for a workspace
   */
  async getWorkspaceInvitations(
    workspaceId: string,
    status?: InvitationStatus
  ): Promise<WorkspaceInvitation[]> {
    let query = supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get workspace invitations: ${error.message}`);
    }

    return (data || []).map((inv: Record<string, unknown>) => this.mapInvitation(inv));
  }

  /**
   * Get all pending invitations for the current user
   */
  async getUserInvitations(): Promise<WorkspaceInvitation[]> {
    const user = await this.getCurrentUser();

    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('email', user.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user invitations: ${error.message}`);
    }

    return (data || []).map((inv: Record<string, unknown>) => this.mapInvitation(inv));
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('accept_workspace_invitation', {
      invitation_token: token,
    });

    if (error) {
      throw new Error(error.message || 'Failed to accept invitation');
    }

    return data as string;
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationId: string): Promise<void> {
    const user = await this.getCurrentUser();

    // Get invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to get invitation: ${fetchError.message}`);
    }

    // Check if invitation belongs to user
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error('Cannot decline invitation for another user');
    }

    // Update status
    const { error } = await supabase
      .from('workspace_invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);

    if (error) {
      throw new Error(`Failed to decline invitation: ${error.message}`);
    }
  }

  /**
   * Cancel an invitation (admin only)
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    const user = await this.getCurrentUser();

    // Get invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to get invitation: ${fetchError.message}`);
    }

    // Check if user is admin
    const isAdmin = await this.isAdmin(invitation.workspace_id, user.id);
    if (!isAdmin) {
      throw new Error('Only admins can cancel invitations');
    }

    // Delete invitation
    const { error } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      throw new Error(`Failed to cancel invitation: ${error.message}`);
    }
  }

  /**
   * Resend an invitation with new token and expiry
   */
  async resendInvitation(invitationId: string): Promise<WorkspaceInvitation> {
    const user = await this.getCurrentUser();

    // Get invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to get invitation: ${fetchError.message}`);
    }

    // Check if invitation is pending
    if (invitation.status !== 'pending') {
      throw new Error('Can only resend pending invitations');
    }

    // Check if user is admin
    const isAdmin = await this.isAdmin(invitation.workspace_id, user.id);
    if (!isAdmin) {
      throw new Error('Only admins can resend invitations');
    }

    // Generate new token and expiry
    const newToken = this.generateToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update invitation
    const { data, error } = await supabase
      .from('workspace_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt,
      })
      .eq('id', invitationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resend invitation: ${error.message}`);
    }

    return this.mapInvitation(data);
  }

  /**
   * Check if an invitation is valid (pending and not expired)
   */
  async isInvitationValid(token: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('status, expires_at')
      .eq('token', token)
      .single();

    if (error || !data) {
      return false;
    }

    const isExpired = new Date(data.expires_at) < new Date();
    return data.status === 'pending' && !isExpired;
  }

  /**
   * Get invitation details for display (includes workspace info)
   */
  async getInvitationDetails(
    token: string
  ): Promise<(WorkspaceInvitation & { workspaceName: string; inviterEmail: string }) | null> {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select(
        `
        *,
        workspace:workspaces(name),
        inviter:users!invited_by(email)
      `
      )
      .eq('token', token)
      .single();

    if (error || !data) {
      return null;
    }

    const invitation = this.mapInvitation(data);
    return {
      ...invitation,
      workspaceName: (data.workspace as { name: string })?.name || 'Unknown',
      inviterEmail: (data.inviter as { email: string })?.email || 'Unknown',
    };
  }

  /**
   * Map database invitation to WorkspaceInvitation type
   */
  private mapInvitation(data: Record<string, unknown>): WorkspaceInvitation {
    return {
      id: data.id as string,
      workspaceId: (data.workspace_id || data.workspaceId) as string,
      email: data.email as string,
      role: data.role as WorkspaceRole,
      invitedBy: (data.invited_by || data.invitedBy) as string,
      status: data.status as InvitationStatus,
      token: data.token as string,
      expiresAt: (data.expires_at || data.expiresAt) as string,
      createdAt: (data.created_at || data.createdAt) as string,
      acceptedAt: (data.accepted_at || data.acceptedAt) as string | undefined,
    };
  }
}

// Export singleton instance
export const invitationService = new InvitationService();