/**
 * AnyType Slack Handler
 * 
 * Pure Node.js MongoDB integration with OpenClaw Slack bot
 * No external Go binaries required
 * 
 * Commands:
 *   @openclaw anytype spaces
 *   @openclaw anytype summary <space-id>
 *   @openclaw anytype count <space-id>
 *   @openclaw anytype activity <space-id>
 */

const { MongoClient } = require('mongodb');

class AnytypeSlackHandler {
  constructor(slackClient, options = {}) {
    this.slack = slackClient;
    this.mongoUrl = options.mongoUrl || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
    this.logger = options.logger || console;
    this.mongoClient = null;
  }

  /**
   * Initialize MongoDB connection
   */
  async connect() {
    if (this.mongoClient) return; // Already connected
    
    try {
      this.mongoClient = new MongoClient(this.mongoUrl, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      
      await this.mongoClient.connect();
      this.logger.debug('[AnyType] Connected to MongoDB');
    } catch (error) {
      this.logger.error('[AnyType] MongoDB connection failed:', error.message);
      this.mongoClient = null;
      throw error;
    }
  }

  /**
   * Handle incoming Slack message/command
   */
  async handle(message) {
    try {
      // Ensure MongoDB is connected
      if (!this.mongoClient) {
        await this.connect();
      }

      // Parse command: "anytype spaces" or "anytype summary bafyrei..."
      const parts = message.text.split(/\s+/);
      
      if (parts[0].toLowerCase() !== 'anytype') {
        return null; // Not an anytype command
      }

      const command = parts[1];
      const param = parts[2];

      let result;

      switch (command) {
        case 'spaces':
          result = await this.listSpaces();
          return await this.postSpaces(message, result);
          
        case 'summary':
          if (!param) {
            return await this.postError(message, 'Space ID required: `@openclaw anytype summary <space-id>`');
          }
          result = await this.getSummary(param);
          return await this.postSummary(message, result);
          
        case 'count':
          if (!param) {
            return await this.postError(message, 'Space ID required: `@openclaw anytype count <space-id>`');
          }
          result = await this.getCount(param);
          return await this.postCount(message, result);
          
        case 'activity':
          if (!param) {
            return await this.postError(message, 'Space ID required: `@openclaw anytype activity <space-id>`');
          }
          result = await this.getActivity(param);
          return await this.postActivity(message, result);
          
        case 'help':
          return await this.postHelp(message);
          
        default:
          return await this.postError(message, `Unknown command: \`${command}\`. Try \`anytype help\``);
      }

    } catch (error) {
      this.logger.error('[AnyType] Handler error:', error);
      return await this.postError(message, `Error: ${error.message}`);
    }
  }

  /**
   * Get all spaces from MongoDB
   */
  async listSpaces() {
    try {
      const db = this.mongoClient.db('coordinator');
      const spacesCollection = db.collection('spaces');
      const spaces = await spacesCollection.find({}).toArray();
      
      return {
        success: true,
        spaces: spaces.map(s => ({
          id: s._id,
          identity: s.identity,
          shareable: s.isShareable
        })),
        count: spaces.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get space summary
   */
  async getSummary(spaceId) {
    try {
      const db = this.mongoClient.db('coordinator');
      const inboxCollection = db.collection('inboxMessages');
      
      const consensusDb = this.mongoClient.db('consensus');
      const payloadCollection = consensusDb.collection('payload');
      
      // Count payloads for this space
      const regex = new RegExp(`^${spaceId}/`);
      const count = await payloadCollection.countDocuments({ _id: { $regex: regex } });
      
      // Get recent activity
      const activity = await inboxCollection.find({ spaceId })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      return {
        success: true,
        summary: {
          spaceId,
          totalObjects: count,
          lastUpdated: activity.length > 0 ? activity[0].createdAt : null,
          recentActivity: activity
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Count objects in space
   */
  async getCount(spaceId) {
    try {
      const db = this.mongoClient.db('consensus');
      const payloadCollection = db.collection('payload');
      
      const regex = new RegExp(`^${spaceId}/`);
      const count = await payloadCollection.countDocuments({ _id: { $regex: regex } });
      
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent activity
   */
  async getActivity(spaceId) {
    try {
      const db = this.mongoClient.db('coordinator');
      const inboxCollection = db.collection('inboxMessages');
      
      const activity = await inboxCollection.find({ spaceId })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      
      return { success: true, activities: activity };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Post spaces list to Slack
   */
  async postSpaces(message, result) {
    if (!result.success) {
      return await this.postError(message, result.error);
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🗂️  AnyType Workspaces (${result.count})`,
          emoji: true
        }
      }
    ];

    // Add spaces as sections
    result.spaces.slice(0, 10).forEach((space, i) => {
      const share = space.shareable ? '✅ Shareable' : '🔒 Private';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${i + 1}. ${share}*\n\`${space.id}\``
        }
      });
    });

    if (result.count > 10) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `... and ${result.count - 10} more spaces`
          }
        ]
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Tip: Use `@openclaw anytype summary <space-id>` to see workspace details'
        }
      ]
    });

    return await this.slack.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts || message.ts,
      blocks
    });
  }

  /**
   * Post space summary to Slack
   */
  async postSummary(message, result) {
    if (!result.success) {
      return await this.postError(message, result.error);
    }

    const summary = result.summary;
    const lastUpdated = summary.lastUpdated 
      ? new Date(summary.lastUpdated).toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
      : 'Never';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📋 Workspace Summary',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Total Objects*\n' + (summary.totalObjects || 0)
          },
          {
            type: 'mrkdwn',
            text: '*Last Updated*\n' + lastUpdated
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '`' + summary.spaceId + '`'
          }
        ]
      }
    ];

    if (summary.recentActivity && summary.recentActivity.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Recent Activity*\n' + summary.recentActivity.length + ' items'
        }
      });
    }

    return await this.slack.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts || message.ts,
      blocks
    });
  }

  /**
   * Post object count to Slack
   */
  async postCount(message, result) {
    if (!result.success) {
      return await this.postError(message, result.error);
    }

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *${result.count}* objects in workspace`
        }
      }
    ];

    return await this.slack.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts || message.ts,
      blocks
    });
  }

  /**
   * Post recent activity to Slack
   */
  async postActivity(message, result) {
    if (!result.success) {
      return await this.postError(message, result.error);
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📝 Recent Activity',
          emoji: true
        }
      }
    ];

    if (result.activities.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No recent activity'
        }
      });
    } else {
      let activityText = '';
      result.activities.slice(0, 10).forEach((a, i) => {
        const time = a.createdAt ? new Date(a.createdAt).toLocaleString() : 'Unknown';
        activityText += `${i + 1}. \`${time}\` — ${a.type || 'unknown'}\n`;
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: activityText
        }
      });

      if (result.activities.length > 10) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `... and ${result.activities.length - 10} more`
            }
          ]
        });
      }
    }

    return await this.slack.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts || message.ts,
      blocks
    });
  }

  /**
   * Post help message
   */
  async postHelp(message) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 AnyType Commands',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*List all workspaces*\n`@openclaw anytype spaces`'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Get workspace summary*\n`@openclaw anytype summary <space-id>`\nShows object count and recent activity'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Count objects in workspace*\n`@openclaw anytype count <space-id>`'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*See recent activity*\n`@openclaw anytype activity <space-id>`'
        }
      }
    ];

    return await this.slack.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts || message.ts,
      blocks
    });
  }

  /**
   * Post error message
   */
  async postError(message, errorText) {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ ${errorText}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Use `@openclaw anytype help` for available commands'
          }
        ]
      }
    ];

    return await this.slack.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts || message.ts,
      blocks
    });
  }

  /**
   * Cleanup
   */
  async disconnect() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
    }
  }
}

module.exports = {
  AnytypeSlackHandler
};
