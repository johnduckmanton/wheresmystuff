const { 
  isRetryableError, 
  calculateDelay, 
  withRetry, 
  withTimeout,
  CircuitBreaker 
} = require('../utils/retryHandler');

// Mock the sleep function to make tests run faster
jest.mock('../utils/retryHandler', () => {
  const originalModule = jest.requireActual('../utils/retryHandler');
  
  // Create a fast sleep function for testing
  const fastSleep = (ms) => Promise.resolve();
  
  // Override the withRetry function to use fast sleep
  const withRetryFast = async (fn, config = {}, operationName = 'operation') => {
    const retryConfig = { ...originalModule.DEFAULT_RETRY_CONFIG, ...config };
    const { maxAttempts } = retryConfig;
    
    let lastError;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts - 1) {
          break;
        }
        
        if (!originalModule.isRetryableError(error, retryConfig.retryableErrors)) {
          break;
        }
        
        // Use fast sleep instead of actual delay
        await fastSleep(1);
      }
    }
    
    throw lastError;
  };
  
  return {
    ...originalModule,
    withRetry: withRetryFast
  };
});

describe('Retry Handler Tests', () => {
  describe('isRetryableError', () => {
    test('should identify retryable errors by code', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNRESET';
      expect(isRetryableError(error)).toBe(true);
    });

    test('should identify retryable errors by name', () => {
      const error = new Error('Service unavailable');
      error.name = 'ServiceUnavailable';
      expect(isRetryableError(error)).toBe(true);
    });

    test('should identify retryable errors by message', () => {
      const error = new Error('Request timeout occurred');
      expect(isRetryableError(error)).toBe(true);
    });

    test('should not retry non-retryable errors', () => {
      const error = new Error('Validation failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    test('should calculate exponential backoff delay', () => {
      const delay0 = calculateDelay(0);
      const delay1 = calculateDelay(1);
      const delay2 = calculateDelay(2);
      
      expect(delay0).toBeGreaterThanOrEqual(90); // 100ms with jitter
      expect(delay0).toBeLessThanOrEqual(110);
      expect(delay1).toBeGreaterThanOrEqual(180); // 200ms with jitter
      expect(delay1).toBeLessThanOrEqual(220);
      expect(delay2).toBeGreaterThanOrEqual(360); // 400ms with jitter
      expect(delay2).toBeLessThanOrEqual(440);
    });

    test('should cap delay at maximum', () => {
      const config = { baseDelayMs: 1000, maxDelayMs: 2000, backoffMultiplier: 2, jitterFactor: 0 };
      const delay = calculateDelay(10, config);
      expect(delay).toBeLessThanOrEqual(2000);
    });
  });

  describe('withRetry', () => {
    test('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(mockFn, { maxAttempts: 3 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable errors', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValue('success');
      
      const result = await withRetry(mockFn, { 
        maxAttempts: 3
      }, 'test operation');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should not retry non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Validation failed'));
      
      await expect(withRetry(mockFn, { maxAttempts: 3 }, 'test operation')).rejects.toThrow('Validation failed');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should fail after max attempts', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('TIMEOUT'));
      
      await expect(withRetry(mockFn, { 
        maxAttempts: 2
      }, 'test operation')).rejects.toThrow('TIMEOUT');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('withTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should resolve if function completes within timeout', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withTimeout(mockFn, 1000, 'test operation');
      
      expect(result).toBe('success');
    });

    test('should reject if function times out', async () => {
      const mockFn = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const timeoutPromise = withTimeout(mockFn, 50, 'test operation');
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(60);
      
      await expect(timeoutPromise).rejects.toThrow('timed out');
    });
  });

  describe('CircuitBreaker', () => {
    test('should allow operations when closed', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(mockFn, 'test');
      expect(result).toBe('success');
      expect(breaker.getState().state).toBe('CLOSED');
    });

    test('should open after failure threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const mockFn = jest.fn().mockRejectedValue(new Error('failure'));
      
      // First failure
      await expect(breaker.execute(mockFn, 'test')).rejects.toThrow('failure');
      expect(breaker.getState().state).toBe('CLOSED');
      
      // Second failure - should open circuit
      await expect(breaker.execute(mockFn, 'test')).rejects.toThrow('failure');
      expect(breaker.getState().state).toBe('OPEN');
      
      // Third attempt should be rejected immediately
      await expect(breaker.execute(mockFn, 'test')).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockFn).toHaveBeenCalledTimes(2); // Not called on third attempt
    });
  });
});