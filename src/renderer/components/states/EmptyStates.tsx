/**
 * Empty States Components
 *
 * Reusable empty state components for various scenarios:
 * - Empty collections
 * - No response yet
 * - Empty history
 */

import React from 'react';
import { FolderOpen, Send, History, Plus, FileInput, Play, Lightbulb } from 'lucide-react';

// Props interfaces
interface EmptyCollectionStateProps {
  onCreateCollection?: () => void;
  onImportCollection?: () => void;
}

interface NoResponseStateProps {
  onSendRequest?: () => void;
}

interface EmptyHistoryStateProps {
  showTip?: boolean;
}

interface GenericEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}

/**
 * Generic Empty State Component
 */
export const GenericEmptyState: React.FC<GenericEmptyStateProps> = ({
  icon,
  title,
  description,
  children,
}) => {
  return (
    <div className="bg-dark-surface rounded-xl border border-dark-border p-12 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-dark-bg rounded-2xl mb-6">
        {icon}
      </div>
      <h2 className="text-2xl font-bold mb-3 text-gray-200">{title}</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
      {children}
    </div>
  );
};

/**
 * Empty Collection State
 * Shown when user has no collections
 */
export const EmptyCollectionState: React.FC<EmptyCollectionStateProps> = ({
  onCreateCollection,
  onImportCollection,
}) => {
  return (
    <GenericEmptyState
      icon={<FolderOpen className="w-8 h-8 text-gray-600" />}
      title="No Collections Yet"
      description="Start organizing your API requests by creating your first collection. Collections help you group related requests together."
    >
      <div className="flex items-center justify-center space-x-3">
        <button
          onClick={onCreateCollection}
          className="bg-accent-blue hover:bg-cyan-400 text-dark-bg font-semibold px-6 py-3 rounded-lg transition-all flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Collection
        </button>
        <button
          onClick={onImportCollection}
          className="bg-dark-bg hover:bg-dark-border text-gray-200 font-medium px-6 py-3 rounded-lg border border-dark-border transition-all flex items-center"
        >
          <FileInput className="w-4 h-4 mr-2" />
          Import Collection
        </button>
      </div>
    </GenericEmptyState>
  );
};

/**
 * No Response State
 * Shown when no request has been sent yet
 */
export const NoResponseState: React.FC<NoResponseStateProps> = ({ onSendRequest }) => {
  return (
    <GenericEmptyState
      icon={<Send className="w-8 h-8 text-gray-600" />}
      title="No Response Yet"
      description="Send a request to see the response here. Configure your request parameters, headers, and body, then hit Send."
    >
      <button
        onClick={onSendRequest}
        className="bg-accent-blue hover:bg-cyan-400 text-dark-bg font-semibold px-6 py-3 rounded-lg transition-all flex items-center mx-auto"
      >
        <Play className="w-4 h-4 mr-2" />
        Send Request
      </button>
    </GenericEmptyState>
  );
};

/**
 * Empty History State
 * Shown when request history is empty
 */
export const EmptyHistoryState: React.FC<EmptyHistoryStateProps> = ({ showTip = true }) => {
  return (
    <GenericEmptyState
      icon={<History className="w-8 h-8 text-gray-600" />}
      title="No Request History"
      description="Your request history is empty. Send some requests to see them appear here for quick access."
    >
      {showTip && (
        <p className="text-sm text-gray-500 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-yellow-500 mr-2" />
          Tip: Recent requests are automatically saved for easy replay
        </p>
      )}
    </GenericEmptyState>
  );
};

/**
 * Empty Environment State
 * Shown when no environments exist
 */
export const EmptyEnvironmentState: React.FC<{ onCreateEnvironment?: () => void }> = ({
  onCreateEnvironment,
}) => {
  return (
    <GenericEmptyState
      icon={<FolderOpen className="w-8 h-8 text-gray-600" />}
      title="No Environments"
      description="Create environments to manage different configurations for your API requests, like development, staging, and production."
    >
      <button
        onClick={onCreateEnvironment}
        className="bg-accent-blue hover:bg-cyan-400 text-dark-bg font-semibold px-6 py-3 rounded-lg transition-all flex items-center mx-auto"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create Environment
      </button>
    </GenericEmptyState>
  );
};

/**
 * Empty Search Results State
 * Shown when search returns no results
 */
export const EmptySearchResultsState: React.FC<{ searchQuery: string; onClearSearch?: () => void }> = ({
  searchQuery,
  onClearSearch,
}) => {
  return (
    <GenericEmptyState
      icon={
        <svg
          className="w-8 h-8 text-gray-600"
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
      }
      title="No Results Found"
      description={`No items match "${searchQuery}". Try adjusting your search terms or filters.`}
    >
      {onClearSearch && (
        <button
          onClick={onClearSearch}
          className="text-accent-blue hover:text-cyan-400 font-medium transition-colors"
        >
          Clear Search
        </button>
      )}
    </GenericEmptyState>
  );
};

export default {
  GenericEmptyState,
  EmptyCollectionState,
  NoResponseState,
  EmptyHistoryState,
  EmptyEnvironmentState,
  EmptySearchResultsState,
};