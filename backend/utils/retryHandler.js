/**
 * Retry handler utility for handling transient failures
 * Implements exponential backoff with jitter for optimal retry behavior
 */

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'TIMEOUT',
    'ThrottlingException',
    'ServiceUnavailable',
    'InternalServerError'
  ]
};

/**
 * Check if an error is retryable based on error type and message
 * @param {Error} error - The error to check
 * @param {Array<string>} retryableErrors - List of retryable error patterns
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error, retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors) {
  if (!error) return false;

  // Check error code
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }

  // Check error name
  if (error.name && retryableErrors.includes(error.name)) {
    return true;
  }

  // Check error message for patterns
  const errorMessage = error.message || '';
  return retryableErrors.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Calculate delay for next retry attempt using exponential backoff with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
  const { baseDelayMs, maxDelayMs, backoffMultiplier, jitterFactor } = config;
  
  // Calculate exponential backoff delay
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
  
  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  
  // Add jitter to avoid thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5);
  const finalDelay = Math.max(0, cappedDelay + jitter);
  
  return Math.round(finalDelay);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {object} config - Retry configuration
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise} Promise that resolves with function result or rejects with final error
 */
async function withRetry(fn, config = {}, operationName = 'operation') {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { maxAttempts } = retryConfig;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Execute the function
      const result = await fn();
      
      // Log successful retry if this wasn't the first attempt
      if (attempt > 0) {
        console.log(`${operationName} succeeded on attempt ${attempt + 1}/${maxAttempts}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if this is the last attempt
      if (attempt === maxAttempts - 1) {
        console.error(`${operationName} failed after ${maxAttempts} attempts:`, error.message);
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error, retryConfig.retryableErrors)) {
        console.error(`${operationName} failed with non-retryable error:`, error.message);
        break;
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, retryConfig);
      
      console.warn(`${operationName} failed on attempt ${attempt + 1}/${maxAttempts}, retrying in ${delay}ms:`, error.message);
      
      // Wait before next attempt
      await sleep(delay);
    }
  }
  
  // All attempts failed, throw the last error
  throw lastError;
}

/**
 * Execute multiple operations with retry logic and collect results
 * @param {Array<Function>} operations - Array of async functions to execute
 * @param {object} config - Retry configuration
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise<object>} Promise that resolves with success/failure results
 */
async function withBulkRetry(operations, config = {}, operationName = 'bulk operation') {
  const results = {
    successful: [],
    failed: [],
    totalRequested: operations.length,
    successCount: 0,
    failureCount: 0
  };
  
  // Execute all operations with individual retry logic
  const promises = operations.map(async (operation, index) => {
    try {
      const result = await withRetry(operation, config, `${operationName}[${index}]`);
      results.successful.push({ index, result });
      results.successCount++;
    } catch (error) {
      results.failed.push({ index, error: error.message });
      results.failureCount++;
    }
  });
  
  // Wait for all operations to complete
  await Promise.all(promises);
  
  console.log(`${operationName} completed: ${results.successCount}/${results.totalRequested} successful`);
  
  return results;
}

/**
 * Create a timeout wrapper for operations
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error messages
 * @returns {Promise} Promise that resolves with function result or rejects with timeout error
 */
function withTimeout(fn, timeoutMs, operationName = 'operation') {
  return Promise.race([
    fn(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Combine retry logic with timeout
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds per attempt
 * @param {object} retryConfig - Retry configuration
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise} Promise that resolves with function result or rejects with final error
 */
async function withRetryAndTimeout(fn, timeoutMs, retryConfig = {}, operationName = 'operation') {
  return withRetry(
    () => withTimeout(fn, timeoutMs, operationName),
    retryConfig,
    operationName
  );
}

/**
 * Create a circuit breaker for operations that fail frequently
 */
class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeoutMs = config.resetTimeoutMs || 60000; // 1 minute
    this.monitoringPeriodMs = config.monitoringPeriodMs || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async execute(fn, operationName = 'circuit breaker operation') {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        console.log(`Circuit breaker for ${operationName} moving to HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Try again later.`);
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(operationName);
      throw error;
    }
  }
  
  onSuccess(operationName) {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`Circuit breaker for ${operationName} reset to CLOSED state`);
    }
  }
  
  onFailure(operationName) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(`Circuit breaker for ${operationName} opened after ${this.failureCount} failures`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

module.exports = {
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
  calculateDelay,
  withRetry,
  withBulkRetry,
  withTimeout,
  withRetryAndTimeout,
  CircuitBreaker
};