/**
 * Retry utility with exponential backoff
 * Implements retry logic for network operations with configurable backoff strategy
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay in milliseconds
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
  shouldRetry: (error: any) => {
    // Retry on network errors
    if (!error.response) {
      return true;
    }
    
    // Retry on specific HTTP status codes
    const status = error.response?.status;
    return status === 503 || status === 409 || status === 429;
  },
};

/**
 * Executes a function with retry logic and exponential backoff
 * 
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects after all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!config.shouldRetry(error)) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff: 1s, 2s, 4s, 8s
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Checks if an error is a network error (no response from server)
 */
export function isNetworkError(error: any): boolean {
  return !!error.request && !error.response;
}

/**
 * Checks if an error is retryable based on status code
 */
export function isRetryableError(error: any): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  
  const status = error.response?.status;
  return status === 503 || status === 409 || status === 429;
}
