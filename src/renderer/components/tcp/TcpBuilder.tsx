/**
 * TcpBuilder Component
 *
 * UI component for raw TCP connections with hex/ASCII views,
 * session management, and data history.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

// Types for TCP client (matches main process service)
interface TcpConnection {
  id: string;
  host: string;
  port: number;
  connected: boolean;
  connectedAt: Date;
  bytesReceived: number;
  bytesSent: number;
}

interface DataEntry {
  timestamp: Date;
  direction: 'sent' | 'received';
  data: Buffer | Uint8Array;
  encoding: 'utf8' | 'hex' | 'base64';
}

interface TcpSession {
  id: string;
  connectionId: string;
  host: string;
  port: number;
  startTime: Date;
  endTime?: Date;
  dataHistory: DataEntry[];
  notes?: string;
}

interface TcpBuilderProps {
  onSessionSaved?: (session: TcpSession) => void;
}

type ViewMode = 'ascii' | 'hex' | 'both';
type SendMode = 'text' | 'hex';

export const TcpBuilder: React.FC<TcpBuilderProps> = ({ onSessionSaved }) => {
  // Connection state
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(8080);
  const [connection, setConnection] = useState<TcpConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Data state
  const [dataHistory, setDataHistory] = useState<DataEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [autoScroll, setAutoScroll] = useState(true);

  // Send state
  const [sendMode, setSendMode] = useState<SendMode>('text');
  const [sendData, setSendData] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<TcpSession[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [showSessions, setShowSessions] = useState(false);

  // Refs
  const dataContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && dataContainerRef.current) {
      dataContainerRef.current.scrollTop = dataContainerRef.current.scrollHeight;
    }
  }, [dataHistory, autoScroll]);

  // Connect to server via IPC
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Call main process via IPC
      const result = await window.electron?.ipcRenderer.invoke('tcp:connect', {
        host,
        port,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setConnection(result.connection);
      setDataHistory([]);
    } catch (err) {
      setConnectionError((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  }, [host, port]);

  // Disconnect from server
  const handleDisconnect = useCallback(async () => {
    if (!connection) return;

    try {
      await window.electron?.ipcRenderer.invoke('tcp:disconnect', connection.id);
      setConnection(null);
    } catch (err) {
      setConnectionError((err as Error).message);
    }
  }, [connection]);

  // Listen for incoming data
  useEffect(() => {
    if (!connection) return;

    const handleData = (_event: unknown, data: { connectionId: string; data: number[]; timestamp: string }) => {
      if (data.connectionId !== connection.id) return;

      const entry: DataEntry = {
        timestamp: new Date(data.timestamp),
        direction: 'received',
        data: new Uint8Array(data.data),
        encoding: 'utf8',
      };

      setDataHistory((prev) => [...prev, entry]);
    };

    window.electron?.ipcRenderer.on('tcp:data', handleData);

    return () => {
      window.electron?.ipcRenderer.removeListener('tcp:data', handleData);
    };
  }, [connection]);

  // Send data
  const handleSend = useCallback(async () => {
    if (!connection || !sendData) return;

    setSendError(null);

    try {
      let dataToSend: string | number[];

      if (sendMode === 'hex') {
        // Parse hex string to bytes
        const hexString = sendData.replace(/\s/g, '');
        if (!/^[0-9a-fA-F]*$/.test(hexString) || hexString.length % 2 !== 0) {
          throw new Error('Invalid hex string');
        }

        const bytes: number[] = [];
        for (let i = 0; i < hexString.length; i += 2) {
          bytes.push(parseInt(hexString.substr(i, 2), 16));
        }
        dataToSend = bytes;

        await window.electron?.ipcRenderer.invoke('tcp:sendHex', {
          connectionId: connection.id,
          hexData: hexString,
        });
      } else {
        dataToSend = sendData;
        await window.electron?.ipcRenderer.invoke('tcp:send', {
          connectionId: connection.id,
          data: sendData,
        });
      }

      // Add to history
      const entry: DataEntry = {
        timestamp: new Date(),
        direction: 'sent',
        data:
          sendMode === 'hex'
            ? new Uint8Array(dataToSend as number[])
            : new TextEncoder().encode(dataToSend as string),
        encoding: sendMode === 'hex' ? 'hex' : 'utf8',
      };

      setDataHistory((prev) => [...prev, entry]);
      setSendData('');
    } catch (err) {
      setSendError((err as Error).message);
    }
  }, [connection, sendData, sendMode]);

  // Save session
  const handleSaveSession = useCallback(async () => {
    if (!connection || dataHistory.length === 0) return;

    const session: TcpSession = {
      id: `session-${Date.now()}`,
      connectionId: connection.id,
      host: connection.host,
      port: connection.port,
      startTime: connection.connectedAt,
      endTime: new Date(),
      dataHistory: [...dataHistory],
      notes: sessionNotes || undefined,
    };

    try {
      await window.electron?.ipcRenderer.invoke('tcp:saveSession', session);
      setSessions((prev) => [...prev, session]);
      setSessionNotes('');
      onSessionSaved?.(session);
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }, [connection, dataHistory, sessionNotes, onSessionSaved]);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const result = await window.electron?.ipcRenderer.invoke('tcp:getSessions');
        if (result?.sessions) {
          setSessions(result.sessions);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };

    loadSessions();
  }, []);

  // Format data for display
  const formatData = useCallback(
    (data: Uint8Array | Buffer, mode: ViewMode): { ascii: string; hex: string } => {
      const bytes = Array.from(data);

      const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');

      const ascii = bytes
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');

      return { ascii, hex };
    },
    []
  );

  // Format hex dump with offset
  const formatHexDump = useCallback((data: Uint8Array | Buffer): string => {
    const bytes = Array.from(data);
    const lines: string[] = [];
    const bytesPerLine = 16;

    for (let i = 0; i < bytes.length; i += bytesPerLine) {
      const offset = i.toString(16).padStart(8, '0');
      const chunk = bytes.slice(i, i + bytesPerLine);

      const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const hexPadded = hex.padEnd(bytesPerLine * 3 - 1, ' ');

      const ascii = chunk
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');

      lines.push(`${offset}  ${hexPadded}  |${ascii}|`);
    }

    return lines.join('\n');
  }, []);

  // Clear history
  const handleClearHistory = useCallback(() => {
    setDataHistory([]);
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Raw TCP Client</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
          >
            Sessions ({sessions.length})
          </button>
          <button
            onClick={handleClearHistory}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            disabled={dataHistory.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Connection & Send */}
        <div className="w-80 border-r border-gray-700 flex flex-col">
          {/* Connection Section */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3">Connection</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="Host"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                  disabled={!!connection}
                />
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 0)}
                  placeholder="Port"
                  className="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                  disabled={!!connection}
                />
              </div>
              {connection ? (
                <button
                  onClick={handleDisconnect}
                  className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
              {connectionError && (
                <p className="text-red-400 text-xs">{connectionError}</p>
              )}
              {connection && (
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="text-green-400">
                    Connected to {connection.host}:{connection.port}
                  </p>
                  <p>Sent: {connection.bytesSent} bytes</p>
                  <p>Received: {connection.bytesReceived} bytes</p>
                </div>
              )}
            </div>
          </div>

          {/* Send Section */}
          <div className="p-4 border-b border-gray-700 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Send Data</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setSendMode('text')}
                  className={`px-2 py-1 text-xs rounded ${
                    sendMode === 'text'
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => setSendMode('hex')}
                  className={`px-2 py-1 text-xs rounded ${
                    sendMode === 'hex'
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Hex
                </button>
              </div>
            </div>
            <textarea
              value={sendData}
              onChange={(e) => setSendData(e.target.value)}
              placeholder={
                sendMode === 'hex'
                  ? 'Enter hex bytes (e.g., 48 65 6c 6c 6f)'
                  : 'Enter text to send...'
              }
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono resize-none"
              disabled={!connection}
            />
            {sendError && <p className="text-red-400 text-xs mt-2">{sendError}</p>}
            <button
              onClick={handleSend}
              disabled={!connection || !sendData}
              className="mt-3 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
            >
              Send
            </button>
          </div>

          {/* Save Session Section */}
          {connection && dataHistory.length > 0 && (
            <div className="p-4 border-t border-gray-700">
              <h3 className="text-sm font-medium mb-3">Save Session</h3>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Session notes (optional)..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm h-16 resize-none"
              />
              <button
                onClick={handleSaveSession}
                className="mt-2 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                Save Session
              </button>
            </div>
          )}
        </div>

        {/* Center Panel - Data View */}
        <div className="flex-1 flex flex-col">
          {/* View Mode Controls */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('ascii')}
                className={`px-3 py-1 text-xs rounded ${
                  viewMode === 'ascii'
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                ASCII
              </button>
              <button
                onClick={() => setViewMode('hex')}
                className={`px-3 py-1 text-xs rounded ${
                  viewMode === 'hex'
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Hex
              </button>
              <button
                onClick={() => setViewMode('both')}
                className={`px-3 py-1 text-xs rounded ${
                  viewMode === 'both'
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Both
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
          </div>

          {/* Data Display */}
          <div
            ref={dataContainerRef}
            className="flex-1 overflow-auto p-4 font-mono text-xs"
          >
            {dataHistory.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                {connection
                  ? 'Waiting for data...'
                  : 'Connect to a server to start capturing data.'}
              </div>
            ) : (
              <div className="space-y-2">
                {dataHistory.map((entry, index) => {
                  const formatted = formatData(entry.data as Uint8Array, viewMode);
                  const timestamp = entry.timestamp.toLocaleTimeString();

                  return (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        entry.direction === 'sent'
                          ? 'bg-blue-900/30 border-l-2 border-blue-500'
                          : 'bg-green-900/30 border-l-2 border-green-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-gray-400">
                        <span>
                          {entry.direction === 'sent' ? '→ Sent' : '← Received'}
                        </span>
                        <span>{timestamp}</span>
                      </div>
                      {viewMode === 'both' ? (
                        <pre className="whitespace-pre-wrap break-all">
                          {formatHexDump(entry.data as Uint8Array)}
                        </pre>
                      ) : viewMode === 'hex' ? (
                        <pre className="whitespace-pre-wrap break-all text-yellow-300">
                          {formatted.hex}
                        </pre>
                      ) : (
                        <pre className="whitespace-pre-wrap break-all">
                          {formatted.ascii}
                        </pre>
                      )}
                      <div className="text-gray-500 mt-1">
                        {(entry.data as Uint8Array).length} bytes
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Sessions (conditional) */}
        {showSessions && (
          <div className="w-80 border-l border-gray-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium mb-3">Saved Sessions</h3>
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">No saved sessions.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
                      onClick={() => {
                        // Load session data
                        setDataHistory(session.dataHistory);
                        setShowSessions(false);
                      }}
                    >
                      <div className="font-medium text-sm">
                        {session.host}:{session.port}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(session.startTime).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {session.dataHistory.length} entries
                      </div>
                      {session.notes && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {session.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
        <div>
          {connection ? (
            <span className="text-green-400">● Connected</span>
          ) : (
            <span className="text-gray-500">○ Disconnected</span>
          )}
        </div>
        <div>{dataHistory.length} entries in history</div>
      </div>
    </div>
  );
};

export default TcpBuilder;