/**
 * Frontend tag cache service for improved autocomplete performance
 * Provides client-side caching for tag suggestions and analytics
 * Validates: Requirements 6.2, 6.4
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface TagSuggestionCache {
  [key: string]: CacheEntry<string[]>;
}

interface TagAnalyticsCache {
  [key: string]: CacheEntry<any>;
}

class FrontendTagCacheService {
  private suggestionCache: TagSuggestionCache = {};
  private analyticsCache: TagAnalyticsCache = {};
  
  // Cache configuration
  private readonly config = {
    // Cache TTL in milliseconds
    suggestionTTL: 2 * 60 * 1000, // 2 minutes for suggestions
    analyticsTTL: 5 * 60 * 1000,  // 5 minutes for analytics
    // Maximum cache entries to prevent memory issues
    maxSuggestionEntries: 100,
    maxAnalyticsEntries: 20,
  };

  constructor() {
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Generate cache key for tag suggestions
   */
  private generateSuggestionKey(inventoryId: string, partialTag: string, excludeTags: string[] = []): string {
    const excludeKey = excludeTags.sort().join(',');
    return `${inventoryId}:${partialTag.toLowerCase()}:${excludeKey}`;
  }

  /**
   * Generate cache key for tag analytics
   */
  private generateAnalyticsKey(inventoryId: string, options: any = {}): string {
    const optionsKey = JSON.stringify(options);
    return `${inventoryId}:${optionsKey}`;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Implement LRU eviction for suggestion cache
   */
  private evictOldestSuggestion(): void {
    if (Object.keys(this.suggestionCache).length < this.config.maxSuggestionEntries) {
      return;
    }

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of Object.entries(this.suggestionCache)) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      delete this.suggestionCache[oldestKey];
    }
  }

  /**
   * Implement LRU eviction for analytics cache
   */
  private evictOldestAnalytics(): void {
    if (Object.keys(this.analyticsCache).length < this.config.maxAnalyticsEntries) {
      return;
    }

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of Object.entries(this.analyticsCache)) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      delete this.analyticsCache[oldestKey];
    }
  }

  /**
   * Cache tag suggestions
   */
  cacheSuggestions(
    inventoryId: string, 
    partialTag: string, 
    excludeTags: string[], 
    suggestions: string[]
  ): void {
    const key = this.generateSuggestionKey(inventoryId, partialTag, excludeTags);
    
    // Evict oldest entry if cache is full
    this.evictOldestSuggestion();
    
    this.suggestionCache[key] = {
      value: suggestions,
      expiresAt: Date.now() + this.config.suggestionTTL,
      createdAt: Date.now()
    };
  }

  /**
   * Get cached tag suggestions
   */
  getCachedSuggestions(
    inventoryId: string, 
    partialTag: string, 
    excludeTags: string[] = []
  ): string[] | null {
    const key = this.generateSuggestionKey(inventoryId, partialTag, excludeTags);
    const entry = this.suggestionCache[key];
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        delete this.suggestionCache[key];
      }
      return null;
    }
    
    return entry.value;
  }

  /**
   * Cache tag analytics
   */
  cacheAnalytics(inventoryId: string, options: any, analytics: any): void {
    const key = this.generateAnalyticsKey(inventoryId, options);
    
    // Evict oldest entry if cache is full
    this.evictOldestAnalytics();
    
    this.analyticsCache[key] = {
      value: analytics,
      expiresAt: Date.now() + this.config.analyticsTTL,
      createdAt: Date.now()
    };
  }

  /**
   * Get cached tag analytics
   */
  getCachedAnalytics(inventoryId: string, options: any = {}): any | null {
    const key = this.generateAnalyticsKey(inventoryId, options);
    const entry = this.analyticsCache[key];
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        delete this.analyticsCache[key];
      }
      return null;
    }
    
    return entry.value;
  }

  /**
   * Clear all cache for an inventory
   */
  clearInventoryCache(inventoryId: string): void {
    // Clear suggestion cache
    const suggestionKeysToDelete = Object.keys(this.suggestionCache).filter(key => 
      key.startsWith(inventoryId + ':')
    );
    suggestionKeysToDelete.forEach(key => delete this.suggestionCache[key]);

    // Clear analytics cache
    const analyticsKeysToDelete = Object.keys(this.analyticsCache).filter(key => 
      key.startsWith(inventoryId + ':')
    );
    analyticsKeysToDelete.forEach(key => delete this.analyticsCache[key]);

    console.log(`Cleared frontend cache for inventory ${inventoryId}: ${suggestionKeysToDelete.length + analyticsKeysToDelete.length} entries`);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.suggestionCache = {};
    this.analyticsCache = {};
    console.log('Cleared all frontend tag cache');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    suggestions: {
      totalEntries: number;
      expiredEntries: number;
      activeEntries: number;
      maxEntries: number;
      utilizationPercent: number;
    };
    analytics: {
      totalEntries: number;
      expiredEntries: number;
      activeEntries: number;
      maxEntries: number;
      utilizationPercent: number;
    };
  } {
    const now = Date.now();
    
    // Count suggestion cache stats
    let expiredSuggestions = 0;
    for (const entry of Object.values(this.suggestionCache)) {
      if (now > entry.expiresAt) {
        expiredSuggestions++;
      }
    }
    
    // Count analytics cache stats
    let expiredAnalytics = 0;
    for (const entry of Object.values(this.analyticsCache)) {
      if (now > entry.expiresAt) {
        expiredAnalytics++;
      }
    }
    
    const suggestionCount = Object.keys(this.suggestionCache).length;
    const analyticsCount = Object.keys(this.analyticsCache).length;
    
    return {
      suggestions: {
        totalEntries: suggestionCount,
        expiredEntries: expiredSuggestions,
        activeEntries: suggestionCount - expiredSuggestions,
        maxEntries: this.config.maxSuggestionEntries,
        utilizationPercent: Math.round((suggestionCount / this.config.maxSuggestionEntries) * 100)
      },
      analytics: {
        totalEntries: analyticsCount,
        expiredEntries: expiredAnalytics,
        activeEntries: analyticsCount - expiredAnalytics,
        maxEntries: this.config.maxAnalyticsEntries,
        utilizationPercent: Math.round((analyticsCount / this.config.maxAnalyticsEntries) * 100)
      }
    };
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Remove expired cache entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean suggestion cache
    for (const [key, entry] of Object.entries(this.suggestionCache)) {
      if (now > entry.expiresAt) {
        delete this.suggestionCache[key];
        cleanedCount++;
      }
    }

    // Clean analytics cache
    for (const [key, entry] of Object.entries(this.analyticsCache)) {
      if (now > entry.expiresAt) {
        delete this.analyticsCache[key];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Frontend tag cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Invalidate cache when data changes
   */
  invalidateCache(inventoryId: string, changeType: 'tags' | 'things' | 'all' = 'all'): void {
    switch (changeType) {
      case 'tags':
      case 'things':
      case 'all':
        // For frontend cache, any change invalidates everything for that inventory
        this.clearInventoryCache(inventoryId);
        break;
    }
  }
}

// Export singleton instance
export default new FrontendTagCacheService();