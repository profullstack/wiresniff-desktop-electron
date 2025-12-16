/**
 * Database Repositories Index
 * 
 * Exports all repository classes and singleton instances.
 */

// Base repository
export { BaseRepository, type BaseEntity, type QueryOptions } from './BaseRepository';

// Collection repository
export {
  CollectionRepository,
  collectionRepository,
  type Collection,
  type CollectionWithChildren,
} from './CollectionRepository';

// Request repository
export {
  RequestRepository,
  requestRepository,
  type Request,
  type ParsedRequest,
  type KeyValuePair,
  type AuthConfig,
  type HttpMethod,
  type BodyType,
  type AuthType,
} from './RequestRepository';

// Environment repository
export {
  EnvironmentRepository,
  EnvironmentVariableRepository,
  environmentRepository,
  environmentVariableRepository,
  type Environment,
  type EnvironmentVariable,
  type EnvironmentWithVariables,
} from './EnvironmentRepository';

// History repository
export {
  HistoryRepository,
  historyRepository,
  type RequestHistory,
  type HistoryStats,
} from './HistoryRepository';

// Settings repository
export {
  SettingsRepository,
  settingsRepository,
  type Setting,
  type AppSettings,
  DEFAULT_SETTINGS,
} from './SettingsRepository';