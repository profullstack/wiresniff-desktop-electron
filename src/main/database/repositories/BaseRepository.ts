/**
 * Base Repository
 * 
 * Provides common CRUD operations for all database entities.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';

export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
  synced_at?: string | null;
  is_deleted?: number;
}

export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected tableName: string;
  protected db: Database.Database;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.db = getDatabase();
  }

  /**
   * Generate a new UUID
   */
  protected generateId(): string {
    return uuidv4();
  }

  /**
   * Get current timestamp in ISO format
   */
  protected now(): string {
    return new Date().toISOString();
  }

  /**
   * Find a record by ID
   */
  findById(id: string, includeDeleted = false): T | null {
    const deletedClause = includeDeleted ? '' : ' AND (is_deleted = 0 OR is_deleted IS NULL)';
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?${deletedClause}`);
    return stmt.get(id) as T | null;
  }

  /**
   * Find all records
   */
  findAll(options: QueryOptions = {}): T[] {
    const { where, orderBy, order = 'ASC', limit, offset, includeDeleted = false } = options;
    
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: unknown[] = [];

    if (!includeDeleted) {
      query += ' AND (is_deleted = 0 OR is_deleted IS NULL)';
    }

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        if (value === null) {
          query += ` AND ${key} IS NULL`;
        } else {
          query += ` AND ${key} = ?`;
          params.push(value);
        }
      }
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy} ${order}`;
    }

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    if (offset) {
      query += ` OFFSET ?`;
      params.push(offset);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as T[];
  }

  /**
   * Find records by a specific field
   */
  findBy(field: string, value: unknown, options: QueryOptions = {}): T[] {
    return this.findAll({ ...options, where: { ...options.where, [field]: value } });
  }

  /**
   * Find one record by a specific field
   */
  findOneBy(field: string, value: unknown, includeDeleted = false): T | null {
    const results = this.findBy(field, value, { limit: 1, includeDeleted });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Create a new record
   */
  create(data: Partial<T>): T {
    const id = data.id || this.generateId();
    const now = this.now();
    
    const record = {
      ...data,
      id,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
      is_deleted: 0,
    };

    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(record);

    const stmt = this.db.prepare(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    );
    stmt.run(...values);

    // Add to sync queue
    this.addToSyncQueue(id, 'INSERT', record);

    return this.findById(id) as T;
  }

  /**
   * Update a record
   */
  update(id: string, data: Partial<T>): T | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = this.now();
    const updateData = {
      ...data,
      updated_at: now,
      synced_at: null, // Mark as needing sync
    };

    // Remove id from update data
    delete (updateData as Partial<T>).id;
    delete (updateData as Partial<T>).created_at;

    const columns = Object.keys(updateData);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const values = [...Object.values(updateData), id];

    const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`);
    stmt.run(...values);

    // Add to sync queue
    this.addToSyncQueue(id, 'UPDATE', updateData);

    return this.findById(id);
  }

  /**
   * Soft delete a record
   */
  softDelete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) {
      return false;
    }

    const now = this.now();
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName} SET is_deleted = 1, updated_at = ?, synced_at = NULL WHERE id = ?`
    );
    stmt.run(now, id);

    // Add to sync queue
    this.addToSyncQueue(id, 'DELETE', { id });

    return true;
  }

  /**
   * Hard delete a record (permanent)
   */
  hardDelete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Restore a soft-deleted record
   */
  restore(id: string): T | null {
    const existing = this.findById(id, true);
    if (!existing || !existing.is_deleted) {
      return null;
    }

    const now = this.now();
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName} SET is_deleted = 0, updated_at = ?, synced_at = NULL WHERE id = ?`
    );
    stmt.run(now, id);

    // Add to sync queue
    this.addToSyncQueue(id, 'UPDATE', { is_deleted: 0 });

    return this.findById(id);
  }

  /**
   * Count records
   */
  count(options: QueryOptions = {}): number {
    const { where, includeDeleted = false } = options;
    
    let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE 1=1`;
    const params: unknown[] = [];

    if (!includeDeleted) {
      query += ' AND (is_deleted = 0 OR is_deleted IS NULL)';
    }

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        if (value === null) {
          query += ` AND ${key} IS NULL`;
        } else {
          query += ` AND ${key} = ?`;
          params.push(value);
        }
      }
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Check if a record exists
   */
  exists(id: string, includeDeleted = false): boolean {
    return this.findById(id, includeDeleted) !== null;
  }

  /**
   * Bulk create records
   */
  bulkCreate(records: Partial<T>[]): T[] {
    const created: T[] = [];
    
    const transaction = this.db.transaction(() => {
      for (const record of records) {
        created.push(this.create(record));
      }
    });
    
    transaction();
    return created;
  }

  /**
   * Bulk update records
   */
  bulkUpdate(updates: { id: string; data: Partial<T> }[]): T[] {
    const updated: T[] = [];
    
    const transaction = this.db.transaction(() => {
      for (const { id, data } of updates) {
        const result = this.update(id, data);
        if (result) {
          updated.push(result);
        }
      }
    });
    
    transaction();
    return updated;
  }

  /**
   * Bulk soft delete records
   */
  bulkSoftDelete(ids: string[]): number {
    let count = 0;
    
    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        if (this.softDelete(id)) {
          count++;
        }
      }
    });
    
    transaction();
    return count;
  }

  /**
   * Get records that need syncing
   */
  getUnsyncedRecords(): T[] {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE synced_at IS NULL AND (is_deleted = 0 OR is_deleted IS NULL)`
    );
    return stmt.all() as T[];
  }

  /**
   * Mark a record as synced
   */
  markAsSynced(id: string): void {
    const now = this.now();
    const stmt = this.db.prepare(`UPDATE ${this.tableName} SET synced_at = ? WHERE id = ?`);
    stmt.run(now, id);
  }

  /**
   * Add operation to sync queue
   */
  protected addToSyncQueue(recordId: string, operation: string, data: unknown): void {
    const id = this.generateId();
    const stmt = this.db.prepare(
      `INSERT INTO sync_queue (id, table_name, record_id, operation, data, status) VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, this.tableName, recordId, operation, JSON.stringify(data), 'pending');
  }

  /**
   * Execute a raw query
   */
  rawQuery<R>(query: string, params: unknown[] = []): R[] {
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as R[];
  }

  /**
   * Execute a raw statement
   */
  rawExecute(query: string, params: unknown[] = []): Database.RunResult {
    const stmt = this.db.prepare(query);
    return stmt.run(...params);
  }
}