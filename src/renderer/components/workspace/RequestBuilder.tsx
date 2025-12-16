/**
 * RequestBuilder Component
 * 
 * The main request editing interface with tabs for params, headers, body, auth, and scripts.
 */

import React, { useState, useCallback } from 'react';
import { useTabStore, type Tab, type HttpRequest, type KeyValuePair, type BodyType, type AuthType } from '../../stores';
import { KeyValueEditor } from './KeyValueEditor';
import { nanoid } from 'nanoid';

// HTTP method colors
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-success/20 text-success border-success/30',
  POST: 'bg-warning/20 text-warning border-warning/30',
  PUT: 'bg-info/20 text-info border-info/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DELETE: 'bg-error/20 text-error border-error/30',
  HEAD: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  OPTIONS: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// Request tabs
type RequestTab = 'params' | 'headers' | 'body' | 'auth' | 'scripts';

interface RequestBuilderProps {
  tab: Tab;
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({ tab }) => {
  const { updateHttpRequest } = useTabStore();
  const [activeTab, setActiveTab] = useState<RequestTab>('params');
  const [bodyType, setBodyType] = useState<BodyType>(tab.httpRequest?.body.type || 'none');

  const request = tab.httpRequest;
  if (!request) return null;

  // Update request method
  const handleMethodChange = useCallback((method: string) => {
    updateHttpRequest(tab.id, { method: method as HttpRequest['method'] });
  }, [tab.id, updateHttpRequest]);

  // Update request URL
  const handleUrlChange = useCallback((url: string) => {
    updateHttpRequest(tab.id, { url });
  }, [tab.id, updateHttpRequest]);

  // Update params
  const handleParamsChange = useCallback((params: KeyValuePair[]) => {
    updateHttpRequest(tab.id, { params });
  }, [tab.id, updateHttpRequest]);

  // Update headers
  const handleHeadersChange = useCallback((headers: KeyValuePair[]) => {
    updateHttpRequest(tab.id, { headers });
  }, [tab.id, updateHttpRequest]);

  // Update body
  const handleBodyChange = useCallback((body: Partial<HttpRequest['body']>) => {
    updateHttpRequest(tab.id, { 
      body: { ...request.body, ...body } 
    });
  }, [tab.id, request.body, updateHttpRequest]);

  // Update auth
  const handleAuthChange = useCallback((auth: Partial<HttpRequest['auth']>) => {
    updateHttpRequest(tab.id, { 
      auth: { ...request.auth, ...auth } 
    });
  }, [tab.id, request.auth, updateHttpRequest]);

  // Count enabled items for badges
  const enabledParamsCount = request.params.filter(p => p.enabled && p.key).length;
  const enabledHeadersCount = request.headers.filter(h => h.enabled && h.key).length;

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="p-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          {/* Method selector */}
          <select
            value={request.method}
            onChange={(e) => handleMethodChange(e.target.value)}
            className={`px-3 py-2.5 rounded-lg font-bold text-sm border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${METHOD_COLORS[request.method]}`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>

          {/* URL input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={request.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Enter request URL (e.g., https://api.example.com/users)"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {/* URL validation indicator */}
            {request.url && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {request.url.startsWith('http://') || request.url.startsWith('https://') ? (
                  <span className="text-success text-xs">✓</span>
                ) : (
                  <span className="text-warning text-xs" title="URL should start with http:// or https://">⚠</span>
                )}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            disabled={tab.isLoading || !request.url}
            className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            {tab.isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Send
              </>
            )}
          </button>

          {/* Save button */}
          <button
            className="p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            title="Save request"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Request tabs */}
      <div className="flex border-b border-border bg-surface">
        {[
          { id: 'params' as const, label: 'Params', count: enabledParamsCount },
          { id: 'headers' as const, label: 'Headers', count: enabledHeadersCount },
          { id: 'body' as const, label: 'Body' },
          { id: 'auth' as const, label: 'Auth' },
          { id: 'scripts' as const, label: 'Scripts' },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setActiveTab(tabItem.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tabItem.id
                ? 'text-primary border-primary'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border'
            }`}
          >
            {tabItem.label}
            {tabItem.count !== undefined && tabItem.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                {tabItem.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4 bg-background">
        {/* Params tab */}
        {activeTab === 'params' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">Query Parameters</h3>
              <span className="text-xs text-text-muted">
                Parameters will be appended to the URL
              </span>
            </div>
            <KeyValueEditor
              items={request.params}
              onChange={handleParamsChange}
              keyPlaceholder="Parameter"
              valuePlaceholder="Value"
              showDescription
            />
          </div>
        )}

        {/* Headers tab */}
        {activeTab === 'headers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">Request Headers</h3>
              <button className="text-xs text-primary hover:underline">
                Add common headers
              </button>
            </div>
            <KeyValueEditor
              items={request.headers}
              onChange={handleHeadersChange}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
              showDescription
            />
          </div>
        )}

        {/* Body tab */}
        {activeTab === 'body' && (
          <div>
            {/* Body type selector */}
            <div className="flex items-center gap-4 mb-4">
              {[
                { id: 'none' as const, label: 'None' },
                { id: 'json' as const, label: 'JSON' },
                { id: 'form-data' as const, label: 'Form Data' },
                { id: 'x-www-form-urlencoded' as const, label: 'URL Encoded' },
                { id: 'raw' as const, label: 'Raw' },
                { id: 'binary' as const, label: 'Binary' },
              ].map((type) => (
                <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={request.body.type === type.id}
                    onChange={() => handleBodyChange({ type: type.id })}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">{type.label}</span>
                </label>
              ))}
            </div>

            {/* Body content based on type */}
            {request.body.type === 'none' && (
              <div className="text-center py-12 text-text-muted">
                <p>This request does not have a body</p>
              </div>
            )}

            {request.body.type === 'json' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted">application/json</span>
                  <button className="text-xs text-primary hover:underline">
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={request.body.raw || ''}
                  onChange={(e) => handleBodyChange({ raw: e.target.value, rawType: 'json' })}
                  placeholder='{\n  "key": "value"\n}'
                  className="w-full h-64 p-3 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {request.body.type === 'form-data' && (
              <KeyValueEditor
                items={request.body.formData || []}
                onChange={(formData) => handleBodyChange({ formData })}
                keyPlaceholder="Key"
                valuePlaceholder="Value"
                showDescription
              />
            )}

            {request.body.type === 'x-www-form-urlencoded' && (
              <KeyValueEditor
                items={request.body.urlencoded || []}
                onChange={(urlencoded) => handleBodyChange({ urlencoded })}
                keyPlaceholder="Key"
                valuePlaceholder="Value"
              />
            )}

            {request.body.type === 'raw' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-text-muted">Content type:</span>
                  <select
                    value={request.body.rawType || 'text'}
                    onChange={(e) => handleBodyChange({ rawType: e.target.value as any })}
                    className="px-2 py-1 text-xs bg-surface border border-border rounded text-text-primary"
                  >
                    <option value="text">Text</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
                <textarea
                  value={request.body.raw || ''}
                  onChange={(e) => handleBodyChange({ raw: e.target.value })}
                  placeholder="Enter raw body content..."
                  className="w-full h-64 p-3 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {request.body.type === 'binary' && (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-text-muted mb-2">Drag and drop a file here, or</p>
                <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
                  Select File
                </button>
              </div>
            )}
          </div>
        )}

        {/* Auth tab */}
        {activeTab === 'auth' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm text-text-primary">Type:</span>
              <select
                value={request.auth.type}
                onChange={(e) => handleAuthChange({ type: e.target.value as AuthType })}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="none">No Auth</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="api-key">API Key</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>

            {request.auth.type === 'none' && (
              <div className="text-center py-12 text-text-muted">
                <p>This request does not use any authorization</p>
              </div>
            )}

            {request.auth.type === 'basic' && (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Username</label>
                  <input
                    type="text"
                    value={request.auth.basic?.username || ''}
                    onChange={(e) => handleAuthChange({ 
                      basic: { ...request.auth.basic, username: e.target.value, password: request.auth.basic?.password || '' } 
                    })}
                    placeholder="Enter username"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Password</label>
                  <input
                    type="password"
                    value={request.auth.basic?.password || ''}
                    onChange={(e) => handleAuthChange({ 
                      basic: { ...request.auth.basic, password: e.target.value, username: request.auth.basic?.username || '' } 
                    })}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {request.auth.type === 'bearer' && (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Token</label>
                  <textarea
                    value={request.auth.bearer?.token || ''}
                    onChange={(e) => handleAuthChange({ 
                      bearer: { ...request.auth.bearer, token: e.target.value } 
                    })}
                    placeholder="Enter bearer token"
                    rows={3}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-primary resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Prefix (optional)</label>
                  <input
                    type="text"
                    value={request.auth.bearer?.prefix || 'Bearer'}
                    onChange={(e) => handleAuthChange({ 
                      bearer: { ...request.auth.bearer, prefix: e.target.value, token: request.auth.bearer?.token || '' } 
                    })}
                    placeholder="Bearer"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {request.auth.type === 'api-key' && (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Key</label>
                  <input
                    type="text"
                    value={request.auth.apiKey?.key || ''}
                    onChange={(e) => handleAuthChange({ 
                      apiKey: { ...request.auth.apiKey, key: e.target.value, value: request.auth.apiKey?.value || '', addTo: request.auth.apiKey?.addTo || 'header' } 
                    })}
                    placeholder="X-API-Key"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Value</label>
                  <input
                    type="text"
                    value={request.auth.apiKey?.value || ''}
                    onChange={(e) => handleAuthChange({ 
                      apiKey: { ...request.auth.apiKey, value: e.target.value, key: request.auth.apiKey?.key || '', addTo: request.auth.apiKey?.addTo || 'header' } 
                    })}
                    placeholder="Enter API key value"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Add to</label>
                  <select
                    value={request.auth.apiKey?.addTo || 'header'}
                    onChange={(e) => handleAuthChange({ 
                      apiKey: { ...request.auth.apiKey, addTo: e.target.value as 'header' | 'query', key: request.auth.apiKey?.key || '', value: request.auth.apiKey?.value || '' } 
                    })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Params</option>
                  </select>
                </div>
              </div>
            )}

            {request.auth.type === 'oauth2' && (
              <div className="text-center py-12 text-text-muted">
                <p>OAuth 2.0 configuration coming soon...</p>
              </div>
            )}
          </div>
        )}

        {/* Scripts tab */}
        {activeTab === 'scripts' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-text-primary">Pre-request Script</h3>
                <span className="text-xs text-text-muted">Runs before the request is sent</span>
              </div>
              <textarea
                value={request.preRequestScript || ''}
                onChange={(e) => updateHttpRequest(tab.id, { preRequestScript: e.target.value })}
                placeholder="// JavaScript code to run before the request&#10;// Example: pm.environment.set('timestamp', Date.now());"
                className="w-full h-40 p-3 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-text-primary">Test Script</h3>
                <span className="text-xs text-text-muted">Runs after the response is received</span>
              </div>
              <textarea
                value={request.testScript || ''}
                onChange={(e) => updateHttpRequest(tab.id, { testScript: e.target.value })}
                placeholder="// JavaScript code to test the response&#10;// Example: pm.test('Status is 200', () => pm.response.to.have.status(200));"
                className="w-full h-40 p-3 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestBuilder;