const { listEntities } = require('./dynamodb');
const { normalizeAndValidateTag, validateAndNormalizeTags } = require('../utils/validation');
const tagCache = require('./tagCacheService');
const { 
  TAG_ERROR_TYPES, 
  handleTagSearchTimeout, 
  handleTagSuggestionError, 
  handleBulkTagOperationError,
  handleTagCacheError,
  validateTagArray 
} = require('../utils/tagErrorHandler');
const { withRetry, withTimeout, withRetryAndTimeout, CircuitBreaker } = require('../utils/retryHandler');

/**
 * Service for managing tags and tag-related operations
 * Enhanced with comprehensive error handling, retry logic, and timeout protection
 */
class TagService {
  constructor() {
    // Circuit breakers for different operations
    this.searchCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30000, // 30 seconds
      monitoringPeriodMs: 10000 // 10 seconds
    });
    
    this.suggestionCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      monitoringPeriodMs: 15000 // 15 seconds
    });
  }
  /**
   * Extract unique tags from all things in an inventory with pagination support
   * @param {string} inventoryId - Inventory UUID
   * @param {object} options - Pagination and filtering options
   * @param {number} options.limit - Maximum number of tags to return (default: 100, max: 1000)
   * @param {number} options.offset - Number of tags to skip (default: 0)
   * @param {string} options.filter - Filter tags by partial name match
   * @param {string} options.sortOrder - Sort order: 'asc' or 'desc' (default: 'asc')
   * @returns {Promise<object>} Paginated tags data
   */
  async getInventoryTagsPaginated(inventoryId, options = {}) {
    if (!inventoryId) {
      throw new Error('inventoryId is required');
    }

    const {
      limit = 100,
      offset = 0,
      filter = '',
      sortOrder = 'asc'
    } = options;

    // Validate pagination parameters
    const validatedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), 1000);
    const validatedOffset = Math.max(0, parseInt(offset, 10) || 0);
    const validatedSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'asc';
    const normalizedFilter = filter.toLowerCase().trim();

    try {
      // Get all unique tags first
      const allTags = await this.getInventoryTags(inventoryId);
      
      // Apply filter if provided
      let filteredTags = allTags;
      if (normalizedFilter) {
        filteredTags = allTags.filter(tag => 
          tag.toLowerCase().includes(normalizedFilter)
        );
      }

      // Sort tags
      filteredTags.sort((a, b) => {
        const comparison = a.localeCompare(b);
        return validatedSortOrder === 'asc' ? comparison : -comparison;
      });

      // Calculate pagination metadata
      const totalResults = filteredTags.length;
      const hasMore = validatedOffset + validatedLimit < totalResults;
      const hasPrevious = validatedOffset > 0;

      // Apply pagination
      const paginatedTags = filteredTags.slice(
        validatedOffset, 
        validatedOffset + validatedLimit
      );

      return {
        inventoryId,
        tags: paginatedTags,
        pagination: {
          limit: validatedLimit,
          offset: validatedOffset,
          totalResults,
          currentPage: Math.floor(validatedOffset / validatedLimit) + 1,
          totalPages: Math.ceil(totalResults / validatedLimit),
          hasMore,
          hasPrevious,
          sortOrder: validatedSortOrder,
          filter: filter || null
        }
      };
    } catch (error) {
      console.error('Error getting paginated inventory tags:', error);
      throw new Error('Failed to retrieve paginated inventory tags');
    }
  }

  /**
   * Extract unique tags from all things in an inventory with enhanced error handling
   * @param {string} inventoryId - Inventory UUID
   * @returns {Promise<Array<string>>} Array of unique tags sorted alphabetically
   */
  async getInventoryTags(inventoryId) {
    if (!inventoryId) {
      throw new Error('inventoryId is required');
    }

    // Check cache first with error handling
    try {
      const cachedTags = tagCache.getCachedInventoryTags(inventoryId);
      if (cachedTags) {
        console.log(`Cache hit for inventory tags: ${inventoryId}`);
        return cachedTags;
      }
    } catch (cacheError) {
      // Log cache error but continue with database query
      console.warn('Tag cache read error (continuing with database query):', cacheError.message);
    }

    try {
      // Use retry logic for database operations
      const sortedTags = await withRetryAndTimeout(
        async () => {
          // Get all things in the inventory
          const things = await listEntities('THINGS', inventoryId);
          
          // Extract all tags from all things
          const allTags = new Set();
          
          for (const thing of things) {
            if (thing.tags && Array.isArray(thing.tags)) {
              thing.tags.forEach(tag => {
                if (tag && typeof tag === 'string') {
                  const normalizedTag = tag.toLowerCase().trim();
                  if (normalizedTag.length > 0) {
                    allTags.add(normalizedTag);
                  }
                }
              });
            }
          }
          
          // Return sorted array of unique tags
          return Array.from(allTags).sort();
        },
        10000, // 10 second timeout per attempt
        {
          maxAttempts: 3,
          retryableErrors: ['TIMEOUT', 'ThrottlingException', 'ServiceUnavailable']
        },
        `getInventoryTags(${inventoryId})`
      );
      
      // Cache the results with error handling
      try {
        tagCache.cacheInventoryTags(inventoryId, sortedTags);
        console.log(`Cached ${sortedTags.length} tags for inventory: ${inventoryId}`);
      } catch (cacheError) {
        // Log cache error but don't fail the request
        console.warn('Tag cache write error (results still returned):', cacheError.message);
      }
      
      return sortedTags;
    } catch (error) {
      console.error('Error getting inventory tags:', error);
      
      // Provide more specific error messages
      if (error.message.includes('timed out')) {
        throw new Error('Request timed out while loading tags. Please try again.');
      } else if (error.message.includes('ThrottlingException')) {
        throw new Error('Service is temporarily busy. Please try again in a moment.');
      } else {
        throw new Error('Failed to retrieve inventory tags');
      }
    }
  }

  /**
   * Get tag usage statistics for an inventory with pagination support
   * @param {string} inventoryId - Inventory UUID
   * @param {object} options - Pagination and filtering options
   * @param {number} options.limit - Maximum number of tag statistics to return (default: 50, max: 1000)
   * @param {number} options.offset - Number of tag statistics to skip (default: 0)
   * @param {string} options.sortBy - Sort field: 'count', 'tag', 'percentage' (default: 'count')
   * @param {string} options.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
   * @param {string} options.filter - Filter tags by partial name match
   * @returns {Promise<object>} Tag analytics data with pagination
   */
  async getTagAnalytics(inventoryId, options = {}) {
    if (!inventoryId) {
      throw new Error('inventoryId is required');
    }

    const {
      limit = 50,
      offset = 0,
      sortBy = 'count',
      sortOrder = 'desc',
      filter = ''
    } = options;

    // Validate pagination parameters
    const validatedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 1000);
    const validatedOffset = Math.max(0, parseInt(offset, 10) || 0);
    const validatedSortBy = ['count', 'tag', 'percentage'].includes(sortBy) ? sortBy : 'count';
    const validatedSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';
    const normalizedFilter = filter.toLowerCase().trim();

    // Create cache key based on parameters
    const cacheParams = {
      limit: validatedLimit,
      offset: validatedOffset,
      sortBy: validatedSortBy,
      sortOrder: validatedSortOrder,
      filter: normalizedFilter || null
    };

    // Check cache first
    const cachedAnalytics = tagCache.getCachedTagAnalytics(inventoryId, cacheParams);
    if (cachedAnalytics) {
      console.log(`Cache hit for tag analytics: ${inventoryId}`);
      return cachedAnalytics;
    }

    try {
      // Get all things in the inventory
      const things = await listEntities('THINGS', inventoryId);
      
      // Count tag usage
      const tagCounts = new Map();
      let totalTaggedThings = 0;
      let totalTagInstances = 0;
      
      for (const thing of things) {
        if (thing.tags && Array.isArray(thing.tags) && thing.tags.length > 0) {
          totalTaggedThings++;
          
          thing.tags.forEach(tag => {
            if (tag && typeof tag === 'string') {
              const normalizedTag = tag.toLowerCase().trim();
              totalTagInstances++;
              
              if (tagCounts.has(normalizedTag)) {
                const existing = tagCounts.get(normalizedTag);
                tagCounts.set(normalizedTag, {
                  ...existing,
                  count: existing.count + 1,
                  lastUsed: new Date().toISOString() // In real implementation, track actual usage dates
                });
              } else {
                tagCounts.set(normalizedTag, {
                  tag: normalizedTag,
                  count: 1,
                  percentage: 0, // Will calculate below
                  firstUsed: new Date().toISOString(), // In real implementation, track actual creation dates
                  lastUsed: new Date().toISOString()
                });
              }
            }
          });
        }
      }
      
      // Calculate percentages and create statistics array
      let tagStatistics = Array.from(tagCounts.values()).map(stat => ({
        ...stat,
        percentage: totalTaggedThings > 0 ? Math.round((stat.count / totalTaggedThings) * 100) : 0
      }));

      // Apply filter if provided
      if (normalizedFilter) {
        tagStatistics = tagStatistics.filter(stat => 
          stat.tag.includes(normalizedFilter)
        );
      }

      // Sort the results
      tagStatistics.sort((a, b) => {
        let comparison = 0;
        
        switch (validatedSortBy) {
          case 'tag':
            comparison = a.tag.localeCompare(b.tag);
            break;
          case 'percentage':
            comparison = a.percentage - b.percentage;
            break;
          case 'count':
          default:
            comparison = a.count - b.count;
            break;
        }
        
        return validatedSortOrder === 'asc' ? comparison : -comparison;
      });

      // Calculate pagination metadata
      const totalResults = tagStatistics.length;
      const hasMore = validatedOffset + validatedLimit < totalResults;
      const hasPrevious = validatedOffset > 0;

      // Apply pagination
      const paginatedStatistics = tagStatistics.slice(
        validatedOffset, 
        validatedOffset + validatedLimit
      );
      
      const result = {
        inventoryId,
        totalTags: totalTagInstances,
        uniqueTags: tagCounts.size,
        totalThings: things.length,
        taggedThings: totalTaggedThings,
        tagStatistics: paginatedStatistics,
        pagination: {
          limit: validatedLimit,
          offset: validatedOffset,
          totalResults,
          currentPage: Math.floor(validatedOffset / validatedLimit) + 1,
          totalPages: Math.ceil(totalResults / validatedLimit),
          hasMore,
          hasPrevious,
          sortBy: validatedSortBy,
          sortOrder: validatedSortOrder,
          filter: filter || null
        },
        lastUpdated: new Date().toISOString()
      };

      // Cache the results (shorter TTL for paginated results)
      tagCache.cacheTagAnalytics(inventoryId, result, cacheParams, 3 * 60 * 1000);
      console.log(`Cached tag analytics for inventory: ${inventoryId}`);
      
      return result;
    } catch (error) {
      console.error('Error getting tag analytics:', error);
      throw new Error('Failed to retrieve tag analytics');
    }
  }

  /**
   * Normalize and validate a tag name
   * @param {string} tagName - Tag name to normalize
   * @returns {object} { valid: boolean, normalizedTag: string|null, error: string|null }
   */
  normalizeTag(tagName) {
    return normalizeAndValidateTag(tagName);
  }

  /**
   * Search things by tag combinations with enhanced error handling and timeout protection
   * @param {string} inventoryId - Inventory UUID
   * @param {Array<string>} tags - Array of tags to search for
   * @param {string} mode - Search mode: 'and' or 'or' (default: 'and')
   * @returns {Promise<Array<object>>} Array of matching things
   */
  async searchByTags(inventoryId, tags, mode = 'and') {
    if (!inventoryId) {
      throw new Error('inventoryId is required');
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      // Return all things if no tags specified
      return await withRetryAndTimeout(
        () => listEntities('THINGS', inventoryId),
        15000, // 15 second timeout
        { maxAttempts: 2 },
        `searchByTags-getAllThings(${inventoryId})`
      );
    }

    // Validate and normalize search tags with detailed error handling
    const tagValidation = validateTagArray(tags, null, `searchByTags-${inventoryId}`);
    if (!tagValidation.valid) {
      const errorMessages = tagValidation.errors.map(err => err.error || err.message).join(', ');
      throw new Error(`Invalid search tags: ${errorMessages}`);
    }

    const searchTags = tagValidation.validTags;
    const searchMode = mode.toLowerCase();

    if (!['and', 'or'].includes(searchMode)) {
      throw new Error('Search mode must be "and" or "or"');
    }

    try {
      // Use circuit breaker for search operations
      return await this.searchCircuitBreaker.execute(async () => {
        return await withRetryAndTimeout(
          async () => {
            // Use the enhanced listEntities function with tag filtering
            const matchingThings = await listEntities('THINGS', inventoryId, {
              tags: searchTags,
              tagMode: searchMode
            });

            return matchingThings;
          },
          20000, // 20 second timeout for search operations
          {
            maxAttempts: 3,
            retryableErrors: ['TIMEOUT', 'ThrottlingException', 'ServiceUnavailable', 'InternalServerError']
          },
          `searchByTags(${inventoryId}, ${searchTags.length} tags, ${searchMode})`
        );
      }, `tag search for inventory ${inventoryId}`);
    } catch (error) {
      console.error('Error searching by tags:', error);
      
      // Handle specific error types
      if (error.message.includes('timed out')) {
        const context = { inventoryId, userId: 'system', endpoint: '/things/search' };
        const searchParams = { tags: searchTags, mode: searchMode, inventoryId };
        const timeoutError = handleTagSearchTimeout(error, context, searchParams);
        throw new Error(timeoutError.error);
      } else if (error.message.includes('Circuit breaker is OPEN')) {
        throw new Error('Search service is temporarily unavailable due to repeated failures. Please try again in a few moments.');
      } else {
        throw new Error('Failed to search by tags');
      }
    }
  }

  /**
   * Advanced search with partial tag matching and performance optimization
   * @param {string} inventoryId - Inventory UUID
   * @param {object} searchOptions - Search configuration
   * @param {Array<string>} searchOptions.tags - Tags to search for
   * @param {string} searchOptions.mode - 'and' or 'or' mode
   * @param {boolean} searchOptions.partialMatch - Enable partial tag matching
   * @param {number} searchOptions.limit - Maximum results to return
   * @returns {Promise<Array<object>>} Array of matching things
   */
  async advancedTagSearch(inventoryId, searchOptions = {}) {
    const {
      tags = [],
      mode = 'and',
      partialMatch = false,
      limit = null
    } = searchOptions;

    if (!inventoryId) {
      throw new Error('inventoryId is required');
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      const allThings = await listEntities('THINGS', inventoryId);
      return limit ? allThings.slice(0, limit) : allThings;
    }

    // Validate and normalize search tags
    const tagValidation = validateAndNormalizeTags(tags);
    if (!tagValidation.valid) {
      throw new Error(`Invalid search tags: ${tagValidation.errors.join(', ')}`);
    }

    const searchTags = tagValidation.normalizedTags;
    const searchMode = mode.toLowerCase();

    if (!['and', 'or'].includes(searchMode)) {
      throw new Error('Search mode must be "and" or "or"');
    }

    try {
      if (partialMatch) {
        // For partial matching, we need to get all things and filter in memory
        // This is less efficient but provides more flexible search capabilities
        const allThings = await listEntities('THINGS', inventoryId);
        
        const matchingThings = allThings.filter(thing => {
          if (!thing.tags || !Array.isArray(thing.tags) || thing.tags.length === 0) {
            return false;
          }

          // Normalize thing tags for comparison
          const thingTags = thing.tags.map(tag => 
            typeof tag === 'string' ? tag.toLowerCase().trim() : ''
          ).filter(tag => tag.length > 0);

          if (searchMode === 'and') {
            // AND mode: thing must have ALL search tags (partial match)
            return searchTags.every(searchTag => 
              thingTags.some(thingTag => thingTag.includes(searchTag))
            );
          } else {
            // OR mode: thing must have ANY of the search tags (partial match)
            return searchTags.some(searchTag => 
              thingTags.some(thingTag => thingTag.includes(searchTag))
            );
          }
        });

        return limit ? matchingThings.slice(0, limit) : matchingThings;
      } else {
        // Use exact matching with DynamoDB filtering for better performance
        const matchingThings = await listEntities('THINGS', inventoryId, {
          tags: searchTags,
          tagMode: searchMode
        });

        return limit ? matchingThings.slice(0, limit) : matchingThings;
      }
    } catch (error) {
      console.error('Error in advanced tag search:', error);
      throw new Error('Failed to perform advanced tag search');
    }
  }

  /**
   * Get tag suggestions for autocomplete with enhanced error handling and fallback
   * @param {string} inventoryId - Inventory UUID
   * @param {string} partialTag - Partial tag input for matching
   * @param {Array<string>} excludeTags - Tags to exclude from suggestions (already applied)
   * @param {number} limit - Maximum number of suggestions (default: 10)
   * @returns {Promise<Array<string>>} Array of suggested tags
   */
  async getTagSuggestions(inventoryId, partialTag = '', excludeTags = [], limit = 10) {
    if (!inventoryId) {
      throw new Error('inventoryId is required');
    }

    // Normalize inputs
    const normalizedPartial = partialTag.toLowerCase().trim();
    const normalizedExclude = excludeTags.map(tag => 
      typeof tag === 'string' ? tag.toLowerCase().trim() : ''
    ).filter(tag => tag.length > 0);

    // Check cache first with error handling
    if (normalizedPartial.length > 0) {
      try {
        const cachedSuggestions = tagCache.getCachedTagSuggestions(inventoryId, normalizedPartial);
        if (cachedSuggestions) {
          console.log(`Cache hit for tag suggestions: ${inventoryId}:${normalizedPartial}`);
          // Filter out excluded tags and apply limit
          const filteredSuggestions = cachedSuggestions
            .filter(tag => !normalizedExclude.includes(tag))
            .slice(0, limit);
          return filteredSuggestions;
        }
      } catch (cacheError) {
        // Log cache error but continue with database query
        console.warn('Tag suggestion cache read error (continuing with database query):', cacheError.message);
      }
    }

    try {
      // Use circuit breaker for suggestion operations
      return await this.suggestionCircuitBreaker.execute(async () => {
        return await withRetryAndTimeout(
          async () => {
            // Get tag analytics to get usage frequency
            const analytics = await this.getTagAnalytics(inventoryId);
            
            // Filter and rank suggestions
            let suggestions = analytics.tagStatistics
              .filter(stat => {
                // Exclude already applied tags
                if (normalizedExclude.includes(stat.tag)) {
                  return false;
                }
                
                // If partial tag provided, filter by match
                if (normalizedPartial.length > 0) {
                  return stat.tag.includes(normalizedPartial);
                }
                
                return true;
              })
              .sort((a, b) => {
                // Sort by usage frequency (descending)
                if (b.count !== a.count) {
                  return b.count - a.count;
                }
                // Secondary sort by alphabetical order
                return a.tag.localeCompare(b.tag);
              })
              .slice(0, limit)
              .map(stat => stat.tag);

            // Cache the suggestions if we have a partial tag
            if (normalizedPartial.length > 0) {
              try {
                // Cache all matching suggestions (before applying exclude filter)
                const allMatchingSuggestions = analytics.tagStatistics
                  .filter(stat => stat.tag.includes(normalizedPartial))
                  .sort((a, b) => {
                    if (b.count !== a.count) {
                      return b.count - a.count;
                    }
                    return a.tag.localeCompare(b.tag);
                  })
                  .map(stat => stat.tag);
                
                tagCache.cacheTagSuggestions(inventoryId, normalizedPartial, allMatchingSuggestions);
                console.log(`Cached ${allMatchingSuggestions.length} tag suggestions for: ${inventoryId}:${normalizedPartial}`);
              } catch (cacheError) {
                // Log cache error but don't fail the request
                console.warn('Tag suggestion cache write error (results still returned):', cacheError.message);
              }
            }

            return suggestions;
          },
          8000, // 8 second timeout for suggestions
          {
            maxAttempts: 2,
            retryableErrors: ['TIMEOUT', 'ThrottlingException', 'ServiceUnavailable']
          },
          `getTagSuggestions(${inventoryId}, "${normalizedPartial}")`
        );
      }, `tag suggestions for inventory ${inventoryId}`);
    } catch (error) {
      console.error('Error getting tag suggestions:', error);
      
      // Handle specific error types with fallback
      if (error.message.includes('timed out')) {
        console.warn('Tag suggestions timed out, returning empty array as fallback');
        return []; // Graceful fallback for suggestions
      } else if (error.message.includes('Circuit breaker is OPEN')) {
        console.warn('Tag suggestion service temporarily unavailable, returning empty array as fallback');
        return []; // Graceful fallback for suggestions
      } else {
        // For suggestions, we can provide a graceful fallback instead of throwing
        console.warn('Tag suggestions failed, returning empty array as fallback:', error.message);
        return [];
      }
    }
  }

  /**
   * Perform bulk tag operations on multiple things
   * @param {string} inventoryId - Inventory UUID
   * @param {object} options - Operation options
   * @param {string} options.operation - Operation type: 'add', 'remove', 'replace'
   * @param {Array<string>} options.thingIds - Array of thing IDs to update
   * @param {Array<string>} options.tags - Array of tags to apply
   * @param {string} options.userId - User performing the operation
   * @returns {Promise<object>} Operation result with success/failure counts
   */
  async bulkTagOperation(inventoryId, options) {
    const { operation, thingIds, tags, userId } = options;
    
    if (!inventoryId || !operation || !thingIds || !tags || !userId) {
      throw new Error('Missing required parameters for bulk tag operation');
    }

    if (!['add', 'remove', 'replace'].includes(operation)) {
      throw new Error('Invalid operation. Must be add, remove, or replace');
    }

    const { getEntity, updateEntity } = require('./dynamodb');
    
    const results = {
      operation,
      totalRequested: thingIds.length,
      successful: 0,
      failed: 0,
      errors: [],
      updatedThings: []
    };

    try {
      // Process each thing individually to handle partial failures gracefully
      for (const thingId of thingIds) {
        try {
          // Get the current thing
          const thing = await getEntity('THINGS', thingId, inventoryId);
          
          if (!thing) {
            results.failed++;
            results.errors.push(`Thing not found: ${thingId}`);
            continue;
          }

          // Get current tags or initialize empty array
          const currentTags = thing.tags || [];
          let newTags = [...currentTags];

          // Apply the operation
          switch (operation) {
            case 'add':
              // Add new tags, avoiding duplicates
              for (const tag of tags) {
                if (!newTags.includes(tag)) {
                  newTags.push(tag);
                }
              }
              break;

            case 'remove':
              // Remove specified tags
              newTags = newTags.filter(tag => !tags.includes(tag));
              break;

            case 'replace':
              // Replace all tags with new ones
              newTags = [...tags];
              break;
          }

          // Only update if tags actually changed
          const tagsChanged = JSON.stringify(currentTags.sort()) !== JSON.stringify(newTags.sort());
          
          if (tagsChanged) {
            // Update the thing with new tags
            const updatedThing = await updateEntity('THINGS', thingId, inventoryId, {
              tags: newTags,
              dateModified: new Date().toISOString()
            });

            results.successful++;
            results.updatedThings.push({
              id: thingId,
              name: thing.name,
              previousTags: currentTags,
              newTags: newTags
            });
          } else {
            // No change needed, still count as successful
            results.successful++;
          }

        } catch (error) {
          console.error(`Error updating thing ${thingId}:`, error);
          results.failed++;
          results.errors.push(`Failed to update ${thingId}: ${error.message}`);
        }
      }

      // Invalidate cache after bulk operations
      if (results.successful > 0) {
        tagCache.invalidateInventoryCache(inventoryId, 'tags');
        console.log(`Invalidated tag cache for inventory ${inventoryId} after bulk operation`);
      }

      // Log the bulk operation
      console.log(`Bulk tag operation completed: ${operation} on ${results.successful}/${results.totalRequested} things`);

      return results;

    } catch (error) {
      console.error('Error in bulk tag operation:', error);
      throw new Error('Failed to perform bulk tag operation');
    }
  }

  /**
   * Validate an array of tags
   * @param {Array<string>} tags - Array of tags to validate
   * @returns {object} { valid: boolean, normalizedTags: Array<string>|null, errors: Array<string> }
   */
  validateTags(tags) {
    return validateAndNormalizeTags(tags);
  }
}

module.exports = new TagService();