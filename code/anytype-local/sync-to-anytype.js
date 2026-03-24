#!/usr/bin/env node
/**
 * AnyType Sync Script - Push markdown files to AnyType via HTTP API
 * 
 * Usage:
 *   node sync-to-anytype.js <markdown-file> [--space <space-id>] [--api-url <url>] [--api-key <key>]
 *   ANYTYPE_API_KEY=<key> ANYTYPE_SPACE_ID=<space-id> node sync-to-anytype.js <markdown-file>
 *
 * Environment variables:
 *   ANYTYPE_API_KEY     - API key for AnyType (required)
 *   ANYTYPE_SPACE_ID    - Space ID to sync to (required)
 *   ANYTYPE_API_URL     - API URL (default: http://127.0.0.1:31012)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  apiUrl: process.env.ANYTYPE_API_URL || 'http://127.0.0.1:31012',
  apiKey: process.env.ANYTYPE_API_KEY || '',
  spaceId: process.env.ANYTYPE_SPACE_ID || '',
  objectType: 'page'
};

class AnyTypeClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || CONFIG.apiUrl;
    this.apiKey = config.apiKey || CONFIG.apiKey;
    this.spaceId = config.spaceId || CONFIG.spaceId;
    this.timeout = 30000;
  }

  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.apiUrl);
      const isHttps = url.protocol === 'https:';
      const httpLib = isHttps ? https : http;

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OpenClaw-AnyType-Sync/1.0'
      };

      const options = { method, headers, timeout: this.timeout };

      const req = httpLib.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsed;
          try { parsed = body ? JSON.parse(body) : {}; } 
          catch (e) { parsed = { raw: body }; }

          if (res.statusCode >= 400) {
            const error = new Error(`AnyType API error (${res.statusCode}): ${parsed.error || parsed.message || body}`);
            error.statusCode = res.statusCode;
            error.response = parsed;
            reject(error);
          } else {
            resolve(parsed);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.abort(); reject(new Error(`Timeout (${this.timeout}ms)`)); });
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  async createObject({ typeKey = 'page', name, description = '', content = '' }) {
    if (!this.spaceId) throw new Error('spaceId is required');

    const data = {
      type_key: typeKey,
      name: name,
      description: description,
      snippet: content.substring(0, 500) // Preview text
    };

    return this.request('POST', 
      `/v1/spaces/${this.spaceId}/objects`,
      data
    );
  }

  async listObjects() {
    if (!this.spaceId) throw new Error('spaceId is required');
    return this.request('GET', `/v1/spaces/${this.spaceId}/objects`);
  }

  async getTypes() {
    if (!this.spaceId) throw new Error('spaceId is required');
    return this.request('GET', `/v1/spaces/${this.spaceId}/types`);
  }
}

function parseMarkdown(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const filename = path.basename(filepath, '.md');
  
  // Extract first heading as title
  let title = filename;
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
      break;
    }
    // Also check for title: or ---
    if (line.startsWith('title:')) {
      title = line.substring(6).trim();
      break;
    }
  }

  return { title, content, filename };
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let filepath = null;
  let spaceId = CONFIG.spaceId;
  let apiKey = CONFIG.apiKey;
  let apiUrl = CONFIG.apiUrl;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--space' && i + 1 < args.length) spaceId = args[++i];
    else if (args[i] === '--api-url' && i + 1 < args.length) apiUrl = args[++i];
    else if (args[i] === '--api-key' && i + 1 < args.length) apiKey = args[++i];
    else if (!args[i].startsWith('--')) filepath = args[i];
  }

  // Validate
  if (!filepath) {
    console.error('Usage: node sync-to-anytype.js <markdown-file> [--space <id>] [--api-url <url>] [--api-key <key>]');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('ERROR: ANYTYPE_API_KEY is required');
    process.exit(1);
  }

  if (!spaceId) {
    console.error('ERROR: ANYTYPE_SPACE_ID is required');
    process.exit(1);
  }

  if (!fs.existsSync(filepath)) {
    console.error(`ERROR: File not found: ${filepath}`);
    process.exit(1);
  }

  const client = new AnyTypeClient({ apiUrl, apiKey, spaceId });

  // Parse markdown
  const { title, content, filename } = parseMarkdown(filepath);
  console.log(`📄 Syncing: ${filename}`);
  console.log(`   Title: ${title}`);
  console.log(`   Space: ${spaceId}`);

  // Create object
  try {
    const result = await client.createObject({
      typeKey: 'page',
      name: title,
      content: content
    });

    if (result.object) {
      console.log(`✅ Created: ${result.object.name}`);
      console.log(`   ID: ${result.object.id}`);
      return result.object;
    } else {
      console.log(`⚠️  Response:`, JSON.stringify(result).substring(0, 200));
      return result;
    }
  } catch (err) {
    console.error(`❌ Failed to sync: ${err.message}`);
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
