/**
 * Tests for Offline Queue Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { offlineQueueService, QueuedOperation } from '../offlineQueueService';

describe('OfflineQueueService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear the queue
    offlineQueueService.clearQueue();
  });

  describe('addOperation', () => {
    it('should add operation to queue', () => {
      const operationId = offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Test Item' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(operationId).toBeTruthy();
      expect(offlineQueueService.getPendingCount()).toBe(1);
    });

    it('should generate unique IDs for operations', () => {
      const id1 = offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      const id2 = offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 2' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(id1).not.toBe(id2);
      expect(offlineQueueService.getPendingCount()).toBe(2);
    });
  });

  describe('getQueue', () => {
    it('should return all queued operations', () => {
      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 2' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      const queue = offlineQueueService.getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].data.thingData.name).toBe('Item 1');
      expect(queue[1].data.thingData.name).toBe('Item 2');
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending operations', () => {
      expect(offlineQueueService.getPendingCount()).toBe(0);

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(offlineQueueService.getPendingCount()).toBe(1);

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 2' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(offlineQueueService.getPendingCount()).toBe(2);
    });
  });

  describe('removeOperation', () => {
    it('should remove operation from queue', () => {
      const id = offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Test Item' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(offlineQueueService.getPendingCount()).toBe(1);

      offlineQueueService.removeOperation(id);

      expect(offlineQueueService.getPendingCount()).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear all operations', () => {
      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 2' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(offlineQueueService.getPendingCount()).toBe(2);

      offlineQueueService.clearQueue();

      expect(offlineQueueService.getPendingCount()).toBe(0);
    });
  });

  describe('processQueue', () => {
    it('should process all pending operations', async () => {
      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 2' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      const executor = vi.fn().mockResolvedValue(undefined);

      const result = await offlineQueueService.processQueue(executor);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(executor).toHaveBeenCalledTimes(2);
      expect(offlineQueueService.getPendingCount()).toBe(0);
    });

    it('should handle failed operations with retry', async () => {
      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      const executor = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await offlineQueueService.processQueue(executor);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0); // Not failed yet, still pending
      expect(offlineQueueService.getPendingCount()).toBe(1); // Still in queue for retry

      const queue = offlineQueueService.getQueue();
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].status).toBe('pending');
    });

    it('should mark operation as failed after max retries', async () => {
      const id = offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Item 1' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      const executor = vi.fn().mockRejectedValue(new Error('Network error'));

      // First attempt
      await offlineQueueService.processQueue(executor);
      expect(offlineQueueService.getPendingCount()).toBe(1);

      // Second attempt
      await offlineQueueService.processQueue(executor);
      expect(offlineQueueService.getPendingCount()).toBe(1);

      // Third attempt (max retries reached)
      const result = await offlineQueueService.processQueue(executor);
      
      expect(result.failed).toBe(1);
      const queue = offlineQueueService.getQueue();
      const operation = queue.find(op => op.id === id);
      expect(operation?.status).toBe('failed');
      expect(operation?.retryCount).toBe(3);
    });
  });

  describe('persistence', () => {
    it('should persist queue to localStorage', () => {
      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Test Item' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      const stored = localStorage.getItem('offline_operation_queue');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].data.thingData.name).toBe('Test Item');
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on queue changes', () => {
      const listener = vi.fn();
      const unsubscribe = offlineQueueService.subscribe(listener);

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Test Item' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      expect(listener).toHaveBeenCalled();

      unsubscribe();

      offlineQueueService.addOperation({
        type: 'create-and-pack',
        data: {
          thingData: { name: 'Test Item 2' },
          containerId: 'container-1',
          inventoryId: 'inventory-1',
        },
      });

      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
