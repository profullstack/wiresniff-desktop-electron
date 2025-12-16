/**
 * Capture Components Module
 *
 * Exports all capture-related UI components for traffic capture,
 * replay, and diff functionality.
 */

export { CaptureViewer } from './CaptureViewer';
export type { CapturedRequest, CaptureSession } from './CaptureViewer';

export { DiffViewer } from './DiffViewer';
export type {
  ResponseData,
  HeaderDiff,
  JsonDiffEntry,
  BodyDiff,
  TimingDiff,
  DiffResult,
} from './DiffViewer';

export { ReplayPanel } from './ReplayPanel';
export type {
  ReplayTarget,
  ReplayEnvironment,
  ReplayResult,
} from './ReplayPanel';