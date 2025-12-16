/**
 * WorkspaceSelector Component
 *
 * Dropdown component for selecting and switching between workspaces,
 * with options to create new workspaces and manage existing ones.
 */

import React, { useState, useEffect, useRef } from 'react';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberCount?: number;
  role?: 'admin' | 'editor' | 'viewer';
}

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  currentWorkspace?: Workspace | null;
  onSelect: (workspace: Workspace) => void;
  onCreate?: () => void;
  onManage?: (workspace: Workspace) => void;
  isLoading?: boolean;
  className?: string;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  currentWorkspace,
  onSelect,
  onCreate,
  onManage,
  isLoading = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter workspaces by search query
  const filteredWorkspaces = workspaces.filter(
    (ws) =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get role badge color
  const getRoleBadgeColor = (role?: string): string => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-400';
      case 'editor':
        return 'bg-blue-500/20 text-blue-400';
      case 'viewer':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Handle workspace selection
  const handleSelect = (workspace: Workspace) => {
    onSelect(workspace);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg hover:bg-dark-surface/80 transition-colors min-w-[200px]"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-400">Loading...</span>
          </div>
        ) : currentWorkspace ? (
          <>
            <div className="w-8 h-8 rounded-md bg-accent-primary/20 flex items-center justify-center">
              <span className="text-accent-primary font-semibold text-sm">
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium text-sm truncate max-w-[120px]">
                {currentWorkspace.name}
              </div>
              {currentWorkspace.role && (
                <div className="text-xs text-gray-500 capitalize">{currentWorkspace.role}</div>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-md bg-dark-border flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <span className="text-gray-400 text-sm">Select Workspace</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50">
          {/* Search input */}
          <div className="p-2 border-b border-dark-border">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspaces..."
                className="w-full pl-9 pr-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Workspace list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No workspaces found' : 'No workspaces yet'}
              </div>
            ) : (
              filteredWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-dark-bg cursor-pointer ${
                    currentWorkspace?.id === workspace.id ? 'bg-dark-bg' : ''
                  }`}
                  onClick={() => handleSelect(workspace)}
                >
                  <div className="w-10 h-10 rounded-md bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent-primary font-semibold">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm truncate">
                        {workspace.name}
                      </span>
                      {workspace.role && (
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded ${getRoleBadgeColor(workspace.role)}`}
                        >
                          {workspace.role}
                        </span>
                      )}
                    </div>
                    {workspace.description && (
                      <div className="text-xs text-gray-500 truncate">{workspace.description}</div>
                    )}
                    {workspace.memberCount !== undefined && (
                      <div className="text-xs text-gray-600">
                        {workspace.memberCount} member{workspace.memberCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <svg className="w-4 h-4 text-accent-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {onManage && workspace.role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onManage(workspace);
                        setIsOpen(false);
                      }}
                      className="p-1 text-gray-500 hover:text-white transition-colors"
                      title="Manage workspace"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Create workspace button */}
          {onCreate && (
            <div className="p-2 border-t border-dark-border">
              <button
                onClick={() => {
                  onCreate();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-accent-primary hover:bg-accent-primary/10 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">Create New Workspace</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelector;