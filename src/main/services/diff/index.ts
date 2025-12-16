/**
 * Diff Engine Module
 *
 * Exports all diff-related functionality for comparing HTTP responses.
 */

export {
  diffResponses,
  compareHeaders,
  compareBody,
  compareTiming,
  compareJsonSemantic,
  createDiffSummary,
} from './diffEngine';

export type {
  ResponseData,
  HeaderDiff,
  BodyDiff,
  JsonDiffEntry,
  TimingDiff,
  DiffResult,
  DiffOptions,
} from './diffEngine';