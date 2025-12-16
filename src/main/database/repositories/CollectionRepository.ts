/**
 * Collection Repository
 * 
 * Handles CRUD operations for collections.
 */

import { BaseRepository, BaseEntity, QueryOptions } from './BaseRepository';

export interface Collection extends BaseEntity {
  user_id?: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  sort_order: number;
}

export interface CollectionWithChildren extends Collection {
  children?: CollectionWithChildren[];
  folders?: unknown[];
  requests?: unknown[];
}

export class CollectionRepository extends BaseRepository<Collection> {
  constructor() {
    super('collections');
  }

  /**
   * Find collections by user ID
   */
  findByUserId(userId: string, options: QueryOptions = {}): Collection[] {
    return this.findBy('user_id', userId, { ...options, orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Find root collections (no parent)
   */
  findRootCollections(userId?: string): Collection[] {
    const where: Record<string, unknown> = { parent_id: null };
    if (userId) {
      where.user_id = userId;
    }
    return this.findAll({ where, orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Find child collections
   */
  findChildren(parentId: string): Collection[] {
    return this.findBy('parent_id', parentId, { orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Get collection tree structure
   */
  getTree(userId?: string): CollectionWithChildren[] {
    const rootCollections = this.findRootCollections(userId);
    return rootCollections.map((collection) => this.buildTree(collection));
  }

  /**
   * Build tree recursively
   */
  private buildTree(collection: Collection): CollectionWithChildren {
    const children = this.findChildren(collection.id);
    return {
      ...collection,
      children: children.map((child) => this.buildTree(child)),
    };
  }

  /**
   * Move collection to a new parent
   */
  moveToParent(id: string, newParentId: string | null): Collection | null {
    return this.update(id, { parent_id: newParentId });
  }

  /**
   * Update sort order
   */
  updateSortOrder(id: string, sortOrder: number): Collection | null {
    return this.update(id, { sort_order: sortOrder });
  }

  /**
   * Reorder collections
   */
  reorder(orderedIds: string[]): void {
    const transaction = this.db.transaction(() => {
      orderedIds.forEach((id, index) => {
        this.updateSortOrder(id, index);
      });
    });
    transaction();
  }

  /**
   * Duplicate a collection
   */
  duplicate(id: string, newName?: string): Collection | null {
    const original = this.findById(id);
    if (!original) {
      return null;
    }

    const { id: _, created_at, updated_at, synced_at, ...data } = original;
    return this.create({
      ...data,
      name: newName || `${original.name} (Copy)`,
    });
  }

  /**
   * Search collections by name
   */
  search(query: string, userId?: string): Collection[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? AND (is_deleted = 0 OR is_deleted IS NULL)`;
    const params: unknown[] = [`%${query}%`];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY name ASC';

    return this.rawQuery<Collection>(sql, params);
  }

  /**
   * Get collection statistics
   */
  getStats(id: string): { requestCount: number; folderCount: number } {
    const requestCount = this.rawQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM requests WHERE collection_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
      [id]
    )[0]?.count || 0;

    const folderCount = this.rawQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM folders WHERE collection_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
      [id]
    )[0]?.count || 0;

    return { requestCount, folderCount };
  }
}

// Export singleton instance
export const collectionRepository = new CollectionRepository();