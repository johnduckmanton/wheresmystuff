/**
 * Pagination Service
 * Provides consistent pagination utilities across all services
 */
class PaginationService {
  constructor() {
    this.DEFAULT_PAGE_SIZE = 50;
    this.MAX_PAGE_SIZE = 100;
    this.MIN_PAGE_SIZE = 10;
  }

  /**
   * Validate and normalize pagination parameters
   * @param {object} params - Pagination parameters
   * @returns {object} Normalized pagination parameters
   */
  normalizePaginationParams(params = {}) {
    const {
      limit,
      page,
      offset,
      lastEvaluatedKey,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    // Normalize limit
    let normalizedLimit = this.DEFAULT_PAGE_SIZE;
    if (limit !== undefined) {
      normalizedLimit = Math.max(
        this.MIN_PAGE_SIZE,
        Math.min(parseInt(limit) || this.DEFAULT_PAGE_SIZE, this.MAX_PAGE_SIZE)
      );
    }

    // Handle different pagination styles
    let exclusiveStartKey = lastEvaluatedKey;
    if (page !== undefined && !lastEvaluatedKey) {
      // Convert page-based to offset-based (less efficient for DynamoDB)
      const pageNum = Math.max(1, parseInt(page) || 1);
      const calculatedOffset = (pageNum - 1) * normalizedLimit;
      // Note: DynamoDB doesn't support true offset, this is for compatibility
    }

    return {
      limit: normalizedLimit,
      exclusiveStartKey,
      sortBy: this.validateSortField(sortBy),
      sortOrder: this.validateSortOrder(sortOrder),
      page: page ? Math.max(1, parseInt(page) || 1) : undefined,
      offset: offset ? Math.max(0, parseInt(offset) || 0) : undefined
    };
  }

  /**
   * Validate sort field
   * @param {string} sortBy - Sort field
   * @returns {string} Validated sort field
   */
  validateSortField(sortBy) {
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'name',
      'type',
      'status',
      'itemCount',
      'estimatedValue'
    ];

    return allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  }

  /**
   * Validate sort order
   * @param {string} sortOrder - Sort order
   * @returns {string} Validated sort order
   */
  validateSortOrder(sortOrder) {
    return ['asc', 'desc'].includes(sortOrder?.toLowerCase()) 
      ? sortOrder.toLowerCase() 
      : 'desc';
  }

  /**
   * Create pagination metadata
   * @param {object} params - Pagination parameters
   * @param {object} result - Query result
   * @returns {object} Pagination metadata
   */
  createPaginationMetadata(params, result) {
    const {
      limit,
      page,
      exclusiveStartKey
    } = this.normalizePaginationParams(params);

    const {
      items = [],
      lastEvaluatedKey,
      count,
      totalCount
    } = result;

    const hasMore = !!lastEvaluatedKey;
    const currentPage = page || (exclusiveStartKey ? undefined : 1);
    
    let totalPages;
    if (totalCount !== undefined) {
      totalPages = Math.ceil(totalCount / limit);
    }

    return {
      pagination: {
        limit,
        count: items.length,
        hasMore,
        lastEvaluatedKey,
        currentPage,
        totalPages,
        totalCount
      }
    };
  }

  /**
   * Create cursor-based pagination info
   * @param {object} result - Query result
   * @param {number} limit - Page limit
   * @returns {object} Cursor pagination info
   */
  createCursorPagination(result, limit) {
    const {
      items = [],
      lastEvaluatedKey
    } = result;

    return {
      data: items,
      pagination: {
        limit,
        count: items.length,
        hasNextPage: !!lastEvaluatedKey,
        nextCursor: lastEvaluatedKey ? this.encodeCursor(lastEvaluatedKey) : null
      }
    };
  }

  /**
   * Encode cursor for client use
   * @param {object} lastEvaluatedKey - DynamoDB last evaluated key
   * @returns {string} Encoded cursor
   */
  encodeCursor(lastEvaluatedKey) {
    if (!lastEvaluatedKey) return null;
    return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
  }

  /**
   * Decode cursor from client
   * @param {string} cursor - Encoded cursor
   * @returns {object} Decoded last evaluated key
   */
  decodeCursor(cursor) {
    if (!cursor) return null;
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch (error) {
      console.warn('Invalid cursor provided:', error.message);
      return null;
    }
  }

  /**
   * Create offset-based pagination (less efficient for DynamoDB)
   * @param {Array} allItems - All items (from scan/query)
   * @param {object} params - Pagination parameters
   * @returns {object} Paginated result
   */
  createOffsetPagination(allItems, params) {
    const {
      limit,
      page,
      offset
    } = this.normalizePaginationParams(params);

    let startIndex = 0;
    if (page !== undefined) {
      startIndex = (page - 1) * limit;
    } else if (offset !== undefined) {
      startIndex = offset;
    }

    const endIndex = startIndex + limit;
    const paginatedItems = allItems.slice(startIndex, endIndex);

    const totalCount = allItems.length;
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = page || Math.floor(startIndex / limit) + 1;

    return {
      data: paginatedItems,
      pagination: {
        limit,
        count: paginatedItems.length,
        currentPage,
        totalPages,
        totalCount,
        hasNextPage: endIndex < totalCount,
        hasPreviousPage: startIndex > 0
      }
    };
  }

  /**
   * Merge multiple paginated results
   * @param {Array} results - Array of paginated results
   * @param {number} totalLimit - Total limit across all results
   * @returns {object} Merged result
   */
  mergeResults(results, totalLimit) {
    const allItems = [];
    let hasMore = false;
    let totalConsumedCapacity = 0;

    for (const result of results) {
      if (result.items) {
        allItems.push(...result.items);
      }
      if (result.hasMore) {
        hasMore = true;
      }
      if (result.consumedCapacity) {
        totalConsumedCapacity += result.consumedCapacity;
      }
    }

    // Limit the merged results
    const limitedItems = allItems.slice(0, totalLimit);
    const actualHasMore = hasMore || allItems.length > totalLimit;

    return {
      items: limitedItems,
      count: limitedItems.length,
      hasMore: actualHasMore,
      totalResults: allItems.length,
      consumedCapacity: totalConsumedCapacity
    };
  }

  /**
   * Create search pagination with highlighting
   * @param {Array} items - Search result items
   * @param {string} searchTerm - Search term used
   * @param {object} params - Pagination parameters
   * @returns {object} Paginated search results
   */
  createSearchPagination(items, searchTerm, params) {
    const paginatedResult = this.createOffsetPagination(items, params);
    
    return {
      ...paginatedResult,
      search: {
        term: searchTerm,
        totalMatches: items.length
      }
    };
  }

  /**
   * Get pagination limits
   * @returns {object} Pagination limits
   */
  getLimits() {
    return {
      defaultPageSize: this.DEFAULT_PAGE_SIZE,
      maxPageSize: this.MAX_PAGE_SIZE,
      minPageSize: this.MIN_PAGE_SIZE
    };
  }
}

module.exports = new PaginationService();