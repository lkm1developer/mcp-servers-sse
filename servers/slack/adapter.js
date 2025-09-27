// Slack MCP Server Adapter for 2025 Protocol
import { z } from 'zod';
import axios from 'axios';
import { log } from '../../multi-mcp-server-simple.js';

/**
 * Slack MCP Server adapter for multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'SLACK_ACCESS_TOKEN') {

  const toolsDefinitions = [
    {
      name: 'slack-send-message',
      title: 'Send Message',
      description: 'Send a message to a Slack channel or user',
      inputSchema: {
        channel: z.string().describe('Channel ID or name (e.g., #general, C1234567890, or @username)'),
        text: z.string().describe('Message text to send'),
      }
    },
    {
      name: 'slack-list-channels',
      title: 'List Channels',
      description: 'List all channels in the Slack workspace',
      inputSchema: {
        types: z.string().optional().default('public_channel,private_channel').describe('Channel types to include (public_channel,private_channel,mpim,im)'),
        limit: z.number().optional().default(100).describe('Maximum number of channels to return')
      }
    },
    {
      name: 'slack-get-channel-info',
      title: 'Get Channel Info',
      description: 'Get detailed information about a specific channel',
      inputSchema: {
        channel: z.string().describe('Channel ID or name')
      }
    },
    {
      name: 'slack-list-users',
      title: 'List Users',
      description: 'List all users in the Slack workspace',
      inputSchema: {
        limit: z.number().optional().default(100).describe('Maximum number of users to return')
      }
    },
    {
      name: 'slack-get-user-info',
      title: 'Get User Info',
      description: 'Get detailed information about a specific user',
      inputSchema: {
        user: z.string().describe('User ID or username')
      }
    },
    {
      name: 'slack-get-channel-history',
      title: 'Get Channel History',
      description: 'Get recent messages from a channel',
      inputSchema: {
        channel: z.string().describe('Channel ID or name'),
        limit: z.number().optional().default(10).describe('Number of messages to retrieve (max 100)'),
        oldest: z.string().optional().describe('Start of time range (timestamp)'),
        latest: z.string().optional().describe('End of time range (timestamp)')
      }
    },
    {
      name: 'slack-update-message',
      title: 'Update Message',
      description: 'Update an existing message in a channel',
      inputSchema: {
        channel: z.string().describe('Channel ID where the message was sent'),
        ts: z.string().describe('Timestamp of the message to update'),
        text: z.string().describe('New message text'),
        blocks: z.array(z.any()).optional().describe('New rich message blocks (JSON format)')
      }
    },
    {
      name: 'slack-delete-message',
      title: 'Delete Message',
      description: 'Delete a message from a channel',
      inputSchema: {
        channel: z.string().describe('Channel ID where the message was sent'),
        ts: z.string().describe('Timestamp of the message to delete')
      }
    }
  ];

  // Initialize Slack API client
  let slackToken = null;

  const initializeSlack = async (accessToken) => {
    try {
      slackToken = accessToken;

      // Test the token by calling auth.test
      const response = await axios.post('https://slack.com/api/auth.test', {}, {
        headers: {
          'Authorization': `Bearer ${slackToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        throw new Error(`Slack auth failed: ${response.data.error}`);
      }

      log('SLACK', 'Token validated successfully', {
        team: response.data.team,
        user: response.data.user
      });

      return true;
    } catch (error) {
      log('SLACK', `Failed to initialize Slack API: ${error.message}`);
      return false;
    }
  };

  const makeSlackRequest = async (method, data = {}) => {
    const response = await axios.post(`https://slack.com/api/${method}`, data, {
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return response.data;
  };

  const toolHandlers = {
    'slack-send-message': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { channel, text, thread_ts, blocks } = params;

        const payload = {
          channel: channel.toString().toUpperCase(),
          text: text
        };

        if (thread_ts) payload.thread_ts = thread_ts;
        if (blocks) payload.blocks = blocks;

        const result = await makeSlackRequest('chat.postMessage', payload);

        return {
          content: [{
            type: "text",
            text: `Message sent successfully:\n\n- Channel: ${channel}\n- Message: "${text}"\n- Timestamp: ${result.ts}\n- Thread: ${thread_ts ? 'Reply to thread' : 'New message'}\n\nFull Response:\n${JSON.stringify(result, null, 2)}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to send message: ${error.message}`);
        throw new Error(`Failed to send message: ${error.message}`);
      }
    },

    'slack-list-channels': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { types = 'public_channel,private_channel', limit = 100 } = params;

        const result = await makeSlackRequest('conversations.list', {
          types: types,
          limit: limit
        });

        const channels = result.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          is_private: channel.is_private,
          is_archived: channel.is_archived,
          num_members: channel.num_members,
          topic: channel.topic?.value || '',
          purpose: channel.purpose?.value || ''
        }));

        return {
          content: [{
            type: "text",
            text: `Found ${channels.length} channels:\n\n${channels.map((channel, index) =>
              `${index + 1}. ${channel.is_private ? '🔒' : '#'} ${channel.name} (${channel.id})\n   Members: ${channel.num_members || 'N/A'}\n   Topic: ${channel.topic || 'None'}`
            ).join('\n\n')}\n\nTotal Channels: ${channels.length}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to list channels: ${error.message}`);
        throw new Error(`Failed to list channels: ${error.message}`);
      }
    },

    'slack-get-channel-info': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { channel } = params;

        const result = await makeSlackRequest('conversations.info', {
          channel: channel
        });

        const channelInfo = result.channel;

        return {
          content: [{
            type: "text",
            text: `Channel Information:\n\n- ID: ${channelInfo.id}\n- Name: ${channelInfo.name}\n- Type: ${channelInfo.is_private ? 'Private' : 'Public'}\n- Created: ${new Date(channelInfo.created * 1000).toISOString()}\n- Members: ${channelInfo.num_members}\n- Topic: ${channelInfo.topic?.value || 'None'}\n- Purpose: ${channelInfo.purpose?.value || 'None'}\n- Archived: ${channelInfo.is_archived ? 'Yes' : 'No'}\n\nFull Response:\n${JSON.stringify(channelInfo, null, 2)}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to get channel info: ${error.message}`);
        throw new Error(`Failed to get channel info: ${error.message}`);
      }
    },

    'slack-list-users': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { limit = 100 } = params;

        const result = await makeSlackRequest('users.list', {
          limit: limit
        });

        const users = result.members
          .filter(user => !user.deleted && !user.is_bot)
          .map(user => ({
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            display_name: user.profile?.display_name || '',
            email: user.profile?.email || '',
            is_admin: user.is_admin,
            is_owner: user.is_owner,
            status: user.profile?.status_text || ''
          }));

        return {
          content: [{
            type: "text",
            text: `Found ${users.length} users:\n\n${users.slice(0, 20).map((user, index) =>
              `${index + 1}. ${user.real_name} (@${user.name})\n   ID: ${user.id}\n   Email: ${user.email || 'Not available'}\n   Status: ${user.status || 'No status'}`
            ).join('\n\n')}\n\n${users.length > 20 ? `... and ${users.length - 20} more users` : ''}\n\nTotal Users: ${users.length}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to list users: ${error.message}`);
        throw new Error(`Failed to list users: ${error.message}`);
      }
    },

    'slack-get-user-info': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { user } = params;

        const result = await makeSlackRequest('users.info', {
          user: user
        });

        const userInfo = result.user;

        return {
          content: [{
            type: "text",
            text: `User Information:\n\n- ID: ${userInfo.id}\n- Username: @${userInfo.name}\n- Real Name: ${userInfo.real_name}\n- Display Name: ${userInfo.profile?.display_name || 'Not set'}\n- Email: ${userInfo.profile?.email || 'Not available'}\n- Phone: ${userInfo.profile?.phone || 'Not available'}\n- Title: ${userInfo.profile?.title || 'Not set'}\n- Status: ${userInfo.profile?.status_text || 'No status'}\n- Timezone: ${userInfo.tz_label || 'Not available'}\n- Admin: ${userInfo.is_admin ? 'Yes' : 'No'}\n- Owner: ${userInfo.is_owner ? 'Yes' : 'No'}\n- Deleted: ${userInfo.deleted ? 'Yes' : 'No'}\n\nFull Response:\n${JSON.stringify(userInfo, null, 2)}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to get user info: ${error.message}`);
        throw new Error(`Failed to get user info: ${error.message}`);
      }
    },

    'slack-get-channel-history': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { channel, limit = 10, oldest, latest } = params;

        const payload = {
          channel: channel,
          limit: Math.min(limit, 100)
        };

        if (oldest) payload.oldest = oldest;
        if (latest) payload.latest = latest;

        const result = await makeSlackRequest('conversations.history', payload);

        const messages = result.messages.map(msg => ({
          ts: msg.ts,
          user: msg.user,
          text: msg.text,
          thread_ts: msg.thread_ts,
          reply_count: msg.reply_count || 0,
          timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString()
        }));

        return {
          content: [{
            type: "text",
            text: `Channel History (${messages.length} messages):\n\n${messages.map((msg, index) =>
              `${index + 1}. [${msg.timestamp}] User: ${msg.user}\n   Message: "${msg.text}"\n   Thread: ${msg.thread_ts ? 'Part of thread' : 'Standalone'}\n   Replies: ${msg.reply_count}`
            ).join('\n\n')}\n\nTotal Messages: ${messages.length}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to get channel history: ${error.message}`);
        throw new Error(`Failed to get channel history: ${error.message}`);
      }
    },

    'slack-update-message': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { channel, ts, text, blocks } = params;

        const payload = {
          channel: channel,
          ts: ts,
          text: text
        };

        if (blocks) payload.blocks = blocks;

        const result = await makeSlackRequest('chat.update', payload);

        return {
          content: [{
            type: "text",
            text: `Message updated successfully:\n\n- Channel: ${channel}\n- Timestamp: ${ts}\n- New Text: "${text}"\n- Updated At: ${new Date().toISOString()}\n\nFull Response:\n${JSON.stringify(result, null, 2)}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to update message: ${error.message}`);
        throw new Error(`Failed to update message: ${error.message}`);
      }
    },

    'slack-delete-message': async (params, apiKey) => {
      try {
        await initializeSlack(apiKey);
        const { channel, ts } = params;

        const result = await makeSlackRequest('chat.delete', {
          channel: channel,
          ts: ts
        });

        return {
          content: [{
            type: "text",
            text: `Message deleted successfully:\n\n- Channel: ${channel}\n- Timestamp: ${ts}\n- Deleted At: ${new Date().toISOString()}\n\nFull Response:\n${JSON.stringify(result, null, 2)}`
          }]
        };
      } catch (error) {
        log('SLACK', `Failed to delete message: ${error.message}`);
        throw new Error(`Failed to delete message: ${error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers,
    initialize: initializeSlack
  };
}