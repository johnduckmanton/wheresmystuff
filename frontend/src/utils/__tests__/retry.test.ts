import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, isNetworkError, isRetryableError } from '../retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error with exponential backoff', async () => {
      const networkError = { request: {}, message: 'Network Error' };
      const fn = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      const promise = withRetry(fn);
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Wait for first retry (1 second)
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Wait for second retry (2 seconds)
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should retry on 503 status code', async () => {
      const serviceError = { response: { status: 503 } };
      const fn = vi.fn()
        .mockRejectedValueOnce(serviceError)
        .mockResolvedValue('success');
      
      const promise = withRetry(fn);
      
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should retry on 409 status code', async () => {
      const conflictError = { response: { status: 409 } };
      const fn = vi.fn()
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValue('success');
      
      const promise = withRetry(fn);
      
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 status code', async () => {
      const badRequestError = { response: { status: 400 } };
      const fn = vi.fn().mockRejectedValue(badRequestError);
      
      await expect(withRetry(fn)).rejects.toEqual(badRequestError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 status code', async () => {
      const notFoundError = { response: { status: 404 } };
      const fn = vi.fn().mockRejectedValue(notFoundError);
      
      await expect(withRetry(fn)).rejects.toEqual(notFoundError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      const networkError = { request: {}, message: 'Network Error' };
      const fn = vi.fn().mockRejectedValue(networkError);
      
      const promise = withRetry(fn, { maxRetries: 2 });
      
      // Initial attempt + 2 retries = 3 total attempts
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toEqual(networkError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff: 1s, 2s, 4s', async () => {
      const networkError = { request: {}, message: 'Network Error' };
      const fn = vi.fn().mockRejectedValue(networkError);
      
      const promise = withRetry(fn, { maxRetries: 3 });
      
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // First retry after 1 second
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Second retry after 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);
      
      // Third retry after 4 seconds
      await vi.advanceTimersByTimeAsync(4000);
      expect(fn).toHaveBeenCalledTimes(4);
      
      await expect(promise).rejects.toEqual(networkError);
    });

    it('should respect maxDelay cap', async () => {
      const networkError = { request: {}, message: 'Network Error' };
      const fn = vi.fn().mockRejectedValue(networkError);
      
      const promise = withRetry(fn, { maxRetries: 5, maxDelay: 3000 });
      
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000); // 1s
      await vi.advanceTimersByTimeAsync(2000); // 2s
      await vi.advanceTimersByTimeAsync(3000); // 4s capped to 3s
      await vi.advanceTimersByTimeAsync(3000); // 8s capped to 3s
      await vi.advanceTimersByTimeAsync(3000); // 16s capped to 3s
      
      await expect(promise).rejects.toEqual(networkError);
      expect(fn).toHaveBeenCalledTimes(6);
    });

    it('should use custom shouldRetry function', async () => {
      const customError = { code: 'CUSTOM_ERROR' };
      const fn = vi.fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, {
        shouldRetry: (error) => error.code === 'CUSTOM_ERROR',
      });
      
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      const error = { request: {}, message: 'Network Error' };
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for response errors', () => {
      const error = { response: { status: 500 }, request: {} };
      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for non-network errors', () => {
      const error = { message: 'Some error' };
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error = { request: {}, message: 'Network Error' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 503 status', () => {
      const error = { response: { status: 503 } };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 409 status', () => {
      const error = { response: { status: 409 } };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 429 status', () => {
      const error = { response: { status: 429 } };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 400 status', () => {
      const error = { response: { status: 400 } };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 404 status', () => {
      const error = { response: { status: 404 } };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 500 status', () => {
      const error = { response: { status: 500 } };
      expect(isRetryableError(error)).toBe(false);
    });
  });
});
