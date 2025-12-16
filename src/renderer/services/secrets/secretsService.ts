/**
 * Secrets Service
 *
 * Provides encrypted secrets vault functionality including:
 * - CRUD operations for secrets
 * - Encryption/decryption using Electron safeStorage
 * - Workspace-scoped secrets
 * - Access logging for audit trail
 */

import { supabase } from '../supabase/client';

// Use the global ElectronAPI type from electron.d.ts
// No need to redeclare - it's already in the global scope

// Types
export type SecretType = 'generic' | 'api_key' | 'oauth_token' | 'password' | 'certificate' | 'ssh_key';

export interface Secret {
  id: string;
  name: string;
  description?: string;
  type: SecretType;
  value?: string; // Only present when decrypted
  tags: string[];
  workspaceId?: string;
  userId?: string;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface SecretListItem {
  id: string;
  name: string;
  description?: string;
  type: SecretType;
  tags: string[];
  workspaceId?: string;
  userId?: string;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSecretInput {
  name: string;
  value: string;
  type: SecretType;
  description?: string;
  tags?: string[];
  workspaceId?: string;
}

export interface UpdateSecretInput {
  name?: string;
  value?: string;
  description?: string;
  tags?: string[];
}

export interface ListSecretsOptions {
  workspaceId?: string;
  type?: SecretType;
  tags?: string[];
}

export interface SecretAccessLog {
  id: string;
  secretId: string;
  userId: string;
  action: 'read' | 'update' | 'delete' | 'share';
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export class SecretsService {
  /**
   * Check if encryption is available
   */
  async isEncryptionAvailable(): Promise<boolean> {
    return window.electronAPI?.secrets?.isEncryptionAvailable() ?? false;
  }

  /**
   * Create a new secret
   */
  async createSecret(input: CreateSecretInput): Promise<Secret> {
    // Check encryption availability
    if (!window.electronAPI?.secrets?.isEncryptionAvailable()) {
      throw new Error('Encryption is not available');
    }

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User must be authenticated to create secrets');
    }

    // Encrypt the value
    const encryptedValue = await window.electronAPI.secrets.encryptString(input.value);

    // Prepare insert data
    const insertData: Record<string, unknown> = {
      name: input.name,
      encrypted_value: encryptedValue,
      secret_type: input.type,
      description: input.description,
      tags: input.tags || [],
      encryption_version: 1,
      created_by: userData.user.id,
    };

    // Set scope (workspace or personal)
    if (input.workspaceId) {
      insertData.workspace_id = input.workspaceId;
      insertData.user_id = null;
    } else {
      insertData.user_id = userData.user.id;
      insertData.workspace_id = null;
    }

    // Insert into database
    const { data, error } = await supabase
      .from('secrets')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Secret "${input.name}" already exists`);
      }
      throw new Error(`Failed to create secret: ${error.message}`);
    }

    return this.mapSecret(data);
  }

  /**
   * Get a secret by ID (with decryption)
   */
  async getSecret(secretId: string): Promise<Secret> {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User must be authenticated to access secrets');
    }

    // Fetch secret
    const { data, error } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', secretId)
      .single();

    if (error || !data) {
      throw new Error('Secret not found');
    }

    // Decrypt the value
    if (!window.electronAPI?.secrets) {
      throw new Error('Encryption API not available');
    }

    const decryptedValue = await window.electronAPI.secrets.decryptString(data.encrypted_value);

    // Log access
    await this.logAccess(secretId, 'read');

    return {
      ...this.mapSecret(data),
      value: decryptedValue,
    };
  }

  /**
   * List secrets (without values)
   */
  async listSecrets(options?: ListSecretsOptions): Promise<SecretListItem[]> {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User must be authenticated to list secrets');
    }

    let query = supabase
      .from('secrets')
      .select('id, name, description, secret_type, tags, workspace_id, user_id, last_accessed_at, access_count, created_at, updated_at');

    // Filter by workspace or personal
    if (options?.workspaceId) {
      query = query.eq('workspace_id', options.workspaceId);
    } else {
      query = query.eq('user_id', userData.user.id).is('workspace_id', null);
    }

    // Filter by type
    if (options?.type) {
      query = query.eq('secret_type', options.type);
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      query = query.contains('tags', options.tags);
    }

    query = query.order('name');

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list secrets: ${error.message}`);
    }

    return (data || []).map((item: Record<string, unknown>) => this.mapSecretListItem(item));
  }

