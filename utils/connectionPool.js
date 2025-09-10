import { EventEmitter } from 'events';
import { setTimeout as sleep } from 'timers/promises';

/**
 * Production-ready Connection Pool Manager for MCP Servers
 * Handles connection pooling, rate limiting, and resource management
 */
export class ConnectionPoolManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration with production defaults
    this.config = {
      maxConnectionsPerServer: config.maxConnectionsPerServer || 50,
      maxConcurrentRequestsPerUser: config.maxConcurrentRequestsPerUser || 10,
      maxTotalConnections: config.maxTotalConnections || 500,
      connectionTimeout: config.connectionTimeout || 30000, // 30s
      requestTimeout: config.requestTimeout || 60000, // 60s
      idleTimeout: config.idleTimeout || 300000, // 5min
      queueMaxSize: config.queueMaxSize || 1000,
      cleanupInterval: config.cleanupInterval || 60000, // 1min
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
      ...config
    };

    // Pool storage
    this.pools = new Map(); // serverName -> ConnectionPool
    this.userSessions = new Map(); // userId -> Set<sessionId>
    this.activeRequests = new Map(); // requestId -> RequestContext
    this.requestQueue = new Map(); // serverName -> Queue
    this.circuitBreakers = new Map(); // serverName -> CircuitBreaker
    this.metrics = {
      totalConnections: 0,
      activeRequests: 0,
      queuedRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      connectionPools: new Map()
    };

    this.setupCleanupInterval();
    this.setupMetricsCollection();
  }

  /**
   * Initialize connection pool for a server
   */
  initializePool(serverName, serverConfig) {
    if (!this.pools.has(serverName)) {
      const pool = new ConnectionPool(serverName, {
        maxConnections: this.config.maxConnectionsPerServer,
        idleTimeout: this.config.idleTimeout,
        connectionTimeout: this.config.connectionTimeout
      });
      
      this.pools.set(serverName, pool);
      this.requestQueue.set(serverName, new RequestQueue(this.config.queueMaxSize));
      this.circuitBreakers.set(serverName, new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeout
      ));
      
      this.metrics.connectionPools.set(serverName, {
        activeConnections: 0,
        totalRequests: 0,
        successRate: 1.0,
        averageLatency: 0
      });

      this.emit('poolInitialized', { serverName, poolSize: 0 });
    }
    return this.pools.get(serverName);
  }

  /**
   * Acquire connection from pool with rate limiting and queuing
   */
  async acquireConnection(serverName, userId, requestId) {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker
      const circuitBreaker = this.circuitBreakers.get(serverName);
      if (circuitBreaker && circuitBreaker.isOpen()) {
        throw new Error(`Circuit breaker is open for server: ${serverName}`);
      }

      // Check user rate limits
      if (!this.checkUserRateLimit(userId)) {
        throw new Error(`Rate limit exceeded for user: ${userId}`);
      }

      // Check total connection limits
      if (this.metrics.totalConnections >= this.config.maxTotalConnections) {
        return await this.queueRequest(serverName, userId, requestId);
      }

      const pool = this.pools.get(serverName);
      if (!pool) {
        throw new Error(`No pool found for server: ${serverName}`);
      }

      // Try to get connection from pool
      let connection = await pool.acquire();
      
      if (!connection) {
        // Queue the request if no connections available
        return await this.queueRequest(serverName, userId, requestId);
      }

      // Track the connection
      this.trackConnection(connection, userId, requestId, startTime);
      return connection;

    } catch (error) {
      this.recordFailure(serverName);
      throw error;
    }
  }

  /**
   * Release connection back to pool
   */
  async releaseConnection(connection, success = true) {
    const { serverName, userId, requestId, startTime } = connection.metadata;
    const responseTime = Date.now() - startTime;
    
    try {
      const pool = this.pools.get(serverName);
      if (pool) {
        await pool.release(connection);
      }

      // Update metrics
      this.updateMetrics(serverName, responseTime, success);
      this.untrackConnection(requestId);

      // Process queued requests
      await this.processQueue(serverName);

      this.emit('connectionReleased', { 
        serverName, 
        userId, 
        requestId, 
        responseTime, 
        success 
      });

    } catch (error) {
      console.error('Error releasing connection:', error);
    }
  }

  /**
   * Check user rate limiting
   */
  checkUserRateLimit(userId) {
    const userSessions = this.userSessions.get(userId) || new Set();
    return userSessions.size < this.config.maxConcurrentRequestsPerUser;
  }

  /**
   * Queue request when no connections available
   */
  async queueRequest(serverName, userId, requestId) {
    const queue = this.requestQueue.get(serverName);
    if (!queue || queue.size() >= this.config.queueMaxSize) {
      throw new Error(`Request queue full for server: ${serverName}`);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        queue.remove(requestId);
        reject(new Error(`Request timeout in queue: ${requestId}`));
      }, this.config.requestTimeout);

      queue.add({
        requestId,
        userId,
        resolve,
        reject,
        timeoutId,
        queuedAt: Date.now()
      });

      this.metrics.queuedRequests++;
    });
  }

  /**
   * Process queued requests
   */
  async processQueue(serverName) {
    const queue = this.requestQueue.get(serverName);
    const pool = this.pools.get(serverName);
    
    if (!queue || !pool || queue.size() === 0) return;

    while (queue.size() > 0 && pool.hasAvailable()) {
      const queuedRequest = queue.next();
      if (!queuedRequest) break;

      try {
        clearTimeout(queuedRequest.timeoutId);
        const connection = await pool.acquire();
        
        if (connection) {
          this.trackConnection(connection, queuedRequest.userId, queuedRequest.requestId, Date.now());
          queuedRequest.resolve(connection);
          this.metrics.queuedRequests--;
        } else {
          // Put back in queue if no connection available
          queue.add(queuedRequest);
          break;
        }
      } catch (error) {
        queuedRequest.reject(error);
        this.metrics.queuedRequests--;
      }
    }
  }

  /**
   * Track active connection
   */
  trackConnection(connection, userId, requestId, startTime) {
    connection.metadata = {
      userId,
      requestId,
      startTime,
      serverName: connection.serverName
    };

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(requestId);

    // Track active request
    this.activeRequests.set(requestId, {
      connection,
      userId,
      startTime,
      serverName: connection.serverName
    });

    this.metrics.totalConnections++;
    this.metrics.activeRequests++;
  }

  /**
   * Untrack connection
   */
  untrackConnection(requestId) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      const userSessions = this.userSessions.get(request.userId);
      if (userSessions) {
        userSessions.delete(requestId);
        if (userSessions.size === 0) {
          this.userSessions.delete(request.userId);
        }
      }
      
      this.activeRequests.delete(requestId);
      this.metrics.totalConnections--;
      this.metrics.activeRequests--;
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(serverName, responseTime, success) {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.recordFailure(serverName);
    }

    // Update average response time
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Update server-specific metrics
    const serverMetrics = this.metrics.connectionPools.get(serverName);
    if (serverMetrics) {
      serverMetrics.totalRequests++;
      serverMetrics.successRate = this.metrics.successfulRequests / totalRequests;
      serverMetrics.averageLatency = 
        (serverMetrics.averageLatency * (serverMetrics.totalRequests - 1) + responseTime) / 
        serverMetrics.totalRequests;
    }
  }

  /**
   * Record failure for circuit breaker
   */
  recordFailure(serverName) {
    const circuitBreaker = this.circuitBreakers.get(serverName);
    if (circuitBreaker) {
      circuitBreaker.recordFailure();
    }
  }

  /**
   * Setup cleanup interval for idle connections
   */
  setupCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Setup metrics collection
   */
  setupMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, 30000); // Collect metrics every 30s
  }

  /**
   * Cleanup idle connections and expired requests
   */
  async cleanup() {
    const now = Date.now();
    
    // Cleanup pools
    for (const [serverName, pool] of this.pools.entries()) {
      await pool.cleanup(now);
    }

    // Cleanup expired queued requests
    for (const [serverName, queue] of this.requestQueue.entries()) {
      queue.cleanup(now, this.config.requestTimeout);
    }

    // Cleanup circuit breakers
    for (const [serverName, circuitBreaker] of this.circuitBreakers.entries()) {
      circuitBreaker.cleanup(now);
    }

    this.emit('cleanupCompleted', { timestamp: now });
  }

  /**
   * Collect and emit metrics
   */
  collectMetrics() {
    const metrics = {
      ...this.metrics,
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    this.emit('metricsCollected', metrics);
  }

  /**
   * Get current status and metrics
   */
  getStatus() {
    return {
      config: this.config,
      metrics: this.metrics,
      pools: Array.from(this.pools.entries()).map(([name, pool]) => ({
        name,
        activeConnections: pool.activeCount(),
        idleConnections: pool.idleCount(),
        maxConnections: pool.maxConnections
      })),
      queues: Array.from(this.requestQueue.entries()).map(([name, queue]) => ({
        name,
        queueSize: queue.size(),
        maxSize: this.config.queueMaxSize
      })),
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
        name,
        state: cb.getState(),
        failureCount: cb.getFailureCount()
      }))
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down connection pool manager...');
    
    // Close all connections
    for (const [serverName, pool] of this.pools.entries()) {
      await pool.shutdown();
    }

    // Clear all queues
    for (const [serverName, queue] of this.requestQueue.entries()) {
      queue.clear();
    }

    this.emit('shutdown');
  }
}

