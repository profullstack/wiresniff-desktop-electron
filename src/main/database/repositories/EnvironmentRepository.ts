/**
 * Environment Repository
 * 
 * Handles CRUD operations for environments and environment variables.
 */

import { BaseRepository, BaseEntity, QueryOptions } from './BaseRepository';

export interface Environment extends BaseEntity {
  user_id?: string;
  name: string;
  is_active: number;
  sort_order: number;
}

export interface EnvironmentVariable extends BaseEntity {
  environment_id: string;
  key: string;
  value?: string;
  is_secret: number;
  enabled: number;
  sort_order: number;
}

export interface EnvironmentWithVariables extends Environment {
  variables: EnvironmentVariable[];
}

export class EnvironmentRepository extends BaseRepository<Environment> {
  constructor() {
    super('environments');
  }

  /**
   * Find environments by user ID
   */
  findByUserId(userId: string, options: QueryOptions = {}): Environment[] {
    return this.findBy('user_id', userId, { ...options, orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Get the active environment
   */
  getActive(userId?: string): Environment | null {
    const where: Record<string, unknown> = { is_active: 1 };
    if (userId) {
      where.user_id = userId;
    }
    const results = this.findAll({ where, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Set an environment as active
   */
  setActive(id: string): Environment | null {
    const env = this.findById(id);
    if (!env) return null;

    // Deactivate all environments for this user
    const transaction = this.db.transaction(() => {
      this.db.prepare(
        `UPDATE ${this.tableName} SET is_active = 0, updated_at = ? WHERE user_id = ?`
      ).run(this.now(), env.user_id);

      // Activate the selected environment
      this.db.prepare(
        `UPDATE ${this.tableName} SET is_active = 1, updated_at = ? WHERE id = ?`
      ).run(this.now(), id);
    });

    transaction();
    return this.findById(id);
  }

  /**
   * Deactivate all environments
   */
  deactivateAll(userId?: string): void {
    let sql = `UPDATE ${this.tableName} SET is_active = 0, updated_at = ?`;
    const params: unknown[] = [this.now()];

    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    this.db.prepare(sql).run(...params);
  }

  /**
   * Get environment with variables
   */
  getWithVariables(id: string): EnvironmentWithVariables | null {
    const env = this.findById(id);
    if (!env) return null;

    const variables = this.db
      .prepare(
        `SELECT * FROM environment_variables WHERE environment_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY sort_order ASC`
      )
      .all(id) as EnvironmentVariable[];

    return { ...env, variables };
  }

  /**
   * Duplicate an environment
   */
  duplicate(id: string, newName?: string): Environment | null {
    const original = this.getWithVariables(id);
    if (!original) return null;

    const { id: _, created_at, updated_at, synced_at, variables, ...data } = original;
    const newEnv = this.create({
      ...data,
      name: newName || `${original.name} (Copy)`,
      is_active: 0,
    });

    // Copy variables
    const variableRepo = new EnvironmentVariableRepository();
    for (const variable of variables) {
      const { id: __, environment_id, created_at: ___, updated_at: ____, synced_at: _____, ...varData } = variable;
      variableRepo.create({
        ...varData,
        environment_id: newEnv.id,
      });
    }

    return newEnv;
  }

  /**
   * Search environments by name
   */
  search(query: string, userId?: string): Environment[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? AND (is_deleted = 0 OR is_deleted IS NULL)`;
    const params: unknown[] = [`%${query}%`];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY name ASC';

    return this.rawQuery<Environment>(sql, params);
  }

  /**
   * Update sort order
   */
  updateSortOrder(id: string, sortOrder: number): Environment | null {
    return this.update(id, { sort_order: sortOrder });
  }

  /**
   * Reorder environments
   */
  reorder(orderedIds: string[]): void {
    const transaction = this.db.transaction(() => {
      orderedIds.forEach((id, index) => {
        this.updateSortOrder(id, index);
      });
    });
    transaction();
  }
}

export class EnvironmentVariableRepository extends BaseRepository<EnvironmentVariable> {
  constructor() {
    super('environment_variables');
  }

  /**
   * Find variables by environment ID
   */
  findByEnvironmentId(environmentId: string, options: QueryOptions = {}): EnvironmentVariable[] {
    return this.findBy('environment_id', environmentId, { ...options, orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Find variable by key in environment
   */
  findByKey(environmentId: string, key: string): EnvironmentVariable | null {
    const results = this.findAll({
      where: { environment_id: environmentId, key },
      limit: 1,
    });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Set or update a variable
   */
  setVariable(environmentId: string, key: string, value: string, isSecret = false): EnvironmentVariable {
    const existing = this.findByKey(environmentId, key);
    
    if (existing) {
      return this.update(existing.id, { value, is_secret: isSecret ? 1 : 0 }) as EnvironmentVariable;
    }
    
    return this.create({
      environment_id: environmentId,
      key,
      value,
      is_secret: isSecret ? 1 : 0,
      enabled: 1,
      sort_order: this.count({ where: { environment_id: environmentId } }),
    });
  }

  /**
   * Toggle variable enabled state
   */
  toggleEnabled(id: string): EnvironmentVariable | null {
    const variable = this.findById(id);
    if (!variable) return null;
    return this.update(id, { enabled: variable.enabled ? 0 : 1 });
  }

  /**
   * Get enabled variables for an environment
   */
  getEnabledVariables(environmentId: string): EnvironmentVariable[] {
    return this.findAll({
      where: { environment_id: environmentId, enabled: 1 },
      orderBy: 'sort_order',
      order: 'ASC',
    });
  }

  /**
   * Get variables as key-value map
   */
  getVariablesMap(environmentId: string, includeDisabled = false): Record<string, string> {
    const variables = includeDisabled
      ? this.findByEnvironmentId(environmentId)
      : this.getEnabledVariables(environmentId);

    return variables.reduce((map, v) => {
      map[v.key] = v.value || '';
      return map;
    }, {} as Record<string, string>);
  }

  /**
   * Bulk set variables
   */
  bulkSetVariables(
    environmentId: string,
    variables: { key: string; value: string; isSecret?: boolean }[]
  ): EnvironmentVariable[] {
    const results: EnvironmentVariable[] = [];
    
    const transaction = this.db.transaction(() => {
      for (const { key, value, isSecret } of variables) {
        results.push(this.setVariable(environmentId, key, value, isSecret));
      }
    });
    
    transaction();
    return results;
  }

  /**
   * Update sort order
   */
  updateSortOrder(id: string, sortOrder: number): EnvironmentVariable | null {
    return this.update(id, { sort_order: sortOrder });
  }

  /**
   * Reorder variables
   */
  reorder(orderedIds: string[]): void {
    const transaction = this.db.transaction(() => {
      orderedIds.forEach((id, index) => {
        this.updateSortOrder(id, index);
      });
    });
    transaction();
  }
}

// Export singleton instances
export const environmentRepository = new EnvironmentRepository();
export const environmentVariableRepository = new EnvironmentVariableRepository();