  /**
   * Update a secret
   */
  async updateSecret(secretId: string, input: UpdateSecretInput): Promise<Secret> {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User must be authenticated to update secrets');
    }

    const updateData: Record<string, unknown> = {};

    // Update name if provided
    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    // Update description if provided
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    // Update tags if provided
    if (input.tags !== undefined) {
      updateData.tags = input.tags;
    }

    // Re-encrypt value if provided
    if (input.value !== undefined) {
      if (!window.electronAPI?.secrets?.isEncryptionAvailable()) {
        throw new Error('Encryption is not available');
      }
      updateData.encrypted_value = await window.electronAPI.secrets.encryptString(input.value);
    }

    // Update in database
    const { data, error } = await supabase
      .from('secrets')
      .update(updateData)
      .eq('id', secretId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update secret: ${error.message}`);
    }

    // Log update
    await this.logAccess(secretId, 'update');

    return this.mapSecret(data);
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string): Promise<void> {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User must be authenticated to delete secrets');
    }

    // Log deletion before deleting
    await this.logAccess(secretId, 'delete');

    // Delete from database
    const { error } = await supabase
      .from('secrets')
      .delete()
      .eq('id', secretId);

    if (error) {
      throw new Error(`Failed to delete secret: ${error.message}`);
    }
  }

  /**
   * Share a personal secret to a workspace
   */
  async shareSecret(secretId: string, workspaceId: string): Promise<Secret> {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User must be authenticated to share secrets');
    }

    // Get the original secret
    const { data: originalSecret, error: fetchError } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', secretId)
      .single();

    if (fetchError || !originalSecret) {
      throw new Error('Secret not found');
    }

    // Decrypt the value
    if (!window.electronAPI?.secrets) {
      throw new Error('Encryption API not available');
    }

    const decryptedValue = await window.electronAPI.secrets.decryptString(originalSecret.encrypted_value);

    // Re-encrypt for workspace
    const encryptedValue = await window.electronAPI.secrets.encryptString(decryptedValue);

    // Create new secret in workspace
    const { data, error } = await supabase
      .from('secrets')
      .insert({
        name: originalSecret.name,
        description: originalSecret.description,
        encrypted_value: encryptedValue,
        secret_type: originalSecret.secret_type,
        tags: originalSecret.tags,
        workspace_id: workspaceId,
        user_id: null,
        encryption_version: 1,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to share secret: ${error.message}`);
    }

    // Log share action
    await this.logAccess(secretId, 'share');

    return this.mapSecret(data);
  }

  /**
   * Get access logs for a secret
   */
  async getAccessLogs(secretId: string): Promise<SecretAccessLog[]> {
    const { data, error } = await supabase
      .from('secret_access_logs')
      .select('*')
      .eq('secret_id', secretId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get access logs: ${error.message}`);
    }

    return (data || []).map((log: Record<string, unknown>) => ({
      id: log.id,
      secretId: log.secret_id,
      userId: log.user_id,
      action: log.action,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at,
    }));
  }

  /**
   * Log secret access
   */
  private async logAccess(secretId: string, action: 'read' | 'update' | 'delete' | 'share'): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    
    await supabase
      .from('secret_access_logs')
      .insert({
        secret_id: secretId,
        user_id: userData.user?.id,
        action,
        user_agent: navigator.userAgent,
      });
  }

  /**
   * Map database row to Secret
   */
  private mapSecret(row: Record<string, unknown>): Secret {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.secret_type as SecretType,
      tags: (row.tags as string[]) || [],
      workspaceId: row.workspace_id as string | undefined,
      userId: row.user_id as string | undefined,
      lastAccessedAt: row.last_accessed_at as string | undefined,
      accessCount: (row.access_count as number) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      createdBy: row.created_by as string | undefined,
    };
  }

  /**
   * Map database row to SecretListItem
   */
  private mapSecretListItem(row: Record<string, unknown>): SecretListItem {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.secret_type as SecretType,
      tags: (row.tags as string[]) || [],
      workspaceId: row.workspace_id as string | undefined,
      userId: row.user_id as string | undefined,
      lastAccessedAt: row.last_accessed_at as string | undefined,
      accessCount: (row.access_count as number) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

// Export singleton instance
export const secretsService = new SecretsService();