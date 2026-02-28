#!/usr/bin/env node

/**
 * AnyType MongoDB Client
 * 
 * Direct query interface to AnyType's MongoDB storage.
 * No PostgreSQL, no SQLite monitoring - just MongoDB.
 * 
 * Usage:
 *   const anytype = require('./anytype-db.js');
 *   const client = await anytype.connect(mongoUrl);
 *   const spaces = await client.listSpaces();
 *   const objects = await client.queryObjects(spaceId, filter);
 */

const { MongoClient, Db } = require('mongodb');

class AnytypeDB {
  constructor(mongoUrl) {
    this.mongoUrl = mongoUrl || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
    this.client = null;
    this.coordinatorDb = null;
    this.consensusDb = null;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    this.client = new MongoClient(this.mongoUrl, {
      serverSelectionTimeoutMS: 5000
    });

    await this.client.connect();
    this.coordinatorDb = this.client.db('coordinator');
    this.consensusDb = this.client.db('consensus');

    console.log('✓ Connected to AnyType MongoDB');
    return this;
  }

  /**
   * Disconnect
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('✓ Disconnected from MongoDB');
    }
  }

  /**
   * List all spaces in the coordinator
   */
  async listSpaces() {
    const spacesCollection = this.coordinatorDb.collection('spaces');
    const spaces = await spacesCollection.find({}).toArray();
    return spaces.map(s => ({
      id: s._id,
      identity: s.identity,
      status: s.status,
      type: s.type,
      isShareable: s.isShareable
    }));
  }

  /**
   * Get a specific space
   */
  async getSpace(spaceId) {
    const spacesCollection = this.coordinatorDb.collection('spaces');
    return await spacesCollection.findOne({ _id: spaceId });
  }

  /**
   * Get all payloads (objects) from consensus
   */
  async getPayloads(filter = {}) {
    const payloadCollection = this.consensusDb.collection('payload');
    return await payloadCollection.find(filter).toArray();
  }

  /**
   * Query payloads by space (from _id which contains space reference)
   */
  async getPayloadsBySpace(spaceId) {
    const payloadCollection = this.consensusDb.collection('payload');
    // Payloads have _id format: "spaceId/objectId"
    const regex = new RegExp(`^${spaceId}/`);
    return await payloadCollection.find({ _id: { $regex: regex } }).toArray();
  }

  /**
   * Get payload count
   */
  async getPayloadCount(spaceId = null) {
    const payloadCollection = this.consensusDb.collection('payload');
    if (spaceId) {
      const regex = new RegExp(`^${spaceId}/`);
      return await payloadCollection.countDocuments({ _id: { $regex: regex } });
    }
    return await payloadCollection.countDocuments();
  }

  /**
   * Watch for changes in a space (real-time)
   */
  async watchSpace(spaceId, callback) {
    const payloadCollection = this.consensusDb.collection('payload');
    const regex = new RegExp(`^${spaceId}/`);

    const changeStream = payloadCollection.watch([
      { $match: { 'fullDocument._id': { $regex: regex } } }
    ]);

    changeStream.on('change', (change) => {
      callback(change);
    });

    return changeStream;
  }

  /**
   * Get identity profiles
   */
  async getIdentityProfiles() {
    const idCollection = this.coordinatorDb.collection('identityRepo');
    return await idCollection.find({}).toArray();
  }

  /**
   * Get inbox messages (recent activity)
   */
  async getInboxMessages(filter = {}) {
    const inboxCollection = this.coordinatorDb.collection('inboxMessages');
    return await inboxCollection.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
  }

  /**
   * Get recent activity (from inbox messages or deletion log)
   */
  async getRecentActivity(spaceId, limit = 50) {
    const inboxCollection = this.coordinatorDb.collection('inboxMessages');
    return await inboxCollection.find({ spaceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get deletion log (deleted objects)
   */
  async getDeletionLog(filter = {}) {
    const deletionCollection = this.coordinatorDb.collection('deletionLog');
    return await deletionCollection.find(filter).toArray();
  }

  /**
   * Summary of space contents
   */
  async getSpaceSummary(spaceId) {
    const payloadCount = await this.getPayloadCount(spaceId);
    const activity = await this.getRecentActivity(spaceId, 5);

    return {
      spaceId,
      totalObjects: payloadCount,
      recentActivity: activity,
      lastUpdated: activity.length > 0 ? activity[0].createdAt : null
    };
  }

  /**
   * Search across all spaces
   */
  async search(query) {
    const payloadCollection = this.consensusDb.collection('payload');
    
    // Simple search: match anything in the binary payload
    // For better search, would need to decode protobuf first
    const results = await payloadCollection.find({
      $or: [
        { _id: { $regex: query, $options: 'i' } }
      ]
    }).limit(50).toArray();

    return results;
  }

  /**
   * Monitor and log changes for debugging
   */
  async monitorChanges(spaceId, durationSeconds = 60) {
    console.log(`\nMonitoring space ${spaceId} for ${durationSeconds} seconds...`);
    
    const changeStream = await this.watchSpace(spaceId, (change) => {
      console.log(`\n[CHANGE] ${new Date().toISOString()}`);
      console.log('  Type:', change.operationType);
      console.log('  Document ID:', change.fullDocument?._id || change.documentKey?._id);
      console.log('  Timestamp:', change.clusterTime);
    });

    return new Promise(resolve => {
      setTimeout(() => {
        changeStream.close();
        console.log('\n✓ Monitoring stopped');
        resolve();
      }, durationSeconds * 1000);
    });
  }
}

/**
 * CLI interface
 */
async function cliMain() {
  const args = process.argv.slice(2);
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AnyType MongoDB Client

Direct interface to AnyType's MongoDB storage.

Usage:
  node anytype-db.js [command] [options]

Commands:
  spaces              List all spaces
  space <id>          Get space info
  payloads            Get all payloads (objects)
  payloads-space <id> Get payloads in a space
  summary <id>        Get space summary
  activity <id>       Get recent activity
  inbox               Get inbox messages
  monitor <id> [sec]  Watch for changes in real-time
  search <query>      Search payloads
  count [space-id]    Count payloads

Options:
  --mongo <url>       MongoDB URL (default: mongodb://127.0.0.1:27017)
  --help              Show this help

Examples:
  node anytype-db.js spaces
  node anytype-db.js payloads-space bafyrei...
  node anytype-db.js summary bafyrei...
  node anytype-db.js monitor bafyrei... 30
  node anytype-db.js count bafyrei...

Environment variables:
  MONGODB_URL    MongoDB connection string
    `);
    process.exit(0);
  }

  try {
    const client = new AnytypeDB(mongoUrl);
    await client.connect();

    const command = args[0];
    const param = args[1];
    const param2 = args[2];

    if (command === 'spaces') {
      const spaces = await client.listSpaces();
      console.log(`\n${spaces.length} spaces found:\n`);
      spaces.forEach(s => {
        console.log(`  ID: ${s.id}`);
        console.log(`  Identity: ${s.identity}`);
        console.log(`  Shareable: ${s.isShareable}`);
        console.log();
      });

    } else if (command === 'space') {
      if (!param) {
        console.error('Space ID required');
        process.exit(1);
      }
      const space = await client.getSpace(param);
      console.log('\nSpace info:');
      console.log(JSON.stringify(space, null, 2));

    } else if (command === 'payloads') {
      const count = await client.getPayloadCount();
      console.log(`\n${count} total payloads in MongoDB`);

    } else if (command === 'payloads-space') {
      if (!param) {
        console.error('Space ID required');
        process.exit(1);
      }
      const payloads = await client.getPayloadsBySpace(param);
      console.log(`\n${payloads.length} payloads in space ${param}`);
      payloads.slice(0, 5).forEach(p => {
        console.log(`  ${p._id}`);
      });
      if (payloads.length > 5) {
        console.log(`  ... and ${payloads.length - 5} more`);
      }

    } else if (command === 'summary') {
      if (!param) {
        console.error('Space ID required');
        process.exit(1);
      }
      const summary = await client.getSpaceSummary(param);
      console.log('\nSpace Summary:');
      console.log(JSON.stringify(summary, null, 2));

    } else if (command === 'activity') {
      if (!param) {
        console.error('Space ID required');
        process.exit(1);
      }
      const activity = await client.getRecentActivity(param, 10);
      console.log(`\n${activity.length} recent activities:\n`);
      activity.forEach(a => {
        console.log(`  ${a.createdAt || 'N/A'}: ${a.type || 'unknown'}`);
      });

    } else if (command === 'inbox') {
      const messages = await client.getInboxMessages();
      console.log(`\n${messages.length} inbox messages:\n`);
      messages.slice(0, 10).forEach(m => {
        console.log(`  ${m.createdAt || 'N/A'}: ${m.type || 'unknown'}`);
      });

    } else if (command === 'monitor') {
      if (!param) {
        console.error('Space ID required');
        process.exit(1);
      }
      const duration = parseInt(param2) || 60;
      await client.monitorChanges(param, duration);

    } else if (command === 'search') {
      if (!param) {
        console.error('Search query required');
        process.exit(1);
      }
      const results = await client.search(param);
      console.log(`\n${results.length} results for "${param}":\n`);
      results.forEach(r => {
        console.log(`  ${r._id}`);
      });

    } else if (command === 'count') {
      const count = await client.getPayloadCount(param);
      if (param) {
        console.log(`\n${count} payloads in space ${param}`);
      } else {
        console.log(`\n${count} total payloads`);
      }

    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }

    await client.disconnect();

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
  AnytypeDB
};
