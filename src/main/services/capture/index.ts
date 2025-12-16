/**
 * Capture Service Module
 * 
 * Exports capture service functionality for traffic capture and analysis.
 */

export {
  CaptureService,
  captureService,
  registerCaptureHandlers,
  type CaptureSource,
  type CaptureConfig,
  type CapturedRequest,
  type CaptureStatus,
  type CaptureFilter,
  type Dependencies,
} from './captureService';