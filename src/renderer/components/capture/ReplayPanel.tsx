/**
 * ReplayPanel Component
 *
 * Allows users to replay captured requests against different environments
 * (staging, production, mock server, or custom URL) and compare responses.
 */

import React, { useState, useCallback } from 'react';
import type { CapturedRequest } from './CaptureViewer';

// Replay target types
export type ReplayTarget = 'staging' | 'production' | 'mock' | 'custom';

export interface ReplayEnvironment {
  id: string;
  name: string;
  type: ReplayTarget;
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface ReplayResult {
  id: string;
  requestId: string;
  environment: ReplayEnvironment;
  originalResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timing: number;
  };
  replayedResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timing: number;
  };
  timestamp: string;
  success: boolean;
  error?: string;
}

interface ReplayPanelProps {
  request: CapturedRequest;
  environments?: ReplayEnvironment[];
  onReplay?: (request: CapturedRequest, environment: ReplayEnvironment) => Promise<ReplayResult>;
  onCompare?: (result: ReplayResult) => void;
  onClose?: () => void;
}

// Default environments
const defaultEnvironments: ReplayEnvironment[] = [
  { id: 'staging', name: 'Staging', type: 'staging', baseUrl: '' },
  { id: 'production', name: 'Production', type: 'production', baseUrl: '' },
  { id: 'mock', name: 'Mock Server', type: 'mock', baseUrl: 'http://localhost:3001' },
];