/**
 * Individual connection pool for a server
 */
class ConnectionPool {
  constructor(serverName, config) {
    this.serverName = serverName;
    this.maxConnections = config.maxConnections;
    this.idleTimeout = config.idleTimeout;
    this.connectionTimeout = config.connectionTimeout;
    
    this.connections = [];
    this.activeConnections = new Set();
    this.idleConnections = new Set();
  }

  async acquire() {
    // Try to get idle connection first
    for (const conn of this.idleConnections) {
      if (this.isConnectionValid(conn)) {
        this.idleConnections.delete(conn);
        this.activeConnections.add(conn);
        conn.lastUsed = Date.now();
        return conn;
      } else {
        this.idleConnections.delete(conn);
        this.removeConnection(conn);
      }
    }

    // Create new connection if under limit
    if (this.connections.length < this.maxConnections) {
      const connection = await this.createConnection();
      if (connection) {
        this.connections.push(connection);
        this.activeConnections.add(connection);
        return connection;
      }
    }

    return null;
  }

  async release(connection) {
    if (this.activeConnections.has(connection)) {
      this.activeConnections.delete(connection);
      
      if (this.isConnectionValid(connection)) {
        connection.lastUsed = Date.now();
        this.idleConnections.add(connection);
      } else {
        this.removeConnection(connection);
      }
    }
  }

