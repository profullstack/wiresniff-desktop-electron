/**
 * Environment Timeline Component
 *
 * Displays a chronological timeline of environment snapshots and drift events,
 * allowing users to track changes, compare versions, and restore previous states.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  snapshotService,
  type EnvironmentSnapshot,
  type TimelineEvent,
  type VariableDiff,
} from '../../services/environment';

interface EnvironmentTimelineProps {
  environmentId: string;
  environmentName?: string;
  onRestoreSnapshot?: (snapshotId: string) => void;
  onCompareSnapshots?: (baselineId: string, comparedId: string) => void;
}

export const EnvironmentTimeline: React.FC<EnvironmentTimelineProps> = ({
  environmentId,
  environmentName = 'Environment',
  onRestoreSnapshot,
  onCompareSnapshots,
}) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [snapshots, setSnapshots] = useState<EnvironmentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<EnvironmentSnapshot | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<VariableDiff[] | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotDescription, setNewSnapshotDescription] = useState('');

  // Load timeline and snapshots
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [timelineData, snapshotsData] = await Promise.all([
        snapshotService.getTimeline(environmentId, { limit: 50 }),
        snapshotService.getEnvironmentSnapshots(environmentId, { limit: 20 }),
      ]);

      setTimeline(timelineData);
      setSnapshots(snapshotsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create new snapshot
  const handleCreateSnapshot = async () => {
    if (!newSnapshotName.trim()) return;

    try {
      await snapshotService.createSnapshot({
        environmentId,
        name: newSnapshotName.trim(),
        description: newSnapshotDescription.trim() || undefined,
        triggerType: 'manual',
      });

      setShowCreateModal(false);
      setNewSnapshotName('');
      setNewSnapshotDescription('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot');
    }
  };

  // Restore snapshot
  const handleRestore = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to restore this snapshot? Current values will be overwritten.')) {
      return;
    }

    try {
      await snapshotService.restoreSnapshot(snapshotId);
      onRestoreSnapshot?.(snapshotId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore snapshot');
    }
  };

  // Delete snapshot
  const handleDelete = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) {
      return;
    }

    try {
      await snapshotService.deleteSnapshot(snapshotId);
      setSelectedSnapshot(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete snapshot');
    }
  };

  // Compare snapshots
  const handleCompare = async () => {
    if (compareSelection.length !== 2) return;

    try {
      const diffs = await snapshotService.compareSnapshots(compareSelection[0], compareSelection[1]);
      setComparisonResult(diffs);
      onCompareSnapshots?.(compareSelection[0], compareSelection[1]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare snapshots');
    }
  };

  // Toggle compare selection
  const toggleCompareSelection = (snapshotId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(snapshotId)) {
        return prev.filter((id) => id !== snapshotId);
      }
      if (prev.length >= 2) {
        return [prev[1], snapshotId];
      }
      return [...prev, snapshotId];
    });
  };

  // Get event icon
  const getEventIcon = (event: TimelineEvent) => {
    if (event.eventType === 'snapshot') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  };

  // Get severity color
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold">{environmentName} Timeline</h2>
          <p className="text-sm text-gray-400">
            {snapshots.length} snapshots • {timeline.filter((e) => e.eventType === 'drift').length} drift events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compareMode ? (
            <>
              <button
                onClick={handleCompare}
                disabled={compareSelection.length !== 2}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare ({compareSelection.length}/2)
              </button>
              <button
                onClick={() => {
                  setCompareMode(false);
                  setCompareSelection([]);
                  setComparisonResult(null);
                }}
                className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCompareMode(true)}
                className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
              >
                Compare
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Create Snapshot
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {timeline.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No timeline events yet</p>
              <p className="text-sm mt-1">Create a snapshot to start tracking changes</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700"></div>

              {/* Timeline events */}
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div
                    key={`${event.eventType}-${event.eventId}`}
                    className={`relative pl-10 ${
                      compareMode && event.eventType === 'snapshot'
                        ? 'cursor-pointer'
                        : ''
                    }`}
                    onClick={() => {
                      if (compareMode && event.eventType === 'snapshot') {
                        toggleCompareSelection(event.eventId);
                      } else if (event.eventType === 'snapshot') {
                        const snapshot = snapshots.find((s) => s.id === event.eventId);
                        setSelectedSnapshot(snapshot || null);
                      }
                    }}
                  >
                    {/* Event icon */}
                    <div
                      className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        event.eventType === 'snapshot'
                          ? compareSelection.includes(event.eventId)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300'
                          : getSeverityColor(event.severity)
                      }`}
                    >
                      {compareMode && event.eventType === 'snapshot' ? (
                        compareSelection.includes(event.eventId) ? (
                          <span className="text-sm font-bold">
                            {compareSelection.indexOf(event.eventId) + 1}
                          </span>
                        ) : (
                          getEventIcon(event)
                        )
                      ) : (
                        getEventIcon(event)
                      )}
                    </div>

                    {/* Event content */}
                    <div
                      className={`p-3 rounded-lg ${
                        event.eventType === 'snapshot'
                          ? 'bg-gray-800 hover:bg-gray-750'
                          : 'bg-gray-800/50'
                      } ${
                        selectedSnapshot?.id === event.eventId
                          ? 'ring-2 ring-blue-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{event.eventName}</h4>
                          {event.eventDescription && (
                            <p className="text-sm text-gray-400 mt-1">{event.eventDescription}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>{formatRelativeTime(event.eventTime)}</span>
                            {event.triggerType && (
                              <span className="px-2 py-0.5 bg-gray-700 rounded">
                                {event.triggerType}
                              </span>
                            )}
                            {event.severity && (
                              <span
                                className={`px-2 py-0.5 rounded ${getSeverityColor(event.severity)}`}
                              >
                                {event.severity}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.eventType === 'snapshot' && !compareMode && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(event.eventId);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                              title="Restore"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(event.eventId);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Snapshot details / Comparison panel */}
        {(selectedSnapshot || comparisonResult) && (
          <div className="w-80 border-l border-gray-700 overflow-y-auto">
            {comparisonResult ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Comparison Result</h3>
                  <button
                    onClick={() => setComparisonResult(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {comparisonResult.length === 0 ? (
                  <p className="text-gray-400 text-sm">No differences found</p>
                ) : (
                  <div className="space-y-3">
                    {comparisonResult.map((diff) => (
                      <div
                        key={diff.key}
                        className={`p-3 rounded-lg ${
                          diff.type === 'added'
                            ? 'bg-green-500/10 border border-green-500/30'
                            : diff.type === 'removed'
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-yellow-500/10 border border-yellow-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              diff.type === 'added'
                                ? 'bg-green-500/20 text-green-400'
                                : diff.type === 'removed'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {diff.type}
                          </span>
                          <span className="font-mono text-sm">{diff.key}</span>
                        </div>
                        {diff.leftValue && (
                          <div className="text-xs text-gray-400 mt-1">
                            <span className="text-red-400">-</span> {diff.leftValue}
                          </div>
                        )}
                        {diff.rightValue && (
                          <div className="text-xs text-gray-400 mt-1">
                            <span className="text-green-400">+</span> {diff.rightValue}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedSnapshot ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Snapshot Details</h3>
                  <button
                    onClick={() => setSelectedSnapshot(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Name</label>
                    <p className="font-medium">{selectedSnapshot.name}</p>
                  </div>

                  {selectedSnapshot.description && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Description</label>
                      <p className="text-sm text-gray-300">{selectedSnapshot.description}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-500 uppercase">Created</label>
                    <p className="text-sm">{formatDate(selectedSnapshot.createdAt)}</p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase">Version</label>
                    <p className="text-sm">v{selectedSnapshot.version}</p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase">Variables ({Object.keys(selectedSnapshot.variables).length})</label>
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(selectedSnapshot.variables).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 text-xs">
                          <span className="font-mono text-blue-400">{key}</span>
                          <span className="text-gray-500">=</span>
                          <span className="font-mono text-gray-300 break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => handleRestore(selectedSnapshot.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(selectedSnapshot.id)}
                      className="px-3 py-2 bg-red-600/20 text-red-400 rounded text-sm hover:bg-red-600/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Snapshot</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  placeholder="e.g., Pre-deployment backup"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={newSnapshotDescription}
                  onChange={(e) => setNewSnapshotDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewSnapshotName('');
                  setNewSnapshotDescription('');
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={!newSnapshotName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvironmentTimeline;