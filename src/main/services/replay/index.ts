/**
 * Replay Service Module
 * 
 * Exports replay service functionality for replaying captured requests.
 */

export {
  ReplayService,
  replayService,
  registerReplayHandlers,
  type ReplayTarget,
  type EnvironmentConfig,
  type EnvironmentMapping,
  type ReplayConfig,
  type ReplayResponse,
  type ReplayResult,
  type ReplayMultipleOptions,
} from './replayService';