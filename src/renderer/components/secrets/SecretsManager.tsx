/**
 * SecretsManager Component
 *
 * UI for managing encrypted secrets vault.
 * Supports creating, viewing, editing, and deleting secrets.
 * Shows access logs and supports workspace sharing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  secretsService,
  type Secret,
  type SecretType,
  type SecretAccessLog,
} from '../../services/secrets';

interface SecretsManagerProps {
  workspaceId?: string;
  className?: string;
}

const SECRET_TYPE_LABELS: Record<SecretType, string> = {
  generic: 'Generic',
  api_key: 'API Key',
  oauth_token: 'OAuth Token',
  password: 'Password',
  certificate: 'Certificate',
  ssh_key: 'SSH Key',
};

const SECRET_TYPE_ICONS: Record<SecretType, string> = {
  generic: '🔐',
  api_key: '🔑',
  oauth_token: '🎫',
  password: '🔒',
  certificate: '📜',
  ssh_key: '🗝️',
};

export const SecretsManager: React.FC<SecretsManagerProps> = ({
  workspaceId,
  className = '',
}) => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessLogs, setShowAccessLogs] = useState(false);
  const [accessLogs, setAccessLogs] = useState<SecretAccessLog[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState<SecretType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);

  // Load secrets
  const loadSecrets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const options: { workspaceId?: string; type?: SecretType } = {};
      if (workspaceId) {
        options.workspaceId = workspaceId;
      }
      if (filterType !== 'all') {
        options.type = filterType;
      }

      const result = await secretsService.listSecrets(options);
      setSecrets(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filterType]);

  // Check encryption availability
  useEffect(() => {
    const checkEncryption = async () => {
      const available = await secretsService.isEncryptionAvailable();
      setEncryptionAvailable(available);
    };
    checkEncryption();
  }, []);

  // Load secrets on mount and when filters change
  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  // Reveal secret value
  const handleRevealSecret = async (secretId: string) => {
    if (revealedSecrets.has(secretId)) {
      // Hide the secret
      setRevealedSecrets((prev) => {
        const next = new Set(prev);
        next.delete(secretId);
        return next;
      });
      return;
    }

    try {
      const secret = await secretsService.getSecret(secretId);
      setDecryptedValues((prev) => ({
        ...prev,
        [secretId]: secret.value || '',
      }));
      setRevealedSecrets((prev) => new Set(prev).add(secretId));

      // Auto-hide after 30 seconds
      setTimeout(() => {
        setRevealedSecrets((prev) => {
          const next = new Set(prev);
          next.delete(secretId);
          return next;
        });
      }, 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal secret');
    }
  };

  // Copy secret to clipboard
  const handleCopySecret = async (secretId: string) => {
    try {
      const secret = await secretsService.getSecret(secretId);
      if (secret.value) {
        await navigator.clipboard.writeText(secret.value);
        // Show brief success message
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy secret');
    }
  };

  // Delete secret
  const handleDeleteSecret = async (secretId: string) => {
    if (!confirm('Are you sure you want to delete this secret? This action cannot be undone.')) {
      return;
    }

    try {
      await secretsService.deleteSecret(secretId);
      await loadSecrets();
      if (selectedSecret?.id === secretId) {
        setSelectedSecret(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete secret');
    }
  };

  // Load access logs
  const handleViewAccessLogs = async (secretId: string) => {
    try {
      const logs = await secretsService.getAccessLogs(secretId);
      setAccessLogs(logs);
      setShowAccessLogs(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load access logs');
    }
  };

  // Filter secrets by search query
  const filteredSecrets = secrets.filter((secret) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      secret.name.toLowerCase().includes(query) ||
      secret.description?.toLowerCase().includes(query) ||
      secret.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  if (!encryptionAvailable) {
    return (
      <div className={`bg-red-900/20 border border-red-500 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-3 text-red-400">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold">Encryption Not Available</h3>
            <p className="text-sm text-red-300">
              Secure storage is not available on this system. Secrets cannot be stored safely.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔐</span>
          <div>
            <h2 className="text-lg font-semibold text-white">Secrets Vault</h2>
            <p className="text-sm text-gray-400">
              {workspaceId ? 'Workspace secrets' : 'Personal secrets'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <span>+</span>
          <span>Add Secret</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-700">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search secrets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as SecretType | 'all')}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {Object.entries(SECRET_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Secrets list */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredSecrets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <span className="text-4xl block mb-4">🔐</span>
            <p>No secrets found</p>
            <p className="text-sm mt-2">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Click "Add Secret" to create your first secret'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSecrets.map((secret) => (
              <SecretCard
                key={secret.id}
                secret={secret}
                isRevealed={revealedSecrets.has(secret.id)}
                decryptedValue={decryptedValues[secret.id]}
                onReveal={() => handleRevealSecret(secret.id)}
                onCopy={() => handleCopySecret(secret.id)}
                onDelete={() => handleDeleteSecret(secret.id)}
                onViewLogs={() => handleViewAccessLogs(secret.id)}
                onSelect={() => setSelectedSecret(secret)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Secret Modal */}
      {showCreateModal && (
        <CreateSecretModal
          workspaceId={workspaceId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadSecrets();
          }}
        />
      )}

      {/* Access Logs Modal */}
      {showAccessLogs && (
        <AccessLogsModal
          logs={accessLogs}
          onClose={() => setShowAccessLogs(false)}
        />
      )}
    </div>
  );
};

