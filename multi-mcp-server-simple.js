#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Load configuration
const configPath = path.join(process.cwd(), 'server.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❌ Failed to load server.json:', error.message);
  process.exit(1);
}

const app = express();
const port = process.env.SSE_PORT || 8009;

// Simple console logging for GCP Cloud Run
export function log(serverName, message, data = null) {
  console.log(`[${serverName}] ${message}`, data || '');
}

// Simple transport storage per server
const serverTransports = new Map(); // serverName -> { sessionId -> transport }

// Load server adapters
const serverAdapters = new Map();

async function loadServerAdapters() {
  log('MANAGER', 'Loading server adapters...');

  for (const [serverName, serverConfig] of Object.entries(config.servers)) {
    if (!serverConfig.enabled) {
      log('MANAGER', `Server ${serverName} is disabled, skipping`);
      continue;
    }

    try {
      const serverDir = path.resolve(serverConfig.directory);
      const entryFile = path.join(serverDir, serverConfig.entryFile || 'index.js');

      if (!fs.existsSync(entryFile)) {
        log('MANAGER', `Entry file not found: ${entryFile}`, null);
        continue;
      }

      const serverModule = await import(`file://${entryFile}?t=${Date.now()}`);

      let toolsDefinitions, toolHandlers;
      if (serverModule.toolsDefinitions && serverModule.toolHandlers) {
        toolsDefinitions = serverModule.toolsDefinitions;
        toolHandlers = serverModule.toolHandlers;
      } else if (serverModule.createServerAdapter) {
        const adapter = await serverModule.createServerAdapter(serverDir, serverConfig.apiKeyParam, log);
        toolsDefinitions = adapter.toolsDefinitions;
        toolHandlers = adapter.toolHandlers;
      } else {
        throw new Error(`Server ${serverName} must export toolsDefinitions and toolHandlers, or provide createServerAdapter function`);
      }

      serverAdapters.set(serverName, {
        name: serverConfig.name,
        version: serverConfig.version,
        toolsDefinitions,
        toolHandlers,
        config: serverConfig
      });

      // Initialize transport storage for this server
      serverTransports.set(serverName, new Map());

      log('MANAGER', `Server adapter loaded: ${serverName}`);
    } catch (error) {
      log('MANAGER', `Failed to load server adapter ${serverName}`, { error: error.message });
    }
  }

  log('MANAGER', `Loaded ${serverAdapters.size} server adapters`);
}

// JWT Secret helper
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

// Server-to-Server API Key validation
// The x-api-key header validates the calling server is authorized
function validateServerApiKey(apiKey) {
  if (!apiKey) {
    log('AUTH', 'No x-api-key provided for server-to-server auth');
    return { isValid: false, error: 'x-api-key header is required' };
  }

  const expectedApiKey = process.env.MCP_API_KEY;
  if (!expectedApiKey) {
    log('AUTH', 'MCP_API_KEY not configured in environment');
    return { isValid: false, error: 'Server API key not configured' };
  }

  if (apiKey !== expectedApiKey) {
    log('AUTH', 'Invalid server-to-server API key');
    return { isValid: false, error: 'Invalid server API key' };
  }

  log('AUTH', 'Valid server-to-server API key');
  return { isValid: true };
}

// Verify and decode the Bearer JWT token to extract user data
// Token contains: { serverId, serverName, userId, apiKey/accessToken }
function decryptBearerToken(token) {
  try {
    const jwtSecret = getJwtSecret();

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, jwtSecret);

    // Validate required fields
    if (!decoded.serverId || !decoded.serverName || !decoded.userId) {
      throw new Error('Missing required fields in JWT token');
    }

    // apiKey or accessToken (for OAuth servers)
    if (!decoded.apiKey && !decoded.accessToken) {
      throw new Error('Missing apiKey or accessToken in JWT token');
    }

    return decoded;
  } catch (error) {
    log('AUTH', 'Failed to verify Bearer token', { error: error.message });
    throw new Error(`Invalid JWT token: ${error.message}`);
  }
}