  async createConnection() {
    try {
      // Connection will be created by the transport layer
      // This is a placeholder that represents a transport connection
      const connection = {
        id: `${this.serverName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        serverName: this.serverName,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        transport: null, // Will be set by transport layer
        valid: true
      };
      
      return connection;
    } catch (error) {
      console.error(`Failed to create connection for ${this.serverName}:`, error);
      return null;
    }
  }

  isConnectionValid(connection) {
    const now = Date.now();
    return connection.valid && 
           (now - connection.lastUsed) < this.idleTimeout &&
           connection.transport !== null;
  }

  removeConnection(connection) {
    const index = this.connections.indexOf(connection);
    if (index > -1) {
      this.connections.splice(index, 1);
    }
    this.activeConnections.delete(connection);
    this.idleConnections.delete(connection);
    
    if (connection.transport && connection.transport.close) {
      try {
        connection.transport.close();
      } catch (error) {
        console.error('Error closing transport:', error);
      }
    }
  }

  async cleanup(now) {
    const expiredConnections = [];
    
    for (const conn of this.idleConnections) {
      if (!this.isConnectionValid(conn) || (now - conn.lastUsed) > this.idleTimeout) {
        expiredConnections.push(conn);
      }
    }

    for (const conn of expiredConnections) {
      this.idleConnections.delete(conn);
      this.removeConnection(conn);
    }
  }

  hasAvailable() {
    return this.idleConnections.size > 0 || this.connections.length < this.maxConnections;
  }

  activeCount() {
    return this.activeConnections.size;
  }

  idleCount() {
    return this.idleConnections.size;
  }

  async shutdown() {
    for (const connection of this.connections) {
      this.removeConnection(connection);
    }
    this.connections = [];
    this.activeConnections.clear();
    this.idleConnections.clear();
  }
}

/**
 * Request queue with timeout handling
 */
class RequestQueue {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.queue = [];
  }

  add(request) {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Queue is full');
    }
    this.queue.push(request);
  }

  next() {
    return this.queue.shift();
  }

  remove(requestId) {
    const index = this.queue.findIndex(req => req.requestId === requestId);
    if (index > -1) {
      const request = this.queue.splice(index, 1)[0];
      clearTimeout(request.timeoutId);
      return request;
    }
    return null;
  }

  size() {
    return this.queue.length;
  }

  cleanup(now, timeout) {
    const expiredRequests = this.queue.filter(req => (now - req.queuedAt) > timeout);
    
    for (const req of expiredRequests) {
      this.remove(req.requestId);
      req.reject(new Error('Request timeout in queue'));
    }
  }

  clear() {
    for (const req of this.queue) {
      clearTimeout(req.timeoutId);
      req.reject(new Error('Queue cleared during shutdown'));
    }
    this.queue = [];
  }
}

/**
 * Circuit breaker pattern implementation
 */
class CircuitBreaker {
  constructor(threshold, timeout) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  isOpen() {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  getState() {
    return this.state;
  }

  getFailureCount() {
    return this.failureCount;
  }

  cleanup(now) {
    if (this.state === 'OPEN' && (now - this.lastFailureTime) > this.timeout) {
      this.state = 'HALF_OPEN';
    }
  }
}