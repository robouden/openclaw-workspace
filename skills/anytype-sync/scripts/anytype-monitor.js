#!/usr/bin/env node

/**
 * AnyType → PostgreSQL Monitor & Sync
 * 
 * Monitors AnyType space SQLite databases for changes
 * Syncs new/updated objects to PostgreSQL
 * Enables OpenClaw to query and act on workspace data
 * 
 * Usage:
 *   node anytype-monitor.js --spaceId xxx --pgUrl postgres://... --watch
 *   node anytype-monitor.js --list-spaces  (discover spaces)
 *   node anytype-monitor.js --sync-now     (one-time sync)
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const pg = require('pg');
const crypto = require('crypto');

class AnytypeMonitor {
  constructor(config = {}) {
    this.config = {
      accountDir: config.accountDir || path.join(
        process.env.HOME || '.',
        '.config/anytype/data',
        config.accountId || process.env.ANYTYPE_ACCOUNT_ID || ''
      ),
      spaceId: config.spaceId || process.env.ANYTYPE_SPACE_ID || '',
      pgUrl: config.pgUrl || process.env.DATABASE_URL || 'postgresql://localhost/openclaw',
      pollInterval: config.pollInterval || 60000, // 60 seconds
      verbose: config.verbose || false,
      objectStoreDir: null,
      spaceDbPath: null
    };

    this.setupPaths();
    this.pgPool = null;
    this.spaceDb = null;
    this.lastSyncTime = {};
  }

  log(msg, level = 'info') {
    if (this.config.verbose || level !== 'debug') {
      console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    }
  }

  /**
   * Setup file paths
   */
  setupPaths() {
    this.config.objectStoreDir = path.join(this.config.accountDir, 'objectstore');
    
    if (this.config.spaceId) {
      this.config.spaceDbPath = path.join(
        this.config.objectStoreDir,
        this.config.spaceId,
        'objects.db'
      );
    }

    this.log(`Account dir: ${this.config.accountDir}`);
    if (this.config.spaceDbPath) {
      this.log(`Space DB: ${this.config.spaceDbPath}`);
    }
  }

  /**
   * Initialize PostgreSQL connection
   */
  async initPostgres() {
    this.log('Connecting to PostgreSQL...');
    this.pgPool = new pg.Pool({ connectionString: this.config.pgUrl });
    
    // Test connection
    const client = await this.pgPool.connect();
    this.log('✓ Connected to PostgreSQL');
    client.release();

    // Create tables if needed
    await this.createTables();
  }

  /**
   * Create PostgreSQL tables for AnyType data
   */
  async createTables() {
    const client = await this.pgPool.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS anytype_objects (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL,
          type TEXT,
          title TEXT,
          content TEXT,
          data JSONB,
          last_modified BIGINT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checksum TEXT,
          UNIQUE(space_id, id)
        );

        CREATE INDEX IF NOT EXISTS idx_anytype_space ON anytype_objects(space_id);
        CREATE INDEX IF NOT EXISTS idx_anytype_modified ON anytype_objects(last_modified);
        CREATE INDEX IF NOT EXISTS idx_anytype_type ON anytype_objects(type);

        CREATE TABLE IF NOT EXISTS anytype_sync_state (
          space_id TEXT PRIMARY KEY,
          last_synced BIGINT,
          last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total_objects INT,
          new_objects INT,
          updated_objects INT
        );
      `);

      this.log('✓ PostgreSQL tables initialized');
    } finally {
      client.release();
    }
  }

  /**
   * List all spaces in the account
   */
  async listSpaces() {
    if (!fs.existsSync(this.config.objectStoreDir)) {
      this.log(`Object store directory not found: ${this.config.objectStoreDir}`, 'error');
      return [];
    }

    const spaces = fs.readdirSync(this.config.objectStoreDir)
      .filter(name => {
        const stat = fs.statSync(path.join(this.config.objectStoreDir, name));
        return stat.isDirectory() && name.startsWith('bafyrei');
      });

    return spaces;
  }

  /**
   * Open SQLite database for a space
   */
  async openSpaceDb(spaceId) {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(this.config.objectStoreDir, spaceId, 'objects.db');
      
      if (!fs.existsSync(dbPath)) {
        reject(new Error(`Space database not found: ${dbPath}`));
        return;
      }

      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });
  }

  /**
   * Get all objects from a space
   */
  async getSpaceObjects(spaceId) {
    const db = await this.openSpaceDb(spaceId);

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, data FROM _objects_docs ORDER BY rowid`,
        [],
        (err, rows) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Decode object data (handle binary protobuf)
   * For now, returns hex representation. In future, would decode proto
   */
  decodeObjectData(buffer) {
    // TODO: Decode protobuf when proto definitions are available
    // For now, return metadata about the object
    return {
      size: buffer.length,
      hash: crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16),
      sample: buffer.slice(0, 50).toString('hex') // First 50 hex bytes
    };
  }

  /**
   * Sync objects from AnyType space to PostgreSQL
   */
  async syncSpace(spaceId) {
    this.log(`Syncing space: ${spaceId}...`);

    try {
      const objects = await this.getSpaceObjects(spaceId);
      this.log(`Found ${objects.length} objects in space`);

      let newCount = 0;
      let updatedCount = 0;

      for (const obj of objects) {
        const id = obj.id.toString('hex');
        const metadata = this.decodeObjectData(obj.data);
        const checksum = metadata.hash;

        // Check if object already exists
        const existing = await this.pgPool.query(
          'SELECT checksum FROM anytype_objects WHERE space_id = $1 AND id = $2',
          [spaceId, id]
        );

        if (existing.rows.length === 0) {
          // New object
          await this.pgPool.query(
            `INSERT INTO anytype_objects 
             (id, space_id, data, checksum, last_modified)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              id,
              spaceId,
              JSON.stringify(metadata),
              checksum,
              Date.now()
            ]
          );
          newCount++;
        } else if (existing.rows[0].checksum !== checksum) {
          // Updated object
          await this.pgPool.query(
            `UPDATE anytype_objects 
             SET data = $1, checksum = $2, synced_at = CURRENT_TIMESTAMP
             WHERE space_id = $3 AND id = $4`,
            [
              JSON.stringify(metadata),
              checksum,
              spaceId,
              id
            ]
          );
          updatedCount++;
        }
      }

      // Update sync state
      await this.pgPool.query(
        `INSERT INTO anytype_sync_state (space_id, last_synced, total_objects, new_objects, updated_objects)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (space_id) DO UPDATE SET
           last_synced = $2,
           total_objects = $3,
           new_objects = $4,
           updated_objects = $5,
           last_checked = CURRENT_TIMESTAMP`,
        [spaceId, Date.now(), objects.length, newCount, updatedCount]
      );

      this.log(`✓ Synced space: ${newCount} new, ${updatedCount} updated`);
      return { newCount, updatedCount, totalCount: objects.length };
    } catch (error) {
      this.log(`Error syncing space: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Watch for changes and sync periodically
   */
  async watchSpaces() {
    this.log(`Starting watch mode (interval: ${this.config.pollInterval}ms)`);

    // Initial sync
    const spaces = await this.listSpaces();
    for (const spaceId of spaces) {
      await this.syncSpace(spaceId);
    }

    // Periodic sync
    setInterval(async () => {
      try {
        const spaces = await this.listSpaces();
        for (const spaceId of spaces) {
          await this.syncSpace(spaceId);
        }
      } catch (error) {
        this.log(`Watch sync error: ${error.message}`, 'error');
      }
    }, this.config.pollInterval);
  }

  /**
   * Query synced objects from PostgreSQL
   */
  async queryObjects(filters = {}) {
    let query = 'SELECT * FROM anytype_objects WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (filters.spaceId) {
      query += ` AND space_id = $${paramIdx++}`;
      params.push(filters.spaceId);
    }

    if (filters.type) {
      query += ` AND type = $${paramIdx++}`;
      params.push(filters.type);
    }

    if (filters.since) {
      query += ` AND last_modified > $${paramIdx++}`;
      params.push(filters.since);
    }

    query += ' ORDER BY last_modified DESC LIMIT $' + paramIdx;
    params.push(filters.limit || 50);

    const result = await this.pgPool.query(query, params);
    return result.rows;
  }

  /**
   * Get sync status
   */
  async getStatus() {
    const result = await this.pgPool.query('SELECT * FROM anytype_sync_state ORDER BY last_checked DESC');
    return result.rows;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
  }
}

/**
 * CLI interface
 */
async function cliMain() {
  const args = process.argv.slice(2);
  const config = {};

  // Parse arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];

    switch (key) {
      case 'accountId': config.accountId = value; break;
      case 'spaceId': config.spaceId = value; break;
      case 'pgUrl': config.pgUrl = value; break;
      case 'pollInterval': config.pollInterval = parseInt(value); break;
      case 'verbose': config.verbose = true; i--; break;
      case 'help':
        console.log(`
AnyType → PostgreSQL Monitor

Syncs AnyType workspace data to PostgreSQL for OpenClaw querying.

Usage:
  node anytype-monitor.js [options] [command]

Commands:
  watch (default)      Monitor spaces and sync periodically
  list-spaces          List all available spaces
  sync-now             Perform one-time sync
  status               Show sync status
  query <spaceId>      Query synced objects

Options:
  --accountId <id>     AnyType account ID
  --spaceId <id>       Space ID to monitor
  --pgUrl <url>        PostgreSQL connection string
  --pollInterval <ms>  Polling interval (default: 60000)
  --verbose            Enable verbose logging
  --help               Show this help message

Examples:
  node anytype-monitor.js --accountId A6JZ... --spaceId bafyrei... watch
  node anytype-monitor.js list-spaces
  node anytype-monitor.js --spaceId bafyrei... sync-now
  node anytype-monitor.js status

Environment variables:
  ANYTYPE_ACCOUNT_ID
  ANYTYPE_SPACE_ID
  DATABASE_URL
        `);
        process.exit(0);
    }
  }

  try {
    const monitor = new AnytypeMonitor(config);
    const command = args[0] || 'watch';

    // Commands that don't need PostgreSQL
    if (command === 'list-spaces') {
      const spaces = await monitor.listSpaces();
      console.log('Available spaces:');
      spaces.forEach(s => console.log(`  ${s}`));
      process.exit(0);
    }

    // Initialize PostgreSQL for other commands
    await monitor.initPostgres();

    if (command === 'watch') {
      await monitor.watchSpaces();
      // Keep running
      process.on('SIGTERM', async () => {
        console.log('\nShutting down...');
        await monitor.cleanup();
        process.exit(0);
      });

    } else if (command === 'sync-now') {
      const spaces = await monitor.listSpaces();
      console.log(`Syncing ${spaces.length} spaces...`);
      for (const space of spaces) {
        const result = await monitor.syncSpace(space);
        console.log(`  ${space}: ${result.newCount} new, ${result.updatedCount} updated`);
      }
      await monitor.cleanup();

    } else if (command === 'status') {
      const status = await monitor.getStatus();
      console.log(JSON.stringify(status, null, 2));
      await monitor.cleanup();

    } else if (command === 'query') {
      if (!args[1]) {
        console.error('Space ID required for query');
        process.exit(1);
      }
      const objects = await monitor.queryObjects({ spaceId: args[1] });
      console.log(JSON.stringify(objects, null, 2));
      await monitor.cleanup();

    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  cliMain();
}

module.exports = {
  AnytypeMonitor
};
