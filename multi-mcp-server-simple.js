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
import { createClient } from '@supabase/supabase-js';
import pkg from 'crypto-js';
const { AES, enc } = pkg;

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'meerkats'
    }
  }
);

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
const JWT_SECRET = process.env.JWT_SECRET;

// Simple logging
const LOG_FILE = path.join(process.cwd(), 'logs', 'multi-mcp-simple.log');
const logsDir = path.dirname(LOG_FILE);

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.error('❌ Cannot create logs directory:', error.message);
}

export function log(serverName, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${serverName}] ${message}${data ? '\\n' + JSON.stringify(data, null, 2) : ''}\\n`;

  try {
    console.log(`[${serverName}] ${message}`, data || '');
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    console.error(`[LOG-ERROR] Failed to write to log file: ${error.message}`);
  }
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

// Encryption/Decryption helper functions
export const getEncryptionKey = () => {
  return process.env.ENCRYPTION_KEY ?? 'ddsf%@#%#dfdfdfvbvdf546456dfcxgvdfgvfdg'; // Default for dev only
};

const decryptCredentialData = (encryptedData) => {
  const encryptKey = getEncryptionKey();
  const decryptedData = AES.decrypt(encryptedData, encryptKey);
  try {
    const plainDataObj = JSON.parse(decryptedData.toString(enc.Utf8));
    return plainDataObj;
  } catch (e) {
    console.error(e);
    throw new Error('Credentials could not be decrypted.');
  }
};

// Get system connection using Supabase
export const getSystemConnection = async (keys) => {
  let obj = {}
  const { data: secrets, error } = await supabase
    .from('connections')
    .select('*')
    .eq('is_system', true)
    .eq('type', 'vault')
    .in('name', keys)

  if (error || !secrets) {
    throw new AppError(404, 'Secret not found');
  }
  await Promise.all(secrets.map(async (secret) => {
    if (secret.data) {
      obj[secret.name] = decryptCredentialData(secret.data);
    }
  }))

  return obj;
};


// API Key validation with caching
const apiKeyCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function validateApiKey(apiKey, serverName, user_id, serverId) {
  try {
    if (!apiKey) {
      log('AUTH_FAILED', JSON.stringify({ apiKey, serverName, user_id, serverId }));
      return { isValid: false, error: 'API key is required' };
    }

    // Check cache first
    const cacheKey = `${apiKey}-${user_id}-${serverId}`;
    const cached = apiKeyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.result;
    }

    let result;

    if (user_id === 'system') {
      const conObj = await getSystemConnection([`${serverName.toUpperCase()}_API_KEY`]);
      const dbApiKey = conObj[`${serverName.toUpperCase()}_API_KEY`];
     
      if (!dbApiKey || apiKey !== dbApiKey) {
         log('AUTH_FAILED22222', JSON.stringify({ apiKey, serverName, user_id, serverId, dbApiKey }));
        result = { isValid: false, error: 'Invalid or disabled API key' };
      } else {
        result = {
          isValid: true,
          user_id: 'system',
          serverId: serverId,
          rateLimit: null
        };
      }
    } else {
      // Query using Supabase
      const { data: mcpServerUser, error } = await supabase
        .from('mcp_server_users')
        .select('*')
        .eq('user_id', user_id)
        .eq('server_id', serverId)
        .eq('enabled', true)
        .maybeSingle();

      if (error || !mcpServerUser) {
        result = { isValid: false, error: 'Invalid or disabled API key' };
      } else {
        const localApiKey = mcpServerUser.is_oauth ? mcpServerUser.oauth_data?.access_token : mcpServerUser.api_key;
        if (apiKey !== localApiKey) {
          result = { isValid: false, error: 'Invalid or disabled API key 2' };
        } else {
          result = {
            isValid: true,
            user_id: mcpServerUser.user_id,
            serverId: mcpServerUser.server_id,
            rateLimit: mcpServerUser.rate_limit
          };
        }
      }
    }

    // Cache the result
    apiKeyCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    log('AUTH', `API key validation error`, { error: error.message, serverName });
    return { isValid: false, error: 'Database validation error' };
  }
}

// Express middleware
app.use(express.json({ limit: '50mb' }));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id']
}));

// Health check endpoint
app.get('/health', (req, res) => {
  const totalSessions = Array.from(serverTransports.values())
    .reduce((sum, transports) => sum + transports.size, 0);

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-supabase',
    transport: 'streamable-http',
    auth_type: 'jwt',
    database: 'supabase',
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
      log(serverName, `Reusing existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - validate JWT
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bearer token required' }
        });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtError) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Invalid JWT token' }
        });
      }
      const { userId, serverId, apiKey: userApiKey, serverName } = decoded;
      // Validate API key
      const apiKeyValidation = await validateApiKey(userApiKey, serverName, userId, serverId);
      if (!apiKeyValidation.isValid) {
        return res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: apiKeyValidation.error }
        });
      }

      // Create new transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transport.sessionId = newSessionId;
          transport.userApiKey = serverName === 'meerkats-table' ? token : userApiKey;
          transport.user_id = apiKeyValidation.user_id;

          transports.set(newSessionId, transport);
          log(serverName, `New session initialized: ${newSessionId}`);
        },
        enableDnsRebindingProtection: false
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          log(serverName, `Session closed: ${transport.sessionId}`);
          transports.delete(transport.sessionId);
        }
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
              const result = await handler(args, transport.userApiKey, transport.user_id);
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
  await transport.handleRequest(req, res);
};

app.get('/:serverName/mcp', handleSessionRequest);
app.delete('/:serverName/mcp', handleSessionRequest);

// Simple cleanup every 5 minutes
setInterval(() => {
  let totalCleaned = 0;

  for (const [serverName, transports] of serverTransports.entries()) {
    let cleaned = 0;
    for (const [sessionId, transport] of transports.entries()) {
      try {
        if (!transport || transport.closed) {
          transports.delete(sessionId);
          cleaned++;
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
    name: 'Multi-MCP Simple Server (Supabase)',
    version: '2.0.0-supabase',
    status: 'running',
    database: 'supabase',
    servers: Array.from(serverAdapters.keys()),
    endpoints: [
      'GET /health - Health check',
      'POST /{serverName}/mcp - MCP server interaction',
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
    log('MAIN', 'Starting Multi-MCP Simple Server (Supabase)...');

    // Test Supabase connection
    const { data, error } = await supabase.from('mcp_servers').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    log('MAIN', '✅ Supabase connected successfully');

    // Load server adapters
    await loadServerAdapters();
    log('MAIN', '✅ Server adapters loaded');

    // Start HTTP server
    app.listen(port, '0.0.0.0', () => {
      log('MAIN', `🚀 Multi-MCP Simple Server (Supabase) running on port ${port}`);
      log('MAIN', `📊 Health check: http://localhost:${port}/health`);
      log('MAIN', `🔗 Database: Supabase PostgreSQL`);
    });

  } catch (error) {
    log('MAIN', 'Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();