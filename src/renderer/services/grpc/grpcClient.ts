/**
 * gRPC Client Service
 *
 * Provides gRPC functionality including unary calls, streaming,
 * reflection, and proto file management for WireSniff.
 */

import { v4 as uuidv4 } from 'uuid';

// Types
export interface GrpcMethod {
  name: string;
  type: 'unary' | 'server_streaming' | 'client_streaming' | 'bidirectional';
  inputType: string;
  outputType: string;
  requestStream: boolean;
  responseStream: boolean;
}

export interface ServiceDefinition {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

export interface MessageField {
  name: string;
  type: string;
  number: number;
  repeated: boolean;
  optional: boolean;
  mapKey?: string;
  mapValue?: string;
}

export interface MessageType {
  name: string;
  fullName: string;
  fields: MessageField[];
  nestedTypes: MessageType[];
}

export interface ProtoFile {
  id: string;
  name: string;
  content: string;
  package: string;
  services: ServiceDefinition[];
  messages: MessageType[];
  loadedAt: Date;
}

export interface TlsConfig {
  rootCerts?: string;
  privateKey?: string;
  certChain?: string;
}

export interface ConnectionConfig {
  address: string;
  useTls: boolean;
  tlsConfig?: TlsConfig;
}

export interface GrpcConnection {
  id: string;
  address: string;
  useTls: boolean;
  tlsConfig?: TlsConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
  metadata: Record<string, string>;
}

export interface GrpcRequest {
  connectionId: string;
  protoFileId: string;
  serviceName: string;
  methodName: string;
  message: Record<string, unknown>;
  metadata?: Record<string, string>;
  timeout?: number;
}

export interface GrpcResponse {
  status: number;
  statusMessage: string;
  message: Record<string, unknown>;
  metadata: Record<string, string>;
  trailers: Record<string, string>;
  duration: number;
  timestamp: Date;
}

export interface RequestHistoryEntry {
  id: string;
  request: GrpcRequest;
  response?: GrpcResponse;
  error?: string;
  timestamp: Date;
}

export interface GrpcStream {
  id: string;
  connectionId: string;
  methodName: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  messages: Array<{ direction: 'sent' | 'received'; data: unknown; timestamp: Date }>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * gRPC Client Service
 */
export class GrpcClientService {
  private protos: Map<string, ProtoFile> = new Map();
  private connections: Map<string, GrpcConnection> = new Map();
  private streams: Map<string, GrpcStream> = new Map();
  private history: Map<string, RequestHistoryEntry[]> = new Map();

  /**
   * Load proto file from string content
   */
  async loadProtoFromString(content: string, filename: string): Promise<ProtoFile> {
    const id = uuidv4();
    const packageName = this.extractPackage(content);
    const services = this.parseServices(content, packageName);
    const messages = this.parseMessages(content, packageName);

    const protoFile: ProtoFile = {
      id,
      name: filename,
      content,
      package: packageName,
      services,
      messages,
      loadedAt: new Date(),
    };

    this.protos.set(id, protoFile);
    return protoFile;
  }

  /**
   * Extract package name from proto content
   */
  private extractPackage(content: string): string {
    const match = content.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
    return match ? match[1] : '';
  }

  /**
   * Parse service definitions from proto content
   */
  private parseServices(content: string, packageName: string): ServiceDefinition[] {
    const services: ServiceDefinition[] = [];
    const serviceRegex = /service\s+(\w+)\s*\{([^}]+)\}/g;
    let serviceMatch;

    while ((serviceMatch = serviceRegex.exec(content)) !== null) {
      const serviceName = serviceMatch[1];
      const serviceBody = serviceMatch[2];
      const methods = this.parseMethods(serviceBody);

      services.push({
        name: serviceName,
        fullName: packageName ? `${packageName}.${serviceName}` : serviceName,
        methods,
      });
    }

    return services;
  }

  /**
   * Parse methods from service body
   */
  private parseMethods(serviceBody: string): GrpcMethod[] {
    const methods: GrpcMethod[] = [];
    const methodRegex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+)\s*\)/g;
    let methodMatch;

    while ((methodMatch = methodRegex.exec(serviceBody)) !== null) {
      const name = methodMatch[1];
      const requestStream = !!methodMatch[2];
      const inputType = methodMatch[3];
      const responseStream = !!methodMatch[4];
      const outputType = methodMatch[5];

      let type: GrpcMethod['type'] = 'unary';
      if (requestStream && responseStream) {
        type = 'bidirectional';
      } else if (requestStream) {
        type = 'client_streaming';
      } else if (responseStream) {
        type = 'server_streaming';
      }

      methods.push({
        name,
        type,
        inputType,
        outputType,
        requestStream,
        responseStream,
      });
    }

