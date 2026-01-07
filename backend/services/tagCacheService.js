/**
 * In-memory cache service for tag operations
 * Provides caching for frequently accessed tag data to improve performance
 * Validates: Requirements 6.2, 6.4
 */
class TagCacheService {
  constructor() {
    // In-memory cache storage
    this.cache = new Map();
    
    // Cache configuration
    this.config = {
      // Cache TTL in milliseconds (5 minutes default)
      defaultTTL: 5 * 60 * 1000,
      // Maximum cache entries to prevent memory issues
      maxEntries: 1000,
      // Cache key prefixes for different data types
      prefixes: {
        INVENTORY_TAGS: 'inv_tags:',
        TAG_ANALYTICS: 'tag_analytics:',
        TAG_SUGGESTIONS: 'tag_suggestions:',
        TAG_SEARCH: 'tag_search:'
      }
    };
    
    // Periodic cleanup to remove expired entries
    this.startCleanupTimer();
  }

  /**
   * Generate cache key with prefix
   * @param {string} prefix - Cache key prefix
   * @param {string} key - Base key
   * @param {object} params - Additional parameters to include in key
   * @returns {string} Complete cache key
   */
  generateKey(prefix, key, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? ':' + JSON.stringify(params) 
      : '';
    return `${prefix}${key}${paramString}`;
  }

  /**
   * Set cache entry with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.config.defaultTTL) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });
  }

  /**
   * Get cache entry if not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries for an inventory
   * @param {string} inventoryId - Inventory UUID
   */
  clearInventoryCache(inventoryId) {
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(inventoryId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
      totalSize += JSON.stringify(entry.value).length;
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      activeEntries: this.cache.size - expiredCount,
      approximateSize: totalSize,
      maxEntries: this.config.maxEntries,
      utilizationPercent: Math.round((this.cache.size / this.config.maxEntries) * 100)
    };
  }

  /**
   * Cache inventory tags
   * @param {string} inventoryId - Inventory UUID
   * @param {Array<string>} tags - Array of tags
   * @param {number} ttl - Cache TTL (optional)
   */
  cacheInventoryTags(inventoryId, tags, ttl) {
    const key = this.generateKey(this.config.prefixes.INVENTORY_TAGS, inventoryId);
    this.set(key, tags, ttl);
  }

  /**
   * Get cached inventory tags
   * @param {string} inventoryId - Inventory UUID
   * @returns {Array<string>|null} Cached tags or null
   */
  getCachedInventoryTags(inventoryId) {
    const key = this.generateKey(this.config.prefixes.INVENTORY_TAGS, inventoryId);
    return this.get(key);
  }

  /**
   * Cache tag analytics
   * @param {string} inventoryId - Inventory UUID
   * @param {object} analytics - Analytics data
   * @param {object} params - Query parameters used for analytics
   * @param {number} ttl - Cache TTL (optional)
   */
  cacheTagAnalytics(inventoryId, analytics, params = {}, ttl) {
    const key = this.generateKey(this.config.prefixes.TAG_ANALYTICS, inventoryId, params);
    this.set(key, analytics, ttl);
  }

  /**
   * Get cached tag analytics
   * @param {string} inventoryId - Inventory UUID
   * @param {object} params - Query parameters used for analytics
   * @returns {object|null} Cached analytics or null
   */
  getCachedTagAnalytics(inventoryId, params = {}) {
    const key = this.generateKey(this.config.prefixes.TAG_ANALYTICS, inventoryId, params);
    return this.get(key);
  }

  /**
   * Cache tag suggestions
   * @param {string} inventoryId - Inventory UUID
   * @param {string} partialTag - Partial tag input
   * @param {Array<string>} suggestions - Suggestion results
   * @param {number} ttl - Cache TTL (optional, shorter for suggestions)
   */
  cacheTagSuggestions(inventoryId, partialTag, suggestions, ttl = 2 * 60 * 1000) {
    const key = this.generateKey(
      this.config.prefixes.TAG_SUGGESTIONS, 
      inventoryId, 
      { partial: partialTag.toLowerCase() }
    );
    this.set(key, suggestions, ttl);
  }

  /**
   * Get cached tag suggestions
   * @param {string} inventoryId - Inventory UUID
   * @param {string} partialTag - Partial tag input
   * @returns {Array<string>|null} Cached suggestions or null
   */
  getCachedTagSuggestions(inventoryId, partialTag) {
    const key = this.generateKey(
      this.config.prefixes.TAG_SUGGESTIONS, 
      inventoryId, 
      { partial: partialTag.toLowerCase() }
    );
    return this.get(key);
  }

  /**
   * Cache tag search results
   * @param {string} inventoryId - Inventory UUID
   * @param {object} searchParams - Search parameters
   * @param {Array<object>} results - Search results
   * @param {number} ttl - Cache TTL (optional, shorter for search results)
   */
  cacheTagSearchResults(inventoryId, searchParams, results, ttl = 3 * 60 * 1000) {
    const key = this.generateKey(this.config.prefixes.TAG_SEARCH, inventoryId, searchParams);
    this.set(key, results, ttl);
  }

  /**
   * Get cached tag search results
   * @param {string} inventoryId - Inventory UUID
   * @param {object} searchParams - Search parameters
   * @returns {Array<object>|null} Cached search results or null
   */
  getCachedTagSearchResults(inventoryId, searchParams) {
    const key = this.generateKey(this.config.prefixes.TAG_SEARCH, inventoryId, searchParams);
    return this.get(key);
  }

  /**
   * Invalidate cache when inventory data changes
   * @param {string} inventoryId - Inventory UUID
   * @param {string} changeType - Type of change: 'tags', 'things', 'all'
   */
  invalidateInventoryCache(inventoryId, changeType = 'all') {
    const prefixesToClear = [];
    
    switch (changeType) {
      case 'tags':
        prefixesToClear.push(
          this.config.prefixes.INVENTORY_TAGS,
          this.config.prefixes.TAG_ANALYTICS,
          this.config.prefixes.TAG_SUGGESTIONS
        );
        break;
      case 'things':
        prefixesToClear.push(
          this.config.prefixes.TAG_SEARCH,
          this.config.prefixes.TAG_ANALYTICS
        );
        break;
      case 'all':
      default:
        prefixesToClear.push(...Object.values(this.config.prefixes));
        break;
    }

    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(inventoryId) && 
          prefixesToClear.some(prefix => key.startsWith(prefix))) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    console.log(`Invalidated ${keysToDelete.length} cache entries for inventory ${inventoryId} (${changeType})`);
  }

  /**
   * Start periodic cleanup timer to remove expired entries
   */
  startCleanupTimer() {
    // Run cleanup every 10 minutes
    setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }

  /**
   * Remove expired cache entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }
}

// Export singleton instance
module.exports = new TagCacheService();