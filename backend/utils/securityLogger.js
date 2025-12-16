const { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand } = require('@aws-sdk/client-cloudwatch-logs');

const client = new CloudWatchLogsClient({});
const LOG_GROUP_NAME = process.env.SECURITY_LOG_GROUP || '/aws/lambda/home-inventory-security-metrics-dev';

/**
 * Send security event to CloudWatch Logs for metric filtering
 * @param {string} eventType - Type of security event (auth, authz_failure, rate_limit)
 * @param {string} action - Specific action (login_failure, access_denied, rate_limit_exceeded)
 * @param {Object} details - Additional event details
 */
async function logSecurityEvent(eventType, action, details = {}) {
  const timestamp = Date.now();
  const logStreamName = `security-events-${new Date().toISOString().split('T')[0]}`;
  
  const logMessage = JSON.stringify({
    timestamp: new Date(timestamp).toISOString(),
    requestId: details.requestId || 'unknown',
    level: getLogLevel(eventType, action),
    eventType,
    action,
    userId: details.userId || 'unknown',
    ipAddress: details.ipAddress || 'unknown',
    resource: details.resource || 'unknown',
    details
  });

  try {
    // Try to create log stream (will fail if it already exists, which is fine)
    try {
      await client.send(new CreateLogStreamCommand({
        logGroupName: LOG_GROUP_NAME,
        logStreamName
      }));
    } catch (error) {
      // Log stream already exists, continue
    }

    // Send log event
    await client.send(new PutLogEventsCommand({
      logGroupName: LOG_GROUP_NAME,
      logStreamName,
      logEvents: [{
        timestamp,
        message: logMessage
      }]
    }));
  } catch (error) {
    // Don't throw - logging failures shouldn't break the application
    console.error('Failed to send security log event:', error);
  }
}

/**
 * Get appropriate log level for event type and action
 * @param {string} eventType - Event type
 * @param {string} action - Action
 * @returns {string} Log level
 */
function getLogLevel(eventType, action) {
  if (eventType === 'auth' && action === 'login_failure') {
    return 'ERROR';
  }
  if (eventType === 'authz_failure') {
    return 'ERROR';
  }
  if (eventType === 'rate_limit') {
    return 'WARN';
  }
  return 'INFO';
}

/**
 * Log authentication failure
 * @param {string} userId - User ID
 * @param {string} reason - Failure reason
 * @param {string} ipAddress - Client IP
 * @param {string} requestId - Request ID
 */
async function logAuthFailure(userId, reason, ipAddress, requestId) {
  await logSecurityEvent('auth', 'login_failure', {
    userId,
    reason,
    ipAddress,
    requestId
  });
}

/**
 * Log authorization failure
 * @param {string} userId - User ID
 * @param {string} resource - Resource being accessed
 * @param {string} action - Action attempted
 * @param {string} reason - Failure reason
 * @param {string} requestId - Request ID
 */
async function logAuthzFailure(userId, resource, action, reason, requestId) {
  await logSecurityEvent('authz_failure', 'access_denied', {
    userId,
    resource,
    action,
    reason,
    requestId
  });
}

/**
 * Log rate limit violation
 * @param {string} userId - User ID
 * @param {string} endpoint - API endpoint
 * @param {string} ipAddress - Client IP
 * @param {string} requestId - Request ID
 */
async function logRateLimitViolation(userId, endpoint, ipAddress, requestId) {
  await logSecurityEvent('rate_limit', 'rate_limit_exceeded', {
    userId,
    endpoint,
    ipAddress,
    requestId
  });
}

module.exports = {
  logSecurityEvent,
  logAuthFailure,
  logAuthzFailure,
  logRateLimitViolation
};