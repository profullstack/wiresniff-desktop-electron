import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDatabase } from '../../providers/DatabaseProvider';
import type { Collection, Request as RequestType, Environment } from '../../types/electron';

interface SidebarProps {
  collapsed: boolean;
  width: number;
  onResize: (width: number) => void;
  onCollapse: () => void;
}

type SidebarTab = 'collections' | 'environments' | 'history';

/**
 * Sidebar Component
 * Navigation sidebar with collections tree, environments, and history
 */
function Sidebar({ collapsed, width, onResize, onCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const { collections, requests, environments, history, activeEnvironment, setActiveEnvironment } = useDatabase();
  const [activeTab, setActiveTab] = useState<SidebarTab>('collections');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [isResizing, setIsResizing] = useState(false);

  // Handle resize drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Toggle collection expansion
  const toggleCollection = (collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  // Get requests for a collection
  const getCollectionRequests = (collectionId: string): RequestType[] => {
    return requests.filter((r) => r.collectionId === collectionId);
  };

  // Get method badge class
  const getMethodClass = (method: string): string => {
    const methodLower = method.toLowerCase();
    return `method-${methodLower}`;
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r border-dark-border bg-dark-surface py-4">
        {/* Collapsed sidebar icons */}
        <button
          onClick={() => setActiveTab('collections')}
          className={`btn-ghost btn-icon mb-2 ${activeTab === 'collections' ? 'text-accent-blue' : ''}`}
          title="Collections"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        <button
          onClick={() => setActiveTab('environments')}
          className={`btn-ghost btn-icon mb-2 ${activeTab === 'environments' ? 'text-accent-blue' : ''}`}
          title="Environments"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`btn-ghost btn-icon ${activeTab === 'history' ? 'text-accent-blue' : ''}`}
          title="History"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col border-r border-dark-border bg-dark-surface"
      style={{ width: `${width}px` }}
    >
      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            activeTab === 'collections'
              ? 'border-b-2 border-accent-blue text-accent-blue'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveTab('environments')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            activeTab === 'environments'
              ? 'border-b-2 border-accent-blue text-accent-blue'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Environments
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            activeTab === 'history'
              ? 'border-b-2 border-accent-blue text-accent-blue'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {activeTab === 'collections' && (
          <div>
            {/* New collection button */}
            <button
              onClick={() => navigate('/collections/new')}
              className="mb-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-dark-border px-3 py-2 text-sm text-gray-400 hover:border-accent-blue hover:text-accent-blue"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Collection
            </button>

            {/* Collections tree */}
            {collections.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <p>No collections yet</p>
                <p className="mt-1 text-xs">Create a collection to organize your requests</p>
              </div>
            ) : (
              <div className="space-y-1">
                {collections.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    requests={getCollectionRequests(collection.id)}
                    expanded={expandedCollections.has(collection.id)}
                    onToggle={() => toggleCollection(collection.id)}
                    getMethodClass={getMethodClass}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'environments' && (
          <div>
            {/* New environment button */}
            <button
              onClick={() => navigate('/environments/new')}
              className="mb-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-dark-border px-3 py-2 text-sm text-gray-400 hover:border-accent-blue hover:text-accent-blue"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Environment
            </button>

            {/* Environments list */}
            {environments.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <p>No environments yet</p>
                <p className="mt-1 text-xs">Create environments to manage variables</p>
              </div>
            ) : (
              <div className="space-y-1">
                {environments.map((env) => (
                  <EnvironmentItem
                    key={env.id}
                    environment={env}
                    isActive={activeEnvironment?.id === env.id}
                    onActivate={() => setActiveEnvironment(env.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <p>No history yet</p>
                <p className="mt-1 text-xs">Your request history will appear here</p>
              </div>
            ) : (
              <div className="space-y-1">
                {history.map((entry) => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    getMethodClass={getMethodClass}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize ${
          isResizing ? 'bg-accent-blue' : 'bg-transparent hover:bg-accent-blue/50'
        }`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

// Collection item component
interface CollectionItemProps {
  collection: Collection;
  requests: RequestType[];
  expanded: boolean;
  onToggle: () => void;
  getMethodClass: (method: string) => string;
}

function CollectionItem({ collection, requests, expanded, onToggle, getMethodClass }: CollectionItemProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-300 hover:bg-dark-border"
      >
        <svg
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="h-4 w-4 text-accent-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="flex-1 truncate text-left">{collection.name}</span>
        <span className="text-xs text-gray-500">{requests.length}</span>
      </button>

      {expanded && requests.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {requests.map((request) => (
            <NavLink
              key={request.id}
              to={`/workspace/${request.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  isActive ? 'bg-dark-border text-white' : 'text-gray-400 hover:bg-dark-border hover:text-gray-200'
                }`
              }
            >
              <span className={`${getMethodClass(request.method)} text-[10px] px-1.5 py-0.5`}>
                {request.method}
              </span>
              <span className="flex-1 truncate">{request.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// Environment item component
interface EnvironmentItemProps {
  environment: Environment;
  isActive: boolean;
  onActivate: () => void;
}

function EnvironmentItem({ environment, isActive, onActivate }: EnvironmentItemProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${
        isActive ? 'bg-accent-teal/20 text-accent-teal' : 'text-gray-300 hover:bg-dark-border'
      }`}
      onClick={onActivate}
    >
      <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-accent-teal' : 'bg-gray-500'}`} />
      <span className="flex-1 truncate">{environment.name}</span>
      <span className="text-xs text-gray-500">{environment.variables.length} vars</span>
    </div>
  );
}

// History item component
interface HistoryItemProps {
  entry: {
    id: string;
    method: string;
    url: string;
    status: number;
    timestamp: string;
  };
  getMethodClass: (method: string) => string;
}

function HistoryItem({ entry, getMethodClass }: HistoryItemProps) {
  const navigate = useNavigate();
  const statusColor = entry.status >= 200 && entry.status < 300 ? 'text-success' : entry.status >= 400 ? 'text-error' : 'text-warning';

  return (
    <button
      onClick={() => navigate(`/workspace?history=${entry.id}`)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-300 hover:bg-dark-border"
    >
      <span className={`${getMethodClass(entry.method)} text-[10px] px-1.5 py-0.5`}>
        {entry.method}
      </span>
      <span className="flex-1 truncate text-left text-xs">{entry.url}</span>
      <span className={`text-xs ${statusColor}`}>{entry.status}</span>
    </button>
  );
}

export default Sidebar;