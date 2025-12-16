/**
 * Database Migrations
 * 
 * This module handles database schema migrations for WireSniff.
 * Each migration is versioned and runs only once.
 */

import Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * All database migrations in order
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db: Database.Database) => {
      // Users table (for local user data, synced with Supabase)
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          display_name TEXT,
          avatar_url TEXT,
          subscription_tier TEXT DEFAULT 'free',
          subscription_status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT
        )
      `);

      // Collections table
      db.exec(`
        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          parent_id TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE CASCADE
        )
      `);

      // Folders table (for organizing requests within collections)
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          collection_id TEXT NOT NULL,
          name TEXT NOT NULL,
          parent_id TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        )
      `);

      // Requests table
      db.exec(`
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          folder_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          method TEXT NOT NULL DEFAULT 'GET',
          url TEXT NOT NULL DEFAULT '',
          protocol TEXT DEFAULT 'http',
          params TEXT DEFAULT '[]',
          headers TEXT DEFAULT '[]',
          body TEXT,
          body_type TEXT DEFAULT 'none',
          auth_type TEXT DEFAULT 'none',
          auth_config TEXT DEFAULT '{}',
          pre_request_script TEXT,
          test_script TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);

      // Environments table
      db.exec(`
        CREATE TABLE IF NOT EXISTS environments (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          is_active INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Environment variables table
      db.exec(`
        CREATE TABLE IF NOT EXISTS environment_variables (
          id TEXT PRIMARY KEY,
          environment_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          is_secret INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
        )
      `);

      // Global variables table
      db.exec(`
        CREATE TABLE IF NOT EXISTS global_variables (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          key TEXT NOT NULL,
          value TEXT,
          is_secret INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Request history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS request_history (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          request_id TEXT,
          name TEXT,
          method TEXT NOT NULL,
          url TEXT NOT NULL,
          protocol TEXT DEFAULT 'http',
          params TEXT DEFAULT '[]',
          headers TEXT DEFAULT '[]',
          body TEXT,
          body_type TEXT,
          auth_type TEXT,
          auth_config TEXT,
          response_status INTEGER,
          response_status_text TEXT,
          response_headers TEXT,
          response_body TEXT,
          response_size INTEGER,
          response_time INTEGER,
          executed_at TEXT DEFAULT (datetime('now')),
          created_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL
        )
      `);

      // Settings table
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          key TEXT NOT NULL,
          value TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, key)
        )
      `);

      // WebSocket connections table
      db.exec(`
        CREATE TABLE IF NOT EXISTS websocket_connections (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          folder_id TEXT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          protocols TEXT DEFAULT '[]',
          headers TEXT DEFAULT '[]',
          auto_reconnect INTEGER DEFAULT 0,
          reconnect_interval INTEGER DEFAULT 5000,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);

      // WebSocket messages table
      db.exec(`
        CREATE TABLE IF NOT EXISTS websocket_messages (
          id TEXT PRIMARY KEY,
          connection_id TEXT NOT NULL,
          direction TEXT NOT NULL,
          message_type TEXT NOT NULL,
          content TEXT,
          timestamp TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (connection_id) REFERENCES websocket_connections(id) ON DELETE CASCADE
        )
      `);

      // GraphQL requests table
      db.exec(`
        CREATE TABLE IF NOT EXISTS graphql_requests (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          folder_id TEXT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          query TEXT,
          variables TEXT DEFAULT '{}',
          operation_name TEXT,
          headers TEXT DEFAULT '[]',
          auth_type TEXT DEFAULT 'none',
          auth_config TEXT DEFAULT '{}',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);

      // SSE connections table
      db.exec(`
        CREATE TABLE IF NOT EXISTS sse_connections (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          folder_id TEXT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          headers TEXT DEFAULT '[]',
          with_credentials INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          synced_at TEXT,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);

      // Sync queue table (for offline-first sync)
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          data TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          attempts INTEGER DEFAULT 0,
          last_error TEXT,
          status TEXT DEFAULT 'pending'
        )
      `);

      // Create indexes for better query performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
        CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON collections(parent_id);
        CREATE INDEX IF NOT EXISTS idx_folders_collection_id ON folders(collection_id);
        CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
        CREATE INDEX IF NOT EXISTS idx_requests_collection_id ON requests(collection_id);
        CREATE INDEX IF NOT EXISTS idx_requests_folder_id ON requests(folder_id);
        CREATE INDEX IF NOT EXISTS idx_environments_user_id ON environments(user_id);
        CREATE INDEX IF NOT EXISTS idx_environment_variables_environment_id ON environment_variables(environment_id);
        CREATE INDEX IF NOT EXISTS idx_global_variables_user_id ON global_variables(user_id);
        CREATE INDEX IF NOT EXISTS idx_request_history_user_id ON request_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_request_history_request_id ON request_history(request_id);
        CREATE INDEX IF NOT EXISTS idx_request_history_executed_at ON request_history(executed_at);
        CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
        CREATE INDEX IF NOT EXISTS idx_websocket_connections_collection_id ON websocket_connections(collection_id);
        CREATE INDEX IF NOT EXISTS idx_websocket_messages_connection_id ON websocket_messages(connection_id);
        CREATE INDEX IF NOT EXISTS idx_graphql_requests_collection_id ON graphql_requests(collection_id);
        CREATE INDEX IF NOT EXISTS idx_sse_connections_collection_id ON sse_connections(collection_id);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_table_name ON sync_queue(table_name);
      `);
    },
  },
  {
    version: 2,
    name: 'add_network_captures',
    up: (db: Database.Database) => {
      // Network captures table (for mitmproxy/tshark integration)
      db.exec(`
        CREATE TABLE IF NOT EXISTS network_captures (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          session_id TEXT NOT NULL,
          method TEXT,
          url TEXT,
          host TEXT,
          path TEXT,
          protocol TEXT,
          request_headers TEXT,
          request_body TEXT,
          response_status INTEGER,
          response_headers TEXT,
          response_body TEXT,
          response_size INTEGER,
          duration INTEGER,
          timestamp TEXT DEFAULT (datetime('now')),
          source TEXT DEFAULT 'mitmproxy',
          tags TEXT DEFAULT '[]',
          notes TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Capture sessions table
      db.exec(`
        CREATE TABLE IF NOT EXISTS capture_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          started_at TEXT DEFAULT (datetime('now')),
          ended_at TEXT,
          status TEXT DEFAULT 'active',
          config TEXT DEFAULT '{}',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_network_captures_session_id ON network_captures(session_id);
        CREATE INDEX IF NOT EXISTS idx_network_captures_user_id ON network_captures(user_id);
        CREATE INDEX IF NOT EXISTS idx_network_captures_timestamp ON network_captures(timestamp);
        CREATE INDEX IF NOT EXISTS idx_capture_sessions_user_id ON capture_sessions(user_id);
      `);
    },
  },
  {
    version: 3,
    name: 'add_cookies_and_certificates',
    up: (db: Database.Database) => {
      // Cookies table
      db.exec(`
        CREATE TABLE IF NOT EXISTS cookies (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          domain TEXT NOT NULL,
          name TEXT NOT NULL,
          value TEXT,
          path TEXT DEFAULT '/',
          expires TEXT,
          http_only INTEGER DEFAULT 0,
          secure INTEGER DEFAULT 0,
          same_site TEXT DEFAULT 'Lax',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Certificates table (for SSL/TLS management)
      db.exec(`
        CREATE TABLE IF NOT EXISTS certificates (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          host TEXT,
          cert_data TEXT,
          key_data TEXT,
          passphrase TEXT,
          enabled INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cookies_user_id ON cookies(user_id);
        CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain);
        CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
        CREATE INDEX IF NOT EXISTS idx_certificates_host ON certificates(host);
      `);
    },
  },
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Get current version
  const currentVersion = db
    .prepare('SELECT MAX(version) as version FROM migrations')
    .get() as { version: number | null };
  
  const startVersion = currentVersion?.version ?? 0;

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > startVersion) {
      console.log(`[Database] Running migration ${migration.version}: ${migration.name}`);
      
      const transaction = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      });
      
      transaction();
      
      console.log(`[Database] Migration ${migration.version} completed`);
    }
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(db: Database.Database): {
  currentVersion: number;
  pendingMigrations: number;
  appliedMigrations: { version: number; name: string; applied_at: string }[];
} {
  const applied = db
    .prepare('SELECT version, name, applied_at FROM migrations ORDER BY version')
    .all() as { version: number; name: string; applied_at: string }[];
  
  const currentVersion = applied.length > 0 ? applied[applied.length - 1].version : 0;
  const pendingMigrations = migrations.filter((m) => m.version > currentVersion).length;

  return {
    currentVersion,
    pendingMigrations,
    appliedMigrations: applied,
  };
}