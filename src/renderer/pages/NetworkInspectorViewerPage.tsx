
/**
 * Network Inspector / Traffic Viewer Page
 *
 * Full-featured network traffic inspector with:
 * - Captured requests list with filtering
 * - Request detail view with tabs (Overview, Headers, Payload, Response, Timing)
 * - Recording controls
 * - Request replay functionality
 * - Export capabilities
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Play,
  Copy,
  Download,
  Info,
  FileText,
  Reply,
  Code,
  Clock,
  Circle,
  StopCircle,
} from 'lucide-react';

// Types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
type DetailTab = 'overview' | 'headers' | 'payload' | 'response' | 'timing';

interface CapturedRequest {
  id: string;
  method: HttpMethod;
  url: string;
  path: string;
  host: string;
  status: number;
  statusText: string;
  duration: number;
  size: number;
  timestamp: Date;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  timing: {
    dns: number;
    tcp: number;
    tls: number;
    request: number;
    waiting: number;
    download: number;
  };
}

// Method badge colors
const methodColors: Record<HttpMethod, { bg: string; text: string }> = {
  GET: { bg: 'bg-green-500/20', text: 'text-green-400' },
  POST: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  PUT: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  PATCH: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  DELETE: { bg: 'bg-red-500/20', text: 'text-red-400' },
  OPTIONS: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  HEAD: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

// Status code colors
const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return 'bg-green-500';
  if (status >= 300 && status < 400) return 'bg-blue-500';
  if (status >= 400 && status < 500) return 'bg-red-500';
  if (status >= 500) return 'bg-yellow-500';
  return 'bg-gray-500';
};

// Format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format time
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour12: false });
};

// Mock data
const mockRequests: CapturedRequest[] = [
  {
    id: '1',
    method: 'GET',
    url: 'https://api.example.com/api/users/profile',
    path: '/api/users/profile',
    host: 'api.example.com',
    status: 200,
    statusText: 'OK',
    duration: 124,
    size: 2457,
    timestamp: new Date(),
    requestHeaders: {
      Accept: 'application/json, text/plain, */*',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'Content-Type': 'application/json',
      'User-Agent': 'WireSniff/1.0.0',
    },
    responseHeaders: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, private',
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '97',
    },
    responseBody: JSON.stringify(
      {
        id: 12345,
        username: 'john_doe',
        email: 'john@example.com',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'https://cdn.example.com/avatars/john.jpg',
          verified: true,
        },
        createdAt: '2024-01-15T12:34:56Z',
      },
      null,
      2
    ),
    timing: { dns: 8, tcp: 12, tls: 24, request: 4, waiting: 56, download: 20 },
  },
  {
    id: '2',
    method: 'POST',
    url: 'https://api.example.com/api/orders/create',
    path: '/api/orders/create',
    host: 'api.example.com',
    status: 201,
    statusText: 'Created',
    duration: 89,
    size: 1843,
    timestamp: new Date(Date.now() - 4000),
    requestHeaders: { 'Content-Type': 'application/json' },
    responseHeaders: { 'Content-Type': 'application/json' },
    requestBody: JSON.stringify({ productId: 123, quantity: 2 }, null, 2),
    responseBody: JSON.stringify({ orderId: 'ORD-12345', status: 'pending' }, null, 2),
    timing: { dns: 5, tcp: 10, tls: 20, request: 8, waiting: 36, download: 10 },
  },
  {
    id: '3',
    method: 'GET',
    url: 'https://api.example.com/api/products/list',
    path: '/api/products/list',
    host: 'api.example.com',
    status: 200,
    statusText: 'OK',
    duration: 56,
    size: 5324,
    timestamp: new Date(Date.now() - 8000),
    requestHeaders: { Accept: 'application/json' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: JSON.stringify([{ id: 1, name: 'Product 1' }], null, 2),
    timing: { dns: 3, tcp: 8, tls: 15, request: 2, waiting: 20, download: 8 },
  },
  {
    id: '4',
    method: 'PUT',
    url: 'https://api.example.com/api/users/update',
    path: '/api/users/update',
    host: 'api.example.com',
    status: 200,
    statusText: 'OK',
    duration: 142,
    size: 921,
    timestamp: new Date(Date.now() - 11000),
    requestHeaders: { 'Content-Type': 'application/json' },
    responseHeaders: { 'Content-Type': 'application/json' },
    requestBody: JSON.stringify({ name: 'John Updated' }, null, 2),
    responseBody: JSON.stringify({ success: true }, null, 2),
    timing: { dns: 6, tcp: 12, tls: 22, request: 10, waiting: 72, download: 20 },
  },
  {
    id: '5',
    method: 'GET',
    url: 'https://cdn.example.com/api/images/notfound.jpg',
    path: '/api/images/notfound.jpg',
    host: 'cdn.example.com',
    status: 404,
    statusText: 'Not Found',
    duration: 78,
    size: 307,
    timestamp: new Date(Date.now() - 15000),
    requestHeaders: { Accept: 'image/*' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: JSON.stringify({ error: 'Not found' }, null, 2),
    timing: { dns: 4, tcp: 10, tls: 18, request: 3, waiting: 35, download: 8 },
  },
  {
    id: '6',
    method: 'DELETE',
    url: 'https://api.example.com/api/sessions/logout',
    path: '/api/sessions/logout',
    host: 'api.example.com',
    status: 204,
    statusText: 'No Content',
    duration: 93,
    size: 0,
    timestamp: new Date(Date.now() - 18000),
    requestHeaders: { Authorization: 'Bearer token' },
    responseHeaders: {},
    timing: { dns: 5, tcp: 11, tls: 21, request: 4, waiting: 42, download: 10 },
  },
  {
    id: '7',
    method: 'POST',
    url: 'https://api.example.com/api/payments/process',
    path: '/api/payments/process',
    host: 'api.example.com',
    status: 500,
    statusText: 'Internal Server Error',
    duration: 1240,
    size: 512,
    timestamp: new Date(Date.now() - 21000),
    requestHeaders: { 'Content-Type': 'application/json' },
    responseHeaders: { 'Content-Type': 'application/json' },
    requestBody: JSON.stringify({ amount: 100, currency: 'USD' }, null, 2),
    responseBody: JSON.stringify({ error: 'Payment gateway timeout' }, null, 2),
    timing: { dns: 8, tcp: 15, tls: 30, request: 12, waiting: 1150, download: 25 },
  },
];

export const NetworkInspectorViewerPage: React.FC = () => {
  // State
  const [requests] = useState<CapturedRequest[]>(mockRequests);
  const [selectedRequestId, setSelectedRequestId] = useState<string>(mockRequests[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<HttpMethod | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [isRecording, setIsRecording] = useState(true);
  const [responseViewMode, setResponseViewMode] = useState<'pretty' | 'raw'>('pretty');

  // Get selected request
  const selectedRequest = requests.find((r) => r.id === selectedRequestId) || requests[0];

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        searchQuery === '' ||
        req.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod = methodFilter === 'ALL' || req.method === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [requests, searchQuery, methodFilter]);

  // Handlers
  const handleSelectRequest = useCallback((requestId: string) => {
    setSelectedRequestId(requestId);
  }, []);

  const handleReplay = useCallback(() => {
    // TODO: Replay request
    console.log('Replaying request:', selectedRequest);
  }, [selectedRequest]);

  const handleCopy = useCallback(() => {
    // Copy request as cURL
    const curl = `curl -X ${selectedRequest.method} "${selectedRequest.url}"`;
    navigator.clipboard.writeText(curl);
  }, [selectedRequest]);

  const handleExport = useCallback(() => {
    // Export request log
    const exportData = JSON.stringify(requests, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-log.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [requests]);

  const handleClearAll = useCallback(() => {
    // TODO: Clear all requests
    console.log('Clearing all requests');
  }, []);

  const handleToggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  // Render timing bar
  const renderTimingBar = (label: string, value: number, total: number, color: string) => {
    const percentage = (value / total) * 100;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs text-gray-300">{value}ms</span>
        </div>
        <div className="w-full bg-dark-bg rounded-full h-2">
          <div className={`${color} rounded-full h-2`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    );
  };

  // Tabs
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'headers', label: 'Headers' },
    { id: 'payload', label: 'Payload' },
    { id: 'response', label: 'Response' },
    { id: 'timing', label: 'Timing' },
  ];

  // Method filter buttons
  const methodFilters: (HttpMethod | 'ALL')[] = ['ALL', 'GET', 'POST', 'PUT', 'DELETE'];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Request List Panel */}
      <div className="w-96 border-r border-dark-border bg-dark-surface flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Captured Requests</h2>
            <div className="flex items-center space-x-2">
              <button className="text-gray-400 hover:text-accent-blue transition-colors">
                <Filter className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearAll}
                className="text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by URL, method, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 pr-10 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" />
          </div>

          {/* Method Filters */}
          <div className="flex items-center space-x-2 mt-3">
            {methodFilters.map((method) => (
              <button
                key={method}
                onClick={() => setMethodFilter(method)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  methodFilter === method
                    ? 'bg-accent-blue text-dark-bg'
                    : 'bg-dark-bg text-gray-400 hover:bg-dark-border'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredRequests.map((request) => {
            const methodColor = methodColors[request.method];
            const statusColor = getStatusColor(request.status);
            const isSelected = request.id === selectedRequestId;

            return (
              <div
                key={request.id}
                onClick={() => handleSelectRequest(request.id)}
                className={`rounded-lg p-3 cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-accent-blue/10 border-accent-blue/30'
                    : 'bg-dark-bg border-dark-border hover:bg-dark-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 ${methodColor.bg} ${methodColor.text} text-xs font-medium rounded`}
                    >
                      {request.method}
                    </span>
                    <span className={`px-2 py-0.5 ${statusColor} text-white text-xs font-medium rounded`}>
                      {request.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{request.duration}ms</span>
                </div>
                <p className="text-sm text-gray-300 font-mono truncate mb-1">{request.path}</p>
                <p className="text-xs text-gray-500 truncate">{request.host}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border">
                  <span className="text-xs text-gray-500">{formatBytes(request.size)}</span>
                  <span className="text-xs text-gray-500">{formatTime(request.timestamp)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-dark-border">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{filteredRequests.length} requests captured</span>
            <button onClick={handleExport} className="text-accent-blue hover:text-cyan-400">
              Export Log
            </button>
          </div>
        </div>
      </div>

      {/* Request Detail Panel */}
      <div className="flex-1 flex flex-col bg-dark-bg">
        {/* Detail Header */}
        <div className="border-b border-dark-border">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-3">
              <span
                className={`px-3 py-1 ${methodColors[selectedRequest.method].bg} ${
                  methodColors[selectedRequest.method].text
                } text-sm font-medium rounded`}
              >
                {selectedRequest.method}
              </span>
              <span className="text-gray-300 font-mono">{selectedRequest.path}</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleReplay}
                className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-all flex items-center"
              >
                <Play className="w-4 h-4 mr-2" />
                Replay
              </button>
              <button
                onClick={handleCopy}
                className="text-gray-400 hover:text-gray-200 transition-colors p-2"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button className="text-gray-400 hover:text-gray-200 transition-colors p-2">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-dark-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-accent-blue border-accent-blue'
                    : 'text-gray-400 hover:text-gray-200 border-transparent hover:border-dark-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* General Info */}
                <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                    <Info className="w-4 h-4 text-accent-blue mr-2" />
                    General Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                        URL
                      </label>
                      <p className="text-sm text-gray-300 font-mono break-all">{selectedRequest.url}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                        Method
                      </label>
                      <p className="text-sm text-gray-300">{selectedRequest.method}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                        Status Code
                      </label>
                      <p
                        className={`text-sm ${
                          selectedRequest.status >= 200 && selectedRequest.status < 300
                            ? 'text-green-400'
                            : selectedRequest.status >= 400
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }`}
                      >
                        {selectedRequest.status} {selectedRequest.statusText}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                        Response Time
                      </label>
                      <p className="text-sm text-gray-300">{selectedRequest.duration}ms</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                        Response Size
                      </label>
                      <p className="text-sm text-gray-300">{formatBytes(selectedRequest.size)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                        Timestamp
                      </label>
                      <p className="text-sm text-gray-300">
                        {selectedRequest.timestamp.toLocaleTimeString('en-US', {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          fractionalSecondDigits: 3,
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Request Headers Preview */}
                <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                    <FileText className="w-4 h-4 text-accent-blue mr-2" />
                    Request Headers
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(selectedRequest.requestHeaders)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start">
                          <span className="text-xs text-gray-500 w-40 flex-shrink-0 font-mono">
                            {key}:
                          </span>
                          <span className="text-xs text-gray-300 font-mono truncate">{value}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Response Headers Preview */}
                <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                    <Reply className="w-4 h-4 text-accent-blue mr-2" />
                    Response Headers
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(selectedRequest.responseHeaders)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start">
                          <span className="text-xs text-gray-500 w-40 flex-shrink-0 font-mono">
                            {key}:
                          </span>
                          <span className="text-xs text-gray-300 font-mono truncate">{value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Headers Tab */}
            {activeTab === 'headers' && (
              <>
                <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                    <FileText className="w-4 h-4 text-accent-blue mr-2" />
                    Request Headers
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selectedRequest.requestHeaders).map(([key, value]) => (
                      <div key={key} className="flex items-start">
                        <span className="text-xs text-gray-500 w-48 flex-shrink-0 font-mono">
                          {key}:
                        </span>
                        <span className="text-xs text-gray-300 font-mono break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                    <Reply className="w-4 h-4 text-accent-blue mr-2" />
                    Response Headers
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selectedRequest.responseHeaders).map(([key, value]) => (
                      <div key={key} className="flex items-start">
                        <span className="text-xs text-gray-500 w-48 flex-shrink-0 font-mono">
                          {key}:
                        </span>
                        <span className="text-xs text-gray-300 font-mono break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Payload Tab */}
            {activeTab === 'payload' && (
              <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                  <Code className="w-4 h-4 text-accent-blue mr-2" />
                  Request Body
                </h3>
                {selectedRequest.requestBody ? (
                  <div className="bg-dark-bg rounded-lg p-4 font-mono text-xs overflow-x-auto">
                    <pre className="text-gray-300 whitespace-pre-wrap">
                      {selectedRequest.requestBody}
                    </pre>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No request body</p>
                )}
              </div>
            )}

            {/* Response Tab */}
            {activeTab === 'response' && (
              <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center">
                    <Code className="w-4 h-4 text-accent-blue mr-2" />
                    Response Body
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setResponseViewMode('pretty')}
                      className={`px-3 py-1 text-xs rounded font-medium ${
                        responseViewMode === 'pretty'
                          ? 'bg-accent-blue text-dark-bg'
                          : 'bg-dark-bg text-gray-400 hover:bg-dark-border'
                      }`}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setResponseViewMode('raw')}
                      className={`px-3 py-1 text-xs rounded font-medium ${
                        responseViewMode === 'raw'
                          ? 'bg-accent-blue text-dark-bg'
                          : 'bg-dark-bg text-gray-400 hover:bg-dark-border'
                      }`}
                    >
                      Raw
                    </button>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(selectedRequest.responseBody || '')
                      }
                      className="text-gray-400 hover:text-gray-200 p-1"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {selectedRequest.responseBody ? (
                  <div className="bg-dark-bg rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96">
                    <pre className="text-gray-300 whitespace-pre-wrap">
                      {selectedRequest.responseBody}
                    </pre>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No response body</p>
                )}
              </div>
            )}

            {/* Timing Tab */}
            {activeTab === 'timing' && (
              <div className="bg-dark-surface rounded-lg border border-dark-border p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                  <Clock className="w-4 h-4 text-accent-blue mr-2" />
                  Timing Breakdown
                </h3>
                <div className="space-y-3">
                  {renderTimingBar(
                    'DNS Lookup',
                    selectedRequest.timing.dns,
                    selectedRequest.duration,
                    'bg-accent-blue'
                  )}
                  {renderTimingBar(
                    'TCP Connection',
                    selectedRequest.timing.tcp,
                    selectedRequest.duration,
                    'bg-blue-500'
                  )}
                  {renderTimingBar(
                    'TLS Handshake',
                    selectedRequest.timing.tls,
                    selectedRequest.duration,
                    'bg-purple-500'
                  )}
                  {renderTimingBar(
                    'Request Sent',
                    selectedRequest.timing.request,
                    selectedRequest.duration,
                    'bg-green-500'
                  )}
                  {renderTimingBar(
                    'Waiting (TTFB)',
                    selectedRequest.timing.waiting,
                    selectedRequest.duration,
                    'bg-yellow-500'
                  )}
                  {renderTimingBar(
                    'Content Download',
                    selectedRequest.timing.download,
                    selectedRequest.duration,
                    'bg-orange-500'
                  )}
                  <div className="pt-3 mt-3 border-t border-dark-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">Total Time</span>
                      <span className="text-sm font-semibold text-accent-blue">
                        {selectedRequest.duration}ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-6">
            <span>WireSniff v1.0.0</span>
            <button
              onClick={handleToggleRecording}
              className="hover:text-accent-blue transition-colors flex items-center"
            >
              {isRecording ? (
                <>
                  <StopCircle className="w-4 h-4 text-red-500 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 text-green-500 mr-2" />
                  Start Recording
                </>
              )}
            </button>
            <button onClick={handleClearAll} className="hover:text-accent-blue transition-colors">
              Clear All
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Circle
                className={`w-2 h-2 mr-2 ${isRecording ? 'text-green-500 fill-green-500' : 'text-gray-500'}`}
              />
              {isRecording ? 'Monitoring active' : 'Monitoring paused'}
            </span>
            <span>{filteredRequests.length} requests</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkInspectorViewerPage;