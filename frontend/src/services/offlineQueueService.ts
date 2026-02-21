/**
 * Offline Operation Queue Service
 * Manages queueing of operations when network connectivity is lost
 * and automatically retries them when connectivity is restored
 */

export interface QueuedOperation {
  id: string;
  type: 'create-and-pack';
  data: {
    thingData: any;
    containerId: string;
    inventoryId: string;
  };
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed' | 'success';
  error?: string;
}

const QUEUE_STORAGE_KEY = 'offline_operation_queue';
const MAX_RETRY_COUNT = 3;

class OfflineQueueService {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadQueue();
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Filter out old operations (older than 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        this.queue = this.queue.filter(op => op.timestamp > oneDayAgo);
        this.saveQueue();
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  /**
   * Add operation to queue
   */
  addOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };
    
    this.queue.push(queuedOp);
    this.saveQueue();
    
    console.log('Operation queued:', id);
    return id;
  }

  /**
   * Get all queued operations
   */
  getQueue(): QueuedOperation[] {
    return [...this.queue];
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.queue.filter(op => op.status === 'pending').length;
  }

  /**
   * Remove operation from queue
   */
  removeOperation(id: string): void {
    this.queue = this.queue.filter(op => op.id !== id);
    this.saveQueue();
  }

  /**
   * Clear all operations
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Process queue with provided executor function
   */
  async processQueue(
    executor: (operation: QueuedOperation) => Promise<void>
  ): Promise<{ success: number; failed: number }> {
    if (this.isProcessing) {
      console.log('Queue is already being processed');
      return { success: 0, failed: 0 };
    }

    this.isProcessing = true;
    let successCount = 0;
    let failedCount = 0;

    const pendingOps = this.queue.filter(op => op.status === 'pending');
    
    console.log(`Processing ${pendingOps.length} pending operations`);

    for (const operation of pendingOps) {
      try {
        // Update status to processing
        operation.status = 'processing';
        this.saveQueue();

        // Execute the operation
        await executor(operation);

        // Mark as success and remove from queue
        operation.status = 'success';
        this.removeOperation(operation.id);
        successCount++;
        
        console.log(`Operation ${operation.id} completed successfully`);
      } catch (error: any) {
        console.error(`Operation ${operation.id} failed:`, error);
        
        operation.retryCount++;
        operation.error = error.message || 'Unknown error';

        if (operation.retryCount >= MAX_RETRY_COUNT) {
          // Max retries reached, mark as failed
          operation.status = 'failed';
          failedCount++;
          console.error(`Operation ${operation.id} failed after ${MAX_RETRY_COUNT} retries`);
        } else {
          // Reset to pending for next retry
          operation.status = 'pending';
        }
        
        this.saveQueue();
      }
    }

    this.isProcessing = false;
    console.log(`Queue processing complete: ${successCount} success, ${failedCount} failed`);
    
    return { success: successCount, failed: failedCount };
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();
