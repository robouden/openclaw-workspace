#!/usr/bin/env node

/**
 * OpenClaw AnyType Skill Wrapper
 * 
 * Wraps the anytype-db Go binary for use in OpenClaw/Slack
 * Provides formatted output and error handling
 * 
 * Usage:
 *   npx anytype spaces
 *   npx anytype summary <space-id>
 *   npx anytype count <space-id>
 *   npx anytype activity <space-id>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class AnytypeSkill {
  constructor(options = {}) {
    // Find the binary - try multiple locations
    const possiblePaths = [
      path.join(__dirname, '..', 'anytype-db'),
      path.join(__dirname, '..', 'cmd', 'anytype-db', 'anytype-db'),
      '/root/.openclaw/workspace/skills/anytype-sync/anytype-db',
      '/usr/local/bin/anytype-db',
    ];

    this.binaryPath = options.binaryPath || this.findBinary(possiblePaths);
    this.mongoUrl = options.mongoUrl || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';

    if (!this.binaryPath || !fs.existsSync(this.binaryPath)) {
      throw new Error(`anytype-db binary not found. Tried: ${possiblePaths.join(', ')}`);
    }
  }

  findBinary(paths) {
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Execute binary with args
   */
  execute(args) {
    const env = { ...process.env, MONGODB_URL: this.mongoUrl };
    const cmd = `${this.binaryPath} ${args.join(' ')}`;
    
    try {
      const output = execSync(cmd, { env, encoding: 'utf8' });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List spaces
   */
  listSpaces() {
    const result = this.execute(['spaces']);
    
    if (!result.success) {
      return { error: `Failed to list spaces: ${result.error}` };
    }

    // Parse output for Slack/formatted display
    const lines = result.output.split('\n');
    const spaces = [];
    
    let current = null;
    for (const line of lines) {
      if (line.includes('ID: ')) {
        if (current) spaces.push(current);
        current = { id: line.replace('  ID: ', '').trim() };
      } else if (line.includes('Identity: ') && current) {
        current.identity = line.replace('  Identity: ', '').trim();
      } else if (line.includes('Shareable: ') && current) {
        current.shareable = line.includes('true');
      }
    }
    if (current) spaces.push(current);

    return {
      success: true,
      spaces,
      count: spaces.length,
      formatted: this.formatSpaces(spaces)
    };
  }

  /**
   * Get space summary
   */
  getSummary(spaceId) {
    const result = this.execute(['summary', spaceId]);
    
    if (!result.success) {
      return { error: `Failed to get summary: ${result.error}` };
    }

    try {
      // Extract JSON from output
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { error: 'Could not parse summary response' };
      }

      const summary = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        summary,
        formatted: this.formatSummary(summary)
      };
    } catch (e) {
      return { error: `Failed to parse summary: ${e.message}` };
    }
  }

  /**
   * Get object count
   */
  getCount(spaceId) {
    const result = this.execute(['count', spaceId]);
    
    if (!result.success) {
      return { error: `Failed to get count: ${result.error}` };
    }

    const match = result.output.match(/(\d+) payloads/);
    const count = match ? parseInt(match[1]) : 0;

    return {
      success: true,
      count,
      formatted: `📊 Space has **${count}** objects`
    };
  }

  /**
   * Get recent activity
   */
  getActivity(spaceId) {
    const result = this.execute(['activity', spaceId]);
    
    if (!result.success) {
      return { error: `Failed to get activity: ${result.error}` };
    }

    const lines = result.output.split('\n');
    const activities = [];
    
    for (const line of lines) {
      if (line.match(/\d{4}-\d{2}-\d{2}/)) {
        const parts = line.trim().split(':');
        if (parts.length >= 2) {
          activities.push({
            time: parts[0].trim(),
            type: parts.slice(1).join(':').trim()
          });
        }
      }
    }

    return {
      success: true,
      activities,
      formatted: this.formatActivity(activities)
    };
  }

  /**
   * Format spaces for display
   */
  formatSpaces(spaces) {
    if (spaces.length === 0) {
      return 'No spaces found';
    }

    let text = `Found **${spaces.length}** spaces:\n`;
    spaces.slice(0, 5).forEach((s, i) => {
      const share = s.shareable ? '✅' : '🔒';
      text += `\n${i + 1}. ${share} \`${s.id.substring(0, 20)}...\``;
    });

    if (spaces.length > 5) {
      text += `\n\n... and ${spaces.length - 5} more`;
    }

    return text;
  }

  /**
   * Format summary for display
   */
  formatSummary(summary) {
    let text = `📋 **Space Summary**\n`;
    text += `Objects: ${summary.totalObjects || 0}\n`;
    
    if (summary.lastUpdated) {
      text += `Last updated: ${new Date(summary.lastUpdated).toLocaleString()}\n`;
    }

    if (summary.recentActivity && summary.recentActivity.length > 0) {
      text += `\nRecent activity (${summary.recentActivity.length} items)`;
    }

    return text;
  }

  /**
   * Format activity for display
   */
  formatActivity(activities) {
    if (activities.length === 0) {
      return 'No recent activity';
    }

    let text = `📝 **Recent Activity** (${activities.length} items)\n`;
    activities.slice(0, 5).forEach((a, i) => {
      text += `${i + 1}. ${a.time} - ${a.type}\n`;
    });

    return text;
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
AnyType OpenClaw Skill

Query AnyType workspaces from OpenClaw/Slack.

Usage:
  npx anytype <command> [args]

Commands:
  spaces           List all workspaces
  summary <id>     Get space summary
  count <id>       Count objects in space
  activity <id>    Get recent activity
  help             Show this help

Examples:
  npx anytype spaces
  npx anytype summary bafyrei...
  npx anytype count bafyrei...
  npx anytype activity bafyrei...

Environment:
  MONGODB_URL      MongoDB connection string
    `);
    process.exit(0);
  }

  try {
    const skill = new AnytypeSkill();
    const command = args[0];
    const param = args[1];

    let result;

    switch (command) {
      case 'spaces':
        result = skill.listSpaces();
        break;
      case 'summary':
        if (!param) throw new Error('Space ID required');
        result = skill.getSummary(param);
        break;
      case 'count':
        if (!param) throw new Error('Space ID required');
        result = skill.getCount(param);
        break;
      case 'activity':
        if (!param) throw new Error('Space ID required');
        result = skill.getActivity(param);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    if (result.error) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }

    // Output formatted result
    if (result.formatted) {
      console.log(result.formatted);
    }

    // Also output raw data as JSON for programmatic use
    if (process.env.DEBUG) {
      console.log('\n[DEBUG]');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  AnytypeSkill
};
