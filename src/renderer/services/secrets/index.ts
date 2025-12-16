/**
 * Secrets Service Module
 *
 * Provides encrypted secrets vault functionality using Electron safeStorage.
 * Supports personal and workspace-scoped secrets with access logging.
 */

export {
  SecretsService,
  type Secret,
  type SecretType,
  type CreateSecretInput,
  type UpdateSecretInput,
  type ListSecretsOptions,
  type SecretAccessLog,
} from './secretsService';

// Create singleton instance
import { SecretsService } from './secretsService';
export const secretsService = new SecretsService();