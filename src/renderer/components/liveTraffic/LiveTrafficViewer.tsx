/**
 * Live Traffic Viewer Component
 *
 * Real-time traffic monitoring interface with filtering and inspection.
 * Displays captured HTTP/WebSocket traffic in a scrollable list.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Filter,
  Trash2,
  Download,
  ChevronDown,
  ChevronRight,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Wifi,
  AlertCircle,
  Clock,
  Search,
} from 'lucide-react';

// Types matching the main process service
interface TrafficEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  sourceIp: string;
  destIp: string;
  sourcePort: number;
  destPort: number;
  method?: string;
  host?: string;
  path?: string;
  statusCode?: number;
  statusPhrase?: string;
  headers: Record<string, string>;
  contentType?: string;
  contentLength?: number;
  isWebSocket: boolean;
  isRequest: boolean;
  rawSize: number;
}

interface TrafficFilter {
  domains?: string[];
  methods?: string[];
  statusCodes?: number[];
  searchQuery?: string;
}

interface SessionStats {
  totalPackets: number;
  totalBytes: number;
  requestCount: number;
  responseCount: number;
  errorCount: number;
  byMethod: Record<string, number>;
  byStatusCode: Record<number, number>;
  byDomain: Record<string, number>;
}

interface LiveTrafficViewerProps {
  onExportSession?: (events: TrafficEvent[]) => void;
  maxEvents?: number;
}

export const LiveTrafficViewer: React.FC<LiveTrafficViewerProps> = ({
  onExportSession,
  maxEvents = 1000,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [events, setEvents] = useState<TrafficEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<TrafficEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TrafficEvent | null>(null);
  const [filter, setFilter] = useState<TrafficFilter>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Apply filters to events
  useEffect(() => {
    let filtered = [...events];

    // Domain filter
    if (filter.domains && filter.domains.length > 0) {
      filtered = filtered.filter(
        (e) => e.host && filter.domains!.includes(e.host)
      );
    }

    // Method filter
    if (filter.methods && filter.methods.length > 0) {
      filtered = filtered.filter(
        (e) => e.method && filter.methods!.includes(e.method)
      );
    }

    // Status code filter
    if (filter.statusCodes && filter.statusCodes.length > 0) {
      filtered = filtered.filter(
        (e) => e.statusCode && filter.statusCodes!.includes(e.statusCode)
      );
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.host?.toLowerCase().includes(query) ||
          e.path?.toLowerCase().includes(query) ||
          e.method?.toLowerCase().includes(query) ||
          e.statusCode?.toString().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events, filter, searchQuery]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredEvents, autoScroll]);

  // Simulated event listener (in real app, this would connect to IPC)
  const handleTrafficEvent = useCallback(
    (event: TrafficEvent) => {
      setEvents((prev) => {
        const newEvents = [...prev, event];
        // Limit events to prevent memory issues
        if (newEvents.length > maxEvents) {
          return newEvents.slice(-maxEvents);
        }
        return newEvents;
      });
    },
    [maxEvents]
  );

  const startCapture = async () => {
    try {
      // In real app: await window.electron.liveTraffic.startCapture()
      setIsCapturing(true);
      setIsPaused(false);
      setEvents([]);
      setStats({
        totalPackets: 0,
        totalBytes: 0,
        requestCount: 0,
        responseCount: 0,
        errorCount: 0,
        byMethod: {},
        byStatusCode: {},
        byDomain: {},
      });
    } catch (error) {
      console.error('Failed to start capture:', error);
    }
  };

  const stopCapture = async () => {
    try {
      // In real app: await window.electron.liveTraffic.stopCapture()
      setIsCapturing(false);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to stop capture:', error);
    }
  };

  const togglePause = async () => {
    try {
      if (isPaused) {
        // In real app: await window.electron.liveTraffic.resumeCapture()
        setIsPaused(false);
      } else {
        // In real app: await window.electron.liveTraffic.pauseCapture()
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
  };

  const clearEvents = () => {
    setEvents([]);
    setSelectedEvent(null);
  };

  const exportEvents = () => {
    if (onExportSession) {
      onExportSession(filteredEvents);
    }
  };

  const getMethodColor = (method?: string): string => {
    switch (method) {
      case 'GET':
        return 'text-green-400';
      case 'POST':
        return 'text-blue-400';
      case 'PUT':
        return 'text-yellow-400';
      case 'PATCH':
        return 'text-orange-400';
      case 'DELETE':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusColor = (status?: number): string => {
    if (!status) return 'text-gray-400';
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 300 && status < 400) return 'text-yellow-400';
    if (status >= 400 && status < 500) return 'text-orange-400';
    if (status >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          {!isCapturing ? (
            <button
              onClick={startCapture}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
            >
              <Play size={16} />
              Start Capture
            </button>
          ) : (
            <>
              <button
                onClick={togglePause}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isPaused
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopCapture}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
              >
                <Square size={16} />
                Stop
              </button>
            </>
          )}

          <div className="w-px h-6 bg-gray-600 mx-2" />

          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showFilterPanel
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            <Filter size={16} />
            Filters
          </button>

          <button
            onClick={clearEvents}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
          >
            <Trash2 size={16} />
            Clear
          </button>

          <button
            onClick={exportEvents}
            disabled={events.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Export
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search traffic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{filteredEvents.length} events</span>
          {stats && (
            <>
              <span>{formatBytes(stats.totalBytes)}</span>
              <span className="text-red-400">{stats.errorCount} errors</span>
            </>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="p-3 border-b border-gray-700 bg-gray-800/50">
          <TrafficFilterBar filter={filter} onFilterChange={setFilter} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Event List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const isAtBottom =
              target.scrollHeight - target.scrollTop - target.clientHeight < 50;
            if (!isAtBottom && autoScroll) {
              setAutoScroll(false);
            }
          }}
        >
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Globe size={48} className="mb-4 opacity-50" />
              <p className="text-lg">No traffic captured</p>
              <p className="text-sm mt-1">
                {isCapturing
                  ? 'Waiting for network activity...'
                  : 'Click "Start Capture" to begin monitoring'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800 text-gray-400 text-left">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 w-24">Time</th>
                  <th className="px-3 py-2 w-16">Method</th>
                  <th className="px-3 py-2 w-16">Status</th>
                  <th className="px-3 py-2">Host</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2 w-20 text-right">Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`cursor-pointer hover:bg-gray-800 border-b border-gray-800 ${
                      selectedEvent?.id === event.id ? 'bg-gray-800' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      {event.isWebSocket ? (
                        <Wifi size={14} className="text-purple-400" />
                      ) : event.isRequest ? (
                        <ArrowUpRight size={14} className="text-blue-400" />
                      ) : (
                        <ArrowDownLeft size={14} className="text-green-400" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                      {formatTime(event.timestamp)}
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${getMethodColor(event.method)}`}
                    >
                      {event.method || '-'}
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${getStatusColor(event.statusCode)}`}
                    >
                      {event.statusCode || '-'}
                    </td>
                    <td className="px-3 py-2 truncate max-w-xs">
                      {event.host || event.destIp}
                    </td>
                    <td className="px-3 py-2 truncate max-w-md text-gray-400">
                      {event.path || '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {formatBytes(event.rawSize)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedEvent && (
          <div className="w-96 border-l border-gray-700 overflow-y-auto bg-gray-800/50">
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-700 bg-gray-800 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span
            className={`flex items-center gap-1 ${isCapturing ? (isPaused ? 'text-yellow-400' : 'text-green-400') : 'text-gray-500'}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isCapturing ? (isPaused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse') : 'bg-gray-500'}`}
            />
            {isCapturing ? (isPaused ? 'Paused' : 'Capturing') : 'Stopped'}
          </span>
          <span>Interface: any</span>
          <span>Ports: 80, 443, 8080, 8443</span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            {stats?.requestCount || 0} requests / {stats?.responseCount || 0}{' '}
            responses
          </span>
        </div>
      </div>
    </div>
  );
};

// Traffic Filter Bar Component
interface TrafficFilterBarProps {
  filter: TrafficFilter;
  onFilterChange: (filter: TrafficFilter) => void;
}

const TrafficFilterBar: React.FC<TrafficFilterBarProps> = ({
  filter,
  onFilterChange,
}) => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  const statusGroups = [
    { label: '2xx Success', codes: [200, 201, 204] },
    { label: '3xx Redirect', codes: [301, 302, 304] },
    { label: '4xx Client Error', codes: [400, 401, 403, 404] },
    { label: '5xx Server Error', codes: [500, 502, 503] },
  ];

  const toggleMethod = (method: string) => {
    const currentMethods = filter.methods || [];
    const newMethods = currentMethods.includes(method)
      ? currentMethods.filter((m) => m !== method)
      : [...currentMethods, method];
    onFilterChange({ ...filter, methods: newMethods.length ? newMethods : undefined });
  };

  const toggleStatusGroup = (codes: number[]) => {
    const currentCodes = filter.statusCodes || [];
    const hasAll = codes.every((c) => currentCodes.includes(c));
    const newCodes = hasAll
      ? currentCodes.filter((c) => !codes.includes(c))
      : [...new Set([...currentCodes, ...codes])];
    onFilterChange({
      ...filter,
      statusCodes: newCodes.length ? newCodes : undefined,
    });
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Method Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Methods:</span>
        <div className="flex gap-1">
          {methods.map((method) => (
            <button
              key={method}
              onClick={() => toggleMethod(method)}
              className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                filter.methods?.includes(method)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Status:</span>
        <div className="flex gap-1">
          {statusGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => toggleStatusGroup(group.codes)}
              className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                group.codes.every((c) => filter.statusCodes?.includes(c))
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {(filter.methods?.length || filter.statusCodes?.length || filter.domains?.length) && (
        <button
          onClick={clearFilters}
          className="px-2 py-0.5 text-xs text-red-400 hover:text-red-300"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

// Event Detail Panel Component
interface EventDetailPanelProps {
  event: TrafficEvent;
  onClose: () => void;
}

const EventDetailPanel: React.FC<EventDetailPanelProps> = ({ event, onClose }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['general', 'headers'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const Section: React.FC<{
    id: string;
    title: string;
    children: React.ReactNode;
  }> = ({ id, title, children }) => (
    <div className="border-b border-gray-700">
      <button
        onClick={() => toggleSection(id)}
        className="flex items-center justify-between w-full px-4 py-2 text-left hover:bg-gray-700/50"
      >
        <span className="font-medium text-sm">{title}</span>
        {expandedSections.has(id) ? (
          <ChevronDown size={16} />
        ) : (
          <ChevronRight size={16} />
        )}
      </button>
      {expandedSections.has(id) && (
        <div className="px-4 pb-3 text-sm">{children}</div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {event.isWebSocket ? (
            <Wifi size={16} className="text-purple-400" />
          ) : event.isRequest ? (
            <ArrowUpRight size={16} className="text-blue-400" />
          ) : (
            <ArrowDownLeft size={16} className="text-green-400" />
          )}
          <span className="font-medium">
            {event.isRequest ? 'Request' : 'Response'} Details
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Section id="general" title="General">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">URL</span>
              <span className="text-right truncate max-w-[200px]">
                {event.host}
                {event.path}
              </span>
            </div>
            {event.method && (
              <div className="flex justify-between">
                <span className="text-gray-400">Method</span>
                <span className={getMethodColor(event.method)}>{event.method}</span>
              </div>
            )}
            {event.statusCode && (
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={getStatusColor(event.statusCode)}>
                  {event.statusCode} {event.statusPhrase}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Time</span>
              <span>{new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Size</span>
              <span>{formatBytes(event.rawSize)}</span>
            </div>
          </div>
        </Section>

        <Section id="network" title="Network">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Source</span>
              <span className="font-mono text-xs">
                {event.sourceIp}:{event.sourcePort}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Destination</span>
              <span className="font-mono text-xs">
                {event.destIp}:{event.destPort}
              </span>
            </div>
          </div>
        </Section>

        <Section id="headers" title="Headers">
          {Object.keys(event.headers).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(event.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-gray-400 shrink-0">{key}:</span>
                  <span className="break-all">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">No headers captured</span>
          )}
        </Section>

        {event.isWebSocket && (
          <Section id="websocket" title="WebSocket">
            <div className="text-gray-400">
              WebSocket connection detected
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

// Helper functions used in EventDetailPanel
const getMethodColor = (method?: string): string => {
  switch (method) {
    case 'GET':
      return 'text-green-400';
    case 'POST':
      return 'text-blue-400';
    case 'PUT':
      return 'text-yellow-400';
    case 'PATCH':
      return 'text-orange-400';
    case 'DELETE':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getStatusColor = (status?: number): string => {
  if (!status) return 'text-gray-400';
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-400';
  if (status >= 400 && status < 500) return 'text-orange-400';
  if (status >= 500) return 'text-red-400';
  return 'text-gray-400';
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default LiveTrafficViewer;