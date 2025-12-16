/**
 * GrpcBuilder Component
 *
 * UI component for making gRPC calls with proto file management,
 * service/method selection, and message editing.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  GrpcClientService,
  GrpcConnection,
  ProtoFile,
  ServiceDefinition,
  GrpcMethod,
  GrpcRequest,
  GrpcResponse,
} from '../../services/grpc';

interface GrpcBuilderProps {
  grpcService?: GrpcClientService;
  onRequestComplete?: (response: GrpcResponse) => void;
}

interface ConnectionState {
  address: string;
  useTls: boolean;
  rootCerts?: string;
  privateKey?: string;
  certChain?: string;
}

export const GrpcBuilder: React.FC<GrpcBuilderProps> = ({
  grpcService,
  onRequestComplete,
}) => {
  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    address: 'localhost:50051',
    useTls: false,
  });
  const [connection, setConnection] = useState<GrpcConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Proto file state
  const [protoFiles, setProtoFiles] = useState<ProtoFile[]>([]);
  const [selectedProto, setSelectedProto] = useState<ProtoFile | null>(null);
  const [protoContent, setProtoContent] = useState('');
  const [protoFilename, setProtoFilename] = useState('');

  // Service/Method state
  const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<GrpcMethod | null>(null);

  // Request state
  const [requestMessage, setRequestMessage] = useState('{}');
  const [metadata, setMetadata] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  const [timeout, setTimeout] = useState(30000);

  // Response state
  const [response, setResponse] = useState<GrpcResponse | null>(null);
  const [streamMessages, setStreamMessages] = useState<GrpcResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);

  // Service instance
  const service = grpcService || new GrpcClientService();

  // Load proto files on mount
  useEffect(() => {
    setProtoFiles(service.getLoadedProtos());
  }, [service]);

  // Connect to server
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const conn = await service.connect({
        address: connectionState.address,
        useTls: connectionState.useTls,
        tlsConfig: connectionState.useTls
          ? {
              rootCerts: connectionState.rootCerts,
              privateKey: connectionState.privateKey,
              certChain: connectionState.certChain,
            }
          : undefined,
      });
      setConnection(conn);
    } catch (err) {
      setConnectionError((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectionState, service]);

  // Disconnect from server
  const handleDisconnect = useCallback(async () => {
    if (connection) {
      await service.disconnect(connection.id);
      setConnection(null);
    }
  }, [connection, service]);

  // Load proto from content
  const handleLoadProto = useCallback(async () => {
    if (!protoContent || !protoFilename) return;

    try {
      const proto = await service.loadProtoFromString(protoContent, protoFilename);
      setProtoFiles(service.getLoadedProtos());
      setSelectedProto(proto);
      setProtoContent('');
      setProtoFilename('');
      setError(null);
    } catch (err) {
      setError(`Failed to parse proto: ${(err as Error).message}`);
    }
  }, [protoContent, protoFilename, service]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          const proto = await service.loadProtoFromString(content, file.name);
          setProtoFiles(service.getLoadedProtos());
          setSelectedProto(proto);
          setError(null);
        } catch (err) {
          setError(`Failed to parse proto: ${(err as Error).message}`);
        }
      };
      reader.readAsText(file);
    },
    [service]
  );

  // Select proto file
  const handleSelectProto = useCallback(
    (protoId: string) => {
      const proto = protoFiles.find((p) => p.id === protoId);
      setSelectedProto(proto || null);
      setSelectedService(null);
      setSelectedMethod(null);
    },
    [protoFiles]
  );

  // Select service
  const handleSelectService = useCallback(
    (serviceName: string) => {
      if (!selectedProto) return;
      const svc = selectedProto.services.find((s) => s.name === serviceName);
      setSelectedService(svc || null);
      setSelectedMethod(null);
    },
    [selectedProto]
  );

  // Select method
  const handleSelectMethod = useCallback(
    (methodName: string) => {
      if (!selectedService) return;
      const method = selectedService.methods.find((m) => m.name === methodName);
      setSelectedMethod(method || null);

      // Generate sample message
      if (method && selectedProto) {
        const sample = service.generateSampleMessage(selectedProto, method.inputType);
        setRequestMessage(JSON.stringify(sample, null, 2));
      }
    },
    [selectedService, selectedProto, service]
  );

  // Add metadata row
  const handleAddMetadata = useCallback(() => {
    setMetadata([...metadata, { key: '', value: '' }]);
  }, [metadata]);

  // Update metadata
  const handleUpdateMetadata = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      const updated = [...metadata];
      updated[index][field] = value;
      setMetadata(updated);
    },
    [metadata]
  );

  // Remove metadata row
  const handleRemoveMetadata = useCallback(
    (index: number) => {
      setMetadata(metadata.filter((_, i) => i !== index));
    },
    [metadata]
  );

  // Send request
  const handleSendRequest = useCallback(async () => {
    if (!connection || !selectedProto || !selectedService || !selectedMethod) {
      setError('Please connect and select a service/method');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);
    setStreamMessages([]);

    try {
      // Parse request message
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(requestMessage);
      } catch {
        throw new Error('Invalid JSON in request message');
      }

      // Build metadata object
      const metadataObj: Record<string, string> = {};
      for (const { key, value } of metadata) {
        if (key) {
          metadataObj[key] = value;
        }
      }

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: selectedProto.id,
        serviceName: selectedService.fullName,
        methodName: selectedMethod.name,
        message,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
        timeout,
      };

      // Handle different method types
      if (selectedMethod.type === 'unary') {
        const resp = await service.unaryCall(request);
        setResponse(resp);
        onRequestComplete?.(resp);
      } else if (selectedMethod.type === 'server_streaming') {
        await service.serverStreamingCall(request, (resp) => {
          setStreamMessages((prev) => [...prev, resp]);
        });
      } else if (selectedMethod.type === 'client_streaming') {
        const stream = await service.clientStreamingCall(request);
        // For client streaming, we'd need additional UI to send multiple messages
        const resp = await service.endClientStream(stream.id);
        setResponse(resp);
        onRequestComplete?.(resp);
      } else if (selectedMethod.type === 'bidirectional') {
        await service.bidirectionalStreamingCall(request, (resp) => {
          setStreamMessages((prev) => [...prev, resp]);
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [
    connection,
    selectedProto,
    selectedService,
    selectedMethod,
    requestMessage,
    metadata,
    timeout,
    service,
    onRequestComplete,
  ]);

  // Export as grpcurl
  const handleExportGrpcurl = useCallback(() => {
    if (!connection || !selectedProto || !selectedService || !selectedMethod) return;

    try {
      const message = JSON.parse(requestMessage);
      const metadataObj: Record<string, string> = {};
      for (const { key, value } of metadata) {
        if (key) metadataObj[key] = value;
      }

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: selectedProto.id,
        serviceName: selectedService.fullName,
        methodName: selectedMethod.name,
        message,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
      };

      const grpcurl = service.exportAsGrpcurl(request);
      navigator.clipboard.writeText(grpcurl);
    } catch (err) {
      setError('Failed to export: ' + (err as Error).message);
    }
  }, [connection, selectedProto, selectedService, selectedMethod, requestMessage, metadata, service]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">gRPC Client</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
          >
            History
          </button>
          <button
            onClick={handleExportGrpcurl}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            disabled={!connection || !selectedMethod}
          >
            Export grpcurl
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Connection & Proto */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto">
          {/* Connection Section */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3">Connection</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={connectionState.address}
                onChange={(e) =>
                  setConnectionState({ ...connectionState, address: e.target.value })
                }
                placeholder="localhost:50051"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                disabled={!!connection}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={connectionState.useTls}
                  onChange={(e) =>
                    setConnectionState({ ...connectionState, useTls: e.target.checked })
                  }
                  disabled={!!connection}
                />
                Use TLS
              </label>
              {connectionState.useTls && !connection && (
                <div className="space-y-2">
                  <textarea
                    value={connectionState.rootCerts || ''}
                    onChange={(e) =>
                      setConnectionState({ ...connectionState, rootCerts: e.target.value })
                    }
                    placeholder="Root certificates (PEM)"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-xs h-20"
                  />
                </div>
              )}
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
                <p className="text-green-400 text-xs">
                  Connected to {connection.address}
                </p>
              )}
            </div>
          </div>

          {/* Proto Files Section */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3">Proto Files</h3>
            <div className="space-y-3">
              <input
                type="file"
                accept=".proto"
                onChange={handleFileUpload}
                className="w-full text-xs"
              />
              <div className="text-xs text-gray-400">Or paste proto content:</div>
              <input
                type="text"
                value={protoFilename}
                onChange={(e) => setProtoFilename(e.target.value)}
                placeholder="filename.proto"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
              />
              <textarea
                value={protoContent}
                onChange={(e) => setProtoContent(e.target.value)}
                placeholder="syntax = 'proto3';..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-xs h-24 font-mono"
              />
              <button
                onClick={handleLoadProto}
                disabled={!protoContent || !protoFilename}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
              >
                Load Proto
              </button>
              {protoFiles.length > 0 && (
                <select
                  value={selectedProto?.id || ''}
                  onChange={(e) => handleSelectProto(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                >
                  <option value="">Select proto file...</option>
                  {protoFiles.map((proto) => (
                    <option key={proto.id} value={proto.id}>
                      {proto.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Service/Method Selection */}
          {selectedProto && (
            <div className="p-4">
              <h3 className="text-sm font-medium mb-3">Service & Method</h3>
              <div className="space-y-3">
                <select
                  value={selectedService?.name || ''}
                  onChange={(e) => handleSelectService(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                >
                  <option value="">Select service...</option>
                  {selectedProto.services.map((svc) => (
                    <option key={svc.name} value={svc.name}>
                      {svc.name}
                    </option>
                  ))}
                </select>
                {selectedService && (
                  <select
                    value={selectedMethod?.name || ''}
                    onChange={(e) => handleSelectMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                  >
                    <option value="">Select method...</option>
                    {selectedService.methods.map((method) => (
                      <option key={method.name} value={method.name}>
                        {method.name} ({method.type})
                      </option>
                    ))}
                  </select>
                )}
                {selectedMethod && (
                  <div className="text-xs text-gray-400">
                    <div>Input: {selectedMethod.inputType}</div>
                    <div>Output: {selectedMethod.outputType}</div>
                    <div>Type: {selectedMethod.type}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center Panel - Request */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3">Request Message</h3>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              className="w-full h-48 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
              placeholder='{"field": "value"}'
            />
          </div>

          {/* Metadata */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Metadata</h3>
              <button
                onClick={handleAddMetadata}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {metadata.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => handleUpdateMetadata(index, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => handleUpdateMetadata(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
                  />
                  <button
                    onClick={() => handleRemoveMetadata(index)}
                    className="px-2 py-1 text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Timeout */}
          <div className="p-4 border-b border-gray-700">
            <label className="flex items-center gap-2 text-sm">
              <span>Timeout (ms):</span>
              <input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(parseInt(e.target.value) || 30000)}
                className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
              />
            </label>
          </div>

          {/* Send Button */}
          <div className="p-4">
            <button
              onClick={handleSendRequest}
              disabled={isLoading || !connection || !selectedMethod}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>

        {/* Right Panel - Response */}
        <div className="w-96 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium mb-3">Response</h3>
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded mb-3 text-sm">
                {error}
              </div>
            )}
            {response && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      response.status === 0
                        ? 'bg-green-600'
                        : 'bg-red-600'
                    }`}
                  >
                    {response.status === 0 ? 'OK' : `Error ${response.status}`}
                  </span>
                  <span className="text-xs text-gray-400">
                    {response.duration}ms
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Message:</div>
                  <pre className="p-3 bg-gray-800 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(response.message, null, 2)}
                  </pre>
                </div>
                {Object.keys(response.metadata).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Metadata:</div>
                    <pre className="p-3 bg-gray-800 rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(response.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {streamMessages.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-400">
                  Stream Messages ({streamMessages.length}):
                </div>
                {streamMessages.map((msg, index) => (
                  <div key={index} className="p-2 bg-gray-800 rounded text-xs">
                    <pre className="overflow-auto">
                      {JSON.stringify(msg.message, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {!response && streamMessages.length === 0 && !error && (
              <div className="text-gray-500 text-sm">
                Response will appear here after sending a request.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrpcBuilder;