// Apify MCP Server Wrapper Adapter - Direct Import Strategy
// This adapter wraps the official @apify/actors-mcp-server package

import { ApifyClient } from 'apify-client';
import { z } from 'zod';

// Note: The package is TypeScript and exports from dist/
// We need to use dynamic import since it's an ESM package
let toolCategories, ApifyClientWrapper;

/**
 * Convert JSON Schema to Zod schema (simplified conversion)
 * This is needed because Apify tools use JSON Schema but our system expects Zod
 */
function jsonSchemaToZod(jsonSchema) {
  if (!jsonSchema || !jsonSchema.properties) {
    return z.object({});
  }

  const shape = {};
  const properties = jsonSchema.properties;
  const required = jsonSchema.required || [];

  for (const [key, prop] of Object.entries(properties)) {
    let zodType;

    switch (prop.type) {
      case 'string':
        zodType = z.string();
        if (prop.minLength) zodType = zodType.min(prop.minLength);
        if (prop.maxLength) zodType = zodType.max(prop.maxLength);
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        if (prop.minimum !== undefined) zodType = zodType.min(prop.minimum);
        if (prop.maximum !== undefined) zodType = zodType.max(prop.maximum);
        if (prop.type === 'integer') zodType = zodType.int();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        zodType = z.array(z.any());
        break;
      case 'object':
        zodType = z.record(z.any());
        break;
      default:
        zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (prop.default !== undefined) {
      zodType = zodType.default(prop.default);
    }

    // Make optional if not in required array
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

/**
 * Apify MCP Server wrapper adapter for multi-MCP system
 * Imports all tools from the official @apify/actors-mcp-server package
 */
export async function createServerAdapter(serverPath, apiKeyParam = 'APIFY_API_TOKEN') {

  // Dynamically import the Apify MCP server internals
  try {
    // Import tool categories from the package
    const apifyMcpInternals = await import('@apify/actors-mcp-server/internals');
    toolCategories = apifyMcpInternals.toolCategories;

    console.log('[Apify Adapter] Successfully imported tool categories');
  } catch (error) {
    console.error('[Apify Adapter] Failed to import from @apify/actors-mcp-server:', error.message);
    throw new Error(`Failed to load Apify MCP server package: ${error.message}`);
  }

  // Collect all tools from all categories
  const allTools = [
    ...toolCategories.actors,      // Actor search, details, call
    ...toolCategories.docs,         // Documentation search and fetch
    ...toolCategories.runs,         // Run management
    ...toolCategories.storage,      // Dataset and KV store access
    ...toolCategories.experimental, // Add tool dynamically
    ...toolCategories.dev          // HTML skeleton extraction
  ];

  console.log(`[Apify Adapter] Loaded ${allTools.length} tools from Apify MCP server`);

  // Transform tool definitions to match our adapter format
  // Convert JSON Schema to Zod schema for compatibility
  const toolsDefinitions = allTools.map(tool => ({
    name: tool.name,
    title: tool.name,
    description: tool.description,
    inputSchema: jsonSchemaToZod(tool.inputSchema)
  }));

  // Create tool handlers that wrap the original tool calls
  const toolHandlers = {};

  for (const tool of allTools) {
    toolHandlers[tool.name] = async (args, apiKey, userId) => {
      if (!apiKey && tool.name !== 'search-apify-docs' && tool.name !== 'fetch-apify-docs') {
        throw new Error('Apify API token is required for this operation');
      }

      try {
        // Create Apify client with the user's API key
        const apifyClient = new ApifyClient({ token: apiKey });

        // Prepare the context that the tool expects
        const toolArgs = {
          args,
          apifyToken: apiKey,
          apifyClient,
          extra: {
            sendNotification: async () => {}, // Stub for notifications
            signal: null // No abort signal support for now
          },
          // These are needed by some internal tools
          apifyMcpServer: null, // We don't have a full server instance
          mcpServer: null,
          userRentedActorIds: [],
          progressTracker: null
        };

        // Call the original tool handler
        const result = await tool.call(toolArgs);

        // Transform the result to our format if needed
        // Apify tools return { content: [...] } or { isError, content }
        if (result && result.content) {
          return result;
        }

        // If no content, wrap it
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        console.error(`[Apify Adapter] Error calling tool ${tool.name}:`, error.message);

        // Return error in expected format
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${tool.name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    };
  }

  console.log(`[Apify Adapter] Created ${Object.keys(toolHandlers).length} tool handlers`);

  return {
    toolsDefinitions,
    toolHandlers
  };
}
