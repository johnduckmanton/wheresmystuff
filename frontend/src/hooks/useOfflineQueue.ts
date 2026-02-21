/**
 * Hook for managing offline operation queue
 * Detects network connectivity and processes queued operations when online
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueueService, QueuedOperation } from '../services/offlineQueueService';
import apiClient from '../services/api';

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update queued count when queue changes
  useEffect(() => {
    const updateCount = () => {
      setQueuedCount(offlineQueueService.getPendingCount());
    };

    updateCount();
    const unsubscribe = offlineQueueService.subscribe(updateCount);

    return unsubscribe;
  }, []);

  // Process queue when coming back online
  const processQueue = useCallback(async () => {
    if (!isOnline || isProcessing) {
      return { success: 0, failed: 0 };
    }

    setIsProcessing(true);

    try {
      const result = await offlineQueueService.processQueue(async (operation) => {
        if (operation.type === 'create-and-pack') {
          const { thingData, containerId, inventoryId } = operation.data;
          await apiClient.createAndPackThing(thingData, containerId, inventoryId);
        }
      });

      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [isOnline, isProcessing]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      console.log('Network connectivity restored');
      setIsOnline(true);

      // Wait a bit to ensure connection is stable
      setTimeout(async () => {
        const result = await processQueue();
        if (result.success > 0 || result.failed > 0) {
          console.log(`Processed ${result.success} operations, ${result.failed} failed`);
        }
      }, 1000);
    };

    const handleOffline = () => {
      console.log('Network connectivity lost');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue]);

  // Queue a create-and-pack operation
  const queueCreateAndPack = useCallback((
    thingData: any,
    containerId: string,
    inventoryId: string
  ): string => {
    return offlineQueueService.addOperation({
      type: 'create-and-pack',
      data: {
        thingData,
        containerId,
        inventoryId,
      },
    });
  }, []);

  return {
    isOnline,
    queuedCount,
    isProcessing,
    queueCreateAndPack,
    processQueue,
  };
}
