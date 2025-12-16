/**
 * Environment Manager Page
 *
 * Full-featured environment management with:
 * - Environment list with search
 * - Variable editor with scope support (Global, Environment, Secret)
 * - Import/Export functionality
 * - Quick actions (duplicate, export, delete)
 */

import React, { useState, useCallback } from 'react';
import {
  Search,
  Plus,
  Save,
  FileDown,
  FileUp,
  Trash2,
  Copy,
  Pencil,
  Eye,
  EyeOff,
  CheckCircle,
  Circle,
  Layers,
  Lock,
  Globe,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';

// Types
interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  scope: 'global' | 'environment' | 'secret';
  showValue?: boolean;
}

interface Environment {
  id: string;
  name: string;
  isActive: boolean;
  variables: EnvironmentVariable[];
}

// Mock data
const mockEnvironments: Environment[] = [
  {
    id: 'env1',
    name: 'Local Development',
    isActive: true,
    variables: [
      {
        id: 'v1',
        key: 'API_BASE_URL',
        value: 'http://localhost:3000/api',
        enabled: true,
        scope: 'environment',
      },
      {
        id: 'v2',
        key: 'API_KEY',
        value: 'sk_test_abc123xyz',
        enabled: true,
        scope: 'secret',
      },
      {
        id: 'v3',
        key: 'AUTH_TOKEN',
        value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        enabled: true,
        scope: 'secret',
      },
      {
        id: 'v4',
        key: 'DB_HOST',
        value: 'localhost',
        enabled: true,
        scope: 'environment',
      },
      {
        id: 'v5',
        key: 'DB_PORT',
        value: '5432',
        enabled: true,
        scope: 'environment',
      },
      {
        id: 'v6',
        key: 'REDIS_URL',
        value: 'redis://localhost:6379',
        enabled: false,
        scope: 'environment',
      },
      {
        id: 'v7',
        key: 'TIMEOUT',
        value: '5000',
        enabled: true,
        scope: 'global',
      },
      {
        id: 'v8',
        key: 'DEBUG_MODE',
        value: 'true',
        enabled: true,
        scope: 'environment',
      },
    ],
  },
  {
    id: 'env2',
    name: 'Staging',
    isActive: false,
    variables: [
      {
        id: 'v9',
        key: 'API_BASE_URL',
        value: 'https://staging-api.example.com',
        enabled: true,
        scope: 'environment',
      },
      {
        id: 'v10',
        key: 'API_KEY',
        value: 'sk_staging_xyz789',
        enabled: true,
        scope: 'secret',
      },
    ],
  },
  {
    id: 'env3',
    name: 'Production',
    isActive: false,
    variables: [
      {
        id: 'v11',
        key: 'API_BASE_URL',
        value: 'https://api.example.com',
        enabled: true,
        scope: 'environment',
      },
      {
        id: 'v12',
        key: 'API_KEY',
        value: 'sk_live_prod123',
        enabled: true,
        scope: 'secret',
      },
    ],
  },
  {
    id: 'env4',
    name: 'Testing',
    isActive: false,
    variables: [
      {
        id: 'v13',
        key: 'API_BASE_URL',
        value: 'http://localhost:3001/api',
        enabled: true,
        scope: 'environment',
      },
    ],
  },
];

// Scope badge component
const ScopeBadge: React.FC<{ scope: EnvironmentVariable['scope'] }> = ({ scope }) => {
  const config = {
    global: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      icon: Globe,
      label: 'Global',
    },
    environment: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      icon: Layers,
      label: 'Environment',
    },
    secret: {
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      icon: Lock,
      label: 'Secret',
    },
  };

  const { bg, text, icon: Icon, label } = config[scope];

  return (
    <span className={`inline-flex items-center px-2 py-1 ${bg} ${text} rounded text-xs`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </span>
  );
};

