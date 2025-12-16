/**
 * WorkspacePage Component
 * Main request builder and response viewer workspace with tab management
 */

import React from 'react';
import { TabBar, RequestBuilder, ResponseViewer } from '../components/workspace';
import { useTabStore, type Tab } from '../stores';

// Empty state when no tabs are open
const EmptyState: React.FC<{ onCreateTab: () => void }> = ({ onCreateTab }) => (
  <div className="flex-1 flex items-center justify-center bg-background">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-surface flex items-center justify-center">
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">No Request Open</h2>
      <p className="text-text-secondary mb-6">
        Create a new request or select one from your collections to get started.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onCreateTab}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors inline-flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New HTTP Request
        </button>
        <button
          onClick={() => {}}
          className="px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors inline-flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import Collection
        </button>
      </div>
    </div>
  </div>
);

// HTTP Tab content with request builder and response viewer
const HttpTabContent: React.FC<{ tab: Tab }> = ({ tab }) => {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Request panel */}
      <div className="w-1/2 flex flex-col border-r border-border overflow-hidden">
        <RequestBuilder tab={tab} />
      </div>

      {/* Response panel */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <ResponseViewer 
          response={tab.response} 
          error={tab.error} 
          isLoading={tab.isLoading} 
        />
      </div>
    </div>
  );
};

// WebSocket tab content placeholder
const WebSocketTabContent: React.FC<{ tab: Tab }> = ({ tab }) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-surface flex items-center justify-center">
          <span className="text-3xl">🔌</span>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">WebSocket Connection</h3>
        <p className="text-text-secondary mb-6">
          Connect to WebSocket servers and send/receive real-time messages.
        </p>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="wss://example.com/socket"
            className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
          />
          <button className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
            Connect
          </button>
        </div>
        <p className="text-xs text-text-muted mt-4">
          Full WebSocket support coming soon...
        </p>
      </div>
    </div>
  );
};

// GraphQL tab content placeholder
const GraphQLTabContent: React.FC<{ tab: Tab }> = ({ tab }) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-surface flex items-center justify-center">
          <span className="text-3xl">◈</span>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">GraphQL Request</h3>
        <p className="text-text-secondary mb-6">
          Build and execute GraphQL queries, mutations, and subscriptions.
        </p>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="https://api.example.com/graphql"
            className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
          />
          <textarea
            placeholder="query {&#10;  users {&#10;    id&#10;    name&#10;  }&#10;}"
            rows={6}
            className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted font-mono text-sm focus:outline-none focus:border-primary resize-none"
          />
          <button className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
            Execute Query
          </button>
        </div>
        <p className="text-xs text-text-muted mt-4">
          Full GraphQL support with schema explorer coming soon...
        </p>
      </div>
    </div>
  );
};

// SSE tab content placeholder
const SSETabContent: React.FC<{ tab: Tab }> = ({ tab }) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-surface flex items-center justify-center">
          <span className="text-3xl">📡</span>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">Server-Sent Events</h3>
        <p className="text-text-secondary mb-6">
          Connect to SSE endpoints and receive real-time event streams.
        </p>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="https://api.example.com/events"
            className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
          />
          <button className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
            Connect
          </button>
        </div>
        <p className="text-xs text-text-muted mt-4">
          Full SSE support with event filtering coming soon...
        </p>
      </div>
    </div>
  );
};

// Tab content router
const TabContent: React.FC<{ tab: Tab }> = ({ tab }) => {
  switch (tab.type) {
    case 'http':
      return <HttpTabContent tab={tab} />;
    case 'websocket':
      return <WebSocketTabContent tab={tab} />;
    case 'graphql':
      return <GraphQLTabContent tab={tab} />;
    case 'sse':
      return <SSETabContent tab={tab} />;
    default:
      return null;
  }
};

function WorkspacePage() {
  const { createTab, getActiveTab } = useTabStore();
  const activeTab = getActiveTab();

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <TabBar />

      {/* Tab content */}
      {activeTab ? (
        <TabContent tab={activeTab} />
      ) : (
        <EmptyState onCreateTab={() => createTab('http')} />
      )}
    </div>
  );
}

export default WorkspacePage;