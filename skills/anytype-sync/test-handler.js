#!/usr/bin/env node

/**
 * Test the AnyType Slack Handler - Pure Node.js MongoDB Client
 * 
 * No external dependencies beyond mongodb driver
 */

const { AnytypeSlackHandler } = require('./slack/handler.js');

// Mock Slack client
class MockSlackClient {
  constructor() {
    this.chat = {
      postMessage: async (config) => {
        console.log('\n📨 Slack Message:');
        console.log('  Channel:', config.channel);
        console.log('  Blocks:', config.blocks.length, 'blocks');
        if (config.blocks[0]) {
          console.log('  Header:', config.blocks[0].text?.text);
        }
        return { ok: true };
      }
    };
  }
}

async function test() {
  console.log('🧪 Testing AnyType Slack Handler (Pure Node.js)\n');
  console.log('Connecting to MongoDB...');
  
  const mockSlack = new MockSlackClient();
  const handler = new AnytypeSlackHandler(mockSlack, {
    mongoUrl: 'mongodb://127.0.0.1:27017'
  });

  try {
    // Connect to MongoDB
    await handler.connect();
    console.log('✅ Connected to MongoDB\n');

    // Test 1: List spaces
    console.log('Test 1: List Spaces');
    const message1 = {
      text: 'anytype spaces',
      channel: '#test',
      ts: '123456'
    };
    await handler.handle(message1);

    // Test 2: Get summary (if space exists)
    console.log('\nTest 2: Space Summary');
    const spaces = await handler.listSpaces();
    if (spaces.success && spaces.spaces.length > 0) {
      const spaceId = spaces.spaces[0].id;
      const message2 = {
        text: `anytype summary ${spaceId}`,
        channel: '#test',
        ts: '123457'
      };
      await handler.handle(message2);
    } else {
      console.log('⚠️  No spaces found - skipping summary test');
    }

    // Test 3: Help
    console.log('\nTest 3: Help Command');
    const message3 = {
      text: 'anytype help',
      channel: '#test',
      ts: '123458'
    };
    await handler.handle(message3);

    console.log('\n✅ All tests passed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await handler.disconnect();
  }
}

test();
