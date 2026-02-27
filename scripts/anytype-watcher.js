#!/usr/bin/env node

/**
 * AnyType Workspace File Watcher
 * 
 * Monitors /root/anytype-workspace for changes and syncs markdown to AnyType.
 * Runs as a systemd service: anytype-workspace-sync.service
 * 
 * Usage: node /root/.openclaw/workspace/scripts/anytype-watcher.js
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '/root/anytype-workspace';
const SPACE_ID = 'bafyreietc6lmsanpkyfz4m3x2xd4hb5vvxex7ywalouqcugufarmhy3nue.10piockh34xft';
const API_BASE = 'http://127.0.0.1:31012/api/v1';

// Track file modification times to debounce rapid changes
const fileTimestamps = {};
const DEBOUNCE_MS = 2000;

/**
 * Parse markdown file and extract title + content
 */
function parseMarkdown(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const filename = path.basename(filepath, '.md');
  
  // Extract first heading as title, or use filename
  const titleMatch = content.match(/^#\s+(.+?)$/m);
  const title = titleMatch ? titleMatch[1] : filename;
  
  return { title, content, filename };
}

/**
 * Sync a markdown file to AnyType
 */
async function syncFile(filepath) {
  try {
    const { title, content, filename } = parseMarkdown(filepath);
    
    console.log(`[${new Date().toISOString()}] Syncing ${filename}...`);
    
    // For now, log the sync (REST API integration pending)
    // TODO: Implement actual sync once REST API is working
    // const response = await fetch(`${API_BASE}/page`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ spaceId: SPACE_ID, title, content })
    // });
    
    console.log(`[${new Date().toISOString()}] ✓ ${filename} ready for sync`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ✗ Error syncing ${filepath}:`, error.message);
  }
}

/**
 * Watch directory recursively
 */
function watchDirectory(dir) {
  console.log(`[${new Date().toISOString()}] Watching ${dir} for changes...`);
  
  fs.watch(dir, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return;
    
    const filepath = path.join(dir, filename);
    const now = Date.now();
    const lastChange = fileTimestamps[filepath] || 0;
    
    // Debounce rapid changes
    if (now - lastChange < DEBOUNCE_MS) return;
    fileTimestamps[filepath] = now;
    
    // Wait for file to stabilize
    setTimeout(() => {
      if (fs.existsSync(filepath)) {
        syncFile(filepath);
      }
    }, DEBOUNCE_MS);
  });
}

/**
 * Initial sync of all existing files
 */
async function initialSync() {
  console.log(`[${new Date().toISOString()}] Running initial sync...`);
  
  const files = fs.readdirSync(WORKSPACE_DIR).filter(f => f.endsWith('.md'));
  for (const file of files) {
    await syncFile(path.join(WORKSPACE_DIR, file));
  }
  
  console.log(`[${new Date().toISOString()}] Initial sync complete`);
}

/**
 * Main
 */
async function main() {
  try {
    // Ensure workspace dir exists
    if (!fs.existsSync(WORKSPACE_DIR)) {
      console.error(`Error: ${WORKSPACE_DIR} does not exist`);
      process.exit(1);
    }
    
    // Initial sync
    await initialSync();
    
    // Start watching
    watchDirectory(WORKSPACE_DIR);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

main();
