/**
 * Secrets Service Tests
 *
 * Tests for encrypted secrets vault functionality including:
 * - CRUD operations for secrets
 * - Encryption/decryption using Electron safeStorage
 * - Workspace-scoped secrets
 * - Access logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecretsService, SecretType } from './secretsService';

// Mock Supabase - must be defined inline in the factory
vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Import the mocked module to access the mock functions
import { supabase } from '../supabase/client';

// Mock Electron safeStorage via IPC
const mockSecretsApi = {
  encryptString: vi.fn(),
  decryptString: vi.fn(),
  isEncryptionAvailable: vi.fn(),
};

vi.stubGlobal('window', {
  electronAPI: {
    secrets: mockSecretsApi,
  },
});

// Helper to create chainable mock
const createChainableMock = (finalValue: unknown) => {
  const mock: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'single', 'maybeSingle', 'contains'];
  
  methods.forEach((method) => {
    mock[method] = vi.fn().mockReturnValue(mock);
  });
  
  mock['then'] = vi.fn((resolve: (value: unknown) => void) => {
    resolve(finalValue);
    return Promise.resolve(finalValue);
  });
  
  return mock;
};

describe('SecretsService', () => {
  let secretsService: SecretsService;

  beforeEach(() => {
    secretsService = new SecretsService();
    vi.clearAllMocks();

    // Default mock for authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as never);

    // Default mock for encryption availability
    mockSecretsApi.isEncryptionAvailable.mockReturnValue(true);
  });

  describe('createSecret', () => {
    it('should create a personal secret with encryption', async () => {
      const encryptedValue = 'encrypted-base64-string';
      mockSecretsApi.encryptString.mockResolvedValue(encryptedValue);

      const mockChain = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'API Key',
          encrypted_value: encryptedValue,
          secret_type: 'api_key',
          user_id: 'user-123',
          workspace_id: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.createSecret({
        name: 'API Key',
        value: 'sk-1234567890',
        type: 'api_key',
        description: 'My API key',
      });

      expect(mockSecretsApi.encryptString).toHaveBeenCalledWith('sk-1234567890');
      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('secrets');
      expect(result.name).toBe('API Key');
      expect(result.type).toBe('api_key');
    });

    it('should create a workspace secret', async () => {
      const encryptedValue = 'encrypted-workspace-secret';
      mockSecretsApi.encryptString.mockResolvedValue(encryptedValue);

      const mockChain = createChainableMock({
        data: {
          id: 'secret-2',
          name: 'Team Token',
          encrypted_value: encryptedValue,
          secret_type: 'oauth_token',
          user_id: null,
          workspace_id: 'workspace-123',
          created_at: new Date().toISOString(),
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.createSecret({
        name: 'Team Token',
        value: 'oauth-token-value',
        type: 'oauth_token',
        workspaceId: 'workspace-123',
      });

      expect(result.workspaceId).toBe('workspace-123');
    });

    it('should throw error when encryption is not available', async () => {
      mockSecretsApi.isEncryptionAvailable.mockReturnValue(false);

      await expect(
        secretsService.createSecret({
          name: 'Test Secret',
          value: 'secret-value',
          type: 'generic',
        })
      ).rejects.toThrow('Encryption is not available');
    });

    it('should throw error for duplicate secret name', async () => {
      mockSecretsApi.encryptString.mockResolvedValue('encrypted');

      const mockChain = createChainableMock({
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      await expect(
        secretsService.createSecret({
          name: 'Existing Secret',
          value: 'value',
          type: 'generic',
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('getSecret', () => {
    it('should retrieve and decrypt a secret', async () => {
      const encryptedValue = 'encrypted-value';
      const decryptedValue = 'my-secret-value';

      mockSecretsApi.decryptString.mockResolvedValue(decryptedValue);

      const mockChain = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'My Secret',
          encrypted_value: encryptedValue,
          secret_type: 'generic',
          user_id: 'user-123',
          workspace_id: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.getSecret('secret-1');

      expect(mockSecretsApi.decryptString).toHaveBeenCalledWith(encryptedValue);
      expect(result.value).toBe(decryptedValue);
    });

    it('should log access when retrieving secret', async () => {
      mockSecretsApi.decryptString.mockResolvedValue('decrypted');

      const selectMock = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'My Secret',
          encrypted_value: 'encrypted',
          secret_type: 'generic',
          user_id: 'user-123',
        },
        error: null,
      });

      const insertMock = createChainableMock({ data: null, error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'secrets') return selectMock as never;
        if (table === 'secret_access_logs') return insertMock as never;
        return selectMock as never;
      });

      await secretsService.getSecret('secret-1');

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('secret_access_logs');
    });

    it('should throw error for non-existent secret', async () => {
      const mockChain = createChainableMock({
        data: null,
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      await expect(secretsService.getSecret('non-existent')).rejects.toThrow('Secret not found');
    });
  });

  describe('listSecrets', () => {
    it('should list personal secrets without values', async () => {
      const mockChain = createChainableMock({
        data: [
          {
            id: 'secret-1',
            name: 'API Key',
            secret_type: 'api_key',
            user_id: 'user-123',
            workspace_id: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'secret-2',
            name: 'Password',
            secret_type: 'password',
            user_id: 'user-123',
            workspace_id: null,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.listSecrets();

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('value');
      expect(result[0]).not.toHaveProperty('encrypted_value');
    });

    it('should list workspace secrets', async () => {
      const mockChain = createChainableMock({
        data: [
          {
            id: 'secret-3',
            name: 'Team Secret',
            secret_type: 'generic',
            user_id: null,
            workspace_id: 'workspace-123',
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.listSecrets({ workspaceId: 'workspace-123' });

      expect(result).toHaveLength(1);
      expect(result[0].workspaceId).toBe('workspace-123');
    });

    it('should filter by secret type', async () => {
      const mockChain = createChainableMock({
        data: [
          {
            id: 'secret-1',
            name: 'API Key 1',
            secret_type: 'api_key',
            user_id: 'user-123',
          },
        ],
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.listSecrets({ type: 'api_key' });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('api_key');
    });
  });

  describe('updateSecret', () => {
    it('should update secret value with re-encryption', async () => {
      const newEncryptedValue = 'new-encrypted-value';
      mockSecretsApi.encryptString.mockResolvedValue(newEncryptedValue);

      const mockChain = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'Updated Secret',
          encrypted_value: newEncryptedValue,
          secret_type: 'generic',
          user_id: 'user-123',
          updated_at: new Date().toISOString(),
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.updateSecret('secret-1', {
        value: 'new-secret-value',
      });

      expect(mockSecretsApi.encryptString).toHaveBeenCalledWith('new-secret-value');
      expect(result.id).toBe('secret-1');
    });

    it('should update secret metadata without re-encryption', async () => {
      const mockChain = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'Renamed Secret',
          description: 'New description',
          secret_type: 'generic',
          user_id: 'user-123',
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.updateSecret('secret-1', {
        name: 'Renamed Secret',
        description: 'New description',
      });

      expect(mockSecretsApi.encryptString).not.toHaveBeenCalled();
      expect(result.name).toBe('Renamed Secret');
    });

    it('should log update action', async () => {
      mockSecretsApi.encryptString.mockResolvedValue('encrypted');

      const updateMock = createChainableMock({
        data: { id: 'secret-1', name: 'Secret' },
        error: null,
      });
      const insertMock = createChainableMock({ data: null, error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'secrets') return updateMock as never;
        if (table === 'secret_access_logs') return insertMock as never;
        return updateMock as never;
      });

      await secretsService.updateSecret('secret-1', { value: 'new-value' });

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('secret_access_logs');
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret', async () => {
      const mockChain = createChainableMock({
        data: null,
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      await secretsService.deleteSecret('secret-1');

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('secrets');
    });

    it('should log delete action before deletion', async () => {
      const deleteMock = createChainableMock({ data: null, error: null });
      const insertMock = createChainableMock({ data: null, error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'secrets') return deleteMock as never;
        if (table === 'secret_access_logs') return insertMock as never;
        return deleteMock as never;
      });

      await secretsService.deleteSecret('secret-1');

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('secret_access_logs');
    });
  });

  describe('shareSecret', () => {
    it('should share personal secret to workspace', async () => {
      mockSecretsApi.decryptString.mockResolvedValue('secret-value');
      mockSecretsApi.encryptString.mockResolvedValue('re-encrypted');

      const selectMock = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'My Secret',
          encrypted_value: 'encrypted',
          secret_type: 'generic',
          user_id: 'user-123',
        },
        error: null,
      });

      const insertMock = createChainableMock({
        data: {
          id: 'secret-2',
          name: 'My Secret',
          workspace_id: 'workspace-123',
        },
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return selectMock as never;
        return insertMock as never;
      });

      const result = await secretsService.shareSecret('secret-1', 'workspace-123');

      expect(result.workspaceId).toBe('workspace-123');
    });

    it('should log share action', async () => {
      mockSecretsApi.decryptString.mockResolvedValue('value');
      mockSecretsApi.encryptString.mockResolvedValue('encrypted');

      const selectMock = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'Secret',
          encrypted_value: 'encrypted',
          user_id: 'user-123',
        },
        error: null,
      });

      const insertMock = createChainableMock({
        data: { id: 'secret-2', workspace_id: 'workspace-123' },
        error: null,
      });

      const logMock = createChainableMock({ data: null, error: null });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'secret_access_logs') return logMock as never;
        callCount++;
        if (callCount === 1) return selectMock as never;
        return insertMock as never;
      });

      await secretsService.shareSecret('secret-1', 'workspace-123');

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('secret_access_logs');
    });
  });

  describe('getAccessLogs', () => {
    it('should retrieve access logs for a secret', async () => {
      const mockChain = createChainableMock({
        data: [
          {
            id: 'log-1',
            secret_id: 'secret-1',
            user_id: 'user-123',
            action: 'read',
            created_at: new Date().toISOString(),
          },
          {
            id: 'log-2',
            secret_id: 'secret-1',
            user_id: 'user-123',
            action: 'update',
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.getAccessLogs('secret-1');

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('read');
    });
  });

  describe('encryption', () => {
    it('should check encryption availability', async () => {
      mockSecretsApi.isEncryptionAvailable.mockReturnValue(true);

      const result = await secretsService.isEncryptionAvailable();

      expect(result).toBe(true);
    });

    it('should handle encryption failure gracefully', async () => {
      mockSecretsApi.encryptString.mockRejectedValue(new Error('Encryption failed'));

      await expect(
        secretsService.createSecret({
          name: 'Test',
          value: 'value',
          type: 'generic',
        })
      ).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption failure gracefully', async () => {
      mockSecretsApi.decryptString.mockRejectedValue(new Error('Decryption failed'));

      const mockChain = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'Secret',
          encrypted_value: 'corrupted',
          user_id: 'user-123',
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      await expect(secretsService.getSecret('secret-1')).rejects.toThrow('Decryption failed');
    });
  });

  describe('secret types', () => {
    const secretTypes: SecretType[] = ['generic', 'api_key', 'oauth_token', 'password', 'certificate', 'ssh_key'];

    secretTypes.forEach((type) => {
      it(`should support ${type} secret type`, async () => {
        mockSecretsApi.encryptString.mockResolvedValue('encrypted');

        const mockChain = createChainableMock({
          data: {
            id: 'secret-1',
            name: `${type} Secret`,
            secret_type: type,
            user_id: 'user-123',
          },
          error: null,
        });
        vi.mocked(supabase.from).mockReturnValue(mockChain as never);

        const result = await secretsService.createSecret({
          name: `${type} Secret`,
          value: 'value',
          type,
        });

        expect(result.type).toBe(type);
      });
    });
  });

  describe('tags', () => {
    it('should create secret with tags', async () => {
      mockSecretsApi.encryptString.mockResolvedValue('encrypted');

      const mockChain = createChainableMock({
        data: {
          id: 'secret-1',
          name: 'Tagged Secret',
          tags: ['production', 'api'],
          user_id: 'user-123',
        },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.createSecret({
        name: 'Tagged Secret',
        value: 'value',
        type: 'generic',
        tags: ['production', 'api'],
      });

      expect(result.tags).toContain('production');
      expect(result.tags).toContain('api');
    });

    it('should filter secrets by tag', async () => {
      const mockChain = createChainableMock({
        data: [
          {
            id: 'secret-1',
            name: 'Production Secret',
            tags: ['production'],
            user_id: 'user-123',
          },
        ],
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await secretsService.listSecrets({ tags: ['production'] });

      expect(result).toHaveLength(1);
    });
  });
});