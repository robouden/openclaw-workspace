#!/usr/bin/env node

/**
 * OpenClaw Session Sync for AnyType
 * 
 * Syncs OpenClaw session notes and conversation history to AnyType.
 * 
 * Usage:
 *   node sync-notes.js --sessionKey main --type backup
 *   node sync-notes.js --continuous [--interval 1800000]
 *   node sync-notes.js --export markdown --output notes.md
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('./anytype-api.js');

class SessionSync {
  constructor(config = {}) {
    this.config = {
      sessionKey: config.sessionKey || process.env.OPENCLAW_SESSION_KEY || 'main',
      sessionDir: config.sessionDir || process.env.OPENCLAW_SESSION_DIR || 
                  path.join(process.env.HOME || '.', '.openclaw', 'workspace'),
      anyTypeConfig: {
        apiUrl: config.apiUrl || process.env.ANYTYPE_API_URL || 'http://127.0.0.1:31012',
        apiKey: config.apiKey || process.env.ANYTYPE_API_KEY || '',
        spaceId: config.spaceId || process.env.ANYTYPE_SPACE_ID || ''
      },
      pageTitle: config.pageTitle || this.generatePageTitle(),
      tags: config.tags || ['openclaw', 'session', 'backup'],
      batchSize: config.batchSize || 100,
      continuous: config.continuous || false,
      interval: config.interval || 1800000, // 30 minutes default
      verbose: config.verbose || false
    };

    this.client = null;
  }

  log(msg, level = 'info') {
    if (this.config.verbose || level !== 'debug') {
      console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    }
  }

  generatePageTitle() {
    const now = new Date();
    return `OpenClaw Session - ${now.toISOString().split('T')[0]} ${now.toLocaleTimeString()}`;
  }

  /**
   * Read OpenClaw session history from files
   */
  readSessionHistory() {
    this.log('Reading session history...');

    try {
      // Read memory files if they exist
      const memoryPath = path.join(this.config.sessionDir, 'MEMORY.md');
      const dailyPath = path.join(this.config.sessionDir, 'memory', 
        new Date().toISOString().split('T')[0] + '.md');

      let content = '# OpenClaw Session Notes\n\n';
      content += `**Session:** ${this.config.sessionKey}\n`;
      content += `**Created:** ${new Date().toISOString()}\n`;
      content += `**Hostname:** ${require('os').hostname()}\n\n`;

      // Add memory if exists
      if (fs.existsSync(memoryPath)) {
        this.log('Found MEMORY.md');
        const memory = fs.readFileSync(memoryPath, 'utf8');
        content += `## Long-term Memory\n\n${memory}\n\n`;
      }

      // Add daily notes if exist
      if (fs.existsSync(dailyPath)) {
        this.log(`Found daily notes for today`);
        const daily = fs.readFileSync(dailyPath, 'utf8');
        content += `## Today's Notes\n\n${daily}\n\n`;
      }

      // Add current environment/status
      content += `## System Info\n\n`;
      content += `- Node version: ${process.version}\n`;
      content += `- Platform: ${process.platform}\n`;
      content += `- Working directory: ${process.cwd()}\n`;
      content += `- Home directory: ${process.env.HOME || 'N/A'}\n\n`;

      this.log(`Read ${content.length} characters of content`);
      return content;
    } catch (error) {
      this.log(`Error reading session history: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Initialize AnyType client
   */
  initializeClient() {
    try {
      this.client = createClient(this.config.anyTypeConfig);
      this.log('AnyType client initialized');
    } catch (error) {
      this.log(`Failed to initialize client: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Sync session to AnyType as new page
   */
  async syncAsNewPage() {
    this.log('Creating new session page in AnyType...');

    try {
      const content = this.readSessionHistory();

      const result = await this.client.createPage({
        title: this.config.pageTitle,
        content: content,
        tags: this.config.tags,
        type: 'page'
      });

      this.log(`Successfully created page: ${result.id}`);
      return result;
    } catch (error) {
      this.log(`Failed to sync as new page: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Sync session to existing page (append)
   */
  async syncToExistingPage(pageId) {
    this.log(`Appending to existing page: ${pageId}`);

    try {
      const content = this.readSessionHistory();

      const result = await this.client.appendContent({
        pageId: pageId,
        content: content
      });

      this.log(`Successfully updated page: ${pageId}`);
      return result;
    } catch (error) {
      this.log(`Failed to sync to existing page: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Export session as markdown file
   */
  async exportAsMarkdown(outputPath) {
    this.log(`Exporting session to ${outputPath}...`);

    try {
      const content = this.readSessionHistory();
      fs.writeFileSync(outputPath, content, 'utf8');
      this.log(`Successfully exported to ${outputPath}`);
      return { path: outputPath, size: content.length };
    } catch (error) {
      this.log(`Failed to export: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Run continuous sync mode
   */
  async runContinuous() {
    this.log(`Starting continuous sync (interval: ${this.config.interval}ms)`);
    
    // Initial sync
    await this.syncAsNewPage();

    // Periodic syncs
    setInterval(async () => {
      try {
        this.log('Running periodic sync...');
        await this.syncAsNewPage();
      } catch (error) {
        this.log(`Periodic sync failed: ${error.message}`, 'error');
      }
    }, this.config.interval);

    // Keep process alive
    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, gracefully shutting down...');
      process.exit(0);
    });
  }

  /**
   * Find most recent session page
   */
  async findRecentSession() {
    this.log('Searching for recent session pages...');

    try {
      const results = await this.client.queryPages({
        query: 'openclaw',
        limit: 1,
        tags: ['openclaw']
      });

      if (results.objects && results.objects.length > 0) {
        this.log(`Found recent session: ${results.objects[0].id}`);
        return results.objects[0];
      }

      this.log('No recent sessions found');
      return null;
    } catch (error) {
      this.log(`Error finding recent session: ${error.message}`, 'error');
      return null;
    }
  }
}

/**
 * CLI interface
 */
async function cliMain() {
  const args = process.argv.slice(2);
  const config = {};

  // Parse CLI arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];

    switch (key) {
      case 'sessionKey': config.sessionKey = value; break;
      case 'sessionDir': config.sessionDir = value; break;
      case 'apiUrl': config.apiUrl = value; break;
      case 'apiKey': config.apiKey = value; break;
      case 'spaceId': config.spaceId = value; break;
      case 'pageTitle': config.pageTitle = value; break;
      case 'interval': config.interval = parseInt(value); break;
      case 'continuous': config.continuous = true; i--; break;
      case 'verbose': config.verbose = true; i--; break;
      case 'type': config.type = value; break;
      case 'export': config.export = value; break;
      case 'output': config.output = value; break;
      case 'help': 
        console.log(`
OpenClaw AnyType Session Sync

Usage:
  node sync-notes.js [options] [mode]

Modes:
  backup (default)     Create new page for current session
  continuous           Keep syncing periodically
  export <format>      Export session to file

Options:
  --sessionKey <key>   OpenClaw session key (default: main)
  --apiUrl <url>       AnyType API endpoint
  --apiKey <key>       AnyType API key
  --spaceId <id>       AnyType space ID
  --interval <ms>      Sync interval in milliseconds (continuous mode)
  --output <path>      Output file path (export mode)
  --verbose            Enable verbose logging
  --help               Show this help message

Examples:
  # Create backup of current session
  node sync-notes.js --sessionKey main --type backup

  # Continuous sync every 30 minutes
  node sync-notes.js --continuous --interval 1800000

  # Export to markdown
  node sync-notes.js --export markdown --output backup.md

Environment variables:
  OPENCLAW_SESSION_KEY
  OPENCLAW_SESSION_DIR
  ANYTYPE_API_URL
  ANYTYPE_API_KEY
  ANYTYPE_SPACE_ID
        `);
        process.exit(0);
    }
  }

  try {
    const sync = new SessionSync(config);
    const mode = config.type || 'backup';

    if (mode === 'backup') {
      sync.initializeClient();
      const result = await sync.syncAsNewPage();
      console.log(JSON.stringify(result, null, 2));

    } else if (mode === 'continuous') {
      sync.initializeClient();
      await sync.runContinuous();

    } else if (mode === 'export') {
      // Export doesn't need API key
      const format = config.export || 'markdown';
      const output = config.output || `session-${Date.now()}.md`;
      const result = await sync.exportAsMarkdown(output);
      console.log(JSON.stringify(result, null, 2));

    } else {
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  cliMain();
}

module.exports = {
  SessionSync
};