    return methods;
  }

  /**
   * Parse message definitions from proto content
   */
  private parseMessages(content: string, packageName: string): MessageType[] {
    const messages: MessageType[] = [];
    const messageRegex = /message\s+(\w+)\s*\{([^}]+)\}/g;
    let messageMatch;

    while ((messageMatch = messageRegex.exec(content)) !== null) {
      const messageName = messageMatch[1];
      const messageBody = messageMatch[2];
      const fields = this.parseFields(messageBody);

      messages.push({
        name: messageName,
        fullName: packageName ? `${packageName}.${messageName}` : messageName,
        fields,
        nestedTypes: [],
      });
    }

    return messages;
  }

  /**
   * Parse fields from message body
   */
  private parseFields(messageBody: string): MessageField[] {
    const fields: MessageField[] = [];
    const fieldRegex = /(repeated\s+|optional\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(messageBody)) !== null) {
      const modifier = fieldMatch[1]?.trim();
      const type = fieldMatch[2];
      const name = fieldMatch[3];
      const number = parseInt(fieldMatch[4], 10);

      fields.push({
        name,
        type,
        number,
        repeated: modifier === 'repeated',
        optional: modifier === 'optional',
      });
    }

    return fields;
  }

  /**
   * Get message type definition
   */
  getMessageType(protoFile: ProtoFile, messageName: string): MessageType | undefined {
    return protoFile.messages.find(
      (m) => m.name === messageName || m.fullName === messageName
    );
  }

  /**
   * Get all loaded proto files
   */
  getLoadedProtos(): ProtoFile[] {
    return Array.from(this.protos.values());
  }

  /**
   * Remove a loaded proto file
   */
  removeProto(protoId: string): void {
    this.protos.delete(protoId);
  }

  /**
   * Connect to gRPC server
   */
  async connect(config: ConnectionConfig): Promise<GrpcConnection> {
    const id = uuidv4();
    const connection: GrpcConnection = {
      id,
      address: config.address,
      useTls: config.useTls,
      tlsConfig: config.tlsConfig,
      status: 'connected',
      connectedAt: new Date(),
      metadata: {},
    };

    this.connections.set(id, connection);
    this.history.set(id, []);
    return connection;
  }

  /**
   * Disconnect from gRPC server
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    connection.status = 'disconnected';
    this.connections.set(connectionId, connection);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): GrpcConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getConnections(): GrpcConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Set metadata for connection
   */
  setMetadata(connectionId: string, metadata: Record<string, string>): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.metadata = { ...connection.metadata, ...metadata };
      this.connections.set(connectionId, connection);
    }
  }

  /**
   * Get metadata for connection
   */
  getMetadata(connectionId: string): Record<string, string> | undefined {
    return this.connections.get(connectionId)?.metadata;
  }

  /**
   * Discover services via server reflection
   */
  async discoverServices(connectionId: string): Promise<string[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // In a real implementation, this would use gRPC reflection
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get service definition via reflection
   */
  async getServiceDefinition(
    connectionId: string,
    serviceName: string
  ): Promise<ServiceDefinition | undefined> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // In a real implementation, this would use gRPC reflection
    return undefined;
  }

  /**
   * Make unary RPC call
   */
  async unaryCall(request: GrpcRequest): Promise<GrpcResponse> {
    const connection = this.connections.get(request.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const startTime = Date.now();

    // Record in history
    const historyEntry: RequestHistoryEntry = {
      id: uuidv4(),
      request,
      timestamp: new Date(),
    };

    // Simulate response (in real implementation, this would make actual gRPC call)
    const response: GrpcResponse = {
      status: 0,
      statusMessage: 'OK',
      message: {},
      metadata: {},
      trailers: {},
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };

    historyEntry.response = response;

    const connectionHistory = this.history.get(request.connectionId) || [];
    connectionHistory.push(historyEntry);
    this.history.set(request.connectionId, connectionHistory);

    return response;
  }

  /**
   * Make server streaming RPC call
   */
  async serverStreamingCall(
    request: GrpcRequest,
    onMessage: (response: GrpcResponse) => void
  ): Promise<string> {
    const connection = this.connections.get(request.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const streamId = uuidv4();
    const stream: GrpcStream = {
      id: streamId,
      connectionId: request.connectionId,
      methodName: request.methodName,
      status: 'active',
      messages: [],
    };

    this.streams.set(streamId, stream);

    // In real implementation, this would handle actual streaming
    // For now, just mark as completed
    stream.status = 'completed';
    this.streams.set(streamId, stream);

    return streamId;
  }

  /**
   * Cancel a stream
   */
  async cancelStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.status = 'cancelled';
      this.streams.set(streamId, stream);
    }
  }

  /**
   * Get stream by ID
   */
  getStream(streamId: string): GrpcStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Make client streaming RPC call
   */
  async clientStreamingCall(request: GrpcRequest): Promise<GrpcStream> {
    const connection = this.connections.get(request.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const streamId = uuidv4();
    const stream: GrpcStream = {
      id: streamId,
      connectionId: request.connectionId,
      methodName: request.methodName,
      status: 'active',
      messages: [],
    };

    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * Send message on client stream
   */
  async sendStreamMessage(streamId: string, message: unknown): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error('Stream not found');
    }

    stream.messages.push({
      direction: 'sent',
      data: message,
      timestamp: new Date(),
    });
    this.streams.set(streamId, stream);
  }

  /**
   * End client stream and get response
   */
  async endClientStream(streamId: string): Promise<GrpcResponse> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error('Stream not found');
    }

    stream.status = 'completed';
    this.streams.set(streamId, stream);

    return {
      status: 0,
      statusMessage: 'OK',
      message: {},
      metadata: {},
      trailers: {},
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Make bidirectional streaming RPC call
   */
  async bidirectionalStreamingCall(
    request: GrpcRequest,
    onMessage: (response: GrpcResponse) => void
  ): Promise<GrpcStream> {
    const connection = this.connections.get(request.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const streamId = uuidv4();
    const stream: GrpcStream = {
      id: streamId,
      connectionId: request.connectionId,
      methodName: request.methodName,
      status: 'active',
      messages: [],
    };

    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * Get request history for connection
   */
  getRequestHistory(connectionId: string): RequestHistoryEntry[] {
    return this.history.get(connectionId) || [];
  }

  /**
   * Clear request history for connection
   */
  clearHistory(connectionId: string): void {
    this.history.set(connectionId, []);
  }

  /**
   * Generate sample message from proto definition
   */
  generateSampleMessage(
    protoFile: ProtoFile,
    messageName: string
  ): Record<string, unknown> {
    const messageType = this.getMessageType(protoFile, messageName);
    if (!messageType) {
      return {};
    }

    const sample: Record<string, unknown> = {};

    for (const field of messageType.fields) {
      sample[field.name] = this.getDefaultValue(field);
    }

    return sample;
  }

  /**
   * Get default value for field type
   */
  private getDefaultValue(field: MessageField): unknown {
    if (field.repeated) {
      return [];
    }

    switch (field.type) {
      case 'string':
        return '';
      case 'int32':
      case 'int64':
      case 'uint32':
      case 'uint64':
      case 'sint32':
      case 'sint64':
      case 'fixed32':
      case 'fixed64':
      case 'sfixed32':
      case 'sfixed64':
        return 0;
      case 'float':
      case 'double':
        return 0.0;
      case 'bool':
        return false;
      case 'bytes':
        return new Uint8Array();
      default:
        return {};
    }
  }

  /**
   * Validate message against proto definition
   */
  validateMessage(
    protoFile: ProtoFile,
    messageName: string,
    message: Record<string, unknown>
  ): ValidationResult {
    const messageType = this.getMessageType(protoFile, messageName);
    if (!messageType) {
      return { valid: false, errors: [`Message type ${messageName} not found`] };
    }

    const errors: string[] = [];

    for (const field of messageType.fields) {
      const value = message[field.name];
      if (value !== undefined) {
        const typeError = this.validateFieldType(field, value);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate field type
   */
  private validateFieldType(field: MessageField, value: unknown): string | null {
    const expectedType = this.getExpectedJsType(field.type);

    if (field.repeated) {
      if (!Array.isArray(value)) {
        return `Field ${field.name} should be an array`;
      }
      return null;
    }

    if (typeof value !== expectedType) {
      return `Field ${field.name} should be ${expectedType}, got ${typeof value}`;
    }

    return null;
  }

  /**
   * Get expected JavaScript type for proto type
   */
  private getExpectedJsType(protoType: string): string {
    switch (protoType) {
      case 'string':
        return 'string';
      case 'int32':
      case 'int64':
      case 'uint32':
      case 'uint64':
      case 'sint32':
      case 'sint64':
      case 'fixed32':
      case 'fixed64':
      case 'sfixed32':
      case 'sfixed64':
      case 'float':
      case 'double':
        return 'number';
      case 'bool':
        return 'boolean';
      default:
        return 'object';
    }
  }

  /**
   * Export request as grpcurl command
   */
  exportAsGrpcurl(request: GrpcRequest): string {
    const connection = this.connections.get(request.connectionId);
    if (!connection) {
      return '';
    }

    const parts = ['grpcurl'];

    if (!connection.useTls) {
      parts.push('-plaintext');
    }

    if (request.metadata) {
      for (const [key, value] of Object.entries(request.metadata)) {
        parts.push(`-H '${key}: ${value}'`);
      }
    }

    parts.push(`-d '${JSON.stringify(request.message)}'`);
    parts.push(connection.address);
    parts.push(`${request.serviceName}/${request.methodName}`);

    return parts.join(' ');
  }

  /**
   * Export request history as JSON
   */
  exportHistoryAsJson(connectionId: string): string {
    const history = this.getRequestHistory(connectionId);
    const connection = this.connections.get(connectionId);

    return JSON.stringify(
      {
        connection: connection
          ? {
              address: connection.address,
              useTls: connection.useTls,
            }
          : null,
        requests: history.map((entry) => ({
          id: entry.id,
          timestamp: entry.timestamp.toISOString(),
          request: {
            serviceName: entry.request.serviceName,
            methodName: entry.request.methodName,
            message: entry.request.message,
            metadata: entry.request.metadata,
          },
          response: entry.response
            ? {
                status: entry.response.status,
                statusMessage: entry.response.statusMessage,
                message: entry.response.message,
                duration: entry.response.duration,
              }
            : null,
          error: entry.error,
        })),
      },
      null,
      2
    );
  }
}

// Export singleton instance
export const grpcClient = new GrpcClientService();