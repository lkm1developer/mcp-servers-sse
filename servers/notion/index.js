// Notion MCP Server - Adapted for Multi-MCP Server
import { createServerAdapter } from './adapter.js';

// Get the adapter with Notion tools
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const { toolsDefinitions, toolHandlers } = await createServerAdapter(__dirname, 'NOTION_TOKEN');

// Export in the format expected by multi-mcp-server
export { toolsDefinitions, toolHandlers };
