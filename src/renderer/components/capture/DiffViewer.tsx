/**
 * DiffViewer Component
 *
 * Displays side-by-side or unified diff view of two HTTP responses,
 * showing differences in status, headers, body, and timing.
 */

import React, { useState, useMemo } from 'react';

// Types matching the diff engine
export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: {
    total: number;
    dns?: number;
    connect?: number;
    ttfb?: number;
    download?: number;
  };
  timestamp: string;
}

export interface HeaderDiff {
  key: string;
  type: 'added' | 'removed' | 'modified';
  leftValue?: string;
  rightValue?: string;
}

export interface JsonDiffEntry {
  path: string;
  type: 'added' | 'removed' | 'modified' | 'type-changed';
  leftValue?: unknown;
  rightValue?: unknown;
  leftType?: string;
  rightType?: string;
}

export interface BodyDiff {
  type: 'identical' | 'different' | 'json-semantic' | 'binary';
  textDiff?: string[];
  jsonDiff?: JsonDiffEntry[];
  similarity: number;
}

export interface TimingDiff {
  totalDelta: number;
  dnsDelta?: number;
  connectDelta?: number;
  ttfbDelta?: number;
  downloadDelta?: number;
  percentageChange: number;
}

export interface DiffResult {
  id: string;
  leftResponse: ResponseData;
  rightResponse: ResponseData;
  statusDiff: {
    identical: boolean;
    left: { status: number; statusText: string };
    right: { status: number; statusText: string };
  };
  headerDiff: HeaderDiff[];
  bodyDiff: BodyDiff;
  timingDiff: TimingDiff;
  summary: {
    hasStatusDiff: boolean;
    hasHeaderDiff: boolean;
    hasBodyDiff: boolean;
    hasSignificantTimingDiff: boolean;
    overallSimilarity: number;
  };
  createdAt: string;
}

interface DiffViewerProps {
  diffResult: DiffResult;
  leftLabel?: string;
  rightLabel?: string;
  viewMode?: 'side-by-side' | 'unified';
  onClose?: () => void;
}

