const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, BatchWriteCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Database Optimization Service
 * Provides optimized database operations with batching, pagination, and efficient querying
 */
class DatabaseOptimizationService {
  constructor() {
    // Batch operation limits
    this.BATCH_GET_LIMIT = 100;
    this.BATCH_WRITE_LIMIT = 25;
    this.TRANSACTION_LIMIT = 25;
    
    // Query optimization settings
    this.DEFAULT_PAGE_SIZE = 50;
    this.MAX_PAGE_SIZE = 100;
    this.PARALLEL_QUERY_LIMIT = 5;
  }

  /**
   * Optimized batch get operation with automatic chunking
   * @param {Array} keys - Array of key objects
   * @param {object} options - Query options
   * @returns {Promise<Array>} Retrieved items
   */
  async batchGetItems(keys, options = {}) {
    if (!keys || keys.length === 0) {
      return [];
    }

    const {
      projectionExpression,
      consistentRead = false
    } = options;

    const results = [];
    const chunks = this._chunkArray(keys, this.BATCH_GET_LIMIT);

    // Process chunks in parallel with concurrency limit
    const concurrencyLimit = 3;
    for (let i = 0; i < chunks.length; i += concurrencyLimit) {
      const batchChunks = chunks.slice(i, i + concurrencyLimit);
      
      const batchPromises = batchChunks.map(async (chunk) => {
        const requestItems = {
          [TABLE_NAME]: {
            Keys: chunk,
            ConsistentRead: consistentRead
          }
        };

        if (projectionExpression) {
          requestItems[TABLE_NAME].ProjectionExpression = projectionExpression;
        }

        let unprocessedKeys = requestItems;
        const batchResults = [];

        // Handle unprocessed keys with exponential backoff
        let retryCount = 0;
        const maxRetries = 3;

        while (unprocessedKeys && Object.keys(unprocessedKeys).length > 0 && retryCount < maxRetries) {
          try {
            const result = await docClient.send(new BatchGetCommand({
              RequestItems: unprocessedKeys
            }));

            if (result.Responses && result.Responses[TABLE_NAME]) {
              batchResults.push(...result.Responses[TABLE_NAME]);
            }

            unprocessedKeys = result.UnprocessedKeys;
            
            if (unprocessedKeys && Object.keys(unprocessedKeys).length > 0) {
              // Exponential backoff
              const delay = Math.pow(2, retryCount) * 100;
              await this._sleep(delay);
              retryCount++;
            }
          } catch (error) {
            console.error(`Batch get error (retry ${retryCount}):`, error);
            retryCount++;
            if (retryCount >= maxRetries) {
              throw error;
            }
            await this._sleep(Math.pow(2, retryCount) * 100);
          }
        }

        return batchResults;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    return results;
  }

  /**
   * Optimized batch write operation with automatic chunking and retry logic
   * @param {Array} items - Array of items to write
   * @param {string} operation - 'put' or 'delete'
   * @returns {Promise<object>} Write results
   */
  async batchWriteItems(items, operation = 'put') {
    if (!items || items.length === 0) {
      return { successful: 0, failed: 0, errors: [] };
    }

    const chunks = this._chunkArray(items, this.BATCH_WRITE_LIMIT);
    let successful = 0;
    let failed = 0;
    const errors = [];

    // Process chunks sequentially to avoid throttling
    for (const chunk of chunks) {
      try {
        const requestItems = {
          [TABLE_NAME]: chunk.map(item => {
            if (operation === 'put') {
              return { PutRequest: { Item: item } };
            } else if (operation === 'delete') {
              return { DeleteRequest: { Key: item } };
            }
          })
        };

        let unprocessedItems = requestItems;
        let retryCount = 0;
        const maxRetries = 3;

        while (unprocessedItems && Object.keys(unprocessedItems).length > 0 && retryCount < maxRetries) {
          const result = await docClient.send(new BatchWriteCommand({
            RequestItems: unprocessedItems
          }));

          const processedCount = chunk.length - (result.UnprocessedItems?.[TABLE_NAME]?.length || 0);
          successful += processedCount;

          unprocessedItems = result.UnprocessedItems;
          
          if (unprocessedItems && Object.keys(unprocessedItems).length > 0) {
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 200;
            await this._sleep(delay);
            retryCount++;
          }
        }

        // Count remaining unprocessed items as failed
        if (unprocessedItems && unprocessedItems[TABLE_NAME]) {
          failed += unprocessedItems[TABLE_NAME].length;
          errors.push(`Failed to process ${unprocessedItems[TABLE_NAME].length} items after ${maxRetries} retries`);
        }

      } catch (error) {
        failed += chunk.length;
        errors.push(`Batch write error: ${error.message}`);
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Optimized query with automatic pagination and projection
   * @param {object} queryParams - DynamoDB query parameters
   * @param {object} options - Query optimization options
   * @returns {Promise<object>} Query results with pagination info
   */
  async optimizedQuery(queryParams, options = {}) {
    const {
      maxItems = this.MAX_PAGE_SIZE,
      projectionExpression,
      consistentRead = false,
      scanIndexForward = true,
      returnConsumedCapacity = false
    } = options;

    // Optimize projection to reduce data transfer
    const optimizedParams = {
      ...queryParams,
      Limit: Math.min(queryParams.Limit || this.DEFAULT_PAGE_SIZE, maxItems),
      ScanIndexForward: scanIndexForward,
      ConsistentRead: consistentRead
    };

    if (projectionExpression) {
      optimizedParams.ProjectionExpression = projectionExpression;
    }

    if (returnConsumedCapacity) {
      optimizedParams.ReturnConsumedCapacity = 'TOTAL';
    }

    const results = [];
    let lastEvaluatedKey = queryParams.ExclusiveStartKey;
    let totalConsumedCapacity = 0;

    do {
      if (lastEvaluatedKey) {
        optimizedParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      try {
        const result = await docClient.send(new QueryCommand(optimizedParams));
        
        if (result.Items) {
          results.push(...result.Items);
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
        
        if (result.ConsumedCapacity) {
          totalConsumedCapacity += result.ConsumedCapacity.CapacityUnits || 0;
        }

        // Stop if we've reached the maximum items
        if (results.length >= maxItems) {
          break;
        }

        // Adjust limit for next iteration
        const remainingItems = maxItems - results.length;
        optimizedParams.Limit = Math.min(optimizedParams.Limit, remainingItems);

      } catch (error) {
        console.error('Optimized query error:', error);
        throw error;
      }

    } while (lastEvaluatedKey && results.length < maxItems);

    return {
      items: results.slice(0, maxItems),
      lastEvaluatedKey,
      count: results.length,
      hasMore: !!lastEvaluatedKey,
      consumedCapacity: totalConsumedCapacity
    };
  }

  /**
   * Parallel query execution for multiple partition keys
   * @param {Array} queries - Array of query configurations
   * @param {object} options - Parallel query options
   * @returns {Promise<Array>} Array of query results
   */
  async parallelQuery(queries, options = {}) {
    const {
      concurrencyLimit = this.PARALLEL_QUERY_LIMIT,
      failFast = false
    } = options;

    const results = [];
    const errors = [];

    // Process queries in batches to control concurrency
    for (let i = 0; i < queries.length; i += concurrencyLimit) {
      const batch = queries.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (queryConfig, index) => {
        try {
          const result = await this.optimizedQuery(queryConfig.params, queryConfig.options);
          return { success: true, index: i + index, result };
        } catch (error) {
          const errorResult = { success: false, index: i + index, error: error.message };
          if (failFast) {
            throw error;
          }
          return errorResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results[result.index] = result.result;
        } else {
          errors.push({ index: result.index, error: result.error });
        }
      });
    }

    return {
      results,
      errors,
      successCount: results.filter(r => r).length,
      errorCount: errors.length
    };
  }

  /**
   * Optimized transaction write with automatic chunking
   * @param {Array} transactItems - Array of transaction items
   * @param {object} options - Transaction options
   * @returns {Promise<object>} Transaction results
   */
  async optimizedTransactWrite(transactItems, options = {}) {
    if (!transactItems || transactItems.length === 0) {
      return { successful: 0, failed: 0, errors: [] };
    }

    const {
      clientRequestToken,
      returnConsumedCapacity = false
    } = options;

    const chunks = this._chunkArray(transactItems, this.TRANSACTION_LIMIT);
    let successful = 0;
    let failed = 0;
    const errors = [];
    let totalConsumedCapacity = 0;

    // Process chunks sequentially to maintain transaction semantics
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const transactParams = {
          TransactItems: chunk
        };

        if (clientRequestToken) {
          transactParams.ClientRequestToken = `${clientRequestToken}_${i}`;
        }

        if (returnConsumedCapacity) {
          transactParams.ReturnConsumedCapacity = 'TOTAL';
        }

        const result = await docClient.send(new TransactWriteCommand(transactParams));
        
        successful += chunk.length;
        
        if (result.ConsumedCapacity) {
          totalConsumedCapacity += result.ConsumedCapacity.reduce((sum, cap) => 
            sum + (cap.CapacityUnits || 0), 0
          );
        }

      } catch (error) {
        failed += chunk.length;
        errors.push(`Transaction chunk ${i} failed: ${error.message}`);
        
        // For transactions, we might want to fail fast
        if (error.name === 'TransactionCanceledException') {
          console.error('Transaction cancelled, stopping further chunks');
          break;
        }
      }
    }

    return {
      successful,
      failed,
      errors,
      consumedCapacity: totalConsumedCapacity
    };
  }

  /**
   * Efficient item count estimation using query with count
   * @param {object} queryParams - DynamoDB query parameters
   * @returns {Promise<number>} Estimated item count
   */
  async estimateItemCount(queryParams) {
    const countParams = {
      ...queryParams,
      Select: 'COUNT',
      Limit: 1000 // Reasonable limit for count estimation
    };

    let totalCount = 0;
    let lastEvaluatedKey;

    do {
      if (lastEvaluatedKey) {
        countParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      try {
        const result = await docClient.send(new QueryCommand(countParams));
        totalCount += result.Count || 0;
        lastEvaluatedKey = result.LastEvaluatedKey;

        // Limit estimation to prevent excessive queries
        if (totalCount > 10000) {
          break;
        }

      } catch (error) {
        console.error('Count estimation error:', error);
        throw error;
      }

    } while (lastEvaluatedKey);

    return totalCount;
  }

  /**
   * Optimized bulk container move operation
   * @param {Array} containerIds - Array of container IDs
   * @param {string} inventoryId - Inventory ID
   * @param {string} newLocationId - New location ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Bulk move results
   */
  async bulkMoveContainersOptimized(containerIds, inventoryId, newLocationId, userId) {
    if (!containerIds || containerIds.length === 0) {
      throw new Error('No containers specified for bulk move');
    }

    // Step 1: Batch get all containers
    const containerKeys = containerIds.map(id => ({
      pk: `INVENTORY#${inventoryId}#CONTAINERS`,
      sk: id
    }));

    const containers = await this.batchGetItems(containerKeys, {
      projectionExpression: 'pk, sk, #data, locationId, itemCount',
      expressionAttributeNames: { '#data': 'data' }
    });

    if (containers.length !== containerIds.length) {
      throw new Error('Some containers not found');
    }

    // Step 2: Get all items in these containers in parallel
    const itemQueries = containerIds.map(containerId => ({
      params: {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'containerId = :containerId',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`,
          ':containerId': containerId
        },
        ProjectionExpression: 'pk, sk, containerId, locationId'
      },
      options: { maxItems: 1000 }
    }));

    const itemQueryResults = await this.parallelQuery(itemQueries);
    const allItems = itemQueryResults.results.flatMap(result => result?.items || []);

    // Step 3: Prepare batch updates
    const containerUpdates = containers.map(container => ({
      ...container,
      data: {
        ...container.data,
        locationId: newLocationId,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      }
    }));

    const itemUpdates = allItems.map(item => ({
      ...item,
      data: {
        ...item.data,
        locationId: newLocationId,
        previousLocationId: item.data?.locationId,
        updatedAt: new Date().toISOString()
      }
    }));

    // Step 4: Execute batch writes
    const containerWriteResult = await this.batchWriteItems(containerUpdates, 'put');
    const itemWriteResult = await this.batchWriteItems(itemUpdates, 'put');

    return {
      containersUpdated: containerWriteResult.successful,
      itemsUpdated: itemWriteResult.successful,
      totalContainers: containerIds.length,
      totalItems: allItems.length,
      errors: [...containerWriteResult.errors, ...itemWriteResult.errors]
    };
  }

  /**
   * Chunk array into smaller arrays
   * @private
   */
  _chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Sleep utility for backoff delays
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get optimization statistics
   * @returns {object} Optimization statistics
   */
  getOptimizationStats() {
    return {
      batchLimits: {
        batchGet: this.BATCH_GET_LIMIT,
        batchWrite: this.BATCH_WRITE_LIMIT,
        transaction: this.TRANSACTION_LIMIT
      },
      queryLimits: {
        defaultPageSize: this.DEFAULT_PAGE_SIZE,
        maxPageSize: this.MAX_PAGE_SIZE,
        parallelQueryLimit: this.PARALLEL_QUERY_LIMIT
      }
    };
  }
}

module.exports = new DatabaseOptimizationService();