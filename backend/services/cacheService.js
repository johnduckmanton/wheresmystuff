const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Cache Service
 * Provides caching functionality with TTL support for frequently accessed data
 */
class CacheService {
  constructor() {
    // In-memory cache for very short-lived data (1-5 minutes)
    this.memoryCache = new Map();
    this.memoryCacheTTL = new Map();
    
    // Default TTL values (in seconds)
    this.defaultTTLs = {
      containerList: 300,      // 5 minutes
      qrCodeImage: 3600,       // 1 hour
      reportResult: 900,       // 15 minutes
      containerContents: 180,  // 3 minutes
      locationData: 1800,      // 30 minutes
      projectData: 600,        // 10 minutes
      analytics: 1800          // 30 minutes
    };

    // Start cleanup interval for memory cache
    this.startMemoryCacheCleanup();
  }

  /**
   * Generate cache key for consistent caching
   * @param {string} type - Cache type (containerList, qrCode, etc.)
   * @param {string} identifier - Unique identifier
   * @param {object} params - Additional parameters for key generation
   * @returns {string} Cache key
   */
  generateCacheKey(type, identifier, params = {}) {
    const baseKey = `CACHE#${type}#${identifier}`;
    
    if (Object.keys(params).length === 0) {
      return baseKey;
    }

    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${baseKey}#${sortedParams}`;
  }

