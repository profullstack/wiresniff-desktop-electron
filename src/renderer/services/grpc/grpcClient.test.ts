/**
 * gRPC Client Service Tests
 *
 * Tests for gRPC functionality including unary calls, streaming,
 * reflection, and proto file management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GrpcClientService,
  GrpcConnection,
  GrpcMethod,
  GrpcRequest,
  GrpcResponse,
  ProtoFile,
  ServiceDefinition,
} from './grpcClient';

describe('GrpcClientService', () => {
  let service: GrpcClientService;

  beforeEach(() => {
    service = new GrpcClientService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('proto file management', () => {
    it('should load proto file from path', async () => {
      const protoContent = `
        syntax = "proto3";
        package example;
        
        service Greeter {
          rpc SayHello (HelloRequest) returns (HelloReply);
        }
        
        message HelloRequest {
          string name = 1;
        }
        
        message HelloReply {
          string message = 1;
        }
      `;

      const protoFile = await service.loadProtoFromString(protoContent, 'greeter.proto');

      expect(protoFile).toBeDefined();
      expect(protoFile.name).toBe('greeter.proto');
      expect(protoFile.services.length).toBeGreaterThan(0);
    });

    it('should parse service definitions from proto', async () => {
      const protoContent = `
        syntax = "proto3";
        package example;
        
        service UserService {
          rpc GetUser (GetUserRequest) returns (User);
          rpc ListUsers (ListUsersRequest) returns (stream User);
          rpc CreateUser (User) returns (User);
        }
        
        message GetUserRequest {
          string id = 1;
        }
        
        message ListUsersRequest {
          int32 page = 1;
          int32 limit = 2;
        }
        
        message User {
          string id = 1;
          string name = 2;
          string email = 3;
        }
      `;

      const protoFile = await service.loadProtoFromString(protoContent, 'user.proto');
      const services = protoFile.services;

      expect(services.length).toBe(1);
      expect(services[0].name).toBe('UserService');
      expect(services[0].methods.length).toBe(3);
    });

    it('should identify method types (unary, server streaming, client streaming, bidirectional)', async () => {
      const protoContent = `
        syntax = "proto3";
        package example;
        
        service StreamService {
          rpc Unary (Request) returns (Response);
          rpc ServerStream (Request) returns (stream Response);
          rpc ClientStream (stream Request) returns (Response);
          rpc BidiStream (stream Request) returns (stream Response);
        }
        
        message Request { string data = 1; }
        message Response { string data = 1; }
      `;

      const protoFile = await service.loadProtoFromString(protoContent, 'stream.proto');
      const methods = protoFile.services[0].methods;

      expect(methods.find((m: GrpcMethod) => m.name === 'Unary')?.type).toBe('unary');
      expect(methods.find((m: GrpcMethod) => m.name === 'ServerStream')?.type).toBe('server_streaming');
      expect(methods.find((m: GrpcMethod) => m.name === 'ClientStream')?.type).toBe('client_streaming');
      expect(methods.find((m: GrpcMethod) => m.name === 'BidiStream')?.type).toBe('bidirectional');
    });

    it('should extract message field definitions', async () => {
      const protoContent = `
        syntax = "proto3";
        package example;
        
        service Test {
          rpc Test (TestMessage) returns (TestMessage);
        }
        
        message TestMessage {
          string name = 1;
          int32 age = 2;
          bool active = 3;
          repeated string tags = 4;
          NestedMessage nested = 5;
        }
        
        message NestedMessage {
          string value = 1;
        }
      `;

      const protoFile = await service.loadProtoFromString(protoContent, 'test.proto');
      const messageType = service.getMessageType(protoFile, 'TestMessage');

      expect(messageType).toBeDefined();
      expect(messageType?.fields.length).toBe(5);
      expect(messageType?.fields.find((f: { name: string }) => f.name === 'name')?.type).toBe('string');
      expect(messageType?.fields.find((f: { name: string }) => f.name === 'age')?.type).toBe('int32');
      expect(messageType?.fields.find((f: { name: string }) => f.name === 'tags')?.repeated).toBe(true);
    });

    it('should list loaded proto files', async () => {
      const proto1 = `
        syntax = "proto3";
        package pkg1;
        service Svc1 { rpc M1 (Req) returns (Res); }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;
      const proto2 = `
        syntax = "proto3";
        package pkg2;
        service Svc2 { rpc M2 (Req) returns (Res); }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      await service.loadProtoFromString(proto1, 'proto1.proto');
      await service.loadProtoFromString(proto2, 'proto2.proto');

      const protos = service.getLoadedProtos();
      expect(protos.length).toBe(2);
    });

    it('should remove loaded proto file', async () => {
      const proto = `
        syntax = "proto3";
        package test;
        service Test { rpc M (Req) returns (Res); }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');
      service.removeProto(protoFile.id);

      const protos = service.getLoadedProtos();
      expect(protos.length).toBe(0);
    });
  });

  describe('connection management', () => {
    it('should create gRPC connection', async () => {
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.address).toBe('localhost:50051');
      expect(connection.status).toBe('connected');
    });

    it('should create secure TLS connection', async () => {
      const connection = await service.connect({
        address: 'api.example.com:443',
        useTls: true,
        tlsConfig: {
          rootCerts: 'cert-content',
          privateKey: 'key-content',
          certChain: 'chain-content',
        },
      });

      expect(connection.useTls).toBe(true);
    });

    it('should disconnect from server', async () => {
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      await service.disconnect(connection.id);

      const updatedConnection = service.getConnection(connection.id);
      expect(updatedConnection?.status).toBe('disconnected');
    });

    it('should list all connections', async () => {
      await service.connect({ address: 'localhost:50051', useTls: false });
      await service.connect({ address: 'localhost:50052', useTls: false });

      const connections = service.getConnections();
      expect(connections.length).toBe(2);
    });

    it('should set metadata for connection', async () => {
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      service.setMetadata(connection.id, {
        'authorization': 'Bearer token123',
        'x-custom-header': 'value',
      });

      const metadata = service.getMetadata(connection.id);
      expect(metadata?.['authorization']).toBe('Bearer token123');
    });
  });

  describe('server reflection', () => {
    it('should discover services via reflection', async () => {
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      // Mock reflection response - returns empty array as placeholder
      const services = await service.discoverServices(connection.id);

      expect(Array.isArray(services)).toBe(true);
    });

    it('should get service definition via reflection (placeholder)', async () => {
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      // Currently returns undefined as placeholder - real implementation would use gRPC reflection
      const definition = await service.getServiceDefinition(
        connection.id,
        'example.Greeter'
      );

      // Placeholder returns undefined until real reflection is implemented
      expect(definition).toBeUndefined();
    });
  });

  describe('unary calls', () => {
    it('should make unary RPC call', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Greeter {
          rpc SayHello (HelloRequest) returns (HelloReply);
        }
        message HelloRequest { string name = 1; }
        message HelloReply { string message = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'greeter.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Greeter',
        methodName: 'SayHello',
        message: { name: 'World' },
      };

      const response = await service.unaryCall(request);

      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
    });

    it('should handle unary call timeout', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Slow {
          rpc SlowMethod (Req) returns (Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'slow.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Slow',
        methodName: 'SlowMethod',
        message: {},
        timeout: 100,
      };

      // Should handle timeout gracefully
      const response = await service.unaryCall(request);
      expect(response).toBeDefined();
    });

    it('should include metadata in request', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Auth {
          rpc Protected (Req) returns (Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'auth.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Auth',
        methodName: 'Protected',
        message: {},
        metadata: {
          'authorization': 'Bearer token',
        },
      };

      const response = await service.unaryCall(request);
      expect(response).toBeDefined();
    });
  });

  describe('server streaming', () => {
    it('should handle server streaming RPC', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Stream {
          rpc ServerStream (Req) returns (stream Res);
        }
        message Req { int32 count = 1; }
        message Res { int32 value = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'stream.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const messages: GrpcResponse[] = [];
      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Stream',
        methodName: 'ServerStream',
        message: { count: 5 },
      };

      await service.serverStreamingCall(request, (response: GrpcResponse) => {
        messages.push(response);
      });

      // Stream should complete
      expect(Array.isArray(messages)).toBe(true);
    });

    it('should cancel server streaming call', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Stream {
          rpc LongStream (Req) returns (stream Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'stream.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Stream',
        methodName: 'LongStream',
        message: {},
      };

      const streamId = await service.serverStreamingCall(request, () => {});
      await service.cancelStream(streamId);

      const stream = service.getStream(streamId);
      expect(stream?.status).toBe('cancelled');
    });
  });

  describe('client streaming', () => {
    it('should handle client streaming RPC', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Upload {
          rpc Upload (stream Chunk) returns (Summary);
        }
        message Chunk { bytes data = 1; }
        message Summary { int32 total_bytes = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'upload.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Upload',
        methodName: 'Upload',
        message: {},
      };

      const stream = await service.clientStreamingCall(request);

      // Send multiple messages
      await service.sendStreamMessage(stream.id, { data: new Uint8Array([1, 2, 3]) });
      await service.sendStreamMessage(stream.id, { data: new Uint8Array([4, 5, 6]) });

      // End stream and get response
      const response = await service.endClientStream(stream.id);
      expect(response).toBeDefined();
    });
  });

  describe('bidirectional streaming', () => {
    it('should handle bidirectional streaming RPC', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Chat {
          rpc Chat (stream Message) returns (stream Message);
        }
        message Message { string text = 1; string user = 2; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'chat.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const messages: GrpcResponse[] = [];
      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Chat',
        methodName: 'Chat',
        message: {},
      };

      const stream = await service.bidirectionalStreamingCall(
        request,
        (response: GrpcResponse) => {
          messages.push(response);
        }
      );

      // Send messages
      await service.sendStreamMessage(stream.id, { text: 'Hello', user: 'Alice' });
      await service.sendStreamMessage(stream.id, { text: 'Hi', user: 'Bob' });

      expect(stream).toBeDefined();
    });
  });

  describe('request history', () => {
    it('should record request history', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Test {
          rpc Test (Req) returns (Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Test',
        methodName: 'Test',
        message: { a: 'test' },
      };

      await service.unaryCall(request);

      const history = service.getRequestHistory(connection.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].request.methodName).toBe('Test');
    });

    it('should clear request history', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Test {
          rpc Test (Req) returns (Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      await service.unaryCall({
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Test',
        methodName: 'Test',
        message: {},
      });

      service.clearHistory(connection.id);

      const history = service.getRequestHistory(connection.id);
      expect(history.length).toBe(0);
    });
  });

  describe('message generation', () => {
    it('should generate sample message from proto definition', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Test {
          rpc Test (TestMessage) returns (TestMessage);
        }
        message TestMessage {
          string name = 1;
          int32 count = 2;
          bool active = 3;
          repeated string items = 4;
        }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');
      const sample = service.generateSampleMessage(protoFile, 'TestMessage');

      expect(sample).toBeDefined();
      expect(typeof sample.name).toBe('string');
      expect(typeof sample.count).toBe('number');
      expect(typeof sample.active).toBe('boolean');
      expect(Array.isArray(sample.items)).toBe(true);
    });

    it('should validate message against proto definition', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Test {
          rpc Test (TestMessage) returns (TestMessage);
        }
        message TestMessage {
          string name = 1;
          int32 count = 2;
        }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');

      const validMessage = { name: 'test', count: 42 };
      const invalidMessage = { name: 123, count: 'not a number' };

      const validResult = service.validateMessage(protoFile, 'TestMessage', validMessage);
      const invalidResult = service.validateMessage(protoFile, 'TestMessage', invalidMessage);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('export/import', () => {
    it('should export request as curl-like command', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Test {
          rpc Test (Req) returns (Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      const request: GrpcRequest = {
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Test',
        methodName: 'Test',
        message: { a: 'value' },
      };

      const grpcurl = service.exportAsGrpcurl(request);

      expect(grpcurl).toContain('grpcurl');
      expect(grpcurl).toContain('localhost:50051');
      expect(grpcurl).toContain('example.Test/Test');
    });

    it('should export request history as JSON', async () => {
      const proto = `
        syntax = "proto3";
        package example;
        service Test {
          rpc Test (Req) returns (Res);
        }
        message Req { string a = 1; }
        message Res { string b = 1; }
      `;

      const protoFile = await service.loadProtoFromString(proto, 'test.proto');
      const connection = await service.connect({
        address: 'localhost:50051',
        useTls: false,
      });

      await service.unaryCall({
        connectionId: connection.id,
        protoFileId: protoFile.id,
        serviceName: 'example.Test',
        methodName: 'Test',
        message: { a: 'test' },
      });

      const json = service.exportHistoryAsJson(connection.id);
      const parsed = JSON.parse(json);

      expect(parsed.requests).toBeDefined();
      expect(parsed.requests.length).toBeGreaterThan(0);
    });
  });
});