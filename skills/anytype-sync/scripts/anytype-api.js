#!/usr/bin/env node

/**
 * AnyType HTTP API Client
 * 
 * Wrapper for AnyType's HTTP API with auth, error handling, and convenience methods
 * for common operations (create page, query, update, etc.)
 * 
 * Usage:
 *   const anytype = require('./anytype-api.js');
 *   const client = anytype.createClient({ apiUrl, apiKey });
 *   await client.createPage({ spaceId, title, content });
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class AnytypeClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.ANYTYPE_API_URL || 'http://127.0.0.1:31012';
    this.apiKey = config.apiKey || process.env.ANYTYPE_API_KEY || '';
    this.spaceId = config.spaceId || process.env.ANYTYPE_SPACE_ID || '';
    this.timeout = config.timeout || 30000;
    
    if (!this.apiKey) {
      throw new Error('AnyType API key is required. Set via config.apiKey, ANYTYPE_API_KEY env var, or --apiKey flag');
    }
  }

  /**
   * Make authenticated HTTP request to AnyType API
   */
  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.apiUrl);
      const isHttps = url.protocol === 'https:';
      const httpLib = isHttps ? https : http;

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OpenClaw/1.0'
      };

      const options = {
        method,
        headers,
        timeout: this.timeout
      };

      const req = httpLib.request(url, options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            // Handle non-JSON responses
            let parsed;
            try {
              parsed = body ? JSON.parse(body) : {};
            } catch (e) {
              parsed = { raw: body };
            }

            if (res.statusCode >= 400) {
              const error = new Error(
                `AnyType API error (${res.statusCode}): ${parsed.error || parsed.message || body}`
              );
              error.statusCode = res.statusCode;
              error.response = parsed;
              reject(error);
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.abort();
        reject(new Error(`AnyType API request timeout (${this.timeout}ms)`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Create a new page/object in AnyType
   */
  async createPage({ spaceId = this.spaceId, title, content, type = 'page', tags = [] }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!title) throw new Error('title is required');

    const payload = {
      space: spaceId,
      name: title,
      type: type,
      content: content || '',
      tags: tags
    };

    return this.request('POST', '/api/v1/objects', payload);
  }

  /**
   * Update an existing page
   */
  async updatePage({ spaceId = this.spaceId, pageId, content, title = null, tags = [] }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!pageId) throw new Error('pageId is required');

    const payload = {
      space: spaceId,
      id: pageId,
      content: content
    };

    if (title) {
      payload.name = title;
    }

    if (tags.length > 0) {
      payload.tags = tags;
    }

    return this.request('PATCH', `/api/v1/objects/${pageId}`, payload);
  }

  /**
   * Get a single page/object
   */
  async getPage({ spaceId = this.spaceId, pageId }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!pageId) throw new Error('pageId is required');

    return this.request('GET', `/api/v1/objects/${pageId}?space=${spaceId}`);
  }

  /**
   * Query/search pages in a space
   */
  async queryPages({ spaceId = this.spaceId, query = '', limit = 50, offset = 0, tags = [] }) {
    if (!spaceId) throw new Error('spaceId is required');

    const params = new URLSearchParams({
      space: spaceId,
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (query) {
      params.append('q', query);
    }

    tags.forEach(tag => {
      params.append('tags', tag);
    });

    return this.request('GET', `/api/v1/objects?${params.toString()}`);
  }

  /**
   * Delete a page
   */
  async deletePage({ spaceId = this.spaceId, pageId }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!pageId) throw new Error('pageId is required');

    return this.request('DELETE', `/api/v1/objects/${pageId}?space=${spaceId}`);
  }

  /**
   * List all spaces available to this account
   */
  async listSpaces() {
    return this.request('GET', '/api/v1/spaces');
  }

  /**
   * Get space info
   */
  async getSpace(spaceId) {
    if (!spaceId) throw new Error('spaceId is required');
    return this.request('GET', `/api/v1/spaces/${spaceId}`);
  }

  /**
   * Add a tag to a page
   */
  async addTags({ spaceId = this.spaceId, pageId, tags = [] }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!pageId) throw new Error('pageId is required');
    if (tags.length === 0) throw new Error('At least one tag is required');

    return this.request('POST', `/api/v1/objects/${pageId}/tags`, {
      space: spaceId,
      tags: tags
    });
  }

  /**
   * Remove tags from a page
   */
  async removeTags({ spaceId = this.spaceId, pageId, tags = [] }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!pageId) throw new Error('pageId is required');
    if (tags.length === 0) throw new Error('At least one tag is required');

    return this.request('DELETE', `/api/v1/objects/${pageId}/tags`, {
      space: spaceId,
      tags: tags
    });
  }

  /**
   * Append content to a page (useful for continuous syncing)
   */
  async appendContent({ spaceId = this.spaceId, pageId, content }) {
    if (!spaceId) throw new Error('spaceId is required');
    if (!pageId) throw new Error('pageId is required');
    if (!content) throw new Error('content is required');

    // Get current page
    const page = await this.getPage({ spaceId, pageId });
    
    // Append new content with timestamp
    const timestamp = new Date().toISOString();
    const newContent = `${page.content || ''}\n\n---\n\n**Updated:** ${timestamp}\n\n${content}`;

    return this.updatePage({ spaceId, pageId, content: newContent });
  }
}

/**
 * Factory function to create client instance
 */
function createClient(config) {
  return new AnytypeClient(config);
}

/**
 * CLI interface for direct script usage
 */
async function cliMain() {
  const args = process.argv.slice(2);
  const config = {};

  // Parse CLI arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];

    if (key === 'apiUrl') config.apiUrl = value;
    if (key === 'apiKey') config.apiKey = value;
    if (key === 'spaceId') config.spaceId = value;
    if (key === 'help') {
      console.log(`
AnyType API Client CLI

Usage:
  node anytype-api.js --apiKey <key> --spaceId <space> [command]

Commands:
  list-spaces          List all available spaces
  get-space <id>       Get space info
  query <query>        Search pages (default limit 10)
  create <title>       Create new page

Examples:
  node anytype-api.js --apiKey xyz --spaceId abc list-spaces
  node anytype-api.js --apiKey xyz --spaceId abc query "OpenClaw"
  node anytype-api.js --apiKey xyz --spaceId abc create "My Page"

Environment variables:
  ANYTYPE_API_URL      API endpoint (default: http://127.0.0.1:31012)
  ANYTYPE_API_KEY      API authentication key
  ANYTYPE_SPACE_ID     Default space ID
      `);
      process.exit(0);
    }
  }

  try {
    const client = createClient(config);
    const command = args[0];

    if (command === 'list-spaces') {
      const spaces = await client.listSpaces();
      console.log(JSON.stringify(spaces, null, 2));
    } else if (command === 'get-space') {
      const space = await client.getSpace(args[1]);
      console.log(JSON.stringify(space, null, 2));
    } else if (command === 'query') {
      const query = args[1] || '';
      const results = await client.queryPages({ query, limit: 10 });
      console.log(JSON.stringify(results, null, 2));
    } else if (command === 'create') {
      const title = args[1] || 'Untitled';
      const result = await client.createPage({ title });
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('No command specified. Use --help for usage info.');
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
  createClient,
  AnytypeClient
};
