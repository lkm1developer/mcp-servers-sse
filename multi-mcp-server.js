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
const port = config.global.port || 8080;
const JWT_SECRET = process.env.JWT_SECRET;
const LOG_FILE = path.join(process.cwd(), 'logs', config.global.log_file || 'multi-mcp-debug.log');
const REQUEST_LOG_FILE = path.join(process.cwd(), 'logs', 'requests.log');

// Initialize logs directory and log files
const logsDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const initEntry = `[${new Date().toISOString()}] Multi-MCP Server initializing...\n`;
  fs.appendFileSync(LOG_FILE, initEntry);
} catch (error) {
  console.error('❌ Cannot create logs directory or write to log file:', error.message);
}

function log(serverName, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${serverName}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  
  try {
    console.log(`[${serverName}] ${message}`, data || '');
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    console.error(`[LOG-ERROR] Failed to write to log file: ${error.message}`);
  }
}

// isInitializeRequest is imported from SDK

// Request logging function
function logRequest(req, additionalInfo = {}) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    method: req.method,
    url: req.url,
    pathname: req.path || req.url,
    query: req.query,
    headers: req.headers,
    remoteAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    serverName: req.params?.serverName,
    sessionId: req.headers['mcp-session-id'],
    protocolVersion: req.headers['mcp-protocol-version'],
    hasAuthorization: !!req.headers['authorization'],
    body: req.method === 'POST' ? (req.body || '[body not captured]') : undefined,
    ...additionalInfo
  };
  
  const logEntry = `${JSON.stringify(logData, null, 2)}\n${'='.repeat(80)}\n`;
  
  try {
    fs.appendFileSync(REQUEST_LOG_FILE, logEntry);
    console.log(`📝 Request logged: ${req.method} ${req.url}`);
  } catch (error) {
    console.error(`[REQUEST-LOG-ERROR] Failed to write to request log: ${error.message}`);
  }
}

// Server registry to manage multiple MCP servers
class MCPServerManager {
  constructor() {
    this.servers = new Map(); // serverName -> { transports: Map, mcpServer: Server, config: Object }
  }

  // Initialize all servers from config
  async initializeServers() {
    log('MANAGER', 'Initializing servers from configuration');
    
    for (const [serverName, serverConfig] of Object.entries(config.servers)) {
      if (!serverConfig.enabled) {
        log('MANAGER', `Server ${serverName} is disabled, skipping`);
        continue;
      }
      
      try {
        await this.initializeServer(serverName, serverConfig);
      } catch (error) {
        log('MANAGER', `Failed to initialize server ${serverName}`, { error: error.message });
        // Mark server as crashed but continue with others
        this.servers.set(serverName, {
          transports: new Map(),
          mcpServer: null,
          config: serverConfig,
          status: 'crashed',
          crashedAt: new Date(),
          crashError: error.message
        });
      }
    }
    
    log('MANAGER', `Initialized ${this.getActiveServerCount()} out of ${Object.keys(config.servers).length} servers`);
  }

