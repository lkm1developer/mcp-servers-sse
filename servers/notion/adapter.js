// Adapter to convert Notion MCP Server to our format
import axios from 'axios';
import { z } from 'zod';

const NOTION_VERSION = '2022-06-28';
const BASE_URL = 'https://api.notion.com';

/**
 * Extract tools from Notion MCP server and create handlers for our multi-MCP system
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'NOTION_TOKEN') {

  const toolsDefinitions = [
    {
      name: 'search-notion',
      title: 'Search Notion',
      description: 'Search for pages, databases, and other content in Notion workspace',
      inputSchema: {
        query: z.string().describe('Search query text'),
        filter: z.object({
          value: z.enum(['page', 'database']).describe('Filter by object type'),
          property: z.literal('object').describe('Property to filter on')
        }).optional().describe('Optional filter to limit search results'),
        sort: z.object({
          direction: z.enum(['ascending', 'descending']).describe('Sort direction'),
          timestamp: z.enum(['last_edited_time']).describe('Timestamp to sort by')
        }).optional().describe('Optional sort criteria')
      }
    },
    {
      name: 'get-page',
      title: 'Get Page',
      description: 'Retrieve a Notion page by ID',
      inputSchema: {
        page_id: z.string().describe('The ID of the page to retrieve')
      }
    },
    {
      name: 'get-block-children',
      title: 'Get Block Children',
      description: 'Retrieve the children blocks of a page or block',
      inputSchema: {
        block_id: z.string().describe('The ID of the block to get children from'),
        page_size: z.number().optional().describe('Number of results per page (max 100)')
      }
    },
    {
      name: 'append-block-children',
      title: 'Append Block Children',
      description: 'Append new content blocks to a page or block',
      inputSchema: {
        block_id: z.string().describe('The ID of the parent block'),
        children: z.array(z.any()).describe('Array of block objects to append')
      }
    },
    {
      name: 'create-page',
      title: 'Create Page',
      description: 'Create a new page in a database or as a child of another page',
      inputSchema: {
        parent: z.object({
          database_id: z.string().optional(),
          page_id: z.string().optional()
        }).describe('Parent database or page'),
        properties: z.record(z.any()).describe('Page properties'),
        children: z.array(z.any()).optional().describe('Page content blocks')
      }
    },
    {
      name: 'update-page',
      title: 'Update Page',
      description: 'Update page properties',
      inputSchema: {
        page_id: z.string().describe('The ID of the page to update'),
        properties: z.record(z.any()).describe('Properties to update')
      }
    },
    {
      name: 'get-database',
      title: 'Get Database',
      description: 'Retrieve a database by ID',
      inputSchema: {
        database_id: z.string().describe('The ID of the database')
      }
    },
    {
      name: 'query-database',
      title: 'Query Database',
      description: 'Query a database with filters and sorts',
      inputSchema: {
        database_id: z.string().describe('The ID of the database to query'),
        filter: z.any().optional().describe('Filter conditions'),
        sorts: z.array(z.any()).optional().describe('Sort criteria'),
        page_size: z.number().optional().describe('Number of results per page (max 100)')
      }
    },
    {
      name: 'list-users',
      title: 'List Users',
      description: 'List all users in the workspace',
      inputSchema: {}
    },
    {
      name: 'get-user',
      title: 'Get User',
      description: 'Retrieve a user by ID',
      inputSchema: {
        user_id: z.string().describe('The ID of the user')
      }
    }
  ];

  const toolHandlers = {
    'search-notion': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.post(`${BASE_URL}/v1/search`, {
          query: args.query,
          filter: args.filter,
          sort: args.sort
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Notion search failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'get-page': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.get(`${BASE_URL}/v1/pages/${args.page_id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Get page failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'get-block-children': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const params = {};
        if (args.page_size) params.page_size = args.page_size;

        const response = await axios.get(`${BASE_URL}/v1/blocks/${args.block_id}/children`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION
          },
          params
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Get block children failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'append-block-children': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.patch(`${BASE_URL}/v1/blocks/${args.block_id}/children`, {
          children: args.children
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Append block children failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'create-page': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.post(`${BASE_URL}/v1/pages`, {
          parent: args.parent,
          properties: args.properties,
          children: args.children
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Create page failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'update-page': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.patch(`${BASE_URL}/v1/pages/${args.page_id}`, {
          properties: args.properties
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Update page failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'get-database': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.get(`${BASE_URL}/v1/databases/${args.database_id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Get database failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'query-database': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.post(`${BASE_URL}/v1/databases/${args.database_id}/query`, {
          filter: args.filter,
          sorts: args.sorts,
          page_size: args.page_size
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Query database failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'list-users': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.get(`${BASE_URL}/v1/users`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`List users failed: ${error.response?.data?.message || error.message}`);
      }
    },

    'get-user': async (args, apiKey, userId) => {
      if (!apiKey) {
        throw new Error('Notion API token is required');
      }

      try {
        const response = await axios.get(`${BASE_URL}/v1/users/${args.user_id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': NOTION_VERSION
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Get user failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return {
    toolsDefinitions,
    toolHandlers
  };
}
