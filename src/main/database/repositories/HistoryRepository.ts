/**
 * History Repository
 * 
 * Handles CRUD operations for request history.
 */

import { BaseRepository, BaseEntity, QueryOptions } from './BaseRepository';

export interface RequestHistory extends BaseEntity {
  user_id?: string;
  request_id?: string;
  name?: string;
  method: string;
  url: string;
  protocol: string;
  params: string;
  headers: string;
  body?: string;
  body_type?: string;
  auth_type?: string;
  auth_config?: string;
  response_status?: number;
  response_status_text?: string;
  response_headers?: string;
  response_body?: string;
  response_size?: number;
  response_time?: number;
  executed_at: string;
}

export interface HistoryStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  methodBreakdown: Record<string, number>;
}

export class HistoryRepository extends BaseRepository<RequestHistory> {
  constructor() {
    super('request_history');
  }

  /**
   * Find history by user ID
   */
  findByUserId(userId: string, options: QueryOptions = {}): RequestHistory[] {
    return this.findBy('user_id', userId, { ...options, orderBy: 'executed_at', order: 'DESC' });
  }

  /**
   * Find history by request ID
   */
  findByRequestId(requestId: string, options: QueryOptions = {}): RequestHistory[] {
    return this.findBy('request_id', requestId, { ...options, orderBy: 'executed_at', order: 'DESC' });
  }

  /**
   * Get recent history
   */
  getRecent(limit = 50, userId?: string): RequestHistory[] {
    const where: Record<string, unknown> = {};
    if (userId) {
      where.user_id = userId;
    }
    return this.findAll({ where, orderBy: 'executed_at', order: 'DESC', limit });
  }

  /**
   * Search history by URL or name
   */
  search(query: string, userId?: string): RequestHistory[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE (url LIKE ? OR name LIKE ?)`;
    const params: unknown[] = [`%${query}%`, `%${query}%`];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY executed_at DESC';

    return this.rawQuery<RequestHistory>(sql, params);
  }

  /**
   * Find history by method
   */
  findByMethod(method: string, userId?: string, limit?: number): RequestHistory[] {
    const where: Record<string, unknown> = { method };
    if (userId) {
      where.user_id = userId;
    }
    return this.findAll({ where, orderBy: 'executed_at', order: 'DESC', limit });
  }

  /**
   * Find history by status code range
   */
  findByStatusRange(minStatus: number, maxStatus: number, userId?: string): RequestHistory[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE response_status >= ? AND response_status <= ?`;
    const params: unknown[] = [minStatus, maxStatus];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY executed_at DESC';

    return this.rawQuery<RequestHistory>(sql, params);
  }

  /**
   * Find successful requests (2xx)
   */
  findSuccessful(userId?: string, limit?: number): RequestHistory[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE response_status >= 200 AND response_status < 300`;
    const params: unknown[] = [];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY executed_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.rawQuery<RequestHistory>(sql, params);
  }

  /**
   * Find failed requests (4xx, 5xx)
   */
  findFailed(userId?: string, limit?: number): RequestHistory[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE response_status >= 400`;
    const params: unknown[] = [];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY executed_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.rawQuery<RequestHistory>(sql, params);
  }

  /**
   * Find history within date range
   */
  findByDateRange(startDate: string, endDate: string, userId?: string): RequestHistory[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE executed_at >= ? AND executed_at <= ?`;
    const params: unknown[] = [startDate, endDate];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY executed_at DESC';

    return this.rawQuery<RequestHistory>(sql, params);
  }

  /**
   * Get history statistics
   */
  getStats(userId?: string): HistoryStats {
    let whereClause = '';
    const params: unknown[] = [];

    if (userId) {
      whereClause = ' WHERE user_id = ?';
      params.push(userId);
    }

    // Total requests
    const totalResult = this.rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}${whereClause}`,
      params
    );
    const totalRequests = totalResult[0]?.count || 0;

    // Successful requests (2xx)
    const successResult = this.rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}${whereClause}${whereClause ? ' AND' : ' WHERE'} response_status >= 200 AND response_status < 300`,
      params
    );
    const successfulRequests = successResult[0]?.count || 0;

    // Failed requests (4xx, 5xx)
    const failedResult = this.rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}${whereClause}${whereClause ? ' AND' : ' WHERE'} response_status >= 400`,
      params
    );
    const failedRequests = failedResult[0]?.count || 0;

    // Average response time
    const avgResult = this.rawQuery<{ avg: number }>(
      `SELECT AVG(response_time) as avg FROM ${this.tableName}${whereClause}${whereClause ? ' AND' : ' WHERE'} response_time IS NOT NULL`,
      params
    );
    const averageResponseTime = avgResult[0]?.avg || 0;

    // Method breakdown
    const methodResult = this.rawQuery<{ method: string; count: number }>(
      `SELECT method, COUNT(*) as count FROM ${this.tableName}${whereClause} GROUP BY method`,
      params
    );
    const methodBreakdown = methodResult.reduce((acc, row) => {
      acc[row.method] = row.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      methodBreakdown,
    };
  }

  /**
   * Clear history older than a certain date
   */
  clearOlderThan(date: string, userId?: string): number {
    let sql = `DELETE FROM ${this.tableName} WHERE executed_at < ?`;
    const params: unknown[] = [date];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    const result = this.rawExecute(sql, params);
    return result.changes;
  }

  /**
   * Clear all history
   */
  clearAll(userId?: string): number {
    let sql = `DELETE FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    const result = this.rawExecute(sql, params);
    return result.changes;
  }

  /**
   * Get unique URLs from history
   */
  getUniqueUrls(userId?: string, limit = 100): string[] {
    let sql = `SELECT DISTINCT url FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY executed_at DESC LIMIT ?';
    params.push(limit);

    const results = this.rawQuery<{ url: string }>(sql, params);
    return results.map((r) => r.url);
  }

  /**
   * Get slowest requests
   */
  getSlowest(limit = 10, userId?: string): RequestHistory[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE response_time IS NOT NULL`;
    const params: unknown[] = [];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY response_time DESC LIMIT ?';
    params.push(limit);

    return this.rawQuery<RequestHistory>(sql, params);
  }

  /**
   * Replay a history entry (create a new request from history)
   */
  replayToRequest(historyId: string): Partial<RequestHistory> | null {
    const history = this.findById(historyId);
    if (!history) return null;

    return {
      name: history.name,
      method: history.method,
      url: history.url,
      protocol: history.protocol,
      params: history.params,
      headers: history.headers,
      body: history.body,
      body_type: history.body_type,
      auth_type: history.auth_type,
      auth_config: history.auth_config,
    };
  }
}

// Export singleton instance
export const historyRepository = new HistoryRepository();