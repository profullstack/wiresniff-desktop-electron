/**
 * WebSocket Builder Component
 * 
 * UI for managing WebSocket connections, sending messages,
 * and viewing message history.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plug,
  Unplug,
  Send,
  Trash2,
  Copy,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { KeyValueEditor } from './KeyValueEditor';
import type { KeyValuePair } from '../../stores';
import {
  connect,
  disconnect,
  send,
  onStateChange,
  onMessage,
  onReconnecting,
  removeAllListeners,
  WebSocketConnectionState,
  WebSocketMessage,
} from '../../services/websocket';

// Types
interface WebSocketBuilderProps {
  connectionId: string;
  initialUrl?: string;
  initialHeaders?: KeyValuePair[];
  onConnectionChange?: (state: WebSocketConnectionState) => void;
}

type MessageFormat = 'text' | 'json' | 'binary';

interface FormattedMessage extends WebSocketMessage {
  formattedData?: string;
  isExpanded?: boolean;
}

// Status color mapping
const statusColors: Record<string, string> = {
  connecting: 'text-yellow-400',
  connected: 'text-green-400',
  disconnecting: 'text-yellow-400',
  disconnected: 'text-gray-400',
  error: 'text-red-400',
};

const statusBgColors: Record<string, string> = {
  connecting: 'bg-yellow-500/20',
  connected: 'bg-green-500/20',
  disconnecting: 'bg-yellow-500/20',
  disconnected: 'bg-gray-500/20',
  error: 'bg-red-500/20',
};

export const WebSocketBuilder: React.FC<WebSocketBuilderProps> = ({
  connectionId,
  initialUrl = '',
  initialHeaders = [],
  onConnectionChange,
}) => {
  // State
  const [url, setUrl] = useState(initialUrl);
  const [headers, setHeaders] = useState<KeyValuePair[]>(initialHeaders);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState | null>(null);
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [messageFormat, setMessageFormat] = useState<MessageFormat>('text');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sent' | 'received'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Set up event listeners
  useEffect(() => {
    const unsubscribeState = onStateChange(connectionId, (state) => {
      setConnectionState(state);
      setIsConnecting(state.status === 'connecting');
      if (state.status === 'error') {
        setError(state.error || 'Connection error');
      } else {
        setError(null);
      }
      onConnectionChange?.(state);
    });

    const unsubscribeMessage = onMessage(connectionId, (message) => {
      const formattedMessage: FormattedMessage = {
        ...message,
        formattedData: formatMessageData(message.data),
        isExpanded: false,
      };
      setMessages((prev) => [...prev, formattedMessage]);
    });

    const unsubscribeReconnecting = onReconnecting(connectionId, (data) => {
      setReconnectAttempt(data.attempt);
    });

    return () => {
      unsubscribeState();
      unsubscribeMessage();
      unsubscribeReconnecting();
    };
  }, [connectionId, onConnectionChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeAllListeners(connectionId);
    };
  }, [connectionId]);

  // Format message data for display
  const formatMessageData = (data: string | ArrayBuffer): string => {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    return `[Binary data: ${(data as ArrayBuffer).byteLength} bytes]`;
  };

  // Handle connect
  const handleConnect = async () => {
    if (!url.trim()) {
      setError('Please enter a WebSocket URL');
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Build headers object
    const headersObj: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        headersObj[h.key] = h.value;
      }
    });

    const result = await connect({
      connectionId,
      url: url.trim(),
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      autoReconnect,
    });

    if (!result.success) {
      setError(result.error || 'Connection failed');
      setIsConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    await disconnect(connectionId);
    setReconnectAttempt(null);
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || connectionState?.status !== 'connected') {
      return;
    }

    let data: string | ArrayBuffer = messageInput;

    // Validate JSON if format is JSON
    if (messageFormat === 'json') {
      try {
        JSON.parse(messageInput);
      } catch {
        setError('Invalid JSON format');
        return;
      }
    }

    const result = await send(connectionId, data, { binary: messageFormat === 'binary' });

    if (result.success) {
      setMessageInput('');
      setError(null);
    } else {
      setError(result.error || 'Failed to send message');
    }
  };

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear messages
  const clearMessages = () => {
    setMessages([]);
  };

  // Copy message to clipboard
  const copyMessage = (message: FormattedMessage) => {
    const text = message.formattedData || String(message.data);
    navigator.clipboard.writeText(text);
  };

  // Toggle message expansion
  const toggleMessageExpansion = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isExpanded: !m.isExpanded } : m
      )
    );
  };

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) {
      return false;
    }
    if (filterText) {
      const text = m.formattedData || String(m.data);
      return text.toLowerCase().includes(filterText.toLowerCase());
    }
    return true;
  });

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Download messages as JSON
  const downloadMessages = () => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `websocket-messages-${connectionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isConnected = connectionState?.status === 'connected';
  const isDisconnected = !connectionState || connectionState.status === 'disconnected';

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      {/* Connection Bar */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center space-x-2">
          {/* URL Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://example.com/socket"
              disabled={isConnected || isConnecting}
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue disabled:opacity-50"
            />
            {connectionState && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2 ${statusColors[connectionState.status]}`}
              >
                {connectionState.status === 'connecting' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {connectionState.status === 'connected' && (
                  <CheckCircle className="w-4 h-4" />
                )}
                {connectionState.status === 'error' && (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="text-xs capitalize">{connectionState.status}</span>
              </div>
            )}
          </div>

          {/* Connect/Disconnect Button */}
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Unplug className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plug className="w-4 h-4" />
              )}
              <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-surface'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reconnecting Message */}
        {reconnectAttempt !== null && (
          <div className="mt-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Reconnecting... Attempt {reconnectAttempt}</span>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-dark-surface rounded-lg border border-dark-border">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Connection Settings</h3>

            {/* Auto Reconnect */}
            <label className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
                disabled={isConnected}
                className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-gray-300">Auto-reconnect on disconnect</span>
            </label>

            {/* Headers */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Headers</h4>
              <KeyValueEditor
                pairs={headers}
                onChange={setHeaders}
                disabled={isConnected}
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </div>
          </div>
        )}
      </div>

      {/* Connection Stats */}
      {connectionState && connectionState.status === 'connected' && (
        <div className="px-4 py-2 bg-dark-surface border-b border-dark-border flex items-center space-x-6 text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>
              Connected {connectionState.connectedAt
                ? new Date(connectionState.connectedAt).toLocaleTimeString()
                : ''}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <ArrowUp className="w-3 h-3 text-green-400" />
            <span>{connectionState.messageCount.sent} sent</span>
          </div>
          <div className="flex items-center space-x-1">
            <ArrowDown className="w-3 h-3 text-blue-400" />
            <span>{connectionState.messageCount.received} received</span>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Message Toolbar */}
        <div className="px-4 py-2 border-b border-dark-border flex items-center space-x-2">
          {/* Filter Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter messages..."
              className="w-full pl-9 pr-4 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-gray-200 focus:outline-none focus:border-accent-blue"
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
          </select>

          {/* Actions */}
          <button
            onClick={downloadMessages}
            disabled={messages.length === 0}
            className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-50"
            title="Download messages"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearMessages}
            disabled={messages.length === 0}
            className="p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-50"
            title="Clear messages"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {messages.length === 0 ? (
                <>
                  <Plug className="w-12 h-12 mb-4 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">
                    {isConnected
                      ? 'Send a message to get started'
                      : 'Connect to start sending messages'}
                  </p>
                </>
              ) : (
                <>
                  <Filter className="w-12 h-12 mb-4 opacity-50" />
                  <p>No messages match your filter</p>
                </>
              )}
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border ${
                  message.type === 'sent'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                }`}
              >
                {/* Message Header */}
                <div
                  className="px-3 py-2 flex items-center space-x-2 cursor-pointer"
                  onClick={() => toggleMessageExpansion(message.id)}
                >
                  {message.isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      message.type === 'sent' ? 'text-green-400' : 'text-blue-400'
                    }`}
                  >
                    {message.type === 'sent' ? '↑ SENT' : '↓ RECEIVED'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(message.timestamp)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {message.dataType === 'binary'
                      ? `Binary (${(message.data as ArrayBuffer).byteLength} bytes)`
                      : `${String(message.data).length} chars`}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyMessage(message);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-200"
                    title="Copy message"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {/* Message Content */}
                {message.isExpanded && (
                  <div className="px-3 pb-3">
                    <pre className="p-2 bg-dark-bg rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {message.formattedData || String(message.data)}
                    </pre>
                  </div>
                )}

                {/* Collapsed Preview */}
                {!message.isExpanded && (
                  <div className="px-3 pb-2">
                    <p className="text-xs text-gray-400 truncate">
                      {String(message.data).substring(0, 100)}
                      {String(message.data).length > 100 && '...'}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-dark-border">
        <div className="flex items-start space-x-2">
          {/* Format Selector */}
          <select
            value={messageFormat}
            onChange={(e) => setMessageFormat(e.target.value as MessageFormat)}
            disabled={!isConnected}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent-blue disabled:opacity-50"
          >
            <option value="text">Text</option>
            <option value="json">JSON</option>
            <option value="binary">Binary</option>
          </select>

          {/* Message Input */}
          <div className="flex-1">
            <textarea
              ref={messageInputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                isConnected
                  ? 'Type a message... (Ctrl+Enter to send)'
                  : 'Connect to send messages'
              }
              disabled={!isConnected}
              rows={3}
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue disabled:opacity-50 resize-none font-mono text-sm"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !messageInput.trim()}
            className="px-4 py-2 bg-accent-blue hover:bg-cyan-400 text-dark-bg font-medium rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>

        {/* Format Hint */}
        {messageFormat === 'json' && messageInput && (
          <div className="mt-2 text-xs text-gray-500">
            {(() => {
              try {
                JSON.parse(messageInput);
                return (
                  <span className="text-green-400 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Valid JSON</span>
                  </span>
                );
              } catch {
                return (
                  <span className="text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Invalid JSON</span>
                  </span>
                );
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebSocketBuilder;