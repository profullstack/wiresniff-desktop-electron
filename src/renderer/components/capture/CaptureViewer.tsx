/**
 * CaptureViewer Component
 *
 * Displays captured HTTP traffic from tshark/mitmproxy with filtering,
 * sorting, and the ability to convert captures to replayable requests.
 */

import React, { useState, useMemo, useCallback } from 'react';

// Types for captured requests
export interface CapturedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  host: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: string;
    timing: {
      total: number;
      ttfb?: number;
    };
  };
  protocol: 'http' | 'https' | 'ws' | 'wss';
  source: 'tshark' | 'mitmproxy';
}

export interface CaptureSession {
  id: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'stopped' | 'paused';
  requestCount: number;
  source: 'tshark' | 'mitmproxy';
  filters?: {
    hosts?: string[];
    methods?: string[];
    statusCodes?: number[];
  };
}

interface CaptureViewerProps {
  session?: CaptureSession;
  requests: CapturedRequest[];
  isCapturing: boolean;
  onStartCapture: () => void;
  onStopCapture: () => void;
  onPauseCapture: () => void;
  onClearCaptures: () => void;
  onSelectRequest: (request: CapturedRequest) => void;
  onConvertToReplayable: (request: CapturedRequest) => void;
  onExportCaptures: (format: 'har' | 'json' | 'curl') => void;
  selectedRequestId?: string;
}

// Method color mapping
const methodColors: Record<string, string> = {
  GET: 'text-green-400 bg-green-400/10',
  POST: 'text-blue-400 bg-blue-400/10',
  PUT: 'text-yellow-400 bg-yellow-400/10',
  PATCH: 'text-orange-400 bg-orange-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
  HEAD: 'text-purple-400 bg-purple-400/10',
  OPTIONS: 'text-gray-400 bg-gray-400/10',
};

// Status color mapping
const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-400';
  if (status >= 400 && status < 500) return 'text-orange-400';
  if (status >= 500) return 'text-red-400';
  return 'text-gray-400';
};

