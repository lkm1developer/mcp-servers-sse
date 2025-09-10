import { EventEmitter } from 'events';

/**
 * Advanced Rate Limiter with multiple algorithms and monitoring
 */
export class RateLimiter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Token bucket algorithm settings
      tokensPerWindow: config.tokensPerWindow || 100,
      windowSizeMs: config.windowSizeMs || 60000, // 1 minute
      maxBurstSize: config.maxBurstSize || 150,
      
      // Sliding window settings
      slidingWindowSize: config.slidingWindowSize || 60000, // 1 minute
      slidingWindowSegments: config.slidingWindowSegments || 60, // 1 second segments
      
      // Adaptive settings
      enableAdaptive: config.enableAdaptive || true,
      adaptiveThreshold: config.adaptiveThreshold || 0.8, // 80% usage triggers adaptation
      adaptiveReduction: config.adaptiveReduction || 0.5, // Reduce by 50%
      adaptiveRecoveryRate: config.adaptiveRecoveryRate || 0.1, // 10% recovery per window
      
      // Per-user limits
      perUserLimit: config.perUserLimit || 10,
      perUserWindowMs: config.perUserWindowMs || 60000,
      
      // Per-server limits  
      perServerLimit: config.perServerLimit || 50,
      perServerWindowMs: config.perServerWindowMs || 60000,
      
      // Cleanup
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      ...config
    };

    // Storage
    this.tokenBuckets = new Map(); // key -> TokenBucket
    this.slidingWindows = new Map(); // key -> SlidingWindow
    this.userLimits = new Map(); // userId -> RateLimit
    this.serverLimits = new Map(); // serverName -> RateLimit
    this.adaptiveStates = new Map(); // key -> AdaptiveState
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      rateLimitHits: 0,
      adaptiveAdjustments: 0,
      averageResponseTime: 0
    };

    this.setupCleanup();
  }

  /**
   * Check if request is allowed using multiple algorithms
   */
  async isAllowed(key, userId, serverName, weight = 1) {
    const now = Date.now();
    this.metrics.totalRequests++;

    try {
      // Check user-level limits
      if (!this.checkUserLimit(userId, now)) {
        this.metrics.rejectedRequests++;
        this.metrics.rateLimitHits++;
        this.emit('rateLimitHit', { type: 'user', key: userId, timestamp: now });
        return { allowed: false, reason: 'User rate limit exceeded', retryAfter: this.getRetryAfter('user', userId) };
      }

      // Check server-level limits
      if (!this.checkServerLimit(serverName, now)) {
        this.metrics.rejectedRequests++;
        this.metrics.rateLimitHits++;
        this.emit('rateLimitHit', { type: 'server', key: serverName, timestamp: now });
        return { allowed: false, reason: 'Server rate limit exceeded', retryAfter: this.getRetryAfter('server', serverName) };
      }

      // Check token bucket
      if (!this.checkTokenBucket(key, weight, now)) {
        this.metrics.rejectedRequests++;
        this.metrics.rateLimitHits++;
        this.emit('rateLimitHit', { type: 'bucket', key, timestamp: now });
        return { allowed: false, reason: 'Rate limit exceeded', retryAfter: this.getRetryAfter('bucket', key) };
      }

      // Check sliding window
      if (!this.checkSlidingWindow(key, weight, now)) {
        this.metrics.rejectedRequests++;
        this.metrics.rateLimitHits++;
        this.emit('rateLimitHit', { type: 'window', key, timestamp: now });
        return { allowed: false, reason: 'Rate limit exceeded', retryAfter: this.getRetryAfter('window', key) };
      }

      // All checks passed - consume tokens
      this.consumeTokens(key, userId, serverName, weight, now);
      this.metrics.allowedRequests++;

      // Check if adaptive adjustment is needed
      if (this.config.enableAdaptive) {
        this.checkAdaptiveAdjustment(key, now);
      }

      return { allowed: true, remaining: this.getRemainingTokens(key) };

    } catch (error) {
      console.error('Rate limiter error:', error);
      this.metrics.rejectedRequests++;
      return { allowed: false, reason: 'Rate limiter error', retryAfter: 60 };
    }
  }

  /**
   * Check user-level rate limits
   */
  checkUserLimit(userId, now) {
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, {
        tokens: this.config.perUserLimit,
        lastRefill: now,
        requestTimes: []
      });
    }

    const userLimit = this.userLimits.get(userId);
    
    // Refill tokens based on time passed
    const timePassed = now - userLimit.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.perUserWindowMs * this.config.perUserLimit);
    
    userLimit.tokens = Math.min(this.config.perUserLimit, userLimit.tokens + tokensToAdd);
    userLimit.lastRefill = now;

    // Clean old request times
    userLimit.requestTimes = userLimit.requestTimes.filter(time => (now - time) < this.config.perUserWindowMs);

    return userLimit.tokens > 0 && userLimit.requestTimes.length < this.config.perUserLimit;
  }

  /**
   * Check server-level rate limits
   */
  checkServerLimit(serverName, now) {
    if (!this.serverLimits.has(serverName)) {
      this.serverLimits.set(serverName, {
        tokens: this.config.perServerLimit,
        lastRefill: now,
        requestTimes: []
      });
    }

    const serverLimit = this.serverLimits.get(serverName);
    
    // Refill tokens
    const timePassed = now - serverLimit.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.perServerWindowMs * this.config.perServerLimit);
    
    serverLimit.tokens = Math.min(this.config.perServerLimit, serverLimit.tokens + tokensToAdd);
    serverLimit.lastRefill = now;

    // Clean old request times
    serverLimit.requestTimes = serverLimit.requestTimes.filter(time => (now - time) < this.config.perServerWindowMs);

    return serverLimit.tokens > 0 && serverLimit.requestTimes.length < this.config.perServerLimit;
  }

  /**
   * Token bucket algorithm
   */
  checkTokenBucket(key, weight, now) {
    if (!this.tokenBuckets.has(key)) {
      this.tokenBuckets.set(key, {
        tokens: this.config.tokensPerWindow,
        lastRefill: now,
        maxTokens: this.config.maxBurstSize
      });
    }

    const bucket = this.tokenBuckets.get(key);
    
    // Calculate tokens to add based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.config.windowSizeMs) * this.config.tokensPerWindow);
    
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    return bucket.tokens >= weight;
  }

  /**
   * Sliding window algorithm
   */
  checkSlidingWindow(key, weight, now) {
    if (!this.slidingWindows.has(key)) {
      this.slidingWindows.set(key, {
        segments: new Array(this.config.slidingWindowSegments).fill(0),
        currentSegment: 0,
        lastUpdate: now,
        windowStart: now
      });
    }

    const window = this.slidingWindows.get(key);
    const segmentSize = this.config.slidingWindowSize / this.config.slidingWindowSegments;
    
    // Calculate which segment we should be in
    const expectedSegment = Math.floor((now - window.windowStart) / segmentSize) % this.config.slidingWindowSegments;
    
    // Reset segments that have passed
    if (expectedSegment !== window.currentSegment) {
      const segmentsPassed = expectedSegment - window.currentSegment;
      if (segmentsPassed > 0 && segmentsPassed < this.config.slidingWindowSegments) {
        for (let i = 0; i < segmentsPassed; i++) {
          const segmentToReset = (window.currentSegment + i + 1) % this.config.slidingWindowSegments;
          window.segments[segmentToReset] = 0;
        }
      } else if (segmentsPassed >= this.config.slidingWindowSegments) {
        // More than a full window has passed, reset all segments
        window.segments.fill(0);
      }
      window.currentSegment = expectedSegment;
      window.lastUpdate = now;
    }

    // Calculate total requests in current window
    const totalRequests = window.segments.reduce((sum, count) => sum + count, 0);
    
    return totalRequests + weight <= this.config.tokensPerWindow;
  }

  /**
   * Consume tokens from all limiters
   */
  consumeTokens(key, userId, serverName, weight, now) {
    // Consume from token bucket
    const bucket = this.tokenBuckets.get(key);
    if (bucket) {
      bucket.tokens -= weight;
    }

    // Add to sliding window
    const window = this.slidingWindows.get(key);
    if (window) {
      window.segments[window.currentSegment] += weight;
    }

    // Consume from user limit
    const userLimit = this.userLimits.get(userId);
    if (userLimit) {
      userLimit.tokens -= 1;
      userLimit.requestTimes.push(now);
    }

    // Consume from server limit
    const serverLimit = this.serverLimits.get(serverName);
    if (serverLimit) {
      serverLimit.tokens -= 1;
      serverLimit.requestTimes.push(now);
    }
  }

  /**
   * Get remaining tokens for a key
   */
  getRemainingTokens(key) {
    const bucket = this.tokenBuckets.get(key);
    return bucket ? bucket.tokens : 0;
  }

  /**
   * Get retry after time in seconds
   */
  getRetryAfter(type, key) {
    switch (type) {
      case 'user':
        return Math.ceil(this.config.perUserWindowMs / 1000);
      case 'server':
        return Math.ceil(this.config.perServerWindowMs / 1000);
      case 'bucket':
      case 'window':
      default:
        return Math.ceil(this.config.windowSizeMs / 1000);
    }
  }

  /**
   * Adaptive rate limiting based on system load
   */
  checkAdaptiveAdjustment(key, now) {
    if (!this.adaptiveStates.has(key)) {
      this.adaptiveStates.set(key, {
        originalLimit: this.config.tokensPerWindow,
        currentLimit: this.config.tokensPerWindow,
        lastAdjustment: now,
        loadHistory: []
      });
    }

    const state = this.adaptiveStates.get(key);
    const bucket = this.tokenBuckets.get(key);
    
    if (!bucket) return;

    // Calculate current load (how much of the limit is being used)
    const currentLoad = 1 - (bucket.tokens / bucket.maxTokens);
    state.loadHistory.push({ load: currentLoad, timestamp: now });

    // Keep only recent load history
    state.loadHistory = state.loadHistory.filter(entry => (now - entry.timestamp) < this.config.windowSizeMs);

    // Check if adjustment is needed (every window)
    if (now - state.lastAdjustment >= this.config.windowSizeMs) {
      const avgLoad = state.loadHistory.reduce((sum, entry) => sum + entry.load, 0) / state.loadHistory.length;

      if (avgLoad > this.config.adaptiveThreshold && state.currentLimit > state.originalLimit * 0.1) {
        // High load - reduce limit
        const newLimit = Math.max(
          state.originalLimit * 0.1,
          state.currentLimit * (1 - this.config.adaptiveReduction)
        );
        this.adjustLimit(key, newLimit);
        state.currentLimit = newLimit;
        this.metrics.adaptiveAdjustments++;
        this.emit('adaptiveAdjustment', { key, type: 'reduce', newLimit, avgLoad });
      } else if (avgLoad < this.config.adaptiveThreshold * 0.5 && state.currentLimit < state.originalLimit) {
        // Low load - gradually increase limit
        const newLimit = Math.min(
          state.originalLimit,
          state.currentLimit * (1 + this.config.adaptiveRecoveryRate)
        );
        this.adjustLimit(key, newLimit);
        state.currentLimit = newLimit;
        this.metrics.adaptiveAdjustments++;
        this.emit('adaptiveAdjustment', { key, type: 'increase', newLimit, avgLoad });
      }

      state.lastAdjustment = now;
    }
  }

  /**
   * Adjust rate limit for a key
   */
  adjustLimit(key, newLimit) {
    const bucket = this.tokenBuckets.get(key);
    if (bucket) {
      bucket.maxTokens = newLimit;
      bucket.tokens = Math.min(bucket.tokens, newLimit);
    }
  }

  /**
   * Reset limits for a key
   */
  resetLimits(key) {
    this.tokenBuckets.delete(key);
    this.slidingWindows.delete(key);
    this.adaptiveStates.delete(key);
  }

  /**
   * Reset user limits
   */
  resetUserLimits(userId) {
    this.userLimits.delete(userId);
  }

  /**
   * Reset server limits
   */
  resetServerLimits(serverName) {
    this.serverLimits.delete(serverName);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeKeys: this.tokenBuckets.size,
      activeUsers: this.userLimits.size,
      activeServers: this.serverLimits.size,
      adaptiveKeys: this.adaptiveStates.size,
      timestamp: Date.now()
    };
  }

  /**
   * Get detailed status for monitoring
   */
  getStatus() {
    const now = Date.now();
    
    return {
      config: this.config,
      metrics: this.getMetrics(),
      buckets: Array.from(this.tokenBuckets.entries()).map(([key, bucket]) => ({
        key,
        tokens: bucket.tokens,
        maxTokens: bucket.maxTokens,
        lastRefill: bucket.lastRefill,
        age: now - bucket.lastRefill
      })).slice(0, 100), // Limit for performance
      users: Array.from(this.userLimits.entries()).map(([userId, limit]) => ({
        userId,
        tokens: limit.tokens,
        requestCount: limit.requestTimes.length,
        lastRefill: limit.lastRefill
      })).slice(0, 100),
      servers: Array.from(this.serverLimits.entries()).map(([serverName, limit]) => ({
        serverName,
        tokens: limit.tokens,
        requestCount: limit.requestTimes.length,
        lastRefill: limit.lastRefill
      }))
    };
  }

  /**
   * Setup cleanup interval
   */
  setupCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredThreshold = this.config.windowSizeMs * 2; // Keep data for 2 windows

    // Cleanup token buckets
    for (const [key, bucket] of this.tokenBuckets.entries()) {
      if (now - bucket.lastRefill > expiredThreshold) {
        this.tokenBuckets.delete(key);
      }
    }

    // Cleanup sliding windows
    for (const [key, window] of this.slidingWindows.entries()) {
      if (now - window.lastUpdate > expiredThreshold) {
        this.slidingWindows.delete(key);
      }
    }

    // Cleanup user limits
    for (const [userId, limit] of this.userLimits.entries()) {
      if (now - limit.lastRefill > expiredThreshold) {
        this.userLimits.delete(userId);
      }
    }

    // Cleanup server limits
    for (const [serverName, limit] of this.serverLimits.entries()) {
      if (now - limit.lastRefill > expiredThreshold) {
        this.serverLimits.delete(serverName);
      }
    }

    // Cleanup adaptive states
    for (const [key, state] of this.adaptiveStates.entries()) {
      if (now - state.lastAdjustment > expiredThreshold) {
        this.adaptiveStates.delete(key);
      }
    }

    this.emit('cleanupCompleted', { 
      timestamp: now, 
      bucketsRemaining: this.tokenBuckets.size,
      usersRemaining: this.userLimits.size,
      serversRemaining: this.serverLimits.size 
    });
  }
}