// Validate Bearer token and extract user data
function validateBearerToken(authHeader, serverName) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log('AUTH', `No Bearer token provided for ${serverName}`);
    return { isValid: false, error: 'Bearer token is required', userData: null };
  }

  try {
    const encryptedToken = authHeader.split(' ')[1];
    const userData = decryptBearerToken(encryptedToken);

    // Verify the serverName in token matches the requested server
    if (userData.serverName !== serverName) {
      log('AUTH', `Server name mismatch: token=${userData.serverName}, request=${serverName}`);
      return {
        isValid: false,
        error: 'Token server name does not match request',
        userData: null
      };
    }

    log('AUTH', `Successfully validated Bearer token for ${serverName}, userId: ${userData.userId}`);
    return {
      isValid: true,
      userData: {
        serverId: userData.serverId,
        serverName: userData.serverName,
        userId: userData.userId,
        userApiKey: userData.apiKey || userData.accessToken
      }
    };
  } catch (error) {
    log('AUTH', `Failed to validate Bearer token for ${serverName}`, { error: error.message });
    return { isValid: false, error: error.message, userData: null };
  }
}

// Express middleware
app.use(express.json({ limit: '50mb' }));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'mcp-session-id']
}));

// Health check endpoint
app.get('/health', (req, res) => {
  const totalSessions = Array.from(serverTransports.values())
    .reduce((sum, transports) => sum + transports.size, 0);

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    servers: Array.from(serverAdapters.keys()),
    totalSessions,
    loadedServers: serverAdapters.size
  });
});

