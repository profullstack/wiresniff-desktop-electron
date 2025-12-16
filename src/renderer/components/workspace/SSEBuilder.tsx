/**
 * SSE Builder Component
 * 
 * UI for managing Server-Sent Events connections, viewing event streams,
 * and filtering events.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plug,
  Unplug,
  Trash2,
  Copy,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  ArrowDown,
  Filter,
  Search,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Radio,
  Pause,
  Play,
} from 'lucide-react';
import {
  connect,
  disconnect,
  subscribeToEventType,
  onStateChange,
  onEvent,
  onReconnecting,
  removeAllListeners,
  parseSSEData,
  formatSSEEvent,
  SSEConnectionState,
  SSEEvent,
} from '../../services/sse';

// Types
interface SSEBuilderProps {
  connectionId: string;
  initialUrl?: string;
  onConnectionChange?: (state: SSEConnectionState) => void;
}

interface FormattedEvent extends SSEEvent {
  parsedData?: unknown;
  isExpanded?: boolean;
}

// Status color mapping
const statusColors: Record<string, string> = {
  connecting: 'text-yellow-400',
  connected: 'text-green-400',
  disconnected: 'text-gray-400',
  error: 'text-red-400',
};

const statusBgColors: Record<string, string> = {
  connecting: 'bg-yellow-500/20',
  connected: 'bg-green-500/20',
  disconnected: 'bg-gray-500/20',
  error: 'bg-red-500/20',
};

export const SSEBuilder: React.FC<SSEBuilderProps> = ({
  connectionId,
  initialUrl = '',
  onConnectionChange,
}) => {
  // State
  const [url, setUrl] = useState(initialUrl);
  const [connectionState, setConnectionState] = useState<SSEConnectionState | null>(null);
  const [events, setEvents] = useState<FormattedEvent[]>([]);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterEventType, setFilterEventType] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [customEventTypes, setCustomEventTypes] = useState<string[]>([]);
  const [newEventType, setNewEventType] = useState('');

  // Refs
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const pausedEventsRef = useRef<FormattedEvent[]>([]);

  // Auto-scroll to bottom when new events arrive
  const scrollToBottom = useCallback(() => {
    if (!isPaused) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isPaused]);

  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  // Set up event listeners
  useEffect(() => {
    const unsubscribeState = onStateChange(connectionId, (state) => {
      setConnectionState(state);
      setIsConnecting(state.status === 'connecting');
      if (state.status === 'error') {
        setError(state.error || 'Connection error');
      } else {
        setError(null);
      }
      onConnectionChange?.(state);
    });

    const unsubscribeEvent = onEvent(connectionId, (event) => {
      const formattedEvent: FormattedEvent = {
        ...event,
        parsedData: parseSSEData(event.data),
        isExpanded: false,
      };

      if (isPaused) {
        pausedEventsRef.current.push(formattedEvent);
      } else {
        setEvents((prev) => [...prev, formattedEvent]);
      }
    });

    const unsubscribeReconnecting = onReconnecting(connectionId, (data) => {
      setReconnectAttempt(data.attempt);
    });

    return () => {
      unsubscribeState();
      unsubscribeEvent();
      unsubscribeReconnecting();
    };
  }, [connectionId, isPaused, onConnectionChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeAllListeners(connectionId);
    };
  }, [connectionId]);

  // Handle connect
  const handleConnect = () => {
    if (!url.trim()) {
      setError('Please enter an SSE endpoint URL');
      return;
    }

    setIsConnecting(true);
    setError(null);

    const result = connect({
      connectionId,
      url: url.trim(),
      autoReconnect,
    });

    if (!result.success) {
      setError(result.error || 'Connection failed');
      setIsConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    disconnect(connectionId);
    setReconnectAttempt(null);
  };

  // Handle pause/resume
  const handleTogglePause = () => {
    if (isPaused) {
      // Resume - add paused events
      setEvents((prev) => [...prev, ...pausedEventsRef.current]);
      pausedEventsRef.current = [];
    }
    setIsPaused(!isPaused);
  };

  // Add custom event type subscription
  const handleAddEventType = () => {
    if (!newEventType.trim() || customEventTypes.includes(newEventType.trim())) {
      return;
    }

    const eventType = newEventType.trim();
    setCustomEventTypes((prev) => [...prev, eventType]);
    setNewEventType('');

    // Subscribe to the event type if connected
    if (connectionState?.status === 'connected') {
      subscribeToEventType(connectionId, eventType);
    }
  };

  // Remove custom event type
  const handleRemoveEventType = (eventType: string) => {
    setCustomEventTypes((prev) => prev.filter((t) => t !== eventType));
  };

  // Clear events
  const clearEvents = () => {
    setEvents([]);
    pausedEventsRef.current = [];
  };

  // Copy event to clipboard
  const copyEvent = (event: FormattedEvent) => {
    const text = formatSSEEvent(event);
    navigator.clipboard.writeText(text);
  };

  // Toggle event expansion
  const toggleEventExpansion = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, isExpanded: !e.isExpanded } : e
      )
    );
  };

  // Get unique event types from events
  const eventTypes = Array.from(new Set(events.map((e) => e.eventType)));

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (filterEventType !== 'all' && e.eventType !== filterEventType) {
      return false;
    }
    if (filterText) {
      const text = e.data.toLowerCase();
      return text.includes(filterText.toLowerCase());
    }
    return true;
  });

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Download events as JSON
  const downloadEvents = () => {
    const data = JSON.stringify(events, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sse-events-${connectionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isConnected = connectionState?.status === 'connected';
  const isDisconnected = !connectionState || connectionState.status === 'disconnected';

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      {/* Connection Bar */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center space-x-2">
          {/* URL Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/events"
              disabled={isConnected || isConnecting}
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue disabled:opacity-50"
            />
            {connectionState && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2 ${statusColors[connectionState.status]}`}
              >
                {connectionState.status === 'connecting' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {connectionState.status === 'connected' && (
                  <Radio className="w-4 h-4 animate-pulse" />
                )}
                {connectionState.status === 'error' && (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="text-xs capitalize">{connectionState.status}</span>
              </div>
            )}
          </div>

          {/* Connect/Disconnect Button */}
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Unplug className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plug className="w-4 h-4" />
              )}
              <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-surface'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reconnecting Message */}
        {reconnectAttempt !== null && (
          <div className="mt-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Reconnecting... Attempt {reconnectAttempt}</span>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-dark-surface rounded-lg border border-dark-border">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Connection Settings</h3>

            {/* Auto Reconnect */}
            <label className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
                disabled={isConnected}
                className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-gray-300">Auto-reconnect on disconnect</span>
            </label>

            {/* Custom Event Types */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">
                Custom Event Types
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Subscribe to specific event types (in addition to default &quot;message&quot;)
              </p>

              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  placeholder="Event type name"
                  className="flex-1 px-3 py-1.5 bg-dark-bg border border-dark-border rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddEventType();
                    }
                  }}
                />
                <button
                  onClick={handleAddEventType}
                  className="px-3 py-1.5 bg-accent-blue/20 text-accent-blue rounded text-sm hover:bg-accent-blue/30"
                >
                  Add
                </button>
              </div>

              {customEventTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customEventTypes.map((type) => (
                    <span
                      key={type}
                      className="px-2 py-1 bg-dark-bg rounded text-xs text-gray-300 flex items-center space-x-1"
                    >
                      <span>{type}</span>
                      <button
                        onClick={() => handleRemoveEventType(type)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connection Stats */}
      {connectionState && connectionState.status === 'connected' && (
        <div className="px-4 py-2 bg-dark-surface border-b border-dark-border flex items-center space-x-6 text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>
              Connected{' '}
              {connectionState.connectedAt
                ? new Date(connectionState.connectedAt).toLocaleTimeString()
                : ''}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <ArrowDown className="w-3 h-3 text-blue-400" />
            <span>{connectionState.eventCount} events</span>
          </div>
          {connectionState.lastEventId && (
            <div className="flex items-center space-x-1">
              <span>Last ID: {connectionState.lastEventId}</span>
            </div>
          )}
        </div>
      )}

      {/* Events Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Event Toolbar */}
        <div className="px-4 py-2 border-b border-dark-border flex items-center space-x-2">
          {/* Filter Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter events..."
              className="w-full pl-9 pr-4 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Filter Event Type */}
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-gray-200 focus:outline-none focus:border-accent-blue"
          >
            <option value="all">All Types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Pause/Resume Button */}
          <button
            onClick={handleTogglePause}
            className={`p-1.5 rounded ${
              isPaused
                ? 'text-yellow-400 bg-yellow-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Actions */}
          <button
            onClick={downloadEvents}
            disabled={events.length === 0}
            className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-50"
            title="Download events"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearEvents}
            disabled={events.length === 0}
            className="p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-50"
            title="Clear events"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Paused Indicator */}
        {isPaused && pausedEventsRef.current.length > 0 && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs flex items-center justify-between">
            <span>{pausedEventsRef.current.length} events buffered while paused</span>
            <button
              onClick={handleTogglePause}
              className="text-yellow-400 hover:text-yellow-300"
            >
              Resume to see them
            </button>
          </div>
        )}

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {events.length === 0 ? (
                <>
                  <Radio className="w-12 h-12 mb-4 opacity-50" />
                  <p>No events yet</p>
                  <p className="text-sm">
                    {isConnected
                      ? 'Waiting for events from the server...'
                      : 'Connect to start receiving events'}
                  </p>
                </>
              ) : (
                <>
                  <Filter className="w-12 h-12 mb-4 opacity-50" />
                  <p>No events match your filter</p>
                </>
              )}
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border bg-blue-500/10 border-blue-500/20"
              >
                {/* Event Header */}
                <div
                  className="px-3 py-2 flex items-center space-x-2 cursor-pointer"
                  onClick={() => toggleEventExpansion(event.id)}
                >
                  {event.isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                    {event.eventType}
                  </span>
                  {event.eventId && (
                    <span className="text-xs text-gray-500">id: {event.eventId}</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {event.data.length} chars
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyEvent(event);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-200"
                    title="Copy event"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {/* Event Content */}
                {event.isExpanded && (
                  <div className="px-3 pb-3">
                    <pre className="p-2 bg-dark-bg rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {typeof event.parsedData === 'object'
                        ? JSON.stringify(event.parsedData, null, 2)
                        : event.data}
                    </pre>
                  </div>
                )}

                {/* Collapsed Preview */}
                {!event.isExpanded && (
                  <div className="px-3 pb-2">
                    <p className="text-xs text-gray-400 truncate">
                      {event.data.substring(0, 100)}
                      {event.data.length > 100 && '...'}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default SSEBuilder;