// Secret Card Component
interface SecretCardProps {
  secret: Secret;
  isRevealed: boolean;
  decryptedValue?: string;
  onReveal: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
  onSelect: () => void;
}

const SecretCard: React.FC<SecretCardProps> = ({
  secret,
  isRevealed,
  decryptedValue,
  onReveal,
  onCopy,
  onDelete,
  onViewLogs,
}) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{SECRET_TYPE_ICONS[secret.type]}</span>
          <div>
            <h3 className="font-medium text-white">{secret.name}</h3>
            <p className="text-sm text-gray-400">
              {SECRET_TYPE_LABELS[secret.type]}
              {secret.description && ` • ${secret.description}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReveal}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={isRevealed ? 'Hide value' : 'Reveal value'}
          >
            {isRevealed ? '👁️' : '👁️‍🗨️'}
          </button>
          <button
            onClick={onCopy}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Copy to clipboard"
          >
            📋
          </button>
          <button
            onClick={onViewLogs}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="View access logs"
          >
            📊
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
            title="Delete secret"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Revealed value */}
      {isRevealed && decryptedValue && (
        <div className="mt-3 p-3 bg-gray-900 rounded-lg font-mono text-sm text-green-400 break-all">
          {decryptedValue}
        </div>
      )}

      {/* Tags */}
      {secret.tags && secret.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {secret.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-3 text-xs text-gray-500">
        Created {new Date(secret.createdAt).toLocaleDateString()}
        {secret.updatedAt && ` • Updated ${new Date(secret.updatedAt).toLocaleDateString()}`}
      </div>
    </div>
  );
};

// Create Secret Modal
interface CreateSecretModalProps {
  workspaceId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const CreateSecretModal: React.FC<CreateSecretModalProps> = ({
  workspaceId,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState<SecretType>('generic');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !value.trim()) {
      setError('Name and value are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await secretsService.createSecret({
        name: name.trim(),
        value: value.trim(),
        type,
        description: description.trim() || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        workspaceId,
      });

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create secret');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Add New Secret</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production API Key"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Value *
            </label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter the secret value"
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SecretType)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(SECRET_TYPE_LABELS).map(([t, label]) => (
                <option key={t} value={t}>
                  {SECRET_TYPE_ICONS[t as SecretType]} {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags (e.g., production, api)"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Access Logs Modal
interface AccessLogsModalProps {
  logs: SecretAccessLog[];
  onClose: () => void;
}

const AccessLogsModal: React.FC<AccessLogsModalProps> = ({ logs, onClose }) => {
  const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    read: { label: 'Read', color: 'text-blue-400' },
    create: { label: 'Created', color: 'text-green-400' },
    update: { label: 'Updated', color: 'text-yellow-400' },
    delete: { label: 'Deleted', color: 'text-red-400' },
    share: { label: 'Shared', color: 'text-purple-400' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Access Logs</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No access logs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || {
                  label: log.action,
                  color: 'text-gray-400',
                };
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                      <span className="text-gray-400 text-sm">
                        by {log.userId}
                      </span>
                    </div>
                    <span className="text-gray-500 text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecretsManager;