const performanceMonitoring = require('../services/performanceMonitoringService');
const { createResponse } = require('../utils/response');
const { authenticateUser } = require('../middleware/auth');

/**
 * Get performance metrics
 */
exports.getMetrics = async (event) => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Only allow admin users to view performance metrics
    if (!user.isAdmin) {
      return createResponse(403, { error: 'Admin access required' });
    }

    const timeRange = parseInt(event.queryStringParameters?.timeRange) || 60;
    const metrics = performanceMonitoring.getAllMetrics(timeRange);

    return createResponse(200, metrics);

  } catch (error) {
    console.error('Get metrics error:', error);
    return createResponse(500, { 
      error: 'Failed to retrieve performance metrics',
      details: error.message 
    });
  }
};

/**
 * Get performance report
 */
exports.getPerformanceReport = async (event) => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Only allow admin users to view performance reports
    if (!user.isAdmin) {
      return createResponse(403, { error: 'Admin access required' });
    }

    const timeRange = parseInt(event.queryStringParameters?.timeRange) || 60;
    const report = performanceMonitoring.createPerformanceReport(timeRange);

    return createResponse(200, report);

  } catch (error) {
    console.error('Get performance report error:', error);
    return createResponse(500, { 
      error: 'Failed to generate performance report',
      details: error.message 
    });
  }
};

/**
 * Get current performance status
 */
exports.getStatus = async (event) => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Only allow admin users to view performance status
    if (!user.isAdmin) {
      return createResponse(403, { error: 'Admin access required' });
    }

    const status = performanceMonitoring.getCurrentStatus();

    return createResponse(200, status);

  } catch (error) {
    console.error('Get performance status error:', error);
    return createResponse(500, { 
      error: 'Failed to retrieve performance status',
      details: error.message 
    });
  }
};

/**
 * Get performance statistics for a specific metric
 */
exports.getMetricStats = async (event) => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Only allow admin users to view performance metrics
    if (!user.isAdmin) {
      return createResponse(403, { error: 'Admin access required' });
    }

    const { metricName } = event.pathParameters;
    const timeRange = parseInt(event.queryStringParameters?.timeRange) || 60;

    if (!metricName) {
      return createResponse(400, { error: 'Metric name is required' });
    }

    const stats = performanceMonitoring.getPerformanceStats(metricName, timeRange);

    return createResponse(200, {
      metricName,
      timeRange,
      statistics: stats
    });

  } catch (error) {
    console.error('Get metric stats error:', error);
    return createResponse(500, { 
      error: 'Failed to retrieve metric statistics',
      details: error.message 
    });
  }
};