/**
 * Photo loading queue to prevent overwhelming Lambda with concurrent requests
 * Limits concurrent photo downloads to avoid cold start issues
 */

type QueueItem = {
  photoKey: string;
  resolve: (url: string) => void;
  reject: (error: Error) => void;
  retryCount: number;
};

class PhotoQueue {
  private queue: QueueItem[] = [];
  private activeRequests = 0;
  private readonly maxConcurrent = 5; // Max concurrent photo requests
  private readonly maxRetries = 5;

  async loadPhoto(photoKey: string, apiClient: any): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ photoKey, resolve, reject, retryCount: 0 });
      this.processQueue(apiClient);
    });
  }

  private async processQueue(apiClient: any) {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeRequests++;

    try {
      const response = await apiClient.generateDownloadUrl(item.photoKey);
      item.resolve(response.downloadUrl);
    } catch (error: any) {
      // Retry on 503 errors
      if (error.message?.includes('Service Unavailable') && item.retryCount < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, item.retryCount), 8000);
        console.log(`Retrying photo load in ${delay}ms (attempt ${item.retryCount + 1}/${this.maxRetries})`);
        
        setTimeout(() => {
          this.queue.push({ ...item, retryCount: item.retryCount + 1 });
          this.processQueue(apiClient);
        }, delay);
      } else {
        item.reject(error);
      }
    } finally {
      this.activeRequests--;
      // Process next item in queue
      this.processQueue(apiClient);
    }
  }
}

// Singleton instance
export const photoQueue = new PhotoQueue();
