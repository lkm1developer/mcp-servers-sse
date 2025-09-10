import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Production Monitoring and Health Check System
 */
export class MonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Health check intervals
      healthCheckInterval: config.healthCheckInterval || 30000, // 30s
      metricsCollectionInterval: config.metricsCollectionInterval || 10000, // 10s
      
      // Thresholds
      cpuThreshold: config.cpuThreshold || 80, // 80%
      memoryThreshold: config.memoryThreshold || 85, // 85%
      responseTimeThreshold: config.responseTimeThreshold || 5000, // 5s
      errorRateThreshold: config.errorRateThreshold || 0.1, // 10%
      
      // Alerting
      enableAlerting: config.enableAlerting || true,
      alertCooldown: config.alertCooldown || 300000, // 5 minutes
      
      // Storage
      metricsRetentionHours: config.metricsRetentionHours || 24,
      logRotationSize: config.logRotationSize || 100 * 1024 * 1024, // 100MB
      
      // Health endpoints
      enableHealthEndpoint: config.enableHealthEndpoint || true,
      enableMetricsEndpoint: config.enableMetricsEndpoint || true,
      
      ...config
    };

    // State tracking
    this.metrics = {
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkConnections: 0,
        uptime: 0,
        loadAverage: []
      },
      application: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        activeConnections: 0,
        queuedRequests: 0,
        cacheHitRate: 0,
        lastErrorTime: null,
        lastErrorMessage: ''
      },
      servers: new Map(),
      rateLimits: {
        totalHits: 0,
        activeKeys: 0,
        adaptiveAdjustments: 0
      }
    };

    this.healthStatus = {
      overall: 'healthy',
      services: new Map(),
      lastCheck: Date.now(),
      issues: []
    };

    this.alerts = {
      active: new Map(),
      history: [],
      lastAlert: null
    };

    this.performanceData = {
      requestTimes: [],
      memorySnapshots: [],
      cpuSnapshots: []
    };

    this.setupMonitoring();
  }

  /**
   * Setup monitoring intervals
   */
  setupMonitoring() {
    // Health checks
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    // Cleanup old data
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    const startTime = performance.now();
    const issues = [];
    
    try {
      // System health checks
      await this.checkSystemHealth(issues);
      
      // Application health checks
      await this.checkApplicationHealth(issues);
      
      // Service health checks
      await this.checkServiceHealth(issues);
      
      // Database health check
      await this.checkDatabaseHealth(issues);
      
      // External dependencies health
      await this.checkExternalDependencies(issues);

      // Update overall health status
      this.healthStatus = {
        overall: issues.length === 0 ? 'healthy' : 
                issues.some(i => i.severity === 'critical') ? 'unhealthy' : 'degraded',
        services: new Map(Array.from(this.healthStatus.services.entries())),
        lastCheck: Date.now(),
        issues: issues,
        checkDuration: performance.now() - startTime
      };

      // Handle alerts
      if (issues.length > 0) {
        this.handleAlerts(issues);
      }

      this.emit('healthCheckCompleted', this.healthStatus);

    } catch (error) {
      console.error('Health check failed:', error);
      this.healthStatus.overall = 'unhealthy';
      this.healthStatus.issues.push({
        type: 'monitoring',
        severity: 'critical',
        message: 'Health check system failure',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check system-level health
   */
  async checkSystemHealth(issues) {
    try {
      // CPU usage
      const cpuUsage = await this.getCpuUsage();
      this.metrics.system.cpuUsage = cpuUsage;
      
      if (cpuUsage > this.config.cpuThreshold) {
        issues.push({
          type: 'system',
          severity: cpuUsage > 95 ? 'critical' : 'warning',
          message: `High CPU usage: ${cpuUsage.toFixed(1)}%`,
          threshold: this.config.cpuThreshold,
          current: cpuUsage,
          timestamp: Date.now()
        });
      }

      // Memory usage
      const memInfo = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      
      this.metrics.system.memoryUsage = memoryUsage;
      
      if (memoryUsage > this.config.memoryThreshold) {
        issues.push({
          type: 'system',
          severity: memoryUsage > 95 ? 'critical' : 'warning',
          message: `High memory usage: ${memoryUsage.toFixed(1)}%`,
          threshold: this.config.memoryThreshold,
          current: memoryUsage,
          heapUsed: Math.round(memInfo.heapUsed / 1024 / 1024),
          timestamp: Date.now()
        });
      }

      // Load average
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      this.metrics.system.loadAverage = loadAvg;
      
      if (loadAvg[0] > cpuCount * 2) {
        issues.push({
          type: 'system',
          severity: 'warning',
          message: `High load average: ${loadAvg[0].toFixed(2)}`,
          cpuCount: cpuCount,
          loadAverage: loadAvg,
          timestamp: Date.now()
        });
      }

      // Uptime
      this.metrics.system.uptime = process.uptime();

    } catch (error) {
      issues.push({
        type: 'system',
        severity: 'critical',
        message: 'Failed to check system health',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check application-level health
   */
  async checkApplicationHealth(issues) {
    try {
      // Error rate check
      const totalRequests = this.metrics.application.totalRequests;
      const failedRequests = this.metrics.application.failedRequests;
      const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

      if (errorRate > this.config.errorRateThreshold) {
        issues.push({
          type: 'application',
          severity: errorRate > 0.2 ? 'critical' : 'warning',
          message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
          threshold: this.config.errorRateThreshold * 100,
          current: errorRate * 100,
          totalRequests,
          failedRequests,
          timestamp: Date.now()
        });
      }

      // Response time check
      const avgResponseTime = this.metrics.application.averageResponseTime;
      if (avgResponseTime > this.config.responseTimeThreshold) {
        issues.push({
          type: 'application',
          severity: avgResponseTime > 10000 ? 'critical' : 'warning',
          message: `High response time: ${avgResponseTime.toFixed(0)}ms`,
          threshold: this.config.responseTimeThreshold,
          current: avgResponseTime,
          timestamp: Date.now()
        });
      }

      // Queue length check
      const queuedRequests = this.metrics.application.queuedRequests;
      if (queuedRequests > 100) {
        issues.push({
          type: 'application',
          severity: queuedRequests > 500 ? 'critical' : 'warning',
          message: `High queue length: ${queuedRequests} requests`,
          current: queuedRequests,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      issues.push({
        type: 'application',
        severity: 'critical',
        message: 'Failed to check application health',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check service-specific health
   */
  async checkServiceHealth(issues) {
    for (const [serverName, serverMetrics] of this.metrics.servers.entries()) {
      try {
        const serviceHealth = {
          name: serverName,
          status: 'healthy',
          responseTime: serverMetrics.averageLatency || 0,
          successRate: serverMetrics.successRate || 1.0,
          activeConnections: serverMetrics.activeConnections || 0,
          lastActivity: serverMetrics.lastActivity || Date.now()
        };

        // Check service response time
        if (serviceHealth.responseTime > this.config.responseTimeThreshold) {
          serviceHealth.status = 'degraded';
          issues.push({
            type: 'service',
            service: serverName,
            severity: 'warning',
            message: `Service ${serverName} has high response time: ${serviceHealth.responseTime}ms`,
            threshold: this.config.responseTimeThreshold,
            current: serviceHealth.responseTime,
            timestamp: Date.now()
          });
        }

        // Check service success rate
        if (serviceHealth.successRate < 0.9) {
          serviceHealth.status = serviceHealth.successRate < 0.5 ? 'unhealthy' : 'degraded';
          issues.push({
            type: 'service',
            service: serverName,
            severity: serviceHealth.successRate < 0.5 ? 'critical' : 'warning',
            message: `Service ${serverName} has low success rate: ${(serviceHealth.successRate * 100).toFixed(1)}%`,
            current: serviceHealth.successRate * 100,
            timestamp: Date.now()
          });
        }

        // Check service activity
        const timeSinceActivity = Date.now() - serviceHealth.lastActivity;
        if (timeSinceActivity > 3600000) { // 1 hour
          serviceHealth.status = 'inactive';
          issues.push({
            type: 'service',
            service: serverName,
            severity: 'warning',
            message: `Service ${serverName} has been inactive for ${Math.round(timeSinceActivity / 60000)} minutes`,
            lastActivity: serviceHealth.lastActivity,
            timestamp: Date.now()
          });
        }

        this.healthStatus.services.set(serverName, serviceHealth);

      } catch (error) {
        issues.push({
          type: 'service',
          service: serverName,
          severity: 'critical',
          message: `Failed to check health for service ${serverName}`,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(issues) {
    try {
      // This would be implemented based on your database connection
      // For now, we'll simulate a basic check
      const dbStartTime = performance.now();
      
      // Simulate database ping
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const dbResponseTime = performance.now() - dbStartTime;
      
      if (dbResponseTime > 1000) { // 1s threshold for DB
        issues.push({
          type: 'database',
          severity: dbResponseTime > 5000 ? 'critical' : 'warning',
          message: `Database slow response: ${dbResponseTime.toFixed(0)}ms`,
          responseTime: dbResponseTime,
          timestamp: Date.now()
        });
      }

      this.healthStatus.services.set('database', {
        name: 'database',
        status: dbResponseTime < 1000 ? 'healthy' : 'degraded',
        responseTime: dbResponseTime
      });

    } catch (error) {
      issues.push({
        type: 'database',
        severity: 'critical',
        message: 'Database connection failed',
        error: error.message,
        timestamp: Date.now()
      });

      this.healthStatus.services.set('database', {
        name: 'database',
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Check external dependencies
   */
  async checkExternalDependencies(issues) {
    // This would check external APIs, services etc.
    // Implementation depends on specific dependencies
    
    const dependencies = [
      // Add your external dependencies here
      // { name: 'external-api', url: 'https://api.example.com/health' }
    ];

    for (const dep of dependencies) {
      try {
        // Implement actual health check for each dependency
        // For now, we'll skip this as it's environment specific
      } catch (error) {
        issues.push({
          type: 'dependency',
          dependency: dep.name,
          severity: 'warning',
          message: `External dependency ${dep.name} is unhealthy`,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Collect comprehensive metrics
   */
  async collectMetrics() {
    try {
      // System metrics
      await this.collectSystemMetrics();
      
      // Performance data cleanup
      this.cleanupPerformanceData();
      
      this.emit('metricsCollected', this.metrics);

    } catch (error) {
      console.error('Metrics collection failed:', error);
    }
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    // Memory snapshots
    const memUsage = process.memoryUsage();
    this.performanceData.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // CPU snapshots
    const cpuUsage = await this.getCpuUsage();
    this.performanceData.cpuSnapshots.push({
      timestamp: Date.now(),
      usage: cpuUsage
    });
  }

  /**
   * Get CPU usage percentage
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const userCPU = endUsage.user / 1000; // Convert to milliseconds
        const systemCPU = endUsage.system / 1000;
        const totalTime = endTime - startTime;
        
        const cpuPercent = ((userCPU + systemCPU) / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Update application metrics
   */
  updateRequestMetrics(responseTime, success, serverName) {
    this.metrics.application.totalRequests++;
    
    if (success) {
      this.metrics.application.successfulRequests++;
    } else {
      this.metrics.application.failedRequests++;
      this.metrics.application.lastErrorTime = Date.now();
    }

    // Update average response time
    const total = this.metrics.application.totalRequests;
    this.metrics.application.averageResponseTime = 
      (this.metrics.application.averageResponseTime * (total - 1) + responseTime) / total;

    // Track performance data
    this.performanceData.requestTimes.push({
      timestamp: Date.now(),
      responseTime,
      success,
      serverName
    });

    // Update server-specific metrics
    if (serverName) {
      if (!this.metrics.servers.has(serverName)) {
        this.metrics.servers.set(serverName, {
          totalRequests: 0,
          successfulRequests: 0,
          averageLatency: 0,
          lastActivity: Date.now()
        });
      }
      
      const serverMetrics = this.metrics.servers.get(serverName);
      serverMetrics.totalRequests++;
      serverMetrics.lastActivity = Date.now();
      
      if (success) {
        serverMetrics.successfulRequests++;
      }
      
      serverMetrics.averageLatency = 
        (serverMetrics.averageLatency * (serverMetrics.totalRequests - 1) + responseTime) / 
        serverMetrics.totalRequests;
      
      serverMetrics.successRate = serverMetrics.successfulRequests / serverMetrics.totalRequests;
    }
  }

  /**
   * Handle alerts based on issues
   */
  handleAlerts(issues) {
    if (!this.config.enableAlerting) return;

    for (const issue of issues) {
      const alertKey = `${issue.type}-${issue.service || 'system'}`;
      const now = Date.now();
      
      // Check cooldown
      const existingAlert = this.alerts.active.get(alertKey);
      if (existingAlert && (now - existingAlert.lastSent) < this.config.alertCooldown) {
        continue;
      }

      // Create or update alert
      const alert = {
        key: alertKey,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        firstSeen: existingAlert ? existingAlert.firstSeen : now,
        lastSeen: now,
        lastSent: now,
        count: existingAlert ? existingAlert.count + 1 : 1,
        issue: issue
      };

      this.alerts.active.set(alertKey, alert);
      this.alerts.history.push(alert);
      this.alerts.lastAlert = alert;

      this.emit('alert', alert);
    }

    // Clear resolved alerts
    for (const [key, alert] of this.alerts.active.entries()) {
      const stillActive = issues.some(issue => 
        `${issue.type}-${issue.service || 'system'}` === key
      );
      
      if (!stillActive) {
        this.alerts.active.delete(key);
        this.emit('alertResolved', alert);
      }
    }
  }

  /**
   * Cleanup old performance data
   */
  cleanupPerformanceData() {
    const now = Date.now();
    const retentionMs = this.config.metricsRetentionHours * 3600000;

    this.performanceData.requestTimes = this.performanceData.requestTimes
      .filter(data => (now - data.timestamp) < retentionMs);
    
    this.performanceData.memorySnapshots = this.performanceData.memorySnapshots
      .filter(data => (now - data.timestamp) < retentionMs);
    
    this.performanceData.cpuSnapshots = this.performanceData.cpuSnapshots
      .filter(data => (now - data.timestamp) < retentionMs);
  }

  /**
   * Cleanup old data
   */
  cleanupOldData() {
    const now = Date.now();
    const retentionMs = this.config.metricsRetentionHours * 3600000;

    // Cleanup alert history
    this.alerts.history = this.alerts.history
      .filter(alert => (now - alert.lastSeen) < retentionMs);

    // Cleanup performance data
    this.cleanupPerformanceData();
  }

  /**
   * Get health status for HTTP endpoint
   */
  getHealthStatus() {
    return {
      status: this.healthStatus.overall,
      timestamp: this.healthStatus.lastCheck,
      uptime: process.uptime(),
      version: process.version,
      services: Object.fromEntries(this.healthStatus.services),
      issues: this.healthStatus.issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        timestamp: issue.timestamp
      }))
    };
  }

  /**
   * Get metrics for HTTP endpoint
   */
  getMetrics() {
    return {
      timestamp: Date.now(),
      system: this.metrics.system,
      application: this.metrics.application,
      servers: Object.fromEntries(this.metrics.servers),
      rateLimits: this.metrics.rateLimits,
      performance: {
        recentRequestTimes: this.performanceData.requestTimes.slice(-100),
        recentMemoryUsage: this.performanceData.memorySnapshots.slice(-60),
        recentCpuUsage: this.performanceData.cpuSnapshots.slice(-60)
      }
    };
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    return {
      health: this.getHealthStatus(),
      metrics: this.getMetrics(),
      alerts: {
        active: Object.fromEntries(this.alerts.active),
        recent: this.alerts.history.slice(-50)
      }
    };
  }
}