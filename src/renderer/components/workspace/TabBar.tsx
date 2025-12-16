/**
 * TabBar Component
 * 
 * Displays and manages the request tabs in the workspace.
 * Supports drag-and-drop reordering, context menus, and tab actions.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useTabStore, type Tab, type TabType, type HttpMethod } from '../../stores';

// HTTP method colors
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-success',
  POST: 'text-warning',
  PUT: 'text-info',
  PATCH: 'text-purple-400',
  DELETE: 'text-error',
  HEAD: 'text-text-muted',
  OPTIONS: 'text-text-muted',
};

// Tab type icons
const TAB_TYPE_ICONS: Record<TabType, string> = {
  http: '🌐',
  websocket: '🔌',
  graphql: '◈',
  sse: '📡',
  grpc: '⚡',
};

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  index: number;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  isActive,
  index,
  onSelect,
  onClose,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const method = tab.httpRequest?.method;
  const methodColor = method ? METHOD_COLORS[method] : 'text-text-muted';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`
        group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px]
        border-r border-border cursor-pointer select-none
        transition-colors duration-150
        ${isActive 
          ? 'bg-surface border-b-2 border-b-primary' 
          : 'bg-background hover:bg-surface/50'
        }
      `}
    >
      {/* Pin indicator */}
      {tab.isPinned && (
        <span className="text-xs text-primary" title="Pinned">📌</span>
      )}

      {/* Tab type icon or HTTP method */}
      {tab.type === 'http' && method ? (
        <span className={`text-xs font-bold ${methodColor}`}>
          {method}
        </span>
      ) : (
        <span className="text-sm">{TAB_TYPE_ICONS[tab.type]}</span>
      )}

      {/* Tab name */}
      <span className="flex-1 truncate text-sm text-text-primary">
        {tab.name}
      </span>

      {/* Dirty indicator */}
      {tab.isDirty && (
        <span className="w-2 h-2 rounded-full bg-warning" title="Unsaved changes" />
      )}

      {/* Loading indicator */}
      {tab.isLoading && (
        <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      )}

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={`
          w-4 h-4 flex items-center justify-center rounded
          text-text-muted hover:text-text-primary hover:bg-surface-hover
          transition-colors
          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
        title="Close tab"
      >
        ×
      </button>
    </div>
  );
};

interface ContextMenuProps {
  x: number;
  y: number;
  tab: Tab;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, tab, onClose }) => {
  const { 
    closeTab, 
    closeOtherTabs, 
    closeTabsToRight, 
    closeTabsToLeft, 
    closeAllTabs,
    duplicateTab,
    pinTab,
    unpinTab,
  } = useTabStore();

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuItems = [
    { label: 'Close', action: () => closeTab(tab.id) },
    { label: 'Close Others', action: () => closeOtherTabs(tab.id) },
    { label: 'Close to the Right', action: () => closeTabsToRight(tab.id) },
    { label: 'Close to the Left', action: () => closeTabsToLeft(tab.id) },
    { label: 'Close All', action: () => closeAllTabs() },
    { type: 'separator' as const },
    { label: 'Duplicate', action: () => duplicateTab(tab.id) },
    { type: 'separator' as const },
    tab.isPinned
      ? { label: 'Unpin', action: () => unpinTab(tab.id) }
      : { label: 'Pin', action: () => pinTab(tab.id) },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="border-t border-border my-1" />;
        }
        return (
          <button
            key={index}
            onClick={() => {
              item.action?.();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover transition-colors"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, createTab, reorderTabs } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderTabs(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  }, [draggedIndex, reorderTabs]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  const handleNewTab = useCallback((type: TabType = 'http') => {
    createTab(type);
  }, [createTab]);

  // Scroll tabs into view when active tab changes
  React.useEffect(() => {
    if (activeTabId && tabBarRef.current) {
      const activeTabElement = tabBarRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  return (
    <div className="flex items-center bg-background border-b border-border">
      {/* Tab list */}
      <div 
        ref={tabBarRef}
        className="flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {tabs.map((tab, index) => (
          <div key={tab.id} data-tab-id={tab.id}>
            <TabItem
              tab={tab}
              isActive={tab.id === activeTabId}
              index={index}
              onSelect={() => setActiveTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        ))}

        {/* Empty state */}
        {tabs.length === 0 && (
          <div className="px-4 py-2 text-text-muted text-sm">
            No open tabs
          </div>
        )}
      </div>

      {/* New tab button */}
      <div className="flex items-center border-l border-border">
        <button
          onClick={() => handleNewTab('http')}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
          title="New HTTP Request"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Dropdown for other request types */}
        <div className="relative group">
          <button
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            title="New Request Type"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[150px] hidden group-hover:block z-50">
            <button
              onClick={() => handleNewTab('http')}
              className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover flex items-center gap-2"
            >
              <span>🌐</span> HTTP Request
            </button>
            <button
              onClick={() => handleNewTab('websocket')}
              className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover flex items-center gap-2"
            >
              <span>🔌</span> WebSocket
            </button>
            <button
              onClick={() => handleNewTab('graphql')}
              className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover flex items-center gap-2"
            >
              <span>◈</span> GraphQL
            </button>
            <button
              onClick={() => handleNewTab('sse')}
              className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover flex items-center gap-2"
            >
              <span>📡</span> Server-Sent Events
            </button>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tab={contextMenu.tab}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default TabBar;