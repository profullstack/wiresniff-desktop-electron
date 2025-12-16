/**
 * WireSniff Database Module
 * 
 * This module provides SQLite database functionality using better-sqlite3
 * for offline-first local storage with sync capabilities to Supabase.
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations';

let db: Database.Database | null = null;

/**
 * Get the database file path
 */
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'wiresniff.db');
}

/**
 * Initialize the database connection
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection with WAL mode for better performance
  db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Run migrations
  runMigrations(db);
  
  console.log(`[Database] Initialized at ${dbPath}`);
  
  return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Connection closed');
  }
}

/**
 * Export database for backup
 */
export function exportDatabase(exportPath: string): void {
  const database = getDatabase();
  database.backup(exportPath);
  console.log(`[Database] Exported to ${exportPath}`);
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  size: number;
  tables: string[];
  rowCounts: Record<string, number>;
} {
  const database = getDatabase();
  const dbPath = getDatabasePath();
  
  // Get file size
  const stats = fs.statSync(dbPath);
  const size = stats.size;
  
  // Get table names
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row: { name: string }) => row.name);
  
  // Get row counts for each table
  const rowCounts: Record<string, number> = {};
  for (const table of tables) {
    const result = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    rowCounts[table] = result.count;
  }
  
  return { size, tables, rowCounts };
}

export { db };