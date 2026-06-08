/**
 * useSnapQueue — manages the capture → upload → analyze → confirm → create pipeline
 * for Quick Pack Mode.
 *
 * Processing rules:
 * - Sequential FIFO: only one item in `uploading` or `analyzing` at a time
 * - Rate limiting: minimum 3-second interval between starting consecutive items
 * - Exponential backoff on 503: delays 1s, 2s, 4s with max 3 retries
 * - Network loss: pause processing, retain items, resume on reconnect
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../services/api';
import type { Thing } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SnapQueueItemStatus =
  | 'queued'
  | 'uploading'
  | 'analyzing'
  | 'confirming'
  | 'creating'
  | 'complete'
  | 'failed';

export interface SnapQueueItem {
  id: string;
  imageBlob: Blob;
  optimizedBlob?: Blob;
  photoKey?: string;
  status: SnapQueueItemStatus;
  analysisResult?: {
    itemName: string;
    description: string;
    suggestedCategory: string;
    extractedText: {
      brandNames: string[];
      modelNumbers: string[];
      serialNumbers: string[];
      otherText: string[];
    };
    estimatedValue?: number;
    confidence: {
      overall: number;
      itemName: number;
      description: number;
      category: number;
    };
  };
  editedData?: Partial<Thing>;
  thingId?: string;
  error?: string;
  retryCount: number;
  createdAt: number;
  completedAt?: number;
}

export interface UseSnapQueueReturn {
  items: SnapQueueItem[];
  addPhoto: (blob: Blob) => string;
  confirmItem: (id: string) => void;
  editItem: (id: string, data: Partial<Thing>) => void;
  retryItem: (id: string) => void;
  discardItem: (id: string) => void;
  deleteCompletedItem: (id: string) => Promise<void>;
  activeItemId: string | null;
  sessionStats: { captured: number; completed: number; failed: number };
  isProcessing: boolean;
  isPaused: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PROCESSING_INTERVAL_MS = 3000; // 3-second rate limit between items
const MAX_RETRIES = 3;

/** Exponential backoff delays for 503 responses (ms) */
function getBackoffDelay(retryCount: number): number {
  return 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSnapQueue(inventoryId: string, containerId: string): UseSnapQueueReturn {
  const [items, setItems] = useState<SnapQueueItem[]>([]);
  const [isPaused, setIsPaused] = useState(!navigator.onLine);

  // Ref to track when the last item started processing (for rate limiting)
  const lastProcessedAtRef = useRef<number>(0);
  // Ref to prevent concurrent processing loops
  const isProcessingRef = useRef<boolean>(false);

  // ── Network online/offline handling ──────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      setIsPaused(false);
    };
    const handleOffline = () => {
      setIsPaused(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Update a single item by id, merging the provided partial fields */
  const updateItem = useCallback(
    (id: string, patch: Partial<SnapQueueItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  // ── Processing pipeline ──────────────────────────────────────────────────

  /**
   * Process a single item through the upload → analyze pipeline.
   * Mutates item status via `updateItem`.
   */
  const processItem = useCallback(
    async (item: SnapQueueItem) => {
      const { id, imageBlob, retryCount } = item;

      // ── Step 1: Upload ──────────────────────────────────────────────────
      updateItem(id, { status: 'uploading', error: undefined });

      let photoKey: string;
      try {
        const fileName = `quick-pack-${id}.jpg`;
        const { uploadUrl, key } = await apiClient.generateUploadUrl(
          fileName,
          'image/jpeg',
          inventoryId,
          id
        );

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: imageBlob,
          headers: { 'Content-Type': 'image/jpeg' },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        photoKey = key;
        updateItem(id, { photoKey });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        updateItem(id, { status: 'failed', error: message });
        return;
      }

      // ── Step 2: Analyze ─────────────────────────────────────────────────
      updateItem(id, { status: 'analyzing' });

      try {
        const analysisResult = await apiClient.analyzePhoto(photoKey, inventoryId);
        updateItem(id, { status: 'confirming', analysisResult });
      } catch (err: unknown) {
        // Check for 503 — apply exponential backoff and re-queue
        const is503 =
          err instanceof Error &&
          (err.message.includes('503') ||
            err.message.toLowerCase().includes('service unavailable'));

        if (is503 && retryCount < MAX_RETRIES) {
          const delay = getBackoffDelay(retryCount);
          console.warn(
            `AI analysis returned 503 for item ${id}. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          updateItem(id, { status: 'queued', retryCount: retryCount + 1 });
          // Re-queue after delay — the processing loop will pick it up
          setTimeout(() => {
            // Trigger re-processing by nudging state (no-op patch)
            setItems((prev) => [...prev]);
          }, delay);
          return;
        }

        const message = err instanceof Error ? err.message : 'Analysis failed';
        updateItem(id, { status: 'failed', error: message });
      }
    },
    [inventoryId, updateItem]
  );

  // ── Sequential FIFO processing loop ──────────────────────────────────────

  useEffect(() => {
    if (isPaused) return;
    if (isProcessingRef.current) return;

    // Check if any item is currently active (uploading or analyzing)
    const hasActiveItem = items.some(
      (i) => i.status === 'uploading' || i.status === 'analyzing'
    );
    if (hasActiveItem) return;

    // Find the next queued item (FIFO — earliest createdAt)
    const nextItem = items
      .filter((i) => i.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    if (!nextItem) return;

    // Enforce rate limit
    const now = Date.now();
    const elapsed = now - lastProcessedAtRef.current;
    if (elapsed < MIN_PROCESSING_INTERVAL_MS) {
      const remaining = MIN_PROCESSING_INTERVAL_MS - elapsed;
      const timer = setTimeout(() => {
        // Nudge state to re-trigger this effect
        setItems((prev) => [...prev]);
      }, remaining);
      return () => clearTimeout(timer);
    }

    // Start processing
    isProcessingRef.current = true;
    lastProcessedAtRef.current = Date.now();

    processItem(nextItem).finally(() => {
      isProcessingRef.current = false;
    });
  }, [items, isPaused, processItem]);

  // ── Public API ────────────────────────────────────────────────────────────

  /** Add a captured photo blob to the queue. Returns the new item's ID. */
  const addPhoto = useCallback((blob: Blob): string => {
    const id = crypto.randomUUID();
    const newItem: SnapQueueItem = {
      id,
      imageBlob: blob,
      status: 'queued',
      retryCount: 0,
      createdAt: Date.now(),
    };
    setItems((prev) => [...prev, newItem]);
    return id;
  }, []);

  /** Accept the AI suggestion and create the Thing. */
  const confirmItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item || item.status !== 'confirming') return prev;
        return prev.map((i) => (i.id === id ? { ...i, status: 'creating' as SnapQueueItemStatus } : i));
      });

      // Perform the create-and-pack call asynchronously
      setItems((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item) return prev;

        const thingData: Partial<Thing> = item.analysisResult
          ? {
              name: item.analysisResult.itemName,
              description: item.analysisResult.description,
              photos: item.photoKey ? [item.photoKey] : [],
              inventoryId,
            }
          : { inventoryId };

        // Fire the API call outside of the state setter
        apiClient
          .createAndPackThing(thingData, containerId, inventoryId)
          .then((result) => {
            setItems((current) =>
              current.map((i) =>
                i.id === id
                  ? {
                      ...i,
                      status: 'complete' as SnapQueueItemStatus,
                      thingId: result.thing.id,
                      completedAt: Date.now(),
                    }
                  : i
              )
            );
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Creation failed';
            setItems((current) =>
              current.map((i) =>
                i.id === id ? { ...i, status: 'failed' as SnapQueueItemStatus, error: message } : i
              )
            );
          });

        return prev;
      });
    },
    [containerId, inventoryId]
  );

  /** Edit the AI suggestion and create the Thing with the provided data. */
  const editItem = useCallback(
    (id: string, data: Partial<Thing>) => {
      setItems((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item || item.status !== 'confirming') return prev;
        return prev.map((i) =>
          i.id === id
            ? { ...i, status: 'creating' as SnapQueueItemStatus, editedData: data }
            : i
        );
      });

      const thingData: Partial<Thing> = {
        ...data,
        inventoryId,
      };

      apiClient
        .createAndPackThing(thingData, containerId, inventoryId)
        .then((result) => {
          setItems((current) =>
            current.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: 'complete' as SnapQueueItemStatus,
                    thingId: result.thing.id,
                    completedAt: Date.now(),
                  }
                : i
            )
          );
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Creation failed';
          setItems((current) =>
            current.map((i) =>
              i.id === id ? { ...i, status: 'failed' as SnapQueueItemStatus, error: message } : i
            )
          );
        });
    },
    [containerId, inventoryId]
  );

  /** Retry a failed item — resets it back to queued. */
  const retryItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.status !== 'failed') return item;
        return {
          ...item,
          status: 'queued' as SnapQueueItemStatus,
          error: undefined,
          // Only reset retryCount if it hasn't exceeded the max
          retryCount: item.retryCount < MAX_RETRIES ? item.retryCount : item.retryCount,
        };
      })
    );
  }, []);

  /** Remove an item from the queue entirely. */
  const discardItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /** Delete a completed Thing from the inventory and remove it from the queue. */
  const deleteCompletedItem = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item || item.status !== 'complete' || !item.thingId) return;

      await apiClient.deleteThing(item.thingId, inventoryId);
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [items, inventoryId]
  );

  // ── Derived state ─────────────────────────────────────────────────────────

  const activeItemId =
    items.find((i) => i.status === 'confirming')?.id ?? null;

  const sessionStats = {
    captured: items.length,
    completed: items.filter((i) => i.status === 'complete').length,
    failed: items.filter((i) => i.status === 'failed').length,
  };

  const isProcessing = items.some(
    (i) => i.status === 'uploading' || i.status === 'analyzing' || i.status === 'creating'
  );

  return {
    items,
    addPhoto,
    confirmItem,
    editItem,
    retryItem,
    discardItem,
    deleteCompletedItem,
    activeItemId,
    sessionStats,
    isProcessing,
    isPaused,
  };
}
