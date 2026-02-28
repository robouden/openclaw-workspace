/**
 * Example: OpenClaw Slack Bot Integration
 * 
 * Shows how to integrate anytype-sync with OpenClaw's Slack plugin
 */

const { AnytypeSlackHandler } = require('../handler.js');

/**
 * Hook for OpenClaw Slack plugin
 * 
 * This would be registered in openclaw.json as:
 * 
 * {
 *   "plugins": {
 *     "slack": {
 *       "handlers": [
 *         {
 *           "name": "anytype-skill",
 *           "path": "./slack/examples/openclawbot.js",
 *           "export": "SlackHandler"
 *         }
 *       ]
 *     }
 *   }
 * }
 */

class SlackHandler {
  constructor(options = {}) {
    this.slackClient = options.slackClient;
    this.logger = options.logger || console;
    this.anytypeHandler = new AnytypeSlackHandler(
      this.slackClient,
      {
        mongoUrl: process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017',
        logger: this.logger
      }
    );
  }

  /**
   * Called for every incoming message
   * Return true if handled, false to pass to next handler
   */
  async onMessage(message) {
    // Only handle messages that mention "anytype"
    if (!message.text || !message.text.includes('anytype')) {
      return false;
    }

    this.logger.debug('[AnyType] Handling message:', message.text);

    try {
      await this.anytypeHandler.handle(message);
      return true;
    } catch (error) {
      this.logger.error('[AnyType] Error handling message:', error);
      return false;
    }
  }

  /**
   * Optional: Called for app mentions
   */
  async onAppMention(event) {
    const message = {
      text: event.text,
      channel: event.channel,
      user: event.user,
      ts: event.ts,
      thread_ts: event.thread_ts
    };

    return await this.onMessage(message);
  }
}

module.exports = {
  SlackHandler
};