export const ReplayPanel: React.FC<ReplayPanelProps> = ({
  request,
  environments = defaultEnvironments,
  onReplay,
  onCompare,
  onClose,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<ReplayTarget>('staging');
  const [customUrl, setCustomUrl] = useState('');
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' },
  ]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get the selected environment
  const getSelectedEnvironment = useCallback((): ReplayEnvironment => {
    if (selectedTarget === 'custom') {
      const headers: Record<string, string> = {};
      customHeaders.forEach(({ key, value }) => {
        if (key.trim()) {
          headers[key.trim()] = value;
        }
      });
      return {
        id: 'custom',
        name: 'Custom URL',
        type: 'custom',
        baseUrl: customUrl,
        headers,
      };
    }
    return environments.find((env) => env.type === selectedTarget) || environments[0];
  }, [selectedTarget, customUrl, customHeaders, environments]);

  // Handle replay
  const handleReplay = useCallback(async () => {
    if (!onReplay) return;

    setIsReplaying(true);
    setError(null);
    setReplayResult(null);

    try {
      const environment = getSelectedEnvironment();
      const result = await onReplay(request, environment);
      setReplayResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replay failed');
    } finally {
      setIsReplaying(false);
    }
  }, [onReplay, request, getSelectedEnvironment]);

  // Handle compare
  const handleCompare = useCallback(() => {
    if (replayResult && onCompare) {
      onCompare(replayResult);
    }
  }, [replayResult, onCompare]);

  // Add custom header row
  const addHeaderRow = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  // Update custom header
  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  // Remove custom header
  const removeHeader = (index: number) => {
    if (customHeaders.length > 1) {
      setCustomHeaders(customHeaders.filter((_, i) => i !== index));
    }
  };

  // Get method color
  const getMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      GET: 'text-green-400',
      POST: 'text-blue-400',
      PUT: 'text-yellow-400',
      PATCH: 'text-orange-400',
      DELETE: 'text-red-400',
      HEAD: 'text-purple-400',
      OPTIONS: 'text-gray-400',
    };
    return colors[method.toUpperCase()] || 'text-gray-400';
  };

  // Get status color
  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 300 && status < 400) return 'text-yellow-400';
    if (status >= 400 && status < 500) return 'text-orange-400';
    if (status >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Replay Request</h2>
          <span className={`font-mono font-medium ${getMethodColor(request.method)}`}>
            {request.method}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Request info */}
      <div className="px-4 py-3 bg-dark-surface/50 border-b border-dark-border">
        <div className="font-mono text-sm text-gray-300 truncate">{request.url}</div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Original: {request.status}</span>
          <span>{request.timing}ms</span>
          <span>{new Date(request.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {/* Target selection */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Replay Target</label>
          <div className="grid grid-cols-4 gap-2">
            {(['staging', 'production', 'mock', 'custom'] as ReplayTarget[]).map((target) => (
              <button
                key={target}
                onClick={() => setSelectedTarget(target)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  selectedTarget === target
                    ? 'bg-accent-primary text-white'
                    : 'bg-dark-surface text-gray-400 hover:text-white hover:bg-dark-surface/80'
                }`}
              >
                {target.charAt(0).toUpperCase() + target.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Custom URL input */}
        {selectedTarget === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Custom Base URL</label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-400">Custom Headers</label>
                <button
                  onClick={addHeaderRow}
                  className="text-xs text-accent-primary hover:text-accent-primary/80"
                >
                  + Add Header
                </button>
              </div>
              <div className="space-y-2">
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      placeholder="Header name"
                      className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                    />
                    <button
                      onClick={() => removeHeader(index)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Environment info for non-custom targets */}
        {selectedTarget !== 'custom' && (
          <div className="p-3 bg-dark-surface rounded-lg">
            <div className="text-sm text-gray-400">
              {selectedTarget === 'staging' && (
                <p>Replay against your staging environment. Configure the staging URL in settings.</p>
              )}
              {selectedTarget === 'production' && (
                <p className="text-yellow-400">
                  ⚠️ Replaying against production. Use with caution for non-idempotent requests.
                </p>
              )}
              {selectedTarget === 'mock' && (
                <p>Replay against a local mock server at localhost:3001.</p>
              )}
            </div>
          </div>
        )}

        {/* Replay button */}
        <button
          onClick={handleReplay}
          disabled={isReplaying || (selectedTarget === 'custom' && !customUrl)}
          className={`w-full py-3 rounded-md font-medium transition-colors ${
            isReplaying || (selectedTarget === 'custom' && !customUrl)
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-accent-primary text-white hover:bg-accent-primary/90'
          }`}
        >
          {isReplaying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
              Replaying...
            </span>
          ) : (
            'Replay Request'
          )}
        </button>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Result display */}
        {replayResult && (
          <div className="space-y-4">
            <div className="p-4 bg-dark-surface rounded-lg">
              <h3 className="text-sm font-medium text-white mb-3">Replay Result</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 uppercase">Original</div>
                  <div className={`text-lg font-bold ${getStatusColor(replayResult.originalResponse.status)}`}>
                    {replayResult.originalResponse.status} {replayResult.originalResponse.statusText}
                  </div>
                  <div className="text-sm text-gray-400">
                    {replayResult.originalResponse.timing}ms
                  </div>
                </div>

                {/* Replayed */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 uppercase">Replayed</div>
                  <div className={`text-lg font-bold ${getStatusColor(replayResult.replayedResponse.status)}`}>
                    {replayResult.replayedResponse.status} {replayResult.replayedResponse.statusText}
                  </div>
                  <div className="text-sm text-gray-400">
                    {replayResult.replayedResponse.timing}ms
                  </div>
                </div>
              </div>

              {/* Quick comparison */}
              <div className="mt-4 pt-4 border-t border-dark-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {replayResult.originalResponse.status === replayResult.replayedResponse.status ? (
                      <span className="text-green-400">✓ Status codes match</span>
                    ) : (
                      <span className="text-yellow-400">⚠ Status codes differ</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    Timing delta:{' '}
                    <span
                      className={
                        replayResult.replayedResponse.timing > replayResult.originalResponse.timing
                          ? 'text-red-400'
                          : 'text-green-400'
                      }
                    >
                      {replayResult.replayedResponse.timing > replayResult.originalResponse.timing
                        ? '+'
                        : ''}
                      {replayResult.replayedResponse.timing - replayResult.originalResponse.timing}ms
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compare button */}
            {onCompare && (
              <button
                onClick={handleCompare}
                className="w-full py-3 bg-dark-surface border border-dark-border rounded-md text-white font-medium hover:bg-dark-surface/80 transition-colors"
              >
                View Full Diff
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplayPanel;