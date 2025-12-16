/**
 * Drift Alert Component
 *
 * Displays alerts for environment drift detection, showing when
 * environment variables have changed from their baseline snapshot.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  snapshotService,
  type DriftRecord,
  type DriftSeverity,
  type DriftCategory,
} from '../../services/environment';

interface DriftAlertProps {
  environmentId: string;
  environmentName?: string;
  autoDetect?: boolean;
  detectInterval?: number; // in milliseconds
  onDriftDetected?: (drifts: DriftRecord[]) => void;
  onResolve?: (driftId: string) => void;
}

export const DriftAlert: React.FC<DriftAlertProps> = ({
  environmentId,
  environmentName = 'Environment',
  autoDetect = false,
  detectInterval = 60000, // 1 minute default
  onDriftDetected,
  onResolve,
}) => {
  const [drifts, setDrifts] = useState<DriftRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Load existing drift records
  const loadDrifts = useCallback(async () => {
    try {
      setLoading(true);
      const records = await snapshotService.getDriftRecords(environmentId, {
        includeResolved: false,
        limit: 20,
      });
      setDrifts(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drift records');
    } finally {
      setLoading(false);
    }
  }, [environmentId]);

  // Detect new drift
  const detectDrift = useCallback(async () => {
    try {
      setDetecting(true);
      setError(null);
      const newDrifts = await snapshotService.detectDrift(environmentId);
      setLastChecked(new Date());

      if (newDrifts.length > 0) {
        setDrifts((prev) => [...newDrifts, ...prev]);
        onDriftDetected?.(newDrifts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect drift');
    } finally {
      setDetecting(false);
    }
  }, [environmentId, onDriftDetected]);

  // Resolve drift
  const handleResolve = async (driftId: string) => {
    try {
      await snapshotService.resolveDrift(driftId);
      setDrifts((prev) => prev.filter((d) => d.id !== driftId));
      onResolve?.(driftId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve drift');
    }
  };

  // Resolve all drifts
  const handleResolveAll = async () => {
    if (!confirm('Are you sure you want to resolve all drift alerts?')) return;

    try {
      await Promise.all(drifts.map((d) => snapshotService.resolveDrift(d.id)));
      setDrifts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve all drifts');
    }
  };

  // Initial load
  useEffect(() => {
    loadDrifts();
  }, [loadDrifts]);

  // Auto-detect interval
  useEffect(() => {
    if (!autoDetect) return;

    const interval = setInterval(detectDrift, detectInterval);
    return () => clearInterval(interval);
  }, [autoDetect, detectInterval, detectDrift]);

  // Get severity icon
  const getSeverityIcon = (severity: DriftSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Get severity color classes
  const getSeverityClasses = (severity: DriftSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  // Get category label
  const getCategoryLabel = (category: DriftCategory) => {
    const labels: Record<DriftCategory, string> = {
      variable_added: 'Variable Added',
      variable_removed: 'Variable Removed',
      variable_modified: 'Variable Modified',
      auth_changed: 'Auth Changed',
      tls_changed: 'TLS Changed',
      proxy_changed: 'Proxy Changed',
      header_changed: 'Header Changed',
    };
    return labels[category] || category;
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Count by severity
  const criticalCount = drifts.filter((d) => d.severity === 'critical').length;
  const warningCount = drifts.filter((d) => d.severity === 'warning').length;
  const infoCount = drifts.filter((d) => d.severity === 'info').length;

  // No drifts - show minimal UI
  if (drifts.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">No drift detected</span>
          {lastChecked && (
            <span className="text-xs text-gray-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={detectDrift}
          disabled={detecting}
          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {detecting ? 'Checking...' : 'Check Now'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 cursor-pointer ${
          criticalCount > 0
            ? 'bg-red-500/10'
            : warningCount > 0
            ? 'bg-yellow-500/10'
            : 'bg-blue-500/10'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {criticalCount > 0 ? (
            getSeverityIcon('critical')
          ) : warningCount > 0 ? (
            getSeverityIcon('warning')
          ) : (
            getSeverityIcon('info')
          )}
          <div>
            <h4 className="font-medium text-white">
              {drifts.length} Drift Alert{drifts.length !== 1 ? 's' : ''}
            </h4>
            <p className="text-xs text-gray-400">
              {environmentName}
              {criticalCount > 0 && (
                <span className="ml-2 text-red-400">{criticalCount} critical</span>
              )}
              {warningCount > 0 && (
                <span className="ml-2 text-yellow-400">{warningCount} warning</span>
              )}
              {infoCount > 0 && (
                <span className="ml-2 text-blue-400">{infoCount} info</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              detectDrift();
            }}
            disabled={detecting}
            className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {detecting ? '...' : 'Refresh'}
          </button>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-700">
          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50">
            <span className="text-xs text-gray-500">
              {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
            </span>
            <button
              onClick={handleResolveAll}
              className="text-xs text-gray-400 hover:text-white"
            >
              Resolve All
            </button>
          </div>

          {/* Drift list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {drifts.map((drift) => (
                  <div
                    key={drift.id}
                    className={`p-3 ${getSeverityClasses(drift.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(drift.severity)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {drift.variableKey || getCategoryLabel(drift.category)}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded">
                              {getCategoryLabel(drift.category)}
                            </span>
                          </div>
                          {drift.description && (
                            <p className="text-sm text-gray-400 mt-1">{drift.description}</p>
                          )}
                          {(drift.baselineValue || drift.currentValue) && (
                            <div className="mt-2 text-xs font-mono">
                              {drift.baselineValue && (
                                <div className="text-red-400">
                                  - {String(drift.baselineValue)}
                                </div>
                              )}
                              {drift.currentValue && (
                                <div className="text-green-400">
                                  + {String(drift.currentValue)}
                                </div>
                              )}
                            </div>
                          )}
                          {drift.recommendation && (
                            <p className="text-xs text-gray-500 mt-2 italic">
                              💡 {drift.recommendation}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Detected: {formatTime(drift.detectedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleResolve(drift.id)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        title="Resolve"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriftAlert;