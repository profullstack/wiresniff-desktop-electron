/**
 * AI Insights Panel Component
 *
 * Displays AI-powered analysis of captured requests including:
 * - Auth flow detection
 * - JWT analysis
 * - Cookie analysis
 * - CORS analysis
 * - Security header analysis
 * - Diff explanations
 * - Generated tests
 */

import React, { useState, useEffect } from 'react';
import {
  AIService,
  CapturedRequest,
  CapturedResponse,
  CaptureExplanation,
  DiffExplanation,
  GeneratedTest,
} from '../../services/ai';

interface AIInsightsPanelProps {
  request?: CapturedRequest;
  response?: CapturedResponse;
  leftResponse?: CapturedResponse;
  rightResponse?: CapturedResponse;
  mode?: 'capture' | 'diff' | 'tests';
  onSaveInsight?: (insightId: string) => void;
  className?: string;
}

const aiService = new AIService();

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  request,
  response,
  leftResponse,
  rightResponse,
  mode = 'capture',
  onSaveInsight,
  className = '',
}) => {
  const [captureExplanation, setCaptureExplanation] = useState<CaptureExplanation | null>(null);
  const [diffExplanation, setDiffExplanation] = useState<DiffExplanation | null>(null);
  const [generatedTests, setGeneratedTests] = useState<GeneratedTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<'vitest' | 'jest' | 'mocha' | 'playwright'>('vitest');
  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'security' | 'cookies' | 'cors' | 'tests'>('overview');

  useEffect(() => {
    const analyze = async () => {
      setLoading(true);
      setError(null);

      try {
        if (mode === 'capture' && request) {
          const explanation = await aiService.explainCapture(request, response);
          setCaptureExplanation(explanation);
        } else if (mode === 'diff' && leftResponse && rightResponse) {
          const explanation = await aiService.explainDiff(leftResponse, rightResponse);
          setDiffExplanation(explanation);
        } else if (mode === 'tests' && request && response) {
          const tests = await aiService.generateTests(request, response, {
            framework: selectedFramework,
            includeSchema: true,
            includeTiming: true,
          });
          setGeneratedTests(tests);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [request, response, leftResponse, rightResponse, mode, selectedFramework]);

  const handleSaveInsight = async () => {
    try {
      let insightId: string;
      if (mode === 'capture' && captureExplanation) {
        insightId = await aiService.saveInsight('capture', captureExplanation);
      } else if (mode === 'diff' && diffExplanation) {
        insightId = await aiService.saveInsight('diff', diffExplanation);
      } else if (mode === 'tests' && generatedTests.length > 0) {
        insightId = await aiService.saveInsight('test', generatedTests);
      } else {
        return;
      }
      onSaveInsight?.(insightId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save insight');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="text-gray-400">Analyzing...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-2 text-red-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Capture Explanation View
  if (mode === 'capture' && captureExplanation) {
    return (
      <div className={`bg-gray-800 rounded-lg ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">AI Analysis</h3>
          </div>
          <button
            onClick={handleSaveInsight}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Save Insight
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {['overview', 'auth', 'security', 'cookies', 'cors'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
                <p className="text-white">{captureExplanation.summary}</p>
              </div>

              {captureExplanation.recommendations && captureExplanation.recommendations.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-400 mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {captureExplanation.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start space-x-2 text-yellow-200">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'auth' && captureExplanation.authFlow && (
            <div className="space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Authentication Type</h4>
                  <span className={`px-2 py-1 text-xs rounded ${
                    captureExplanation.authFlow.type === 'none'
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-green-600/20 text-green-400'
                  }`}>
                    {captureExplanation.authFlow.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-white text-sm">{captureExplanation.authFlow.description}</p>
                {captureExplanation.authFlow.location && (
                  <p className="text-gray-400 text-sm mt-2">
                    Location: <span className="text-gray-300">{captureExplanation.authFlow.location}</span>
                    {captureExplanation.authFlow.headerName && (
                      <> ({captureExplanation.authFlow.headerName})</>
                    )}
                  </p>
                )}
              </div>

              {captureExplanation.jwt && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-300">JWT Token</h4>
                    <span className={`px-2 py-1 text-xs rounded ${
                      captureExplanation.jwt.isExpired
                        ? 'bg-red-600/20 text-red-400'
                        : 'bg-green-600/20 text-green-400'
                    }`}>
                      {captureExplanation.jwt.isExpired ? 'EXPIRED' : 'VALID'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-400">
                      Algorithm: <span className="text-gray-300">{captureExplanation.jwt.algorithm}</span>
                    </p>
                    {captureExplanation.jwt.issuer && (
                      <p className="text-gray-400">
                        Issuer: <span className="text-gray-300">{captureExplanation.jwt.issuer}</span>
                      </p>
                    )}
                    {captureExplanation.jwt.subject && (
                      <p className="text-gray-400">
                        Subject: <span className="text-gray-300">{captureExplanation.jwt.subject}</span>
                      </p>
                    )}
                    {captureExplanation.jwt.expiresAt && (
                      <p className="text-gray-400">
                        Expires: <span className="text-gray-300">{new Date(captureExplanation.jwt.expiresAt).toLocaleString()}</span>
                      </p>
                    )}
                    <div className="mt-3">
                      <p className="text-gray-400 mb-1">Claims:</p>
                      <div className="flex flex-wrap gap-1">
                        {captureExplanation.jwt.claims.map((claim) => (
                          <span key={claim} className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                            {claim}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && captureExplanation.security && (
            <div className="space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Security Score</h4>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          captureExplanation.security.score >= 80
                            ? 'bg-green-500'
                            : captureExplanation.security.score >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${captureExplanation.security.score}%` }}
                      />
                    </div>
                    <span className="text-white font-medium">{captureExplanation.security.score}/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <SecurityBadge label="HSTS" enabled={captureExplanation.security.hsts} />
                  <SecurityBadge label="CSP" enabled={!!captureExplanation.security.csp} />
                  <SecurityBadge label="X-Frame-Options" enabled={!!captureExplanation.security.xFrameOptions} />
                  <SecurityBadge label="X-Content-Type-Options" enabled={captureExplanation.security.xContentTypeOptions} />
                </div>
              </div>

              {captureExplanation.security.issues.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">Security Issues</h4>
                  <ul className="space-y-2">
                    {captureExplanation.security.issues.map((issue, i) => (
                      <li key={i} className="flex items-start space-x-2 text-red-200 text-sm">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cookies' && captureExplanation.cookies && (
            <div className="space-y-3">
              {captureExplanation.cookies.length === 0 ? (
                <p className="text-gray-400 text-sm">No cookies detected</p>
              ) : (
                captureExplanation.cookies.map((cookie, i) => (
                  <div key={i} className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-white">{cookie.name}</h4>
                      {cookie.purpose && (
                        <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded">
                          {cookie.purpose}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <CookieBadge label="HttpOnly" enabled={cookie.httpOnly} />
                      <CookieBadge label="Secure" enabled={cookie.secure} />
                      {cookie.sameSite && (
                        <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                          SameSite={cookie.sameSite}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'cors' && captureExplanation.cors && (
            <div className="space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">CORS Status</h4>
                  <span className={`px-2 py-1 text-xs rounded ${
                    captureExplanation.cors.isEnabled
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {captureExplanation.cors.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {captureExplanation.cors.allowedOrigins && (
                  <div className="mb-3">
                    <p className="text-gray-400 text-sm mb-1">Allowed Origins:</p>
                    <div className="flex flex-wrap gap-1">
                      {captureExplanation.cors.allowedOrigins.map((origin) => (
                        <span key={origin} className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                          {origin}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {captureExplanation.cors.allowedMethods && (
                  <div className="mb-3">
                    <p className="text-gray-400 text-sm mb-1">Allowed Methods:</p>
                    <div className="flex flex-wrap gap-1">
                      {captureExplanation.cors.allowedMethods.map((method) => (
                        <span key={method} className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {captureExplanation.cors.allowCredentials !== undefined && (
                  <p className="text-gray-400 text-sm">
                    Credentials: <span className={captureExplanation.cors.allowCredentials ? 'text-green-400' : 'text-gray-300'}>
                      {captureExplanation.cors.allowCredentials ? 'Allowed' : 'Not Allowed'}
                    </span>
                  </p>
                )}
              </div>

              {captureExplanation.cors.issues && captureExplanation.cors.issues.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-400 mb-2">CORS Issues</h4>
                  <ul className="space-y-2">
                    {captureExplanation.cors.issues.map((issue, i) => (
                      <li key={i} className="text-yellow-200 text-sm">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Diff Explanation View
  if (mode === 'diff' && diffExplanation) {
    return (
      <div className={`bg-gray-800 rounded-lg ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Diff Analysis</h3>
          </div>
          <button
            onClick={handleSaveInsight}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Save Insight
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
            <p className="text-white">{diffExplanation.summary}</p>
          </div>

          {diffExplanation.headerDifferences && diffExplanation.headerDifferences.length > 0 && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Header Differences</h4>
              <div className="space-y-2">
                {diffExplanation.headerDifferences.map((diff, i) => (
                  <div key={i} className="flex items-start justify-between p-2 bg-gray-600/50 rounded">
                    <div>
                      <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${
                        diff.type === 'added' ? 'bg-green-600/20 text-green-400' :
                        diff.type === 'removed' ? 'bg-red-600/20 text-red-400' :
                        'bg-yellow-600/20 text-yellow-400'
                      }`}>
                        {diff.type.toUpperCase()}
                      </span>
                      <span className="text-white font-mono text-sm">{diff.header}</span>
                      <p className="text-gray-400 text-xs mt-1">{diff.explanation}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      diff.significance === 'high' ? 'bg-red-600/20 text-red-400' :
                      diff.significance === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-gray-600 text-gray-400'
                    }`}>
                      {diff.significance}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diffExplanation.bodyDifferences && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Body Differences</h4>
              <p className="text-white text-sm">{diffExplanation.bodyDifferences.explanation}</p>
              {diffExplanation.bodyDifferences.keyDifferences && (
                <div className="mt-2">
                  <p className="text-gray-400 text-xs mb-1">Key changes:</p>
                  <ul className="space-y-1">
                    {diffExplanation.bodyDifferences.keyDifferences.map((diff, i) => (
                      <li key={i} className="text-gray-300 text-xs font-mono">{diff}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {diffExplanation.timingDifferences && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Timing Differences</h4>
              <p className="text-white text-sm">{diffExplanation.timingDifferences.explanation}</p>
              {diffExplanation.timingDifferences.possibleCauses.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {diffExplanation.timingDifferences.possibleCauses.map((cause, i) => (
                    <li key={i} className="text-gray-400 text-xs">• {cause}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {diffExplanation.recommendations.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-400 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {diffExplanation.recommendations.map((rec, i) => (
                  <li key={i} className="text-blue-200 text-sm">• {rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Generated Tests View
  if (mode === 'tests' && generatedTests.length > 0) {
    return (
      <div className={`bg-gray-800 rounded-lg ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Generated Tests</h3>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value as typeof selectedFramework)}
              className="px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-600"
            >
              <option value="vitest">Vitest</option>
              <option value="jest">Jest</option>
              <option value="mocha">Mocha</option>
              <option value="playwright">Playwright</option>
            </select>
            <button
              onClick={handleSaveInsight}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Save Tests
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {generatedTests.map((test, i) => (
            <div key={i} className="bg-gray-700/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-gray-600">
                <div>
                  <h4 className="text-sm font-medium text-white">{test.name}</h4>
                  <p className="text-gray-400 text-xs mt-0.5">{test.description}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(test.code)}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <pre className="p-3 text-xs text-gray-300 overflow-x-auto">
                <code>{test.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <p className="text-gray-400 text-center">No data to analyze</p>
    </div>
  );
};

// Helper Components
const SecurityBadge: React.FC<{ label: string; enabled?: boolean }> = ({ label, enabled }) => (
  <div className={`flex items-center justify-between p-2 rounded ${
    enabled ? 'bg-green-600/20' : 'bg-gray-600/50'
  }`}>
    <span className="text-sm text-gray-300">{label}</span>
    {enabled ? (
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )}
  </div>
);

const CookieBadge: React.FC<{ label: string; enabled: boolean }> = ({ label, enabled }) => (
  <span className={`px-2 py-0.5 text-xs rounded ${
    enabled ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
  }`}>
    {enabled ? '✓' : '✗'} {label}
  </span>
);

export default AIInsightsPanel;