export const EnvironmentManagerPage: React.FC = () => {
  // State
  const [environments, setEnvironments] = useState<Environment[]>(mockEnvironments);
  const [selectedEnvId, setSelectedEnvId] = useState<string>(mockEnvironments[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());

  // Get selected environment
  const selectedEnv = environments.find((e) => e.id === selectedEnvId) || environments[0];

  // Filter environments by search
  const filteredEnvironments = environments.filter((env) =>
    env.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleSelectEnvironment = useCallback((envId: string) => {
    setSelectedEnvId(envId);
  }, []);

  const handleSetActiveEnvironment = useCallback((envId: string) => {
    setEnvironments((prev) =>
      prev.map((env) => ({
        ...env,
        isActive: env.id === envId,
      }))
    );
  }, []);

  const handleAddEnvironment = useCallback(() => {
    const newEnv: Environment = {
      id: `env${Date.now()}`,
      name: 'New Environment',
      isActive: false,
      variables: [],
    };
    setEnvironments((prev) => [...prev, newEnv]);
    setSelectedEnvId(newEnv.id);
  }, []);

  const handleAddVariable = useCallback(() => {
    const newVariable: EnvironmentVariable = {
      id: `v${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
      scope: 'environment',
    };
    setEnvironments((prev) =>
      prev.map((env) =>
        env.id === selectedEnvId
          ? { ...env, variables: [...env.variables, newVariable] }
          : env
      )
    );
  }, [selectedEnvId]);

  const handleUpdateVariable = useCallback(
    (variableId: string, updates: Partial<EnvironmentVariable>) => {
      setEnvironments((prev) =>
        prev.map((env) =>
          env.id === selectedEnvId
            ? {
                ...env,
                variables: env.variables.map((v) =>
                  v.id === variableId ? { ...v, ...updates } : v
                ),
              }
            : env
        )
      );
    },
    [selectedEnvId]
  );

  const handleDeleteVariable = useCallback(
    (variableId: string) => {
      setEnvironments((prev) =>
        prev.map((env) =>
          env.id === selectedEnvId
            ? { ...env, variables: env.variables.filter((v) => v.id !== variableId) }
            : env
        )
      );
    },
    [selectedEnvId]
  );

  const handleToggleShowSecret = useCallback((variableId: string) => {
    setShowSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(variableId)) {
        next.delete(variableId);
      } else {
        next.add(variableId);
      }
      return next;
    });
  }, []);

  const handleDuplicateEnvironment = useCallback(() => {
    const newEnv: Environment = {
      ...selectedEnv,
      id: `env${Date.now()}`,
      name: `${selectedEnv.name} (Copy)`,
      isActive: false,
      variables: selectedEnv.variables.map((v) => ({ ...v, id: `v${Date.now()}_${v.id}` })),
    };
    setEnvironments((prev) => [...prev, newEnv]);
    setSelectedEnvId(newEnv.id);
  }, [selectedEnv]);

  const handleDeleteEnvironment = useCallback(() => {
    if (environments.length <= 1) return;
    setEnvironments((prev) => prev.filter((env) => env.id !== selectedEnvId));
    setSelectedEnvId(environments[0].id === selectedEnvId ? environments[1].id : environments[0].id);
  }, [selectedEnvId, environments]);

  const handleExportEnvironment = useCallback(() => {
    const exportData = {
      name: selectedEnv.name,
      variables: selectedEnv.variables.map((v) => ({
        key: v.key,
        value: v.scope === 'secret' ? '***' : v.value,
        enabled: v.enabled,
        scope: v.scope,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEnv.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedEnv]);

  const handleSave = useCallback(() => {
    // TODO: Save to database
    console.log('Saving environments:', environments);
  }, [environments]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Environment List Panel */}
      <div className="w-80 bg-dark-surface border-r border-dark-border flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-dark-border">
          <div className="relative">
            <input
              type="text"
              placeholder="Search environments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue transition-colors"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Environment List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredEnvironments.map((env) => (
              <div
                key={env.id}
                onClick={() => handleSelectEnvironment(env.id)}
                onDoubleClick={() => handleSetActiveEnvironment(env.id)}
                className={`rounded-lg p-4 cursor-pointer transition-colors border-l-4 ${
                  env.id === selectedEnvId
                    ? 'bg-dark-bg border-accent-blue'
                    : env.isActive
                    ? 'bg-dark-bg border-green-500'
                    : 'bg-dark-bg border-dark-border hover:bg-dark-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-200 flex items-center">
                    {env.isActive ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-600 mr-2" />
                    )}
                    {env.name}
                  </h3>
                  {env.isActive && (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{env.variables.length} variables</p>
              </div>
            ))}
          </div>
        </div>

        {/* Import/Export Buttons */}
        <div className="p-4 border-t border-dark-border">
          <button className="w-full flex items-center justify-between px-4 py-2 text-gray-400 hover:text-gray-200 hover:bg-dark-bg rounded-lg transition-colors">
            <span className="flex items-center">
              <FileUp className="w-4 h-4 mr-2" />
              Import Environment
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportEnvironment}
            className="w-full flex items-center justify-between px-4 py-2 text-gray-400 hover:text-gray-200 hover:bg-dark-bg rounded-lg transition-colors mt-2"
          >
            <span className="flex items-center">
              <FileDown className="w-4 h-4 mr-2" />
              Export Environment
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* New Environment Button */}
        <div className="p-4 border-t border-dark-border">
          <button
            onClick={handleAddEnvironment}
            className="w-full flex items-center justify-center px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Environment
          </button>
        </div>
      </div>

      {/* Environment Editor Panel */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="bg-dark-surface border-b border-dark-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              {selectedEnv.isActive ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <Circle className="w-6 h-6 text-gray-500" />
              )}
              <div>
                <h2 className="text-lg font-semibold">{selectedEnv.name}</h2>
                <p className="text-sm text-gray-500">
                  {selectedEnv.isActive ? 'Active environment' : 'Inactive environment'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportEnvironment}
              className="px-4 py-2 bg-dark-bg hover:bg-dark-border text-gray-200 rounded-lg border border-dark-border transition-colors flex items-center"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export JSON
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
            <button className="text-gray-400 hover:text-gray-200 transition-colors p-2">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Variables Editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Variables Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Environment Variables
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Define key-value pairs for this environment
                  </p>
                </div>
                <button
                  onClick={handleAddVariable}
                  className="px-3 py-1.5 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg border border-dark-border transition-colors text-sm flex items-center"
                >
                  <Plus className="w-3 h-3 mr-2" />
                  Add Variable
                </button>
              </div>

              <div className="bg-dark-surface rounded-lg border border-dark-border overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-bg border-b border-dark-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <div className="col-span-4">Variable Name</div>
                  <div className="col-span-4">Value</div>
                  <div className="col-span-2">Scope</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Variables List */}
                <div className="divide-y divide-dark-border">
                  {selectedEnv.variables.map((variable) => (
                    <div
                      key={variable.id}
                      className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-dark-bg transition-colors group"
                    >
                      {/* Variable Name */}
                      <div className="col-span-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={variable.enabled}
                            onChange={(e) =>
                              handleUpdateVariable(variable.id, { enabled: e.target.checked })
                            }
                            className="w-4 h-4 rounded bg-dark-bg border-dark-border text-accent-blue focus:ring-accent-blue mr-3"
                          />
                          <input
                            type="text"
                            value={variable.key}
                            onChange={(e) =>
                              handleUpdateVariable(variable.id, { key: e.target.value })
                            }
                            className="bg-transparent text-gray-200 text-sm font-mono focus:outline-none w-full"
                            placeholder="VARIABLE_NAME"
                          />
                        </div>
                      </div>

                      {/* Value */}
                      <div className="col-span-4 flex items-center">
                        <input
                          type={
                            variable.scope === 'secret' && !showSecrets.has(variable.id)
                              ? 'password'
                              : 'text'
                          }
                          value={variable.value}
                          onChange={(e) =>
                            handleUpdateVariable(variable.id, { value: e.target.value })
                          }
                          className="bg-transparent text-gray-400 text-sm font-mono focus:outline-none w-full"
                          placeholder="value"
                        />
                        {variable.scope === 'secret' && (
                          <button
                            onClick={() => handleToggleShowSecret(variable.id)}
                            className="ml-2 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {showSecrets.has(variable.id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Scope */}
                      <div className="col-span-2">
                        <select
                          value={variable.scope}
                          onChange={(e) =>
                            handleUpdateVariable(variable.id, {
                              scope: e.target.value as EnvironmentVariable['scope'],
                            })
                          }
                          className="bg-transparent text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="environment">Environment</option>
                          <option value="global">Global</option>
                          <option value="secret">Secret</option>
                        </select>
                        <div className="mt-1">
                          <ScopeBadge scope={variable.scope} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-gray-400 hover:text-accent-blue transition-colors p-1">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVariable(variable.id)}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {selectedEnv.variables.length === 0 && (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <p>No variables defined yet.</p>
                      <button
                        onClick={handleAddVariable}
                        className="mt-2 text-accent-blue hover:text-cyan-400"
                      >
                        Add your first variable
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={handleDuplicateEnvironment}
                  className="flex items-center justify-center px-4 py-3 bg-dark-bg hover:bg-dark-border border border-dark-border rounded-lg text-gray-300 transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate Environment
                </button>
                <button
                  onClick={handleExportEnvironment}
                  className="flex items-center justify-center px-4 py-3 bg-dark-bg hover:bg-dark-border border border-dark-border rounded-lg text-gray-300 transition-colors"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export as JSON
                </button>
                <button
                  onClick={handleDeleteEnvironment}
                  disabled={environments.length <= 1}
                  className="flex items-center justify-center px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Environment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-dark-surface border-t border-dark-border px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-6">
              <span className="flex items-center">
                <Layers className="w-4 h-4 text-accent-blue mr-2" />
                <span className="font-medium text-gray-400">{selectedEnv.name}</span>
                <span className="mx-2">•</span>
                <span>{selectedEnv.variables.length} variables</span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                All systems operational
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default EnvironmentManagerPage;