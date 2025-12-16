/**
 * Live Traffic Service Module
 *
 * Real-time traffic capture and streaming service using tshark.
 * Provides filtering by domain, method, status codes, and headers.
 */

export {
  LiveTrafficService,
  type CaptureConfig,
  type TrafficFilter,
  type TrafficEvent,
  type TrafficSession,
  type SessionStats,
} from './liveTrafficService';