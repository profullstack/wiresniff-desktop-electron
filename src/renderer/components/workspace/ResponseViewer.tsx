/**
 * ResponseViewer Component
 * 
 * Displays the response from an HTTP request with tabs for body, headers, cookies, and timeline.
 */

import React, { useState, useMemo } from 'react';
import type { ResponseData } from '../../stores';

// Response tabs
type ResponseTab = 'body' | 'headers' | 'cookies' | 'timeline';

interface ResponseViewerProps {
  response?: ResponseData;
  error?: string;
  isLoading: boolean;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format time
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Helper function to get status color
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-success';
  if (status >= 300 && status < 400) return 'text-info';
  if (status >= 400 && status < 500) return 'text-warning';
  return 'text-error';
}

// Helper function to detect content type
function detectContentType(body: string, headers: Record<string, string>): 'json' | 'xml' | 'html' | 'text' {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return 'json';
  }
  if (contentType.includes('application/xml') || contentType.includes('+xml') || contentType.includes('text/xml')) {
    return 'xml';
  }
  if (contentType.includes('text/html')) {
    return 'html';
  }
  
  // Try to detect from content
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml';
  }
  
  return 'text';
}

// Format JSON with syntax highlighting
function formatJson(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, error, isLoading }) => {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [wordWrap, setWordWrap] = useState(true);
  const [prettyPrint, setPrettyPrint] = useState(true);

  // Format body based on content type
  const formattedBody = useMemo(() => {
    if (!response?.body) return '';
    
    if (prettyPrint) {
      const contentType = detectContentType(response.body, response.headers);
      if (contentType === 'json') {
        return formatJson(response.body);
      }
    }
    
    return response.body;
  }, [response?.body, response?.headers, prettyPrint]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Sending request...</p>
          <button className="mt-4 px-4 py-2 text-sm text-error hover:underline">
            Cancel Request
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Request Failed</h3>
          <p className="text-text-secondary text-sm mb-4">{error}</p>
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
            Retry Request
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-text-muted">Send a request to see the response</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Response tabs and status */}
      <div className="flex items-center border-b border-border bg-surface">
        {/* Tabs */}
        <div className="flex">
          {[
            { id: 'body' as const, label: 'Body' },
            { id: 'headers' as const, label: 'Headers', count: Object.keys(response.headers).length },
            { id: 'cookies' as const, label: 'Cookies', count: response.cookies?.length || 0 },
            { id: 'timeline' as const, label: 'Timeline' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status info */}
        <div className="ml-auto flex items-center gap-4 px-4 text-sm">
          <span className={`font-medium ${getStatusColor(response.status)}`}>
            {response.status} {response.statusText}
          </span>
          <span className="text-text-muted">{formatTime(response.time)}</span>
          <span className="text-text-muted">{formatBytes(response.size)}</span>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Body tab */}
        {activeTab === 'body' && (
          <>
            {/* Body toolbar */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-surface/50">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={prettyPrint}
                  onChange={(e) => setPrettyPrint(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                Pretty Print
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={wordWrap}
                  onChange={(e) => setWordWrap(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                Word Wrap
              </label>
              <div className="ml-auto flex items-center gap-2">
                <button className="px-3 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-surface rounded transition-colors">
                  Copy
                </button>
                <button className="px-3 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-surface rounded transition-colors">
                  Download
                </button>
              </div>
            </div>

            {/* Body content */}
            <div className="flex-1 overflow-auto p-4 bg-background">
              <pre 
                className={`text-sm text-text-primary font-mono ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}
              >
                {formattedBody}
              </pre>
            </div>
          </>
        )}

        {/* Headers tab */}
        {activeTab === 'headers' && (
          <div className="flex-1 overflow-auto p-4 bg-background">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">Header</th>
                  <th className="pb-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="py-2 pr-4 text-text-secondary font-medium">{key}</td>
                    <td className="py-2 text-text-primary font-mono break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.keys(response.headers).length === 0 && (
              <div className="text-center py-8 text-text-muted">
                No headers in response
              </div>
            )}
          </div>
        )}

        {/* Cookies tab */}
        {activeTab === 'cookies' && (
          <div className="flex-1 overflow-auto p-4 bg-background">
            {response.cookies && response.cookies.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-text-muted uppercase">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Value</th>
                    <th className="pb-2 pr-4 font-medium">Domain</th>
                    <th className="pb-2 pr-4 font-medium">Path</th>
                    <th className="pb-2 pr-4 font-medium">Expires</th>
                    <th className="pb-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {response.cookies.map((cookie, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="py-2 pr-4 text-text-secondary font-medium">{cookie.name}</td>
                      <td className="py-2 pr-4 text-text-primary font-mono max-w-xs truncate">{cookie.value}</td>
                      <td className="py-2 pr-4 text-text-muted">{cookie.domain}</td>
                      <td className="py-2 pr-4 text-text-muted">{cookie.path}</td>
                      <td className="py-2 pr-4 text-text-muted">{cookie.expires || 'Session'}</td>
                      <td className="py-2 text-text-muted">
                        {cookie.httpOnly && <span className="mr-2 px-1.5 py-0.5 text-xs bg-surface rounded">HttpOnly</span>}
                        {cookie.secure && <span className="px-1.5 py-0.5 text-xs bg-surface rounded">Secure</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-text-muted">
                No cookies in response
              </div>
            )}
          </div>
        )}

        {/* Timeline tab */}
        {activeTab === 'timeline' && (
          <div className="flex-1 overflow-auto p-4 bg-background">
            {response.timing ? (
              <div className="space-y-4">
                {/* Timeline visualization */}
                <div className="space-y-2">
                  {[
                    { label: 'DNS Lookup', value: response.timing.dns, color: 'bg-blue-500' },
                    { label: 'TCP Connection', value: response.timing.tcp, color: 'bg-green-500' },
                    { label: 'TLS Handshake', value: response.timing.tls, color: 'bg-purple-500' },
                    { label: 'Time to First Byte', value: response.timing.firstByte, color: 'bg-yellow-500' },
                    { label: 'Content Download', value: response.timing.download, color: 'bg-orange-500' },
                  ].map((phase) => {
                    const percentage = (phase.value / response.timing!.total) * 100;
                    return (
                      <div key={phase.label} className="flex items-center gap-4">
                        <div className="w-32 text-sm text-text-secondary">{phase.label}</div>
                        <div className="flex-1 h-6 bg-surface rounded overflow-hidden">
                          <div 
                            className={`h-full ${phase.color} transition-all`}
                            style={{ width: `${Math.max(percentage, 1)}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-text-muted text-right">
                          {formatTime(phase.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total time */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">Total Time</span>
                  <span className="text-sm font-medium text-text-primary">{formatTime(response.timing.total)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                Timing information not available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponseViewer;