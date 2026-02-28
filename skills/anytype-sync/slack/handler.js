/**
 * AnyType Slack Handler
 * 
 * Integrates anytype-sync skill with OpenClaw Slack bot
 * 
 * Commands:
 *   @openclaw anytype spaces
 *   @openclaw anytype summary <space-id>
 *   @openclaw anytype count <space-id>
 *   @openclaw anytype activity <space-id>
 */

const { AnytypeSkill } = require('../scripts/anytype.js');

class AnytypeSlackHandler {
  constructor(slackClient, options = {}) {
    this.slack = slackClient;
    this.skill = new AnytypeSkill(options);
    this.logger = options.logger || console;
  }

  /**
   * Handle incoming Slack message/command
   */
  async handle(message) {
    try {
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
          result = this.skill.listSpaces();
          return await this.postSpaces(message, result);
          
        case 'summary':
          if (!param) {
            return await this.postError(message, 'Space ID required: `@openclaw anytype summary <space-id>`');
          }
          result = this.skill.getSummary(param);
          return await this.postSummary(message, result);
          
        case 'count':
          if (!param) {
            return await this.postError(message, 'Space ID required: `@openclaw anytype count <space-id>`');
          }
          result = this.skill.getCount(param);
          return await this.postCount(message, result);
          
        case 'activity':
          if (!param) {
            return await this.postError(message, 'Space ID required: `@openclaw anytype activity <space-id>`');
          }
          result = this.skill.getActivity(param);
          return await this.postActivity(message, result);
          
        case 'help':
          return await this.postHelp(message);
          
        default:
          return await this.postError(message, `Unknown command: \`${command}\`. Try \`anytype help\``);
      }

    } catch (error) {
      this.logger.error('AnyType Slack handler error:', error);
      return await this.postError(message, `Error: ${error.message}`);
    }
  }

  /**
   * Post spaces list to Slack
   */
  async postSpaces(message, result) {
    if (result.error) {
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
    if (result.error) {
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
    if (result.error) {
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
    if (result.error) {
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
        activityText += `${i + 1}. \`${a.time}\` — ${a.type}\n`;
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
}

module.exports = {
  AnytypeSlackHandler
};
