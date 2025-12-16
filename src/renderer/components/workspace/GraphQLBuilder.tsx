/**
 * GraphQL Builder Component
 * 
 * UI for building and executing GraphQL queries, mutations, and subscriptions
 * with schema introspection and variables support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  RefreshCw,
  Code,
  FileJson,
  Settings,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Braces,
  List,
  Search,
  BookOpen,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { KeyValueEditor } from './KeyValueEditor';
import type { KeyValuePair } from '../../stores';
import {
  executeGraphQL,
  fetchSchema,
  parseQuery,
  formatQuery,
  getTypeName,
  GraphQLSchema,
  GraphQLResponse,
  GraphQLType,
  GraphQLField,
} from '../../services/graphql';

// Types
interface GraphQLBuilderProps {
  requestId: string;
  initialUrl?: string;
  initialQuery?: string;
  initialVariables?: string;
  initialHeaders?: KeyValuePair[];
  onQueryChange?: (query: string) => void;
  onVariablesChange?: (variables: string) => void;
}

type ActiveTab = 'query' | 'variables' | 'headers';
type ResponseTab = 'response' | 'docs';

export const GraphQLBuilder: React.FC<GraphQLBuilderProps> = ({
  requestId,
  initialUrl = '',
  initialQuery = '',
  initialVariables = '{}',
  initialHeaders = [],
  onQueryChange,
  onVariablesChange,
}) => {
  // State
  const [url, setUrl] = useState(initialUrl);
  const [query, setQuery] = useState(initialQuery);
  const [variables, setVariables] = useState(initialVariables);
  const [headers, setHeaders] = useState<KeyValuePair[]>(initialHeaders);
  const [activeTab, setActiveTab] = useState<ActiveTab>('query');
  const [responseTab, setResponseTab] = useState<ResponseTab>('response');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<GraphQLResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);
  const [schema, setSchema] = useState<GraphQLSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [selectedType, setSelectedType] = useState<GraphQLType | null>(null);
  const [docsSearchQuery, setDocsSearchQuery] = useState('');

  // Parse query info
  const queryInfo = parseQuery(query);

  // Handle query change
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    onQueryChange?.(newQuery);
  };

  // Handle variables change
  const handleVariablesChange = (newVariables: string) => {
    setVariables(newVariables);
    onVariablesChange?.(newVariables);
  };

  // Format query
  const handleFormatQuery = () => {
    const formatted = formatQuery(query);
    handleQueryChange(formatted);
  };

  // Execute query
  const handleExecute = async () => {
    if (!url.trim()) {
      setError('Please enter a GraphQL endpoint URL');
      return;
    }

    if (!query.trim()) {
      setError('Please enter a GraphQL query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    // Parse variables
    let parsedVariables: Record<string, unknown> | undefined;
    if (variables.trim() && variables.trim() !== '{}') {
      try {
        parsedVariables = JSON.parse(variables);
      } catch {
        setError('Invalid JSON in variables');
        setIsLoading(false);
        return;
      }
    }

    // Build headers object
    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        headersObj[h.key] = h.value;
      }
    });

    const result = await executeGraphQL({
      id: requestId,
      url: url.trim(),
      query,
      variables: parsedVariables,
      operationName: queryInfo.operationName,
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
    });

    setIsLoading(false);

    if (result.timing) {
      setTiming(result.timing.duration);
    }

    if (result.response) {
      setResponse(result.response);
      if (result.response.errors && result.response.errors.length > 0) {
        setError(result.response.errors.map((e) => e.message).join('\n'));
      }
    } else if (result.error) {
      setError(result.error);
    }
  };

  // Fetch schema
  const handleFetchSchema = async () => {
    if (!url.trim()) {
      setSchemaError('Please enter a GraphQL endpoint URL');
      return;
    }

    setIsLoadingSchema(true);
    setSchemaError(null);

    // Build headers object
    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        headersObj[h.key] = h.value;
      }
    });

    const result = await fetchSchema(
      url.trim(),
      Object.keys(headersObj).length > 0 ? headersObj : undefined
    );

    setIsLoadingSchema(false);

    if (result.success && result.schema) {
      setSchema(result.schema);
      setShowDocs(true);
    } else {
      setSchemaError(result.error || 'Failed to fetch schema');
    }
  };

  // Copy response to clipboard
  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    }
  };

  // Download response
  const downloadResponse = () => {
    if (response) {
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graphql-response-${requestId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filter types for docs
  const filteredTypes = schema?.types.filter((type) => {
    // Filter out internal types
    if (type.name.startsWith('__')) return false;
    // Filter by search query
    if (docsSearchQuery) {
      return type.name.toLowerCase().includes(docsSearchQuery.toLowerCase());
    }
    return true;
  }) || [];

  // Get operation type color
  const getOperationColor = () => {
    switch (queryInfo.operationType) {
      case 'query':
        return 'text-blue-400';
      case 'mutation':
        return 'text-orange-400';
      case 'subscription':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      {/* URL Bar */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center space-x-2">
          {/* Operation Type Badge */}
          {queryInfo.operationType && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded uppercase ${getOperationColor()} bg-dark-surface`}
            >
              {queryInfo.operationType}
            </span>
          )}

          {/* URL Input */}
          <div className="flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/graphql"
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecute}
            disabled={isLoading}
            className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{isLoading ? 'Running...' : 'Run'}</span>
          </button>

          {/* Schema Button */}
          <button
            onClick={handleFetchSchema}
            disabled={isLoadingSchema}
            className="px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg transition-colors flex items-center space-x-2"
            title="Fetch Schema"
          >
            {isLoadingSchema ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Error Message */}
        {(error || schemaError) && (
          <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <pre className="flex-1 whitespace-pre-wrap">{error || schemaError}</pre>
            <button
              onClick={() => {
                setError(null);
                setSchemaError(null);
              }}
              className="flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Query Editor */}
        <div className="flex-1 flex flex-col border-r border-dark-border">
          {/* Tabs */}
          <div className="flex items-center border-b border-dark-border">
            <button
              onClick={() => setActiveTab('query')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'query'
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4" />
                <span>Query</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'variables'
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Braces className="w-4 h-4" />
                <span>Variables</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'headers'
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <List className="w-4 h-4" />
                <span>Headers</span>
              </div>
            </button>

            <div className="flex-1" />

            {/* Format Button */}
            {activeTab === 'query' && (
              <button
                onClick={handleFormatQuery}
                className="px-3 py-1 mr-2 text-xs text-gray-400 hover:text-gray-200 bg-dark-surface rounded"
                title="Format Query"
              >
                Format
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'query' && (
              <textarea
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={`# Enter your GraphQL query here
query {
  users {
    id
    name
    email
  }
}`}
                className="w-full h-full p-4 bg-dark-bg text-gray-200 font-mono text-sm resize-none focus:outline-none placeholder-gray-600"
                spellCheck={false}
              />
            )}

            {activeTab === 'variables' && (
              <textarea
                value={variables}
                onChange={(e) => handleVariablesChange(e.target.value)}
                placeholder='{ "key": "value" }'
                className="w-full h-full p-4 bg-dark-bg text-gray-200 font-mono text-sm resize-none focus:outline-none placeholder-gray-600"
                spellCheck={false}
              />
            )}

            {activeTab === 'headers' && (
              <div className="p-4">
                <KeyValueEditor
                  items={headers}
                  onChange={setHeaders}
                  keyPlaceholder="Header name"
                  valuePlaceholder="Header value"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Response / Docs */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="flex items-center border-b border-dark-border">
            <button
              onClick={() => setResponseTab('response')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                responseTab === 'response'
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileJson className="w-4 h-4" />
                <span>Response</span>
                {timing !== null && (
                  <span className="text-xs text-gray-500">{timing}ms</span>
                )}
              </div>
            </button>
            {schema && (
              <button
                onClick={() => setResponseTab('docs')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  responseTab === 'docs'
                    ? 'text-accent-blue border-b-2 border-accent-blue'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Docs</span>
                </div>
              </button>
            )}

            <div className="flex-1" />

            {/* Response Actions */}
            {responseTab === 'response' && response && (
              <div className="flex items-center space-x-1 mr-2">
                <button
                  onClick={copyResponse}
                  className="p-1.5 text-gray-400 hover:text-gray-200"
                  title="Copy response"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadResponse}
                  className="p-1.5 text-gray-400 hover:text-gray-200"
                  title="Download response"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {responseTab === 'response' && (
              <div className="h-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : response ? (
                  <pre className="p-4 text-sm font-mono text-gray-200 whitespace-pre-wrap">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Play className="w-12 h-12 mb-4 opacity-50" />
                    <p>Run a query to see the response</p>
                  </div>
                )}
              </div>
            )}

            {responseTab === 'docs' && schema && (
              <div className="h-full flex">
                {/* Types List */}
                <div className="w-64 border-r border-dark-border overflow-y-auto">
                  {/* Search */}
                  <div className="p-2 border-b border-dark-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={docsSearchQuery}
                        onChange={(e) => setDocsSearchQuery(e.target.value)}
                        placeholder="Search types..."
                        className="w-full pl-8 pr-2 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                      />
                    </div>
                  </div>

                  {/* Root Types */}
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Root Types
                    </h3>
                    {schema.queryType && (
                      <button
                        onClick={() =>
                          setSelectedType(
                            schema.types.find((t) => t.name === schema.queryType?.name) ||
                              null
                          )
                        }
                        className="w-full text-left px-2 py-1 text-sm text-blue-400 hover:bg-dark-surface rounded"
                      >
                        Query
                      </button>
                    )}
                    {schema.mutationType && (
                      <button
                        onClick={() =>
                          setSelectedType(
                            schema.types.find(
                              (t) => t.name === schema.mutationType?.name
                            ) || null
                          )
                        }
                        className="w-full text-left px-2 py-1 text-sm text-orange-400 hover:bg-dark-surface rounded"
                      >
                        Mutation
                      </button>
                    )}
                    {schema.subscriptionType && (
                      <button
                        onClick={() =>
                          setSelectedType(
                            schema.types.find(
                              (t) => t.name === schema.subscriptionType?.name
                            ) || null
                          )
                        }
                        className="w-full text-left px-2 py-1 text-sm text-purple-400 hover:bg-dark-surface rounded"
                      >
                        Subscription
                      </button>
                    )}
                  </div>

                  {/* All Types */}
                  <div className="p-2 border-t border-dark-border">
                    <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Types
                    </h3>
                    {filteredTypes.map((type) => (
                      <button
                        key={type.name}
                        onClick={() => setSelectedType(type)}
                        className={`w-full text-left px-2 py-1 text-sm rounded truncate ${
                          selectedType?.name === type.name
                            ? 'bg-accent-blue/20 text-accent-blue'
                            : 'text-gray-300 hover:bg-dark-surface'
                        }`}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Details */}
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedType ? (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-200 mb-2">
                        {selectedType.name}
                      </h2>
                      {selectedType.description && (
                        <p className="text-sm text-gray-400 mb-4">
                          {selectedType.description}
                        </p>
                      )}

                      {/* Fields */}
                      {selectedType.fields && selectedType.fields.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-400 mb-2">
                            Fields
                          </h3>
                          <div className="space-y-2">
                            {selectedType.fields.map((field) => (
                              <div
                                key={field.name}
                                className="p-2 bg-dark-surface rounded border border-dark-border"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="text-accent-blue font-mono text-sm">
                                    {field.name}
                                  </span>
                                  {field.args.length > 0 && (
                                    <span className="text-gray-500 text-xs">
                                      ({field.args.length} args)
                                    </span>
                                  )}
                                  <span className="text-gray-500">:</span>
                                  <span className="text-green-400 font-mono text-sm">
                                    {getTypeName(field.type)}
                                  </span>
                                  {field.isDeprecated && (
                                    <span className="px-1 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                                      Deprecated
                                    </span>
                                  )}
                                </div>
                                {field.description && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {field.description}
                                  </p>
                                )}
                                {field.deprecationReason && (
                                  <p className="text-xs text-yellow-400 mt-1">
                                    Reason: {field.deprecationReason}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Enum Values */}
                      {selectedType.enumValues &&
                        selectedType.enumValues.length > 0 && (
                          <div className="mt-4">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">
                              Enum Values
                            </h3>
                            <div className="space-y-1">
                              {selectedType.enumValues.map((value) => (
                                <div
                                  key={value.name}
                                  className="px-2 py-1 bg-dark-surface rounded"
                                >
                                  <span className="text-purple-400 font-mono text-sm">
                                    {value.name}
                                  </span>
                                  {value.description && (
                                    <span className="text-xs text-gray-500 ml-2">
                                      - {value.description}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Input Fields */}
                      {selectedType.inputFields &&
                        selectedType.inputFields.length > 0 && (
                          <div className="mt-4">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">
                              Input Fields
                            </h3>
                            <div className="space-y-2">
                              {selectedType.inputFields.map((field) => (
                                <div
                                  key={field.name}
                                  className="p-2 bg-dark-surface rounded border border-dark-border"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-accent-blue font-mono text-sm">
                                      {field.name}
                                    </span>
                                    <span className="text-gray-500">:</span>
                                    <span className="text-green-400 font-mono text-sm">
                                      {getTypeName(field.type)}
                                    </span>
                                  </div>
                                  {field.description && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {field.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <BookOpen className="w-12 h-12 mb-4 opacity-50" />
                      <p>Select a type to view its documentation</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphQLBuilder;