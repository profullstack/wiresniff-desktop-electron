/**
 * Request Repository
 * 
 * Handles CRUD operations for HTTP requests.
 */

import { BaseRepository, BaseEntity, QueryOptions } from './BaseRepository';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
export type AuthType = 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'digest' | 'aws-sig';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface AuthConfig {
  type: AuthType;
  basic?: { username: string; password: string };
  bearer?: { token: string; prefix?: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: {
    grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit';
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    authUrl?: string;
    tokenUrl?: string;
    scope?: string;
  };
}

export interface Request extends BaseEntity {
  collection_id?: string;
  folder_id?: string | null;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  protocol: string;
  params: string; // JSON string of KeyValuePair[]
  headers: string; // JSON string of KeyValuePair[]
  body?: string;
  body_type: BodyType;
  auth_type: AuthType;
  auth_config: string; // JSON string of AuthConfig
  pre_request_script?: string;
  test_script?: string;
  sort_order: number;
}

export interface ParsedRequest extends Omit<Request, 'params' | 'headers' | 'auth_config'> {
  params: KeyValuePair[];
  headers: KeyValuePair[];
  auth_config: AuthConfig;
}

export class RequestRepository extends BaseRepository<Request> {
  constructor() {
    super('requests');
  }

  /**
   * Find requests by collection ID
   */
  findByCollectionId(collectionId: string, options: QueryOptions = {}): Request[] {
    return this.findBy('collection_id', collectionId, { ...options, orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Find requests by folder ID
   */
  findByFolderId(folderId: string, options: QueryOptions = {}): Request[] {
    return this.findBy('folder_id', folderId, { ...options, orderBy: 'sort_order', order: 'ASC' });
  }

  /**
   * Find requests in collection root (no folder)
   */
  findInCollectionRoot(collectionId: string): Request[] {
    return this.findAll({
      where: { collection_id: collectionId, folder_id: null },
      orderBy: 'sort_order',
      order: 'ASC',
    });
  }

  /**
   * Create a new request with parsed data
   */
  createFromParsed(data: Partial<ParsedRequest>): Request {
    const requestData: Partial<Request> = {
      ...data,
      params: JSON.stringify(data.params || []),
      headers: JSON.stringify(data.headers || []),
      auth_config: JSON.stringify(data.auth_config || { type: 'none' }),
    };
    return this.create(requestData);
  }

  /**
   * Update a request with parsed data
   */
  updateFromParsed(id: string, data: Partial<ParsedRequest>): Request | null {
    const { params, headers, auth_config, ...rest } = data;
    const updateData: Partial<Request> = { ...rest };
    
    if (params !== undefined) {
      updateData.params = JSON.stringify(params);
    }
    if (headers !== undefined) {
      updateData.headers = JSON.stringify(headers);
    }
    if (auth_config !== undefined) {
      updateData.auth_config = JSON.stringify(auth_config);
    }
    
    return this.update(id, updateData);
  }

  /**
   * Get request with parsed JSON fields
   */
  findByIdParsed(id: string): ParsedRequest | null {
    const request = this.findById(id);
    if (!request) return null;
    return this.parseRequest(request);
  }

  /**
   * Parse a request's JSON fields
   */
  parseRequest(request: Request): ParsedRequest {
    return {
      ...request,
      params: this.safeJsonParse(request.params, []),
      headers: this.safeJsonParse(request.headers, []),
      auth_config: this.safeJsonParse(request.auth_config, { type: 'none' }),
    };
  }

  /**
   * Safe JSON parse with fallback
   */
  private safeJsonParse<T>(json: string | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  /**
   * Move request to a different folder
   */
  moveToFolder(id: string, folderId: string | null): Request | null {
    return this.update(id, { folder_id: folderId });
  }

  /**
   * Move request to a different collection
   */
  moveToCollection(id: string, collectionId: string, folderId: string | null = null): Request | null {
    return this.update(id, { collection_id: collectionId, folder_id: folderId });
  }

  /**
   * Update sort order
   */
  updateSortOrder(id: string, sortOrder: number): Request | null {
    return this.update(id, { sort_order: sortOrder });
  }

  /**
   * Reorder requests
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
   * Duplicate a request
   */
  duplicate(id: string, newName?: string): Request | null {
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
   * Search requests by name or URL
   */
  search(query: string, collectionId?: string): Request[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE (name LIKE ? OR url LIKE ?) AND (is_deleted = 0 OR is_deleted IS NULL)`;
    const params: unknown[] = [`%${query}%`, `%${query}%`];

    if (collectionId) {
      sql += ' AND collection_id = ?';
      params.push(collectionId);
    }

    sql += ' ORDER BY name ASC';

    return this.rawQuery<Request>(sql, params);
  }

  /**
   * Find requests by method
   */
  findByMethod(method: HttpMethod, collectionId?: string): Request[] {
    const where: Record<string, unknown> = { method };
    if (collectionId) {
      where.collection_id = collectionId;
    }
    return this.findAll({ where, orderBy: 'name', order: 'ASC' });
  }

  /**
   * Get recent requests
   */
  getRecent(limit = 10): Request[] {
    return this.findAll({ orderBy: 'updated_at', order: 'DESC', limit });
  }

  /**
   * Clone request to another collection
   */
  cloneToCollection(id: string, targetCollectionId: string, targetFolderId?: string): Request | null {
    const original = this.findById(id);
    if (!original) {
      return null;
    }

    const { id: _, created_at, updated_at, synced_at, ...data } = original;
    return this.create({
      ...data,
      collection_id: targetCollectionId,
      folder_id: targetFolderId || null,
      name: `${original.name} (Copy)`,
    });
  }
}

// Export singleton instance
export const requestRepository = new RequestRepository();