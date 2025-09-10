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
import { performance } from 'perf_hooks';
import { initDatabase, closeDatabase, isDatabaseConnected, getSystemConnection } from './utils/database.js';
import McpServerUser from './models/McpServerUser.js';
import McpServerDb from './models/McpServer.js';
import ApiKey from './models/ApiKey.js';
import { ConnectionPoolManager } from './utils/connectionPool.js';
import { RateLimiter } from './utils/rateLimiter.js';
import { MonitoringSystem } from './utils/monitoring.js';

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
const port = process.env.PORT || config.global.port || 8080;
const JWT_SECRET = process.env.JWT_SECRET;
const LOG_FILE = path.join(process.cwd(), 'logs', config.global.log_file || 'multi-mcp-debug.log');

// Initialize production systems with optimized configurations
const connectionPool = new ConnectionPoolManager({
  maxConnectionsPerServer: config.global.maxConnectionsPerServer || 50,
  maxConcurrentRequestsPerUser: config.global.maxConcurrentRequestsPerUser || 10,
  maxTotalConnections: config.global.maxTotalConnections || 500,
  connectionTimeout: config.global.connectionTimeout || 30000,
  requestTimeout: config.global.requestTimeout || 60000,
  idleTimeout: config.global.idleTimeout || 300000,
  queueMaxSize: config.global.queueMaxSize || 1000,
  cleanupInterval: config.global.cleanupInterval || 60000
});

const rateLimiter = new RateLimiter({
  tokensPerWindow: config.global.rateLimitTokens || 1000,
  windowSizeMs: config.global.rateLimitWindow || 60000,
  maxBurstSize: config.global.maxBurst || 1500,
  perUserLimit: config.global.perUserLimit || 100,
  perServerLimit: config.global.perServerLimit || 500,
  enableAdaptive: config.global.enableAdaptiveRateLimit !== false,
  adaptiveThreshold: config.global.adaptiveThreshold || 0.8
});

const monitoring = new MonitoringSystem({
  healthCheckInterval: config.global.healthCheckInterval || 30000,
  metricsCollectionInterval: config.global.metricsInterval || 10000,
  enableAlerting: config.global.enableAlerting !== false,
  cpuThreshold: config.global.cpuThreshold || 80,
  memoryThreshold: config.global.memoryThreshold || 85,
  responseTimeThreshold: config.global.responseTimeThreshold || 5000,
  errorRateThreshold: config.global.errorRateThreshold || 0.1
});

// Global error tracking
let globalStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  startTime: Date.now()
};

// Initialize logs directory
const logsDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.error('❌ Cannot create logs directory:', error.message);
}

// Enhanced logging with performance tracking
function log(serverName, message, data = null, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] [${serverName}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

  try {
    console.log(`[${level}] [${serverName}] ${message}`, data || '');
    if (LOG_FILE) {
      fs.appendFileSync(LOG_FILE, logEntry);
    }
  } catch (error) {
    console.error(`[LOG-ERROR] Failed to write to log file: ${error.message}`);
  }
}

// Production-ready API key validation with caching
const apiKeyCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function validateApiKey(apiKey, serverName, userId, serverId) {
  const startTime = performance.now();
  
  try {
    if (!isDatabaseConnected()) {
      log('AUTH', 'Database connection required for API key validation', null, 'ERROR');
      return { isValid: false, error: 'Database connection unavailable' };
    }

    if (!apiKey) {
      log('AUTH', 'API key is required', { serverName }, 'WARN');
      return { isValid: false, error: 'API key is required' };
    }

    // Check cache first
    const cacheKey = `${apiKey}-${userId}-${serverId}`;
    const cached = apiKeyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      log('AUTH', 'API key validated from cache', { serverName, userId });
      return cached.result;
    }

    log('AUTH', 'Validating API key against database...', { serverName, userId });

    let result;
    
    if (serverName === 'meerkats-table') {
      const apiKeyDb = await ApiKey.findOne({ name: 'automation', userId, isActive: true });
      if (!apiKeyDb || apiKey !== apiKeyDb.key) {
        result = { isValid: false, error: 'Invalid or disabled API key' };
      } else {
        result = {
          isValid: true,
          userId: apiKeyDb.userId,
          serverId: 'meerkats-table',
          rateLimit: null
        };
      }
    } else if (userId === 'system') {
      const mcpServerUser = await McpServerDb.findOne({
        _id: serverId,
        disabled: { $ne: true }
      });
      
      const conObj = await getSystemConnection([`${serverName.toUpperCase()}_API_KEY`]);
      const dbApiKey = conObj[`${serverName.toUpperCase()}_API_KEY`];
      
      if (!dbApiKey || apiKey !== dbApiKey) {
        result = { isValid: false, error: 'Invalid or disabled API key' };
      } else {
        result = {
          isValid: true,
          userId: 'system',
          serverId: serverId,
          rateLimit: null
        };
      }
    } else {
      const mcpServerUser = await McpServerUser.findOne({
        apiKey: apiKey,
        userId: userId,
        serverId: serverId,
        enabled: true
      });

      if (!mcpServerUser) {
        result = { isValid: false, error: 'Invalid or disabled API key' };
      } else {
        result = {
          isValid: true,
          userId: mcpServerUser.userId,
          serverId: mcpServerUser.serverId,
          rateLimit: mcpServerUser.rateLimit
        };
      }
    }

    // Cache the result
    apiKeyCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    const duration = performance.now() - startTime;
    log('AUTH', `API key validation completed in ${duration.toFixed(2)}ms`, {
      serverName,
      userId,
      valid: result.isValid,
      duration
    });

    return result;

  } catch (error) {
    const duration = performance.now() - startTime;
    log('AUTH', `API key validation error after ${duration.toFixed(2)}ms`, { 
      error: error.message, 
      serverName,
      duration 
    }, 'ERROR');
    return { isValid: false, error: 'Database validation error' };
  }
}

// Production-ready server manager with connection pooling
class ProductionMCPServerManager {
  constructor() {
    this.servers = new Map();
    this.isShuttingDown = false;
  }

  async initializeServers() {
    log('MANAGER', 'Initializing servers with production optimizations');

    const initPromises = [];
    
    for (const [serverName, serverConfig] of Object.entries(config.servers)) {
      if (!serverConfig.enabled) {
        log('MANAGER', `Server ${serverName} is disabled, skipping`);
        continue;
      }

      // Initialize connection pool for this server
      connectionPool.initializePool(serverName, serverConfig);
      
      // Initialize server asynchronously for better performance
      initPromises.push(
        this.initializeServer(serverName, serverConfig).catch(error => {
          log('MANAGER', `Failed to initialize server ${serverName}`, { error: error.message }, 'ERROR');
          this.servers.set(serverName, {
            transports: new Map(),
            mcpServer: null,
            config: serverConfig,
            status: 'crashed',
            crashedAt: new Date(),
            crashError: error.message
          });
        })
      );
    }

    await Promise.allSettled(initPromises);
    
    const activeServers = this.getActiveServerCount();
    const totalServers = Object.keys(config.servers).length;
    log('MANAGER', `Initialized ${activeServers}/${totalServers} servers successfully`);
  }

  async initializeServer(serverName, serverConfig) {
    const startTime = performance.now();
    log('MANAGER', `Initializing server: ${serverName}`);

    // Load server tools
    const serverDir = path.resolve(serverConfig.directory);
    const entryFile = path.join(serverDir, serverConfig.entryFile || 'index.js');

    if (!fs.existsSync(entryFile)) {
      throw new Error(`Entry file not found: ${entryFile}`);
    }

    let toolsDefinitions, toolHandlers;

    try {
      const serverModule = await import(`file://${entryFile}?t=${Date.now()}`);

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
    } catch (importError) {
      throw new Error(`Failed to load server ${serverName}: ${importError.message}`);
    }

    if (!toolsDefinitions || !toolHandlers) {
      throw new Error(`Server ${serverName} did not provide valid toolsDefinitions and toolHandlers`);
    }

    // Create MCP server with enhanced error handling
    const mcpServer = new McpServer({
      name: serverConfig.name,
      version: serverConfig.version
    }, {
      capabilities: { tools: {} }
    });

    // Register tools with performance monitoring
    for (const toolDef of toolsDefinitions) {
      mcpServer.registerTool(
        toolDef.name,
        {
          title: toolDef.name,
          description: toolDef.description,
          inputSchema: toolDef.inputSchema
        },
        async (args) => {
          const toolStartTime = performance.now();
          log(serverName, `Processing tool: ${toolDef.name}`);
          
          const handler = toolHandlers[toolDef.name];
          if (!handler) {
            log(serverName, `Tool handler not found: ${toolDef.name}`, null, 'ERROR');
            throw new Error(`Unknown tool: ${toolDef.name}`);
          }

          try {
            const currentTransport = mcpServer.currentTransport;
            const userApiKey = currentTransport?.userApiKey;
            const userId = currentTransport?.userId;

            const result = await handler(args, userApiKey, userId);
            
            const duration = performance.now() - toolStartTime;
            log(serverName, `Tool completed: ${toolDef.name} in ${duration.toFixed(2)}ms`, { 
              success: true, 
              duration 
            });

            // Update monitoring
            monitoring.updateRequestMetrics(duration, true, serverName);

            return result;
          } catch (toolError) {
            const duration = performance.now() - toolStartTime;
            log(serverName, `Tool failed: ${toolDef.name} after ${duration.toFixed(2)}ms`, { 
              error: toolError.message,
              duration
            }, 'ERROR');

            // Update monitoring
            monitoring.updateRequestMetrics(duration, false, serverName);

            throw toolError;
          }
        }
      );
    }

    const initDuration = performance.now() - startTime;
    
    // Store server data with enhanced metadata
    this.servers.set(serverName, {
      transports: new Map(),
      mcpServer,
      config: serverConfig,
      toolHandlers,
      toolsDefinitions,
      status: 'healthy',
      createdAt: new Date(),
      lastActivity: new Date(),
      initDuration,
      requestCount: 0,
      errorCount: 0
    });

    log('MANAGER', `Server ${serverName} initialized successfully in ${initDuration.toFixed(2)}ms`);
  }

  getServerData(serverName) {
    const serverData = this.servers.get(serverName);
    if (!serverData) {
      throw new Error(`Server not found: ${serverName}`);
    }
    
    if (serverData.status === 'crashed') {
      throw new Error(`Server ${serverName} is crashed: ${serverData.crashError}`);
    }
    
    return serverData;
  }

  getActiveServerCount() {
    return Array.from(this.servers.values()).filter(s => s.status !== 'crashed').length;
  }

  getServerStatus() {
    return Array.from(this.servers.entries()).map(([name, data]) => ({
      name,
      status: data.status,
      transportCount: data.transports.size,
      requestCount: data.requestCount || 0,
      errorCount: data.errorCount || 0,
      lastActivity: data.lastActivity,
      createdAt: data.createdAt,
      crashedAt: data.crashedAt,
      initDuration: data.initDuration
    }));
  }

  async shutdown() {
    log('MANAGER', 'Starting graceful shutdown...');
    this.isShuttingDown = true;

    // Close all connections
    for (const [serverName, serverData] of this.servers.entries()) {
      try {
        for (const [sessionId, transport] of serverData.transports.entries()) {
          if (transport && transport.close) {
            await transport.close();
          }
        }
        serverData.transports.clear();
        log('MANAGER', `Closed all connections for server: ${serverName}`);
      } catch (error) {
        log('MANAGER', `Error closing connections for ${serverName}`, { error: error.message }, 'ERROR');
      }
    }

    log('MANAGER', 'Graceful shutdown completed');
  }
}

const serverManager = new ProductionMCPServerManager();

// Express middleware with production optimizations
app.use(express.json({ 
  limit: config.global.maxRequestSize || '10mb',
  strict: false
}));

app.use(cors({
  origin: config.global.allowedOrigins || '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Production middleware for request tracking
app.use((req, res, next) => {
  req.startTime = performance.now();
  req.requestId = randomUUID();
  
  // Track global stats
  globalStats.totalRequests++;
  
  res.on('finish', () => {
    const duration = performance.now() - req.startTime;
    const success = res.statusCode < 400;
    
    if (success) {
      globalStats.successfulRequests++;
    } else {
      globalStats.failedRequests++;
    }
    
    // Update average response time
    const total = globalStats.successfulRequests + globalStats.failedRequests;
    globalStats.averageResponseTime = 
      (globalStats.averageResponseTime * (total - 1) + duration) / total;
  });
  
  next();
});

// Health check endpoint with comprehensive status
app.get('/health', (req, res) => {
  const healthData = monitoring.getHealthStatus();
  const poolStatus = connectionPool.getStatus();
  const rateLimitStatus = rateLimiter.getStatus();
  
  const overallHealth = {
    status: healthData.status,
    timestamp: Date.now(),
    uptime: process.uptime(),
    version: '2.0.0-production',
    environment: process.env.NODE_ENV || 'production',
    
    // System health
    system: healthData.services.system || {},
    
    // Application health  
    servers: serverManager.getServerStatus(),
    
    // Connection pool health
    connectionPool: {
      totalConnections: poolStatus.metrics.totalConnections,
      activeRequests: poolStatus.metrics.activeRequests,
      queuedRequests: poolStatus.metrics.queuedRequests,
      pools: poolStatus.pools
    },
    
    // Rate limiter health
    rateLimiting: {
      totalRequests: rateLimitStatus.metrics.totalRequests,
      allowedRequests: rateLimitStatus.metrics.allowedRequests,
      rejectedRequests: rateLimitStatus.metrics.rejectedRequests,
      rateLimitHits: rateLimitStatus.metrics.rateLimitHits
    },
    
    // Global application stats
    application: globalStats,
    
    // Issues
    issues: healthData.issues
  };
  
  const statusCode = overallHealth.status === 'healthy' ? 200 : 
                    overallHealth.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(overallHealth);
});

// Metrics endpoint for monitoring systems
app.get('/metrics', (req, res) => {
  const metrics = monitoring.getMetrics();
  const poolMetrics = connectionPool.getStatus();
  const rateLimitMetrics = rateLimiter.getStatus();
  
  res.json({
    timestamp: Date.now(),
    application: metrics.application,
    system: metrics.system,
    servers: metrics.servers,
    connectionPool: poolMetrics.metrics,
    rateLimiting: rateLimitMetrics.metrics,
    performance: metrics.performance
  });
});

// Enhanced MCP server endpoint with production optimizations
app.post('/:serverName/mcp', async (req, res) => {
  const startTime = performance.now();
  const { serverName } = req.params;
  
  try {
    // Get server data
    const serverData = serverManager.getServerData(serverName);
    
    // Extract authentication
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

    const { userId, serverId, apiKey: userApiKey } = decoded;
    const requestKey = `${userId}-${serverName}`;

    // Rate limiting check
    const rateLimitResult = await rateLimiter.isAllowed(requestKey, userId, serverName);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        jsonrpc: '2.0',
        error: { 
          code: -32000, 
          message: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter
        }
      });
    }

    // API key validation with caching
    const apiKeyValidation = await validateApiKey(userApiKey, serverName, userId, serverId);
    if (!apiKeyValidation.isValid) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: apiKeyValidation.error }
      });
    }

    // Connection management
    const sessionId = req.headers['mcp-session-id'];
    let connection;

    if (sessionId && serverData.transports.has(sessionId)) {
      // Reuse existing connection
      connection = serverData.transports.get(sessionId);
      log(serverName, `Reusing existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Create new connection through pool
      try {
        connection = await connectionPool.acquireConnection(serverName, userId, req.requestId);
        
        // Create new transport
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transport.userApiKey = userApiKey;
            transport.userId = apiKeyValidation.userId;
            transport.serverId = apiKeyValidation.serverId;
            transport.rateLimit = apiKeyValidation.rateLimit;
            transport.connection = connection;
            
            serverData.transports.set(newSessionId, transport);
            connection.transport = transport;
            
            log(serverName, `New session initialized: ${newSessionId}`, {
              userId: apiKeyValidation.userId,
              connectionId: connection.id
            });
          },
          enableDnsRebindingProtection: false
        });

        // Setup connection cleanup
        transport.onclose = async () => {
          if (transport.sessionId) {
            log(serverName, `Session closed: ${transport.sessionId}`);
            serverData.transports.delete(transport.sessionId);
            
            if (connection) {
              await connectionPool.releaseConnection(connection, true);
            }
          }
        };

        // Connect to MCP server
        await serverData.mcpServer.connect(transport);
        connection = transport;
        
        log(serverName, 'New connection established through pool');
      } catch (poolError) {
        log(serverName, 'Connection pool error', { error: poolError.message }, 'ERROR');
        return res.status(503).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Service temporarily unavailable' }
        });
      }
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session or missing initialization' }
      });
    }

    // Set context for tool execution
    serverData.mcpServer.currentTransport = connection;
    
    // Update server activity
    serverData.lastActivity = new Date();
    serverData.requestCount = (serverData.requestCount || 0) + 1;

    // Handle the request
    await connection.handleRequest(req, res, req.body);
    
    const duration = performance.now() - startTime;
    log(serverName, `Request processed successfully in ${duration.toFixed(2)}ms`);

  } catch (error) {
    const duration = performance.now() - startTime;
    log(serverName, `Request handling error after ${duration.toFixed(2)}ms`, { 
      error: error.message,
      stack: error.stack,
      duration
    }, 'ERROR');

    // Update server error count
    const serverData = serverManager.servers.get(serverName);
    if (serverData) {
      serverData.errorCount = (serverData.errorCount || 0) + 1;
    }

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' }
      });
    }
  }
});

// SSE endpoint for server-to-client notifications
app.get('/:serverName/mcp', async (req, res) => {
  const { serverName } = req.params;
  const sessionId = req.headers['mcp-session-id'];
  const startTime = performance.now();
  
  try {
    const serverData = serverManager.getServerData(serverName);
    
    if (!sessionId || !serverData.transports.has(sessionId)) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' }
      });
    }

    const transport = serverData.transports.get(sessionId);
    await transport.handleRequest(req, res);
    serverData.lastActivity = new Date();
    
    const duration = performance.now() - startTime;
    log(serverName, `SSE request handled in ${duration.toFixed(2)}ms`);
    
  } catch (error) {
    const duration = performance.now() - startTime;
    log(serverName, `SSE request error after ${duration.toFixed(2)}ms`, { 
      error: error.message 
    }, 'ERROR');
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'SSE error', data: error.message }
      });
    }
  }
});

// DELETE endpoint for session termination
app.delete('/:serverName/mcp', async (req, res) => {
  const { serverName } = req.params;
  const sessionId = req.headers['mcp-session-id'];
  const startTime = performance.now();
  
  try {
    const serverData = serverManager.getServerData(serverName);
    
    if (!sessionId || !serverData.transports.has(sessionId)) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' }
      });
    }

    const transport = serverData.transports.get(sessionId);
    await transport.handleRequest(req, res);
    
    // Clean up the session
    serverData.transports.delete(sessionId);
    
    const duration = performance.now() - startTime;
    log(serverName, `Session deleted: ${sessionId} in ${duration.toFixed(2)}ms`);
    
  } catch (error) {
    const duration = performance.now() - startTime;
    log(serverName, `Session deletion error after ${duration.toFixed(2)}ms`, { 
      error: error.message 
    }, 'ERROR');
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Session deletion error', data: error.message }
      });
    }
  }
});

// Root endpoint with API information
app.get('/', (req, res) => {
  res.json({
    name: 'Multi-MCP Production Server',
    version: '2.0.0-production',
    status: 'running',
    endpoints: [
      'GET /health - Health check',
      'GET /metrics - Performance metrics',
      'POST /{serverName}/mcp - MCP server interaction',
      'GET /{serverName}/mcp - MCP SSE stream',
      'DELETE /{serverName}/mcp - Terminate MCP session'
    ],
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    log('MAIN', 'HTTP server closed');
  });

  try {
    // Shutdown connection pool
    await connectionPool.shutdown();
    log('MAIN', 'Connection pool shutdown completed');

    // Shutdown server manager
    await serverManager.shutdown();
    log('MAIN', 'Server manager shutdown completed');

    // Close database connection
    if (isDatabaseConnected()) {
      await closeDatabase();
      log('MAIN', 'Database connection closed');
    }

    log('MAIN', '✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    log('MAIN', 'Error during shutdown', { error: error.message }, 'ERROR');
    process.exit(1);
  }
};

// Setup signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handlers
process.on('uncaughtException', (error) => {
  log('MAIN', 'Uncaught exception', { 
    error: error.message, 
    stack: error.stack 
  }, 'ERROR');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  log('MAIN', 'Unhandled rejection', { 
    reason: reason?.message || reason,
    stack: reason?.stack
  }, 'ERROR');
});

// Start the production server
async function startProductionServer() {
  try {
    log('MAIN', 'Starting production MCP server...');
    
    // Initialize database
    await initDatabase();
    log('MAIN', '✅ Database connected successfully');

    // Initialize servers
    await serverManager.initializeServers();
    log('MAIN', '✅ MCP servers initialized');

    // Start monitoring
    log('MAIN', '✅ Monitoring system active');

    // Setup connection pool event handlers
    connectionPool.on('poolInitialized', (data) => {
      log('POOL', `Pool initialized for ${data.serverName}`);
    });

    connectionPool.on('connectionReleased', (data) => {
      log('POOL', `Connection released: ${data.serverName} (${data.responseTime}ms)`);
    });

    // Setup rate limiter event handlers
    rateLimiter.on('rateLimitHit', (data) => {
      log('RATE_LIMIT', `Rate limit hit: ${data.type} ${data.key}`);
    });

    // Setup monitoring event handlers
    monitoring.on('alert', (alert) => {
      log('MONITORING', `ALERT: ${alert.severity} - ${alert.message}`, null, 'WARN');
    });

    // Start HTTP server
    const server = app.listen(port, '0.0.0.0', () => {
      log('MAIN', `🚀 Production MCP server running on port ${port}`);
      log('MAIN', `📊 Health check: http://localhost:${port}/health`);
      log('MAIN', `📈 Metrics: http://localhost:${port}/metrics`);
      log('MAIN', `⚡ Production optimizations active`);
    });

    // Set server timeout for long-running requests
    server.timeout = config.global.serverTimeout || 120000; // 2 minutes
    server.keepAliveTimeout = config.global.keepAliveTimeout || 65000; // 65 seconds
    server.headersTimeout = config.global.headersTimeout || 66000; // 66 seconds

    return server;

  } catch (error) {
    log('MAIN', 'Failed to start production server', { 
      error: error.message,
      stack: error.stack 
    }, 'ERROR');
    process.exit(1);
  }
}

// Start the server
const server = await startProductionServer();