export const CaptureViewer: React.FC<CaptureViewerProps> = ({
  session,
  requests,
  isCapturing,
  onStartCapture,
  onStopCapture,
  onPauseCapture,
  onClearCaptures,
  onSelectRequest,
  onConvertToReplayable,
  onExportCaptures,
  selectedRequestId,
}) => {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'method' | 'status' | 'duration'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.url.toLowerCase().includes(query) ||
          req.host.toLowerCase().includes(query) ||
          req.path.toLowerCase().includes(query)
      );
    }

    // Method filter
    if (methodFilter.length > 0) {
      filtered = filtered.filter((req) => methodFilter.includes(req.method));
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((req) => {
        if (!req.response) return statusFilter === 'pending';
        const status = req.response.status;
        switch (statusFilter) {
          case '2xx':
            return status >= 200 && status < 300;
          case '3xx':
            return status >= 300 && status < 400;
          case '4xx':
            return status >= 400 && status < 500;
          case '5xx':
            return status >= 500;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'time':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'method':
          comparison = a.method.localeCompare(b.method);
          break;
        case 'status':
          comparison = (a.response?.status ?? 0) - (b.response?.status ?? 0);
          break;
        case 'duration':
          comparison = (a.response?.timing.total ?? 0) - (b.response?.timing.total ?? 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [requests, searchQuery, methodFilter, statusFilter, sortBy, sortOrder]);

  // Toggle method filter
  const toggleMethodFilter = useCallback((method: string) => {
    setMethodFilter((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }, []);

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Traffic Capture</h2>
          {session && (
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  session.status === 'active'
                    ? 'bg-green-500 animate-pulse'
                    : session.status === 'paused'
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                }`}
              />
              <span className="text-sm text-gray-400">{session.name}</span>
              <span className="text-sm text-gray-500">({session.requestCount} requests)</span>
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          {!isCapturing ? (
            <button
              onClick={onStartCapture}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              Start Capture
            </button>
          ) : (
            <>
              <button
                onClick={onPauseCapture}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Pause
              </button>
              <button
                onClick={onStopCapture}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                    clipRule="evenodd"
                  />
                </svg>
                Stop
              </button>
            </>
          )}

          <div className="w-px h-6 bg-dark-border mx-2" />

          <button
            onClick={onClearCaptures}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-dark-surface rounded-md hover:bg-dark-hover transition-colors"
            disabled={requests.length === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear
          </button>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-dark-surface rounded-md hover:bg-dark-hover transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Export
            </button>
            <div className="absolute right-0 mt-1 w-32 bg-dark-surface border border-dark-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => onExportCaptures('har')}
                className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-dark-hover"
              >
                HAR Format
              </button>
              <button
                onClick={() => onExportCaptures('json')}
                className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-dark-hover"
              >
                JSON
              </button>
              <button
                onClick={() => onExportCaptures('curl')}
                className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-dark-hover"
              >
                cURL Commands
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-dark-border bg-dark-surface/50">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
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
            placeholder="Filter by URL, host, or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 text-sm bg-dark-bg border border-dark-border rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
          />
        </div>

        {/* Method filters */}
        <div className="flex items-center gap-1">
          {['GET', 'POST', 'PUT', 'DELETE'].map((method) => (
            <button
              key={method}
              onClick={() => toggleMethodFilter(method)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                methodFilter.includes(method)
                  ? methodColors[method]
                  : 'text-gray-500 bg-dark-bg hover:bg-dark-hover'
              }`}
            >
              {method}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:border-accent-primary"
        >
          <option value="all">All Status</option>
          <option value="2xx">2xx Success</option>
          <option value="3xx">3xx Redirect</option>
          <option value="4xx">4xx Client Error</option>
          <option value="5xx">5xx Server Error</option>
          <option value="pending">Pending</option>
        </select>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 text-sm bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:border-accent-primary"
          >
            <option value="time">Time</option>
            <option value="method">Method</option>
            <option value="status">Status</option>
            <option value="duration">Duration</option>
          </select>
          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            {sortOrder === 'asc' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Request list */}
      <div className="flex-1 overflow-auto">
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg font-medium">No captured requests</p>
            <p className="text-sm">
              {isCapturing ? 'Waiting for traffic...' : 'Start capturing to see requests'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-dark-surface border-b border-dark-border">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 w-24">Time</th>
                <th className="px-4 py-2 w-20">Method</th>
                <th className="px-4 py-2 w-16">Status</th>
                <th className="px-4 py-2">URL</th>
                <th className="px-4 py-2 w-24">Duration</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => onSelectRequest(request)}
                  className={`border-b border-dark-border cursor-pointer transition-colors ${
                    selectedRequestId === request.id
                      ? 'bg-accent-primary/10'
                      : 'hover:bg-dark-hover'
                  }`}
                >
                  <td className="px-4 py-2 text-sm text-gray-400 font-mono">
                    {formatTime(request.timestamp)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${methodColors[request.method] || 'text-gray-400 bg-gray-400/10'}`}
                    >
                      {request.method}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {request.response ? (
                      <span
                        className={`text-sm font-medium ${getStatusColor(request.response.status)}`}
                      >
                        {request.response.status}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">...</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 max-w-lg">
                      <span className="text-sm text-gray-400 truncate">{request.host}</span>
                      <span className="text-sm text-white truncate">{request.path}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-400 font-mono">
                    {request.response ? formatDuration(request.response.timing.total) : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConvertToReplayable(request);
                      }}
                      className="p-1 text-gray-400 hover:text-accent-primary transition-colors"
                      title="Convert to replayable request"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-dark-border bg-dark-surface/50 text-xs text-gray-500">
        <span>
          Showing {filteredRequests.length} of {requests.length} requests
        </span>
        {session && (
          <span>
            Session started: {new Date(session.startedAt).toLocaleString()}
            {session.endedAt && ` • Ended: ${new Date(session.endedAt).toLocaleString()}`}
          </span>
        )}
      </div>
    </div>
  );
};

export default CaptureViewer;