  async initializeServer(serverName, serverConfig) {
    log('MANAGER', `Initializing server: ${serverName}`);
    
    // Load server tools from directory
    const serverDir = path.resolve(serverConfig.directory);
    const entryFile = path.join(serverDir, serverConfig.entryFile || 'index.js');
    
    if (!fs.existsSync(entryFile)) {
      throw new Error(`Entry file not found: ${entryFile}`);
    }
    
    // Dynamically import the server module with cache busting
    let toolsDefinitions, toolHandlers;
    
    try {
      const serverModule = await import(`file://${entryFile}?t=${Date.now()}`);
      
      if (serverModule.toolsDefinitions && serverModule.toolHandlers) {
        // New format - direct export
        toolsDefinitions = serverModule.toolsDefinitions;
        toolHandlers = serverModule.toolHandlers;
        log('MANAGER', `Server ${serverName} loaded in standard format`);
      } else if (serverModule.createServerAdapter) {
        // Adapter format - call the adapter function
        const adapter = await serverModule.createServerAdapter(serverDir, serverConfig.apiKeyParam);
        toolsDefinitions = adapter.toolsDefinitions;
        toolHandlers = adapter.toolHandlers;
        log('MANAGER', `Server ${serverName} loaded via adapter`);
      } else {
        throw new Error(`Server ${serverName} must export toolsDefinitions and toolHandlers, or provide createServerAdapter function`);
      }
    } catch (importError) {
      log('MANAGER', `Failed to import server ${serverName}`, { error: importError.message });
      throw new Error(`Failed to load server ${serverName}: ${importError.message}`);
    }
    
    if (!toolsDefinitions || !toolHandlers) {
      throw new Error(`Server ${serverName} did not provide valid toolsDefinitions and toolHandlers`);
    }
    
    // Create MCP server instance
    const mcpServer = new McpServer({
      name: serverConfig.name,
      version: serverConfig.version
    }, {
      capabilities: {
        tools: {},
      }
    });
    
    // Register tools using the new registerTool API
    for (const toolDef of toolsDefinitions) {
      mcpServer.registerTool(
        toolDef.name,
        {
          title: toolDef.name,
          description: toolDef.description,
          inputSchema: toolDef.inputSchema
        },
        async (args) => {
          log(serverName, `Processing tool: ${toolDef.name}`);
          const handler = toolHandlers[toolDef.name];
          if (!handler) {
            log(serverName, `Tool handler not found: ${toolDef.name}`);
            throw new Error(`Unknown tool: ${toolDef.name}`);
          }

          try {
            // Get API key from current request context
            // This will be set during request processing
            const currentTransport = mcpServer.currentTransport;
            const userApiKey = currentTransport?.userApiKey;
            const userId = currentTransport?.userId;
            
            log(serverName, `Tool executing with context`, { hasApiKey: !!userApiKey, userId });
            
            const result = await handler(args, userApiKey, userId);
            log(serverName, `Tool completed: ${toolDef.name}`, { success: true });
            return result;
          } catch (error) {
            log(serverName, `Tool error: ${toolDef.name}`, { error: error.message, stack: error.stack });
            throw error;
          }
        }
      );
    }
    
    // Store server data
    this.servers.set(serverName, {
      transports: new Map(),
      mcpServer,
      config: serverConfig,
      toolHandlers,
      status: 'ready',
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    log('MANAGER', `Server ${serverName} initialized successfully with ${toolsDefinitions.length} tools`);
  }

  // Get server info
  getServer(serverName) {
    return this.servers.get(serverName);
  }

  // Get all servers status
  getAllServers() {
    return Array.from(this.servers.entries()).map(([name, data]) => ({
      name,
      status: data.status,
      transportCount: data.transports.size,
      lastActivity: data.lastActivity,
      createdAt: data.createdAt,
      crashedAt: data.crashedAt,
      crashError: data.crashError,
      config: {
        name: data.config.name,
        version: data.config.version,
        description: data.config.description,
        enabled: data.config.enabled
      }
    }));
  }

  getActiveServerCount() {
    return Array.from(this.servers.values()).filter(s => s.status === 'ready').length;
  }

  // Mark server as crashed and isolate it
  crashServer(serverName, error) {
    const server = this.servers.get(serverName);
    if (server) {
      server.status = 'crashed';
      server.crashedAt = new Date();
      server.crashError = error.message;
      
      // Close all transports for this server
      server.transports.forEach(transport => {
        try {
          if (transport && transport.close) {
            transport.close();
          }
        } catch (closeError) {
          log('MANAGER', `Error closing transport during crash for ${serverName}`, closeError);
        }
      });
      
      server.transports.clear();
      log('MANAGER', `Server crashed and isolated: ${serverName}`, { error: error.message });
    }
  }
}

const serverManager = new MCPServerManager();

// CORS middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'authorization', 'mcp-session-id', 'mcp-protocol-version', 'origin']
}));

app.use(express.json({ limit: '50mb' }));

// Request logging middleware - logs ALL requests
app.use((req, res, next) => {
  logRequest(req, { 
    route: 'middleware',
    timestamp: new Date().toISOString() 
  });
  next();
});

// MCP Protocol validation middleware
function validateMCPRequest(req, res, next) {
  // Validate Origin header for DNS rebinding protection
  const origin = req.headers['origin'];
  if (origin && config.global.enable_dns_rebinding_protection !== false) {
    const url = new URL(origin);
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return res.status(403).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: { code: -32002, message: 'Invalid origin for security' }
      });
    }
  }

  // Validate MCP Protocol Version
  const enableProtocalVerification = false
  if(!enableProtocalVerification) {
    return next();
  }
  const protocolVersion = req.headers['mcp-protocol-version'];
  if (!protocolVersion) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32002, message: 'MCP-Protocol-Version header required' }
    });
  }

  // Support current versions
  if (protocolVersion !== '2025-06-18' && protocolVersion !== '2024-11-05') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32002, message: `Unsupported protocol version: ${protocolVersion}` }
    });
  }

  req.protocolVersion = protocolVersion;
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  logRequest(req, { 
    endpoint: 'health-check',
    action: 'get-server-status' 
  });
  
  const servers = serverManager.getAllServers();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    transport: 'streamable-http',
    auth_type: 'jwt',
    servers: servers.map(s => ({
      name: s.name,
      status: s.status,
      transportCount: s.transportCount,
      lastActivity: s.lastActivity
    }))
  });
});