// Tab options for the diff viewer
type DiffTab = 'summary' | 'status' | 'headers' | 'body' | 'timing';

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffResult,
  leftLabel = 'Original',
  rightLabel = 'Compared',
  viewMode: initialViewMode = 'side-by-side',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<DiffTab>('summary');
  const [viewMode, setViewMode] = useState(initialViewMode);

  // Calculate similarity percentage
  const similarityPercent = useMemo(
    () => Math.round(diffResult.summary.overallSimilarity * 100),
    [diffResult.summary.overallSimilarity]
  );

  // Get similarity color
  const getSimilarityColor = (percent: number): string => {
    if (percent >= 90) return 'text-green-400';
    if (percent >= 70) return 'text-yellow-400';
    if (percent >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  // Format timing value
  const formatTiming = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format timing delta
  const formatDelta = (delta: number): string => {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${formatTiming(delta)}`;
  };

  // Get status color
  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 300 && status < 400) return 'text-yellow-400';
    if (status >= 400 && status < 500) return 'text-orange-400';
    if (status >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  // Render summary tab
  const renderSummary = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className={`text-6xl font-bold ${getSimilarityColor(similarityPercent)}`}>
            {similarityPercent}%
          </div>
          <div className="text-gray-400 mt-2">Overall Similarity</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status indicator */}
        <div
          className={`p-4 rounded-lg ${diffResult.summary.hasStatusDiff ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Status</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {diffResult.summary.hasStatusDiff
              ? `${diffResult.statusDiff.left.status} → ${diffResult.statusDiff.right.status}`
              : 'Identical'}
          </div>
        </div>

        {/* Headers indicator */}
        <div
          className={`p-4 rounded-lg ${diffResult.summary.hasHeaderDiff ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Headers</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {diffResult.summary.hasHeaderDiff
              ? `${diffResult.headerDiff.length} difference(s)`
              : 'Identical'}
          </div>
        </div>

        {/* Body indicator */}
        <div
          className={`p-4 rounded-lg ${diffResult.summary.hasBodyDiff ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-green-500/10 border border-green-500/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Body</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {diffResult.summary.hasBodyDiff
              ? `${Math.round(diffResult.bodyDiff.similarity * 100)}% similar`
              : 'Identical'}
          </div>
        </div>

        {/* Timing indicator */}
        <div
          className={`p-4 rounded-lg ${diffResult.summary.hasSignificantTimingDiff ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-green-500/10 border border-green-500/30'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Timing</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {diffResult.summary.hasSignificantTimingDiff
              ? `${formatDelta(diffResult.timingDiff.totalDelta)} (${diffResult.timingDiff.percentageChange > 0 ? '+' : ''}${diffResult.timingDiff.percentageChange.toFixed(1)}%)`
              : 'Similar'}
          </div>
        </div>
      </div>
    </div>
  );

  // Render status tab
  const renderStatus = () => (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">{leftLabel}</h3>
          <div
            className={`text-2xl font-bold ${getStatusColor(diffResult.statusDiff.left.status)}`}
          >
            {diffResult.statusDiff.left.status} {diffResult.statusDiff.left.statusText}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">{rightLabel}</h3>
          <div
            className={`text-2xl font-bold ${getStatusColor(diffResult.statusDiff.right.status)}`}
          >
            {diffResult.statusDiff.right.status} {diffResult.statusDiff.right.statusText}
          </div>
        </div>
      </div>
      {!diffResult.statusDiff.identical && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">
            Status codes differ: {diffResult.statusDiff.left.status} →{' '}
            {diffResult.statusDiff.right.status}
          </p>
        </div>
      )}
    </div>
  );

  // Render headers tab
  const renderHeaders = () => (
    <div className="p-6">
      {diffResult.headerDiff.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>Headers are identical</p>
        </div>
      ) : (
        <div className="space-y-2">
          {diffResult.headerDiff.map((diff, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg font-mono text-sm ${
                diff.type === 'added'
                  ? 'bg-green-500/10 border border-green-500/30'
                  : diff.type === 'removed'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-yellow-500/10 border border-yellow-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    diff.type === 'added'
                      ? 'bg-green-500/20 text-green-400'
                      : diff.type === 'removed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {diff.type}
                </span>
                <span className="text-white font-medium">{diff.key}</span>
              </div>
              {diff.type === 'modified' && (
                <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Before: </span>
                    <span className="text-red-400">{diff.leftValue}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">After: </span>
                    <span className="text-green-400">{diff.rightValue}</span>
                  </div>
                </div>
              )}
              {diff.type === 'added' && (
                <div className="mt-2 text-xs text-green-400">{diff.rightValue}</div>
              )}
              {diff.type === 'removed' && (
                <div className="mt-2 text-xs text-red-400">{diff.leftValue}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render body tab
  const renderBody = () => (
    <div className="p-6">
      {diffResult.bodyDiff.type === 'identical' ? (
        <div className="text-center text-gray-500 py-8">
          <p>Response bodies are identical</p>
        </div>
      ) : diffResult.bodyDiff.type === 'binary' ? (
        <div className="text-center text-gray-500 py-8">
          <p>Binary content - cannot display diff</p>
        </div>
      ) : diffResult.bodyDiff.type === 'json-semantic' && diffResult.bodyDiff.jsonDiff ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-400 mb-4">
            JSON Semantic Diff ({diffResult.bodyDiff.jsonDiff.length} changes)
          </div>
          {diffResult.bodyDiff.jsonDiff.map((diff, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg font-mono text-sm ${
                diff.type === 'added'
                  ? 'bg-green-500/10 border border-green-500/30'
                  : diff.type === 'removed'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-yellow-500/10 border border-yellow-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    diff.type === 'added'
                      ? 'bg-green-500/20 text-green-400'
                      : diff.type === 'removed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {diff.type}
                </span>
                <span className="text-white">{diff.path}</span>
              </div>
              {diff.type === 'modified' && (
                <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Before: </span>
                    <span className="text-red-400">{JSON.stringify(diff.leftValue)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">After: </span>
                    <span className="text-green-400">{JSON.stringify(diff.rightValue)}</span>
                  </div>
                </div>
              )}
              {diff.type === 'type-changed' && (
                <div className="mt-2 text-xs">
                  <span className="text-gray-500">Type changed: </span>
                  <span className="text-red-400">{diff.leftType}</span>
                  <span className="text-gray-500"> → </span>
                  <span className="text-green-400">{diff.rightType}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : diffResult.bodyDiff.textDiff ? (
        <div className="font-mono text-sm bg-dark-bg rounded-lg p-4 overflow-auto max-h-96">
          {diffResult.bodyDiff.textDiff.map((line, index) => (
            <div
              key={index}
              className={`${
                line.startsWith('+')
                  ? 'bg-green-500/10 text-green-400'
                  : line.startsWith('-')
                    ? 'bg-red-500/10 text-red-400'
                    : 'text-gray-400'
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  // Render timing tab
  const renderTiming = () => (
    <div className="p-6">
      <div className="space-y-4">
        <div className="p-4 bg-dark-bg rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Total Time</span>
            <div className="flex items-center gap-4">
              <span className="text-white font-mono">
                {formatTiming(diffResult.leftResponse.timing.total)}
              </span>
              <span className="text-gray-500">→</span>
              <span className="text-white font-mono">
                {formatTiming(diffResult.rightResponse.timing.total)}
              </span>
              <span
                className={`font-mono ${diffResult.timingDiff.totalDelta > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                ({formatDelta(diffResult.timingDiff.totalDelta)})
              </span>
            </div>
          </div>
        </div>

        {diffResult.timingDiff.dnsDelta !== undefined && (
          <div className="p-4 bg-dark-bg rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">DNS Lookup</span>
              <span
                className={`font-mono ${(diffResult.timingDiff.dnsDelta ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {formatDelta(diffResult.timingDiff.dnsDelta)}
              </span>
            </div>
          </div>
        )}

        {diffResult.timingDiff.connectDelta !== undefined && (
          <div className="p-4 bg-dark-bg rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Connection</span>
              <span
                className={`font-mono ${(diffResult.timingDiff.connectDelta ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {formatDelta(diffResult.timingDiff.connectDelta)}
              </span>
            </div>
          </div>
        )}

        {diffResult.timingDiff.ttfbDelta !== undefined && (
          <div className="p-4 bg-dark-bg rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Time to First Byte</span>
              <span
                className={`font-mono ${(diffResult.timingDiff.ttfbDelta ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {formatDelta(diffResult.timingDiff.ttfbDelta)}
              </span>
            </div>
          </div>
        )}

        {diffResult.timingDiff.downloadDelta !== undefined && (
          <div className="p-4 bg-dark-bg rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Download</span>
              <span
                className={`font-mono ${(diffResult.timingDiff.downloadDelta ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {formatDelta(diffResult.timingDiff.downloadDelta)}
              </span>
            </div>
          </div>
        )}

        <div className="p-4 bg-dark-surface rounded-lg border border-dark-border">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">Overall Change</span>
            <span
              className={`text-xl font-bold ${diffResult.timingDiff.percentageChange > 0 ? 'text-red-400' : 'text-green-400'}`}
            >
              {diffResult.timingDiff.percentageChange > 0 ? '+' : ''}
              {diffResult.timingDiff.percentageChange.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Tab content renderer
  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummary();
      case 'status':
        return renderStatus();
      case 'headers':
        return renderHeaders();
      case 'body':
        return renderBody();
      case 'timing':
        return renderTiming();
      default:
        return null;
    }
  };

  const tabs: { id: DiffTab; label: string; hasDiff: boolean }[] = [
    { id: 'summary', label: 'Summary', hasDiff: false },
    { id: 'status', label: 'Status', hasDiff: diffResult.summary.hasStatusDiff },
    { id: 'headers', label: 'Headers', hasDiff: diffResult.summary.hasHeaderDiff },
    { id: 'body', label: 'Body', hasDiff: diffResult.summary.hasBodyDiff },
    { id: 'timing', label: 'Timing', hasDiff: diffResult.summary.hasSignificantTimingDiff },
  ];

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Response Diff</h2>
          <div className={`text-sm font-medium ${getSimilarityColor(similarityPercent)}`}>
            {similarityPercent}% Similar
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-dark-surface rounded-md p-1">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1 text-sm rounded ${viewMode === 'side-by-side' ? 'bg-accent-primary text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1 text-sm rounded ${viewMode === 'unified' ? 'bg-accent-primary text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Unified
            </button>
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
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface/50 border-b border-dark-border text-sm">
        <div className="flex items-center gap-2">
          <span className="text-red-400">●</span>
          <span className="text-gray-400">{leftLabel}</span>
          <span className="text-gray-600">|</span>
          <span className="text-xs text-gray-500">
            {new Date(diffResult.leftResponse.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {new Date(diffResult.rightResponse.timestamp).toLocaleString()}
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">{rightLabel}</span>
          <span className="text-green-400">●</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-dark-border bg-dark-surface/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-md transition-colors relative ${
              activeTab === tab.id
                ? 'bg-accent-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-surface'
            }`}
          >
            {tab.label}
            {tab.hasDiff && tab.id !== 'summary' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{renderTabContent()}</div>
    </div>
  );
};

export default DiffViewer;