// Main MCP handler
app.post('/:serverName/mcp', async (req, res) => {
  const { serverName } = req.params;
  try {
    log(serverName, `Received request: ${JSON.stringify(req.body)}`);
    // Check if server adapter exists
    const serverAdapter = serverAdapters.get(serverName);
    if (!serverAdapter) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: `Server '${serverName}' not found` }
      });
    }

    // Get server transports
    const transports = serverTransports.get(serverName);

    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'];
    let transport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId);
      transport.lastActive = Date.now(); // Update activity timestamp
      log(serverName, `Reusing existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - Two-layer authentication:
      // 1. Server-to-Server: x-api-key validates the calling server
      // 2. User Auth: Bearer token contains encrypted user data

      const serverApiKey = req.headers['x-api-key'];
      const authHeader = req.headers.authorization;

      // Validate server-to-server API key
      const serverAuth = validateServerApiKey(serverApiKey);
      if (!serverAuth.isValid) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: serverAuth.error }
        });
      }

      // Validate and decrypt Bearer token for user data
      const bearerAuth = validateBearerToken(authHeader, serverName);
      if (!bearerAuth.isValid) {
        return res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: bearerAuth.error }
        });
      }

      const { userId, serverId, userApiKey } = bearerAuth.userData;

      // Create new transport with user's API key
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transport.sessionId = newSessionId;
          // Store user data for use in tool handlers
          transport.userApiKey = userApiKey;
          transport.userId = userId;
          transport.serverId = serverId;
          transport.lastActive = Date.now(); // Track last activity

          transports.set(newSessionId, transport);
          log(serverName, `New session initialized: ${newSessionId} for userId: ${userId}`);
        },
        enableDnsRebindingProtection: false
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          log(serverName, `Client disconnected - Session closed: ${transport.sessionId}, userId: ${transport.userId}`);

          // Clean up the transport
          transports.delete(transport.sessionId);

          // Optional: Perform additional cleanup here
          // - Close any open file handles
          // - Cancel ongoing operations
          // - Release resources
          // - Notify other services

          log(serverName, `Session cleanup completed: ${transport.sessionId}`);
        }
      };

      // Additional: Detect connection errors
      transport.onerror = (error) => {
        log(serverName, `Transport error for session ${transport.sessionId}: ${error?.message || 'Unknown error'}`);
      };

      // CREATE FRESH MCP SERVER INSTANCE PER SESSION
      const mcpServer = new McpServer({
        name: serverAdapter.name,
        version: serverAdapter.version
      }, {
        capabilities: { tools: {} }
      });

      // Register tools for THIS session
      for (const toolDef of serverAdapter.toolsDefinitions) {
        mcpServer.registerTool(
          toolDef.name,
          {
            title: toolDef.name,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema
          },
          async (args) => {
            log(serverName, `Processing tool: ${toolDef.name}`);
            const handler = serverAdapter.toolHandlers[toolDef.name];
            if (!handler) {
              throw new Error(`Unknown tool: ${toolDef.name}`);
            }

            try {
              const result = await handler(args, transport.userApiKey);
              log(serverName, `Tool completed: ${toolDef.name}`, { success: true });
              return result;
            } catch (error) {
              log(serverName, `Tool error: ${toolDef.name}`, { error: error.message });
              throw error;
            }
          }
        );
      }

      // Connect transport to THIS server instance
      await mcpServer.connect(transport);

      log(serverName, 'New MCP server instance created and connected');
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session or missing initialization' }
      });
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    log(serverName, 'Request handling error', { error: error.message, stack: error.stack });

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' }
      });
    }
  }
});

// SSE endpoint
const handleSessionRequest = async (req, res) => {
  const { serverName } = req.params;
  const sessionId = req.headers['mcp-session-id'];

  log(serverName, `${req.method} request received for session: ${sessionId}`);

  if (!sessionId) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Missing session ID' }
    });
  }

  const transports = serverTransports.get(serverName);
  if (!transports || !transports.has(sessionId)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid session ID' }
    });
  }

  const transport = transports.get(sessionId);
  transport.lastActive = Date.now(); // Update activity timestamp

  await transport.handleRequest(req, res);
};

app.get('/:serverName/mcp', handleSessionRequest);
app.delete('/:serverName/mcp', handleSessionRequest);

// Cleanup inactive sessions every 5 minutes
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  let totalCleaned = 0;
  const now = Date.now();

  for (const [serverName, transports] of serverTransports.entries()) {
    let cleaned = 0;
    for (const [sessionId, transport] of transports.entries()) {
      try {
        // Check if transport is closed OR inactive for more than 5 minutes
        const isInactive = transport.lastActive && (now - transport.lastActive) > SESSION_TIMEOUT_MS;

        if (!transport || transport.closed || isInactive) {
          transports.delete(sessionId);
          cleaned++;
          if (isInactive) {
            log(serverName, `Session ${sessionId} timed out after 5 minutes of inactivity`);
          }
        }
      } catch (error) {
        transports.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log(serverName, `Cleaned up ${cleaned} inactive sessions`);
      totalCleaned += cleaned;
    }
  }

  if (totalCleaned > 0) {
    log('CLEANUP', `Total sessions cleaned: ${totalCleaned}`);
  }
}, 5 * 60 * 1000);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Multi-MCP Simple Server',
    version: '3.0.0-simple',
    status: 'running',
    servers: Array.from(serverAdapters.keys()),
    endpoints: [
      'GET /health - Health check',
      'POST /{serverName}/mcp - MCP server interaction (requires x-api-key + Bearer token)',
      'GET /{serverName}/mcp - MCP SSE stream',
      'DELETE /{serverName}/mcp - Terminate MCP session'
    ],
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);

  // Close all active transports
  for (const [serverName, transports] of serverTransports.entries()) {
    for (const [sessionId, transport] of transports.entries()) {
      try {
        if (transport && transport.close) {
          transport.close();
        }
      } catch (error) {
        console.error(`Error closing transport ${serverName}:${sessionId}:`, error);
      }
    }
  }

  log('MAIN', '✅ Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
async function startServer() {
  try {
    log('MAIN', 'Starting Multi-MCP Simple Server...');

    // Load server adapters
    await loadServerAdapters();
    log('MAIN', '✅ Server adapters loaded');

    // Start HTTP server
    app.listen(port, '0.0.0.0', () => {
      log('MAIN', `🚀 Multi-MCP Simple Server running on port ${port}`);
      log('MAIN', `📊 Health check: http://localhost:${port}/health`);
     
      log('MAIN', `📦 Loaded servers: ${Array.from(serverAdapters.keys()).join(', ')}`);
    });

  } catch (error) {
    log('MAIN', 'Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();