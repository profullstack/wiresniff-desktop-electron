/**
 * gRPC Service Module
 *
 * Exports gRPC client functionality for WireSniff.
 */

export {
  GrpcClientService,
  grpcClient,
  type GrpcMethod,
  type ServiceDefinition,
  type MessageField,
  type MessageType,
  type ProtoFile,
  type TlsConfig,
  type ConnectionConfig,
  type GrpcConnection,
  type GrpcRequest,
  type GrpcResponse,
  type RequestHistoryEntry,
  type GrpcStream,
  type ValidationResult,
} from './grpcClient';