// Servers status endpoint (no management, just info)
app.get('/servers', (req, res) => {
  logRequest(req, { 
    endpoint: 'servers-list',
    action: 'get-all-servers' 
  });
  
  const servers = serverManager.getAllServers();
  res.json({ servers });
});

// Route-based MCP server handler
app.post('/:serverName/mcp', validateMCPRequest, async (req, res) => {
  const { serverName } = req.params;
  
  logRequest(req, { 
    endpoint: 'mcp-post',
    serverName,
    action: req.body?.method || 'unknown-method',
    isInitialize: isInitializeRequest(req.body),
    hasSessionId: !!req.headers['mcp-session-id']
  });
  
  try {
    // Check if server exists and is ready
    const serverData = serverManager.getServer(serverName);
    if (!serverData) {
      return res.status(404).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: { code: -32001, message: `Server '${serverName}' not found` }
      });
    }

    if (serverData.status === 'crashed') {
      return res.status(503).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: { 
          code: -32003, 
          message: `Server '${serverName}' is crashed`,
          data: {
            crashedAt: serverData.crashedAt,
            error: serverData.crashError
          }
        }
      });
    }

    // Update last activity
    serverData.lastActivity = new Date();

    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'];
    let transport;

    if (sessionId && serverData.transports.has(sessionId)) {
      // Reuse existing transport
      transport = serverData.transports.get(sessionId);
      log(serverName, `Reusing existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - decrypt JWT and create session
      const authorization = req.headers['authorization'];
      if (!authorization) {
        return res.status(401).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: { code: -32002, message: 'Authorization header required for initialization' }
        });
      }

      try {
        const token = authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const userApiKey = decoded.apiKey || decoded.key;
        const tokenServerName = decoded.serverName || decoded.server;
        const userId = decoded.userId || decoded.sub; // Optional
        
        if (tokenServerName !== serverName) {
          return res.status(401).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: { code: -32002, message: `JWT token is for server '${tokenServerName}', not '${serverName}'` }
          });
        }

        // Create new transport with proper session management
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID with user context
            transport.userApiKey = userApiKey;
            transport.userId = userId;
            serverData.transports.set(sessionId, transport);
            log(serverName, `Session initialized: ${sessionId}`, { userId, hasApiKey: !!userApiKey });
          },
          enableDnsRebindingProtection: false
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            log(serverName, `Session closed: ${transport.sessionId}`);
            serverData.transports.delete(transport.sessionId);
          }
        };

        // Connect the existing MCP server to the new transport
        await serverData.mcpServer.connect(transport);
        log(serverName, 'New session connected to MCP server');

      } catch (jwtError) {
        return res.status(401).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: { code: -32002, message: 'Invalid JWT token', data: jwtError.message }
        });
      } 
      // catch (error) {
      //   log(serverName, 'Failed to create new session', error);
      //   serverManager.crashServer(serverName, error);
      //   throw error;
      // }
    } else {
      // Invalid request
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
    }

    // Tool calls will use the session's stored API key via the MCP server's tool registration
    
    // Set the current transport context for tool execution
    serverData.mcpServer.currentTransport = transport;

    // Handle the request using the transport's handleRequest method
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    log(serverName, 'Request handling error', { error: error.message, stack: error.stack });
    
    // Mark server as crashed if it's a critical error
    if (error.message.includes('ECONNREFUSED') || error.message.includes('server') || error.code === 'ENOTFOUND') {
      serverManager.crashServer(serverName, error);
    }
    
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: 'Internal error', data: error.message }
    });
  }
});

// Handle GET requests for server-to-client notifications via SSE
app.get('/:serverName/mcp', validateMCPRequest, async (req, res) => {
  const { serverName } = req.params;
  const sessionId = req.headers['mcp-session-id'];

  logRequest(req, { 
    endpoint: 'mcp-get-sse',
    serverName,
    action: 'sse-stream',
    sessionId
  });

  const serverData = serverManager.getServer(serverName);
  if (!serverData) {
    return res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: `Server '${serverName}' not found` }
    });
  }

  if (serverData.status === 'crashed') {
    return res.status(503).json({
      jsonrpc: '2.0',
      error: { 
        code: -32003, 
        message: `Server '${serverName}' is crashed`,
        data: { crashedAt: serverData.crashedAt, error: serverData.crashError }
      }
    });
  }

  if (!sessionId || !serverData.transports.has(sessionId)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid or missing session ID' }
    });
  }

  try {
    const transport = serverData.transports.get(sessionId);
    await transport.handleRequest(req, res);
    serverData.lastActivity = new Date();
  } catch (error) {
    log(serverName, 'SSE request error', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Server error', data: error.message }
    });
  }
});

// Handle DELETE requests for session termination
app.delete('/:serverName/mcp', validateMCPRequest, async (req, res) => {
  const { serverName } = req.params;
  const sessionId = req.headers['mcp-session-id'];

  logRequest(req, { 
    endpoint: 'mcp-delete',
    serverName,
    action: 'terminate-session',
    sessionId
  });

  const serverData = serverManager.getServer(serverName);
  if (!serverData) {
    return res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: `Server '${serverName}' not found` }
    });
  }

  if (!sessionId || !serverData.transports.has(sessionId)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid or missing session ID' }
    });
  }

  try {
    const transport = serverData.transports.get(sessionId);
    await transport.handleRequest(req, res);
    serverData.transports.delete(sessionId);
    log(serverName, `Session deleted: ${sessionId}`);
  } catch (error) {
    log(serverName, 'Session deletion error', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Server error', data: error.message }
    });
  }
});

// Catch-all route to log all unmatched requests
app.all('*', (req, res) => {
  const requestDetails = {
    endpoint: 'catch-all',
    method: req.method,
    originalUrl: req.originalUrl,
    path: req.path,
    params: req.params,
    query: req.query,
    headers: Object.keys(req.headers).reduce((filtered, key) => {
      // Include important headers but filter out sensitive ones
      if (!key.toLowerCase().includes('authorization') && !key.toLowerCase().includes('cookie')) {
        filtered[key] = req.headers[key];
      } else {
        filtered[key] = '[REDACTED]';
      }
      return filtered;
    }, {}),
    body: req.body ? (typeof req.body === 'string' ? req.body.substring(0, 500) : JSON.stringify(req.body).substring(0, 500)) : null,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || 'unknown'
  };

  logRequest(req, requestDetails);
  
  log('CATCH-ALL', `Unmatched request: ${req.method} ${req.originalUrl}`, {
    ...requestDetails,
    timestamp: new Date().toISOString(),
    status: 'no-match'
  });

  // Return appropriate response based on request
  if (req.path.includes('/mcp')) {
    // MCP-related request that didn't match server pattern
    res.status(404).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { 
        code: -32001, 
        message: 'MCP endpoint not found',
        data: {
          availableServers: serverManager.getAllServers().map(s => s.name),
          requestedPath: req.path,
          expectedFormat: '/{serverName}/mcp'
        }
      }
    });
  } else {
    // General API request
    res.status(404).json({
      error: 'Endpoint not found',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
      availableEndpoints: [
        'GET /health - Health check',
        'GET /servers - List all servers',
        'POST /{serverName}/mcp - MCP server interaction',
        'GET /{serverName}/mcp - MCP SSE stream',
        'DELETE /{serverName}/mcp - Terminate MCP session'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// Cleanup inactive sessions
setInterval(() => {
  let totalCleaned = 0;
  
  for (const [serverName, serverData] of serverManager.servers.entries()) {
    if (serverData.status === 'crashed') continue;
    
    let cleaned = 0;
    for (const [sessionId, transport] of serverData.transports.entries()) {
      try {
        if (!transport || transport.closed) {
          serverData.transports.delete(sessionId);
          cleaned++;
        }
      } catch (error) {
        serverData.transports.delete(sessionId);
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
}, config.global.session_cleanup_interval || 300000);

// Initialize servers and start the main server
async function startServer() {
  try {
    // Initialize all MCP servers first
    await serverManager.initializeServers();
    
    // Start the Express server
    app.listen(port, '0.0.0.0', () => {
      log('MAIN', `🚀 Multi-MCP Server started on port ${port}`);
      console.log(`🚀 Multi-MCP Server running on http://localhost:${port}`);
      console.log(`📋 Health check: http://localhost:${port}/health`);
      console.log(`📊 Server status: http://localhost:${port}/servers`);
      console.log(`✅ Active servers: ${serverManager.getActiveServerCount()}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  // Close all servers
  for (const [serverName, serverData] of serverManager.servers.entries()) {
    for (const [sessionId, transport] of serverData.transports.entries()) {
      try {
        if (transport && transport.close) {
          transport.close();
        }
      } catch (error) {
        console.error(`Error closing transport ${serverName}:${sessionId}:`, error);
      }
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGQUIT', () => shutdown('SIGQUIT'));

// Start the server
startServer();

export { serverManager };