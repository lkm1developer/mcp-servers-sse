// Firecrawl MCP Server - Adapted for Multi-MCP Server
import { createServerAdapter } from './adapter.js';

// Get the adapter with Firecrawl tools
const { toolsDefinitions, toolHandlers } = await createServerAdapter(__dirname, 'FIRECRAWL_API_KEY');

// Export in the format expected by multi-mcp-server
export { toolsDefinitions, toolHandlers };