  /**
   * Store data in cache with TTL
   * @param {string} cacheKey - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttlSeconds - TTL in seconds (optional)
   * @param {boolean} useMemoryCache - Use in-memory cache for short TTL
   * @returns {Promise<void>}
   */
  async set(cacheKey, data, ttlSeconds = null, useMemoryCache = false) {
    const ttl = ttlSeconds || this.defaultTTLs.containerList;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    // Use memory cache for very short-lived data (< 5 minutes)
    if (useMemoryCache || ttl <= 300) {
      this.memoryCache.set(cacheKey, data);
      this.memoryCacheTTL.set(cacheKey, expiresAt * 1000); // Convert to milliseconds
      return;
    }

    // Use DynamoDB for longer-lived cache data
    const cacheItem = {
      pk: 'CACHE',
      sk: cacheKey,
      data: data,
      expiresAt: expiresAt,
      cachedAt: new Date().toISOString(),
      ttl: ttl
    };

    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: cacheItem
      }));
    } catch (error) {
      console.warn(`Failed to cache data for key ${cacheKey}:`, error.message);
      // Don't throw error - caching failure shouldn't break the application
    }
  }

  /**
   * Retrieve data from cache
   * @param {string} cacheKey - Cache key
   * @returns {Promise<any|null>} Cached data or null if not found/expired
   */
  async get(cacheKey) {
    // Check memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const expiresAt = this.memoryCacheTTL.get(cacheKey);
      if (Date.now() < expiresAt) {
        return this.memoryCache.get(cacheKey);
      } else {
        // Expired - remove from memory cache
        this.memoryCache.delete(cacheKey);
        this.memoryCacheTTL.delete(cacheKey);
      }
    }

    // Check DynamoDB cache
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: 'CACHE',
          sk: cacheKey
        }
      }));

      if (!result.Item) {
        return null;
      }

      // Check if expired
      const now = Math.floor(Date.now() / 1000);
      if (result.Item.expiresAt <= now) {
        // Expired - remove from cache
        await this.delete(cacheKey);
        return null;
      }

      return result.Item.data;
    } catch (error) {
      console.warn(`Failed to retrieve cache data for key ${cacheKey}:`, error.message);
      return null;
    }
  }

  /**
   * Delete data from cache
   * @param {string} cacheKey - Cache key
   * @returns {Promise<void>}
   */
  async delete(cacheKey) {
    // Remove from memory cache
    this.memoryCache.delete(cacheKey);
    this.memoryCacheTTL.delete(cacheKey);

    // Remove from DynamoDB cache
    try {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: 'CACHE',
          sk: cacheKey
        }
      }));
    } catch (error) {
      console.warn(`Failed to delete cache data for key ${cacheKey}:`, error.message);
    }
  }

  /**
   * Invalidate cache by pattern
   * @param {string} pattern - Pattern to match cache keys
   * @returns {Promise<void>}
   */
  async invalidatePattern(pattern) {
    // Clear matching keys from memory cache
    for (const [key] of this.memoryCache) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        this.memoryCacheTTL.delete(key);
      }
    }

    // Note: For DynamoDB, we would need to scan and delete matching keys
    // This is expensive, so we rely on TTL for most cache invalidation
    console.log(`Cache invalidation pattern: ${pattern} (memory cache cleared)`);
  }

  /**
   * Cache container list with filters
   * @param {string} inventoryId - Inventory ID
   * @param {object} filters - Filter parameters
   * @param {object} data - Container list data
   * @returns {Promise<void>}
   */
  async cacheContainerList(inventoryId, filters, data) {
    const cacheKey = this.generateCacheKey('containerList', inventoryId, filters);
    await this.set(cacheKey, data, this.defaultTTLs.containerList);
  }

  /**
   * Get cached container list
   * @param {string} inventoryId - Inventory ID
   * @param {object} filters - Filter parameters
   * @returns {Promise<object|null>} Cached container list or null
   */
  async getCachedContainerList(inventoryId, filters) {
    const cacheKey = this.generateCacheKey('containerList', inventoryId, filters);
    return await this.get(cacheKey);
  }

  /**
   * Cache QR code data
   * @param {string} containerId - Container ID
   * @param {string} size - QR code size
   * @param {object} qrCodeData - Complete QR code data including s3Key, imageUrl, etc.
   * @returns {Promise<void>}
   */
  async cacheQRCodeImage(containerId, size, qrCodeData) {
    const cacheKey = this.generateCacheKey('qrCodeImage', containerId, { size });
    await this.set(cacheKey, { 
      ...qrCodeData,
      cachedAt: new Date().toISOString() 
    }, this.defaultTTLs.qrCodeImage);
  }

  /**
   * Get cached QR code image URL
   * @param {string} containerId - Container ID
   * @param {string} size - QR code size
   * @returns {Promise<object|null>} Cached QR code data or null
   */
  async getCachedQRCodeImage(containerId, size) {
    const cacheKey = this.generateCacheKey('qrCodeImage', containerId, { size });
    return await this.get(cacheKey);
  }

  /**
   * Cache report result
   * @param {string} reportType - Type of report
   * @param {string} identifier - Report identifier (locationId, projectId, etc.)
   * @param {object} filters - Report filters
   * @param {object} data - Report data
   * @returns {Promise<void>}
   */
  async cacheReportResult(reportType, identifier, filters, data) {
    const cacheKey = this.generateCacheKey(`report_${reportType}`, identifier, filters);
    await this.set(cacheKey, data, this.defaultTTLs.reportResult);
  }

  /**
   * Get cached report result
   * @param {string} reportType - Type of report
   * @param {string} identifier - Report identifier
   * @param {object} filters - Report filters
   * @returns {Promise<object|null>} Cached report data or null
   */
  async getCachedReportResult(reportType, identifier, filters) {
    const cacheKey = this.generateCacheKey(`report_${reportType}`, identifier, filters);
    return await this.get(cacheKey);
  }

  /**
   * Cache container contents
   * @param {string} containerId - Container ID
   * @param {object} data - Container contents data
   * @returns {Promise<void>}
   */
  async cacheContainerContents(containerId, data) {
    const cacheKey = this.generateCacheKey('containerContents', containerId);
    await this.set(cacheKey, data, this.defaultTTLs.containerContents, true); // Use memory cache
  }

  /**
   * Get cached container contents
   * @param {string} containerId - Container ID
   * @returns {Promise<object|null>} Cached container contents or null
   */
  async getCachedContainerContents(containerId) {
    const cacheKey = this.generateCacheKey('containerContents', containerId);
    return await this.get(cacheKey);
  }

  /**
   * Cache analytics data
   * @param {string} inventoryId - Inventory ID
   * @param {string} analyticsType - Type of analytics
   * @param {object} params - Analytics parameters
   * @param {object} data - Analytics data
   * @returns {Promise<void>}
   */
  async cacheAnalytics(inventoryId, analyticsType, params, data) {
    const cacheKey = this.generateCacheKey(`analytics_${analyticsType}`, inventoryId, params);
    await this.set(cacheKey, data, this.defaultTTLs.analytics);
  }

  /**
   * Get cached analytics data
   * @param {string} inventoryId - Inventory ID
   * @param {string} analyticsType - Type of analytics
   * @param {object} params - Analytics parameters
   * @returns {Promise<object|null>} Cached analytics data or null
   */
  async getCachedAnalytics(inventoryId, analyticsType, params) {
    const cacheKey = this.generateCacheKey(`analytics_${analyticsType}`, inventoryId, params);
    return await this.get(cacheKey);
  }

  /**
   * Invalidate cache for specific inventory
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<void>}
   */
  async invalidateInventoryCache(inventoryId) {
    await this.invalidatePattern(inventoryId);
  }

  /**
   * Invalidate cache for specific container
   * @param {string} containerId - Container ID
   * @returns {Promise<void>}
   */
  async invalidateContainerCache(containerId) {
    await this.invalidatePattern(containerId);
  }

  /**
   * Start memory cache cleanup interval
   * @private
   */
  startMemoryCacheCleanup() {
    // Clean up expired memory cache entries every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.memoryCacheTTL) {
        if (now >= expiresAt) {
          this.memoryCache.delete(key);
          this.memoryCacheTTL.delete(key);
        }
      }
    }, 120000); // 2 minutes
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryCacheTTLSize: this.memoryCacheTTL.size,
      defaultTTLs: this.defaultTTLs
    };
  }

  /**
   * Clear all cache data
   * @returns {Promise<void>}
   */
  async clearAll() {
    // Clear memory cache
    this.memoryCache.clear();
    this.memoryCacheTTL.clear();

    console.log('All cache data cleared');
  }
}

module.exports = new CacheService();