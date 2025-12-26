const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'eu-west-1' });

/**
 * Performance Monitoring Service
 * Tracks and reports performance metrics for the moving & storage system
 */
class PerformanceMonitoringService {
  constructor() {
    this.namespace = 'MovingStorage/Performance';
    this.metrics = new Map();
    this.startTimes = new Map();
    
    // Performance thresholds (in milliseconds)
    this.thresholds = {
      containerList: 2000,      // 2 seconds
      containerContents: 1500,  // 1.5 seconds
      qrCodeGeneration: 3000,   // 3 seconds
      reportGeneration: 5000,   // 5 seconds
      bulkOperations: 10000,    // 10 seconds
      cacheOperations: 500      // 0.5 seconds
    };

    // Batch metrics for CloudWatch
    this.metricsBatch = [];
    this.batchInterval = 60000; // 1 minute
    
    this.startBatchProcessing();
  }

  /**
   * Start timing an operation
   * @param {string} operationId - Unique operation identifier
   * @param {string} operationType - Type of operation
   * @param {object} metadata - Additional metadata
   */
  startTiming(operationId, operationType, metadata = {}) {
    this.startTimes.set(operationId, {
      startTime: Date.now(),
      operationType,
      metadata
    });
  }

  /**
   * End timing an operation and record metrics
   * @param {string} operationId - Unique operation identifier
   * @param {object} result - Operation result
   * @returns {number} Duration in milliseconds
   */
  endTiming(operationId, result = {}) {
    const startData = this.startTimes.get(operationId);
    if (!startData) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startData.startTime;
    const { operationType, metadata } = startData;

    // Record the metric
    this.recordMetric(operationType, duration, {
      ...metadata,
      ...result,
      operationId
    });

    // Clean up
    this.startTimes.delete(operationId);

    return duration;
  }

  /**
   * Record a performance metric
   * @param {string} metricName - Name of the metric
   * @param {number} value - Metric value
   * @param {object} dimensions - Metric dimensions
   */
  recordMetric(metricName, value, dimensions = {}) {
    const timestamp = new Date();
    
    // Store locally for analysis
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    
    this.metrics.get(metricName).push({
      value,
      timestamp,
      dimensions
    });

    // Add to CloudWatch batch
    this.addToCloudWatchBatch(metricName, value, dimensions, timestamp);

    // Check thresholds
    this.checkThreshold(metricName, value, dimensions);
  }

  /**
   * Record container operation metrics
   * @param {string} operation - Operation type
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Operation metadata
   */
  recordContainerOperation(operation, duration, metadata = {}) {
    this.recordMetric(`Container${operation}`, duration, {
      InventoryId: metadata.inventoryId,
      UserId: metadata.userId,
      ContainerCount: metadata.containerCount || 1
    });
  }

  /**
   * Record QR code operation metrics
   * @param {string} operation - Operation type
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Operation metadata
   */
  recordQRCodeOperation(operation, duration, metadata = {}) {
    this.recordMetric(`QRCode${operation}`, duration, {
      Size: metadata.size,
      BatchSize: metadata.batchSize || 1,
      FromCache: metadata.fromCache ? 'true' : 'false'
    });
  }

  /**
   * Record report generation metrics
   * @param {string} reportType - Type of report
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Report metadata
   */
  recordReportGeneration(reportType, duration, metadata = {}) {
    this.recordMetric(`Report${reportType}`, duration, {
      InventoryId: metadata.inventoryId,
      ItemCount: metadata.itemCount || 0,
      ContainerCount: metadata.containerCount || 0,
      FromCache: metadata.fromCache ? 'true' : 'false'
    });
  }

  /**
   * Record cache operation metrics
   * @param {string} operation - Cache operation (hit, miss, set, delete)
   * @param {string} cacheType - Type of cached data
   * @param {number} duration - Duration in milliseconds
   */
  recordCacheOperation(operation, cacheType, duration = 0) {
    this.recordMetric(`Cache${operation}`, duration || 1, {
      CacheType: cacheType,
      Operation: operation
    });
  }

  /**
   * Record database operation metrics
   * @param {string} operation - Database operation
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Operation metadata
   */
  recordDatabaseOperation(operation, duration, metadata = {}) {
    this.recordMetric(`Database${operation}`, duration, {
      TableName: metadata.tableName,
      ItemCount: metadata.itemCount || 0,
      ConsumedCapacity: metadata.consumedCapacity || 0,
      BatchSize: metadata.batchSize || 1
    });
  }

  /**
   * Record error metrics
   * @param {string} errorType - Type of error
   * @param {string} operation - Operation that failed
   * @param {object} metadata - Error metadata
   */
  recordError(errorType, operation, metadata = {}) {
    this.recordMetric('Errors', 1, {
      ErrorType: errorType,
      Operation: operation,
      InventoryId: metadata.inventoryId,
      UserId: metadata.userId
    });
  }

  /**
   * Get performance statistics for a metric
   * @param {string} metricName - Name of the metric
   * @param {number} timeRangeMinutes - Time range in minutes
   * @returns {object} Performance statistics
   */
  getPerformanceStats(metricName, timeRangeMinutes = 60) {
    const metrics = this.metrics.get(metricName) || [];
    const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);
    
    const recentMetrics = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
    
    if (recentMetrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0
      };
    }

    const values = recentMetrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      average: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    };
  }

  /**
   * Get all performance metrics summary
   * @param {number} timeRangeMinutes - Time range in minutes
   * @returns {object} All metrics summary
   */
  getAllMetrics(timeRangeMinutes = 60) {
    const summary = {};
    
    for (const [metricName] of this.metrics) {
      summary[metricName] = this.getPerformanceStats(metricName, timeRangeMinutes);
    }

    return {
      timeRange: `${timeRangeMinutes} minutes`,
      generatedAt: new Date().toISOString(),
      metrics: summary,
      thresholds: this.thresholds
    };
  }

  /**
   * Check if a metric exceeds threshold and log warning
   * @private
   */
  checkThreshold(metricName, value, dimensions) {
    const threshold = this.thresholds[metricName];
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded for ${metricName}: ${value}ms > ${threshold}ms`, {
        metricName,
        value,
        threshold,
        dimensions
      });

      // Record threshold violation
      this.recordMetric('ThresholdViolations', 1, {
        MetricName: metricName,
        Value: value,
        Threshold: threshold
      });
    }
  }

  /**
   * Add metric to CloudWatch batch
   * @private
   */
  addToCloudWatchBatch(metricName, value, dimensions, timestamp) {
    const metricData = {
      MetricName: metricName,
      Value: value,
      Timestamp: timestamp,
      Unit: metricName.includes('Duration') || metricName.includes('Time') ? 'Milliseconds' : 'Count'
    };

    // Convert dimensions to CloudWatch format
    if (dimensions && Object.keys(dimensions).length > 0) {
      metricData.Dimensions = Object.entries(dimensions).map(([name, value]) => ({
        Name: name,
        Value: String(value)
      }));
    }

    this.metricsBatch.push(metricData);

    // Send batch if it's getting large
    if (this.metricsBatch.length >= 20) {
      this.sendMetricsBatch();
    }
  }

  /**
   * Send metrics batch to CloudWatch
   * @private
   */
  async sendMetricsBatch() {
    if (this.metricsBatch.length === 0) {
      return;
    }

    try {
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: this.metricsBatch.splice(0, 20) // CloudWatch limit is 20 metrics per request
      });

      await cloudWatchClient.send(command);
    } catch (error) {
      console.error('Failed to send metrics to CloudWatch:', error);
    }
  }

  /**
   * Start batch processing interval
   * @private
   */
  startBatchProcessing() {
    setInterval(() => {
      this.sendMetricsBatch();
      this.cleanupOldMetrics();
    }, this.batchInterval);
  }

  /**
   * Clean up old metrics from memory
   * @private
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [metricName, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
      this.metrics.set(metricName, filteredMetrics);
    }
  }

  /**
   * Create performance report
   * @param {number} timeRangeMinutes - Time range for the report
   * @returns {object} Performance report
   */
  createPerformanceReport(timeRangeMinutes = 60) {
    const allMetrics = this.getAllMetrics(timeRangeMinutes);
    
    // Identify slow operations
    const slowOperations = [];
    for (const [metricName, stats] of Object.entries(allMetrics.metrics)) {
      const threshold = this.thresholds[metricName];
      if (threshold && stats.average > threshold) {
        slowOperations.push({
          operation: metricName,
          averageTime: stats.average,
          threshold,
          exceedsBy: stats.average - threshold
        });
      }
    }

    // Calculate overall health score (0-100)
    let healthScore = 100;
    slowOperations.forEach(op => {
      const penalty = Math.min(20, (op.exceedsBy / op.threshold) * 10);
      healthScore -= penalty;
    });

    return {
      ...allMetrics,
      healthScore: Math.max(0, Math.round(healthScore)),
      slowOperations,
      recommendations: this.generateRecommendations(slowOperations)
    };
  }

  /**
   * Generate performance recommendations
   * @private
   */
  generateRecommendations(slowOperations) {
    const recommendations = [];

    slowOperations.forEach(op => {
      if (op.operation.includes('Container')) {
        recommendations.push('Consider implementing more aggressive caching for container operations');
      }
      if (op.operation.includes('Report')) {
        recommendations.push('Report generation is slow - consider pre-computing common reports');
      }
      if (op.operation.includes('QRCode')) {
        recommendations.push('QR code operations are slow - check S3 performance and caching');
      }
      if (op.operation.includes('Database')) {
        recommendations.push('Database operations are slow - review query optimization and indexing');
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get current performance status
   * @returns {object} Current performance status
   */
  getCurrentStatus() {
    const report = this.createPerformanceReport(15); // Last 15 minutes
    
    return {
      status: report.healthScore > 80 ? 'healthy' : report.healthScore > 60 ? 'warning' : 'critical',
      healthScore: report.healthScore,
      activeOperations: this.startTimes.size,
      metricsCount: Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0),
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new PerformanceMonitoringService();