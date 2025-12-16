
/**
 * Collection Management Page
 *
 * Full-featured collection editor with:
 * - Collection metadata editing (name, description, tags)
 * - Folder and request management with drag-and-drop
 * - Collection variables
 * - Collection-level authorization
 * - Collection settings
 * - Help panel with tips
 */

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  FileDown,
  Trash2,
  Copy,
  GripVertical,
  Pencil,
  X,
  Lightbulb,
  BookOpen,
  ArrowRight,
  Info,
  Tag,
} from 'lucide-react';
import { KeyValueEditor } from '../components/workspace';
import type { KeyValuePair } from '../stores';

// Types
interface CollectionRequest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  url: string;
}

interface CollectionFolder {
  id: string;
  name: string;
  color: string;
  requests: CollectionRequest[];
  expanded?: boolean;
}

interface CollectionTag {
  id: string;
  name: string;
  color: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  folders: CollectionFolder[];
  tags: CollectionTag[];
  variables: KeyValuePair[];
  authType: string;
  authConfig: Record<string, string>;
}

type TabType = 'overview' | 'requests' | 'variables' | 'authorization' | 'settings';

// Method badge colors
const methodColors: Record<string, { bg: string; text: string }> = {
  GET: { bg: 'bg-green-500/20', text: 'text-green-400' },
  POST: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  PUT: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  PATCH: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  DELETE: { bg: 'bg-red-500/20', text: 'text-red-400' },
  OPTIONS: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  HEAD: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

// Folder colors
const folderColors = [
  'text-blue-400',
  'text-green-400',
  'text-purple-400',
  'text-orange-400',
  'text-pink-400',
  'text-teal-400',
  'text-yellow-400',
  'text-red-400',
];

// Tag colors
const tagColors = [
  { bg: 'bg-green-500/20', text: 'text-green-400' },
  { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  { bg: 'bg-pink-500/20', text: 'text-pink-400' },
  { bg: 'bg-teal-500/20', text: 'text-teal-400' },
];

// Mock data
const mockCollection: Collection = {
  id: '1',
  name: 'E-commerce API',
  description:
    'Complete REST API for e-commerce platform including product management, order processing, and payment integration.',
  folders: [
    {
      id: 'f1',
      name: 'Products',
      color: 'text-blue-400',
      expanded: true,
      requests: [
        { id: 'r1', name: 'List Products', method: 'GET', url: '/api/products' },
        { id: 'r2', name: 'Get Product Details', method: 'GET', url: '/api/products/:id' },
        { id: 'r3', name: 'Create Product', method: 'POST', url: '/api/products' },
        { id: 'r4', name: 'Update Product', method: 'PUT', url: '/api/products/:id' },
        { id: 'r5', name: 'Delete Product', method: 'DELETE', url: '/api/products/:id' },
      ],
    },
    {
      id: 'f2',
      name: 'Orders',
      color: 'text-green-400',
      expanded: false,
      requests: [
        { id: 'r6', name: 'List Orders', method: 'GET', url: '/api/orders' },
        { id: 'r7', name: 'Create Order', method: 'POST', url: '/api/orders' },
        { id: 'r8', name: 'Get Order', method: 'GET', url: '/api/orders/:id' },
        { id: 'r9', name: 'Update Order Status', method: 'PATCH', url: '/api/orders/:id/status' },
      ],
    },
  ],
  tags: [
    { id: 't1', name: 'REST', color: 'green' },
    { id: 't2', name: 'OAuth', color: 'blue' },
    { id: 't3', name: 'Production', color: 'purple' },
  ],
  variables: [
    { id: 'v1', key: 'baseUrl', value: 'https://api.example.com', enabled: true },
    { id: 'v2', key: 'apiKey', value: 'sk_test_xxx', enabled: true },
    { id: 'v3', key: 'version', value: 'v1', enabled: true },
  ],
  authType: 'bearer',
  authConfig: { token: '{{apiKey}}' },
};

export const CollectionPage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  // State
  const [collection, setCollection] = useState<Collection>(mockCollection);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(collection.folders.filter((f) => f.expanded).map((f) => f.id))
  );
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(true);

  // Handlers
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setCollection((prev) => ({ ...prev, name }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setCollection((prev) => ({ ...prev, description }));
  }, []);

  const handleAddFolder = useCallback(() => {
    const newFolder: CollectionFolder = {
      id: `f${Date.now()}`,
      name: 'New Folder',
      color: folderColors[Math.floor(Math.random() * folderColors.length)],
      requests: [],
      expanded: true,
    };
    setCollection((prev) => ({
      ...prev,
      folders: [...prev.folders, newFolder],
    }));
    setExpandedFolders((prev) => new Set([...prev, newFolder.id]));
    setEditingFolderId(newFolder.id);
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    setCollection((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== folderId),
    }));
  }, []);

  const handleFolderNameChange = useCallback((folderId: string, name: string) => {
    setCollection((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
    }));
  }, []);

  const handleAddTag = useCallback(() => {
    if (!newTagName.trim()) return;
    const colorIndex = collection.tags.length % tagColors.length;
    const newTag: CollectionTag = {
      id: `t${Date.now()}`,
      name: newTagName.trim(),
      color: ['green', 'blue', 'purple', 'orange', 'pink', 'teal'][colorIndex],
    };
    setCollection((prev) => ({
      ...prev,
      tags: [...prev.tags, newTag],
    }));
    setNewTagName('');
    setShowAddTag(false);
  }, [newTagName, collection.tags.length]);

  const handleRemoveTag = useCallback((tagId: string) => {
    setCollection((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t.id !== tagId),
    }));
  }, []);

  const handleVariablesChange = useCallback((variables: KeyValuePair[]) => {
    setCollection((prev) => ({ ...prev, variables }));
  }, []);

  const handleSave = useCallback(() => {
    // TODO: Save to database
    console.log('Saving collection:', collection);
  }, [collection]);

  const handleExport = useCallback(() => {
    // TODO: Export collection
    console.log('Exporting collection:', collection);
  }, [collection]);

  const handleDelete = useCallback(() => {
    // TODO: Delete collection with confirmation
    console.log('Deleting collection:', collection.id);
    navigate('/');
  }, [collection.id, navigate]);

  const handleDuplicate = useCallback(() => {
    // TODO: Duplicate collection
    console.log('Duplicating collection:', collection.id);
  }, [collection.id]);

  const handleOpenRequest = useCallback(
    (requestId: string) => {
      // TODO: Open request in workspace
      navigate(`/workspace?request=${requestId}`);
    },
    [navigate]
  );

  // Get tag color classes
  const getTagColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      green: { bg: 'bg-green-500/20', text: 'text-green-400' },
      blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
      orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
      pink: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
      teal: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
    };
    return colorMap[color] || colorMap.blue;
  };

  // Calculate totals
  const totalRequests = collection.folders.reduce((sum, f) => sum + f.requests.length, 0);
  const totalFolders = collection.folders.length;

  // Render tabs
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'requests', label: 'Requests' },
    { id: 'variables', label: 'Variables' },
    { id: 'authorization', label: 'Authorization' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main Content */}
      <section className="flex-1 flex flex-col bg-dark-bg overflow-hidden">
        {/* Header */}
        <div className="border-b border-dark-border bg-dark-surface px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Folder className="w-8 h-8 text-purple-400" />
              <div>
                <h2 className="text-xl font-semibold">{collection.name}</h2>
                <p className="text-sm text-gray-500">
                  {totalRequests} requests • {totalFolders} folders
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-dark-border hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2"
              >
                <FileDown className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg rounded-lg transition-all text-sm font-semibold flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Collection</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-dark-border text-gray-200'
                    : 'text-gray-400 hover:bg-dark-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Collection Name */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    value={collection.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={collection.description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue transition-colors resize-none"
                    placeholder="Add a description for this collection..."
                  />
                </div>

                {/* Folders & Requests */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-400">Folders & Requests</label>
                    <button
                      onClick={handleAddFolder}
                      className="px-3 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm flex items-center space-x-2 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Folder</span>
                    </button>
                  </div>

                  <div className="space-y-2 bg-dark-surface border border-dark-border rounded-lg p-4">
                    {collection.folders.map((folder) => (
                      <div key={folder.id} className="group">
                        {/* Folder Header */}
                        <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg hover:bg-dark-border cursor-pointer transition-colors">
                          <div
                            className="flex items-center space-x-3 flex-1"
                            onClick={() => toggleFolder(folder.id)}
                          >
                            <GripVertical className="w-4 h-4 text-gray-600 cursor-move" />
                            {expandedFolders.has(folder.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <Folder className={`w-4 h-4 ${folder.color}`} />
                            {editingFolderId === folder.id ? (
                              <input
                                type="text"
                                value={folder.name}
                                onChange={(e) => handleFolderNameChange(folder.id, e.target.value)}
                                onBlur={() => setEditingFolderId(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingFolderId(null)}
                                className="bg-dark-surface border border-dark-border rounded px-2 py-0.5 text-sm focus:outline-none focus:border-accent-blue"
                                autoFocus
                              />
                            ) : (
                              <span className="text-sm font-medium">{folder.name}</span>
                            )}
                            <span className="text-xs text-gray-500">
                              {folder.requests.length} requests
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingFolderId(folder.id)}
                              className="text-gray-500 hover:text-accent-blue p-1"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="text-gray-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Folder Requests */}
                        {expandedFolders.has(folder.id) && (
                          <div className="ml-8 mt-2 space-y-1">
                            {folder.requests.map((request) => {
                              const colors = methodColors[request.method];
                              return (
                                <div
                                  key={request.id}
                                  onClick={() => handleOpenRequest(request.id)}
                                  className="flex items-center justify-between p-2 rounded hover:bg-dark-border cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center space-x-3">
                                    <GripVertical className="w-3 h-3 text-gray-600 cursor-move" />
                                    <span
                                      className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs font-semibold rounded`}
                                    >
                                      {request.method}
                                    </span>
                                    <span className="text-sm text-gray-300">{request.name}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Request/Folder Button */}
                    <button className="w-full p-3 border-2 border-dashed border-dark-border rounded-lg hover:border-accent-blue/50 hover:bg-dark-border transition-all text-sm text-gray-500 flex items-center justify-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Add Request or Folder</span>
                    </button>
                  </div>
                </div>

                {/* Tags */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {collection.tags.map((tag) => {
                      const colors = getTagColorClasses(tag.color);
                      return (
                        <span
                          key={tag.id}
                          className={`px-3 py-1.5 ${colors.bg} ${colors.text} text-sm rounded-full flex items-center space-x-2`}
                        >
                          <span>{tag.name}</span>
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {showAddTag ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        placeholder="Tag name..."
                        className="bg-dark-surface border border-dark-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-blue"
                        autoFocus
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-3 py-1.5 bg-accent-blue text-dark-bg rounded-lg text-sm font-medium"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddTag(false);
                          setNewTagName('');
                        }}
                        className="px-3 py-1.5 bg-dark-border rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddTag(true)}
                      className="px-3 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm text-gray-400 flex items-center space-x-2 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Tag</span>
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3 pt-6 border-t border-dark-border">
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Collection</span>
                  </button>
                  <button
                    onClick={handleDuplicate}
                    className="px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg transition-colors text-sm font-medium flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Duplicate Collection</span>
                  </button>
                </div>
              </>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">All Requests</h3>
                  <button className="px-3 py-1.5 bg-accent-blue text-dark-bg rounded-lg text-sm font-medium flex items-center space-x-2">
                    <Plus className="w-3 h-3" />
                    <span>New Request</span>
                  </button>
                </div>
                {collection.folders.map((folder) => (
                  <div key={folder.id} className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-400 flex items-center space-x-2">
                      <Folder className={`w-4 h-4 ${folder.color}`} />
                      <span>{folder.name}</span>
                    </h4>
                    {folder.requests.map((request) => {
                      const colors = methodColors[request.method];
                      return (
                        <div
                          key={request.id}
                          onClick={() => handleOpenRequest(request.id)}
                          className="flex items-center justify-between p-3 bg-dark-surface border border-dark-border rounded-lg hover:border-accent-blue/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <span
                              className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs font-semibold rounded`}
                            >
                              {request.method}
                            </span>
                            <span className="text-sm font-medium">{request.name}</span>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">{request.url}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Variables Tab */}
            {activeTab === 'variables' && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Collection Variables</h3>
                  <p className="text-sm text-gray-500">
                    Variables defined here are available to all requests in this collection. Use{' '}
                    {'{{variableName}}'} syntax to reference them.
                  </p>
                </div>
                <KeyValueEditor
                  pairs={collection.variables}
                  onChange={handleVariablesChange}
                  keyPlaceholder="Variable name"
                  valuePlaceholder="Variable value"
                />
              </div>
            )}

            {/* Authorization Tab */}
            {activeTab === 'authorization' && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Collection Authorization</h3>
                  <p className="text-sm text-gray-500">
                    Set default authorization for all requests in this collection. Individual
                    requests can override this setting.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Auth Type
                    </label>
                    <select
                      value={collection.authType}
                      onChange={(e) =>
                        setCollection((prev) => ({ ...prev, authType: e.target.value }))
                      }
                      className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue"
                    >
                      <option value="none">No Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                      <option value="apikey">API Key</option>
                      <option value="oauth2">OAuth 2.0</option>
                    </select>
                  </div>
                  {collection.authType === 'bearer' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Token</label>
                      <input
                        type="text"
                        value={collection.authConfig.token || ''}
                        onChange={(e) =>
                          setCollection((prev) => ({
                            ...prev,
                            authConfig: { ...prev.authConfig, token: e.target.value },
                          }))
                        }
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue font-mono text-sm"
                        placeholder="Enter token or use {{variable}}"
                      />
                    </div>
                  )}
                  {collection.authType === 'basic' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Username
                        </label>
                        <input
                          type="text"
                          value={collection.authConfig.username || ''}
                          onChange={(e) =>
                            setCollection((prev) => ({
                              ...prev,
                              authConfig: { ...prev.authConfig, username: e.target.value },
                            }))
                          }
                          className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Password
                        </label>
                        <input
                          type="password"
                          value={collection.authConfig.password || ''}
                          onChange={(e) =>
                            setCollection((prev) => ({
                              ...prev,
                              authConfig: { ...prev.authConfig, password: e.target.value },
                            }))
                          }
                          className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue"
                        />
                      </div>
                    </>
                  )}
                  {collection.authType === 'apikey' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Key
                        </label>
                        <input
                          type="text"
                          value={collection.authConfig.key || ''}
                          onChange={(e) =>
                            setCollection((prev) => ({
                              ...prev,
                              authConfig: { ...prev.authConfig, key: e.target.value },
                            }))
                          }
                          className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue"
                          placeholder="X-API-Key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Value
                        </label>
                        <input
                          type="text"
                          value={collection.authConfig.value || ''}
                          onChange={(e) =>
                            setCollection((prev) => ({
                              ...prev,
                              authConfig: { ...prev.authConfig, value: e.target.value },
                            }))
                          }
                          className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue font-mono text-sm"
                          placeholder="Enter API key or use {{variable}}"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Add to
                        </label>
                        <select
                          value={collection.authConfig.addTo || 'header'}
                          onChange={(e) =>
                            setCollection((prev) => ({
                              ...prev,
                              authConfig: { ...prev.authConfig, addTo: e.target.value },
                            }))
                          }
                          className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue"
                        >
                          <option value="header">Header</option>
                          <option value="query">Query Params</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Collection Settings</h3>
                  <p className="text-sm text-gray-500">
                    Configure default settings for all requests in this collection.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Base URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.example.com"
                      className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Prepended to all relative URLs in this collection
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Request Timeout (ms)
                    </label>
                    <input
                      type="number"
                      defaultValue={30000}
                      className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium">Follow Redirects</h4>
                      <p className="text-xs text-gray-500">
                        Automatically follow HTTP redirects
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium">SSL Certificate Verification</h4>
                      <p className="text-xs text-gray-500">
                        Verify SSL certificates for HTTPS requests
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Help Panel */}
      {showHelpPanel && (
        <aside className="w-80 bg-dark-surface border-l border-dark-border overflow-y-auto">
          <div className="p-6">
            <div className="flex items-start space-x-3 mb-6">
              <div className="w-10 h-10 bg-accent-blue/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-accent-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-200 mb-1">Collection Management</h3>
                <p className="text-sm text-gray-500">Help & Tips</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-300 mb-2 text-sm">Organizing Requests</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Use folders to group related requests together. You can drag and drop requests
                  between folders to reorganize your collection structure.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-300 mb-2 text-sm">Drag & Drop</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Click and hold the grip icon next to any folder or request to reorder them. This
                  helps maintain a logical structure for your API workflows.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-300 mb-2 text-sm">Collection Metadata</h4>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">
                  Add descriptions and tags to make your collections more discoverable and easier
                  to understand for team members.
                </p>
                <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <p className="text-xs text-gray-400 flex items-start space-x-2">
                    <Info className="w-3 h-3 text-accent-blue mt-0.5 flex-shrink-0" />
                    <span>Tags help filter and search collections across your workspace.</span>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-300 mb-2 text-sm">Import & Export</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Export your collections as JSON to share with team members or back up your work.
                  Import from Postman, OpenAPI, or cURL to quickly migrate existing APIs.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-300 mb-2 text-sm">Keyboard Shortcuts</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">New Request</span>
                    <kbd className="px-2 py-1 bg-dark-bg rounded text-xs font-mono border border-dark-border">
                      ⌘ N
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">New Folder</span>
                    <kbd className="px-2 py-1 bg-dark-bg rounded text-xs font-mono border border-dark-border">
                      ⌘ ⇧ N
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Save Collection</span>
                    <kbd className="px-2 py-1 bg-dark-bg rounded text-xs font-mono border border-dark-border">
                      ⌘ S
                    </kbd>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-accent-blue/10 to-accent-teal/10 rounded-lg p-4 border border-accent-blue/20">
                <h4 className="font-medium text-gray-200 mb-2 text-sm flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-accent-blue" />
                  Learn More
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Check out our documentation for advanced collection management features.
                </p>
                <button className="text-sm text-accent-blue hover:text-cyan-400 font-medium transition-colors flex items-center">
                  View Documentation
                  <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default CollectionPage;