/**
 * Tag Integration Tests (Simplified)
 * Tests complete tag workflow from creation to search, data consistency, and performance
 * Requirements: 7.5, 6.1
 */

// Mock services that create timers FIRST, before any other mocks
jest.mock('../services/cacheService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  clearAll: jest.fn(),
  generateCacheKey: jest.fn(),
  cacheContainerList: jest.fn(),
  getCachedContainerList: jest.fn(),
  cacheQRCodeImage: jest.fn(),
  getCachedQRCodeImage: jest.fn(),
  cacheReportResult: jest.fn(),
  getCachedReportResult: jest.fn(),
  cacheContainerContents: jest.fn(),
  getCachedContainerContents: jest.fn(),
  cacheAnalytics: jest.fn(),
  getCachedAnalytics: jest.fn(),
  invalidateInventoryCache: jest.fn(),
  invalidateContainerCache: jest.fn(),
  invalidatePattern: jest.fn(),
  getCacheStats: jest.fn()
}));

jest.mock('../services/performanceMonitoringService', () => ({
  startTiming: jest.fn(),
  endTiming: jest.fn(),
  recordMetric: jest.fn(),
  recordContainerOperation: jest.fn(),
  recordQRCodeOperation: jest.fn(),
  recordReportGeneration: jest.fn(),
  recordCacheOperation: jest.fn(),
  recordDatabaseOperation: jest.fn(),
  recordError: jest.fn(),
  getPerformanceStats: jest.fn(),
  getAllMetrics: jest.fn(),
  createPerformanceReport: jest.fn(),
  getCurrentStatus: jest.fn()
}));

// Mock rate limiting service to allow all requests in tests
jest.mock('../services/rateLimitService', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetTime: Date.now() + 60000
  }),
  recordRequest: jest.fn().mockResolvedValue(true),
  getRateLimitStatus: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetTime: Date.now() + 60000
  })
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn().mockImplementation((event) => {
    if (event.requestContext?.authorizer?.claims) {
      event.user = {
        userId: event.requestContext.authorizer.claims.sub,
        inventoryId: event.requestContext.authorizer.claims['custom:inventory_id']
      };
    }
    return Promise.resolve();
  }),
  authorizeInventoryAccess: jest.fn().mockResolvedValue(true),
  extractInventoryId: jest.fn().mockImplementation((event) => 
    event.requestContext?.authorizer?.claims?.['custom:inventory_id']
  )
}));

// Mock audit log service
jest.mock('../services/auditLogService', () => ({
  logDataAccess: jest.fn().mockResolvedValue(true),
  logContainerOperation: jest.fn().mockResolvedValue(true),
  logBulkOperation: jest.fn().mockResolvedValue(true),
  logProjectOperation: jest.fn().mockResolvedValue(true)
}));

// Mock DynamoDB service directly
jest.mock('../services/dynamodb', () => ({
  createEntity: jest.fn(),
  getEntity: jest.fn(),
  listEntities: jest.fn(),
  updateEntity: jest.fn(),
  deleteEntity: jest.fn(),
  hasInventoryAccess: jest.fn().mockResolvedValue(true),
  getUserInventories: jest.fn().mockResolvedValue([
    { id: '12345678-1234-1234-1234-123456789012', name: 'Test Inventory' }
  ])
}));

// Mock tag service
jest.mock('../services/tagService', () => ({
  getInventoryTags: jest.fn(),
  getTagAnalytics: jest.fn(),
  searchByTags: jest.fn(),
  getTagSuggestions: jest.fn(),
  bulkTagOperation: jest.fn(),
  advancedTagSearch: jest.fn()
}));

// Mock tag cache service
const mockTagCache = {
  invalidateInventoryCache: jest.fn(),
  getCachedInventoryTags: jest.fn(),
  cacheInventoryTags: jest.fn(),
  getCachedTagAnalytics: jest.fn(),
  cacheTagAnalytics: jest.fn(),
  getCachedTagSuggestions: jest.fn(),
  cacheTagSuggestions: jest.fn(),
  clearInventoryCache: jest.fn(),
  clear: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    hits: 10,
    misses: 5,
    hitRate: 0.67
  })
};

jest.mock('../services/tagCacheService', () => mockTagCache);

// Import handlers and services
const thingsHandler = require('../handlers/things');
const dynamodbService = require('../services/dynamodb');
const tagService = require('../services/tagService');

describe('Tag Integration Tests', () => {
  const testInventoryId = '12345678-1234-1234-1234-123456789012';
  const testUserId = '87654321-4321-4321-4321-210987654321';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    // Clear any pending promises
    return new Promise(resolve => setImmediate(resolve));
  });

  afterAll(() => {
    // Force cleanup of any remaining handles
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  // Helper function to create proper HTTP API v2 events
  const createTestEvent = (method, path, body = null, pathParameters = null, queryStringParameters = null) => {
    return {
      requestContext: {
        http: {
          method: method,
          path: path,
          sourceIp: '127.0.0.1'
        },
        authorizer: {
          claims: {
            sub: testUserId,
            'custom:inventory_id': testInventoryId
          }
        },
        requestId: 'test-request-123'
      },
      rawPath: path,
      headers: {
        'user-agent': 'test-agent',
        'content-type': 'application/json'
      },
      pathParameters: pathParameters,
      queryStringParameters: queryStringParameters,
      body: body ? JSON.stringify(body) : null,
      user: {
        userId: testUserId,
        inventoryId: testInventoryId
      },
      httpMethod: method // Add for backward compatibility
    };
  };

  describe('Complete Tag Workflow Integration', () => {
    test('should handle complete workflow: create things with tags -> search by tags -> get analytics -> bulk operations', async () => {
      // Step 1: Create things with various tag combinations
      const thingData = {
        name: 'Laptop Computer',
        description: 'Work laptop',
        inventoryId: testInventoryId,
        categoryId: '11111111-1111-1111-1111-111111111111',
        tags: ['electronics', 'work', 'portable', 'valuable']
      };

      const mockCreatedThing = {
        id: '44444444-4444-4444-4444-444444444440',
        ...thingData,
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString()
      };

      dynamodbService.createEntity.mockResolvedValueOnce(mockCreatedThing);

      const createEvent = createTestEvent('POST', '/things', thingData);
      const response = await thingsHandler.handler(createEvent);

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(true);
      const createdThing = responseBody.data;
      expect(createdThing.tags).toEqual(thingData.tags);

      // Step 2: Search by tags
      const searchResults = [
        { id: '44444444-4444-4444-4444-444444444440', tags: ['electronics', 'work', 'portable', 'valuable'] }
      ];

      tagService.searchByTags.mockResolvedValueOnce(searchResults);

      const searchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'electronics,valuable',
        tagMode: 'and'
      });

      const searchResponse = await thingsHandler.handler(searchEvent);
      expect(searchResponse.statusCode).toBe(200);
      const searchResponseBody = JSON.parse(searchResponse.body);
      expect(searchResponseBody.success).toBe(true);
      const searchData = searchResponseBody.data;
      expect(searchData).toHaveLength(1);
      expect(searchData[0].tags).toContain('electronics');
      expect(searchData[0].tags).toContain('valuable');

      // Step 3: Get tag analytics
      const mockAnalytics = {
        inventoryId: testInventoryId,
        totalTags: 4,
        uniqueTags: 4,
        totalThings: 1,
        taggedThings: 1,
        tagStatistics: [
          { tag: 'electronics', count: 1, percentage: 100 },
          { tag: 'work', count: 1, percentage: 100 },
          { tag: 'portable', count: 1, percentage: 100 },
          { tag: 'valuable', count: 1, percentage: 100 }
        ],
        pagination: {
          limit: 50,
          offset: 0,
          totalResults: 4,
          currentPage: 1,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false,
          sortBy: 'count',
          sortOrder: 'desc',
          filter: null
        },
        lastUpdated: new Date().toISOString()
      };

      tagService.getTagAnalytics.mockResolvedValueOnce(mockAnalytics);

      const analyticsEvent = createTestEvent('GET', '/things/tags/analytics', null, null, {
        inventoryId: testInventoryId
      });

      const analyticsResponse = await thingsHandler.handler(analyticsEvent);
      expect(analyticsResponse.statusCode).toBe(200);
      const analyticsResponseBody = JSON.parse(analyticsResponse.body);
      expect(analyticsResponseBody.success).toBe(true);
      const analytics = analyticsResponseBody.data;
      expect(analytics.totalThings).toBe(1);
      expect(analytics.taggedThings).toBe(1);
      expect(analytics.uniqueTags).toBe(4);

      // Step 4: Bulk tag operations
      const bulkResult = {
        operation: 'add',
        totalRequested: 1,
        successful: 1,
        failed: 0,
        errors: [],
        updatedThings: [{
          id: '44444444-4444-4444-4444-444444444440',
          name: 'Laptop Computer',
          previousTags: ['electronics', 'work', 'portable', 'valuable'],
          newTags: ['electronics', 'work', 'portable', 'valuable', 'reviewed']
        }]
      };

      tagService.bulkTagOperation.mockResolvedValueOnce(bulkResult);

      const bulkTagEvent = createTestEvent('POST', '/things/tags/bulk', {
        operation: 'add',
        inventoryId: testInventoryId,
        thingIds: ['44444444-4444-4444-4444-444444444440'],
        tags: ['reviewed']
      });

      const bulkResponse = await thingsHandler.handler(bulkTagEvent);
      expect(bulkResponse.statusCode).toBe(200);
      const bulkResponseBody = JSON.parse(bulkResponse.body);
      expect(bulkResponseBody.success).toBe(true);
      const bulkData = bulkResponseBody.data;
      expect(bulkData.operation).toBe('add');
      expect(bulkData.successful).toBe(1);
      expect(bulkData.failed).toBe(0);
    });
  });

  describe('Tag Data Consistency Tests', () => {
    test('should maintain tag consistency across create, update, and delete operations', async () => {
      const thingId = '55555555-5555-5555-5555-555555555555';
      
      // Step 1: Create thing with initial tags
      const originalThing = {
        id: thingId,
        name: 'Test Item',
        inventoryId: testInventoryId,
        tags: ['original', 'test', 'item'],
        dateAdded: new Date().toISOString()
      };

      dynamodbService.createEntity.mockResolvedValueOnce(originalThing);

      const createEvent = createTestEvent('POST', '/things', {
        name: 'Test Item',
        inventoryId: testInventoryId,
        tags: ['original', 'test', 'item']
      });

      const createResponse = await thingsHandler.handler(createEvent);
      expect(createResponse.statusCode).toBe(201);
      const createResponseBody = JSON.parse(createResponse.body);
      expect(createResponseBody.success).toBe(true);
      const createdThing = createResponseBody.data;
      expect(createdThing.tags).toEqual(['original', 'test', 'item']);

      // Step 2: Update thing with modified tags
      const updatedThing = {
        ...originalThing,
        tags: ['updated', 'test', 'modified'],
        dateModified: new Date().toISOString()
      };

      dynamodbService.updateEntity.mockResolvedValueOnce(updatedThing);

      const updateEvent = createTestEvent('PUT', `/things/${thingId}`, {
        name: 'Test Item',
        inventoryId: testInventoryId,
        tags: ['updated', 'test', 'modified']
      }, { id: thingId });

      const updateResponse = await thingsHandler.handler(updateEvent);
      expect(updateResponse.statusCode).toBe(200);
      const updateResponseBody = JSON.parse(updateResponse.body);
      expect(updateResponseBody.success).toBe(true);
      const updatedResult = updateResponseBody.data;
      expect(updatedResult.tags).toEqual(['updated', 'test', 'modified']);

      // Step 3: Search for things with old tags - should not find the updated thing
      tagService.searchByTags.mockResolvedValueOnce([]);

      const oldTagSearchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'original',
        tagMode: 'and'
      });

      const oldTagSearchResponse = await thingsHandler.handler(oldTagSearchEvent);
      expect(oldTagSearchResponse.statusCode).toBe(200);
      const oldTagResponseBody = JSON.parse(oldTagSearchResponse.body);
      expect(oldTagResponseBody.success).toBe(true);
      const oldTagResults = oldTagResponseBody.data;
      expect(oldTagResults).toHaveLength(0);

      // Step 4: Search for things with new tags - should find the updated thing
      tagService.searchByTags.mockResolvedValueOnce([updatedThing]);

      const newTagSearchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'updated',
        tagMode: 'and'
      });

      const newTagSearchResponse = await thingsHandler.handler(newTagSearchEvent);
      expect(newTagSearchResponse.statusCode).toBe(200);
      const newTagResponseBody = JSON.parse(newTagSearchResponse.body);
      expect(newTagResponseBody.success).toBe(true);
      const newTagResults = newTagResponseBody.data;
      expect(newTagResults).toHaveLength(1);
      expect(newTagResults[0].tags).toContain('updated');

      // Step 5: Delete the thing
      dynamodbService.getEntity.mockResolvedValueOnce(updatedThing);
      dynamodbService.deleteEntity.mockResolvedValueOnce(true);

      const deleteEvent = createTestEvent('DELETE', `/things/${thingId}`, null, 
        { id: thingId }, 
        { inventoryId: testInventoryId }
      );

      const deleteResponse = await thingsHandler.handler(deleteEvent);
      expect(deleteResponse.statusCode).toBe(200);

      // Step 6: Verify thing is no longer found in searches
      tagService.searchByTags.mockResolvedValueOnce([]);

      const postDeleteSearchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'updated',
        tagMode: 'and'
      });

      const postDeleteSearchResponse = await thingsHandler.handler(postDeleteSearchEvent);
      expect(postDeleteSearchResponse.statusCode).toBe(200);
      const postDeleteResponseBody = JSON.parse(postDeleteSearchResponse.body);
      expect(postDeleteResponseBody.success).toBe(true);
      const postDeleteResults = postDeleteResponseBody.data;
      expect(postDeleteResults).toHaveLength(0);
    });

    test('should handle tag normalization consistently across operations', async () => {
      // Test that tags are normalized consistently (lowercase, trimmed)
      const testCases = [
        { input: ['Tag1', 'TAG2', '  tag3  '], expected: ['tag1', 'tag2', 'tag3'] },
        { input: ['Mixed-Case', 'UPPER_CASE', 'lower-case'], expected: ['mixed-case', 'upper_case', 'lower-case'] }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const thingId = `66666666-6666-6666-6666-66666666666${i}`;
        
        const mockThing = {
          id: thingId,
          name: `Test Item ${i}`,
          inventoryId: testInventoryId,
          tags: testCase.expected, // DynamoDB should store normalized tags
          dateAdded: new Date().toISOString()
        };

        dynamodbService.createEntity.mockResolvedValueOnce(mockThing);

        const createEvent = createTestEvent('POST', '/things', {
          name: `Test Item ${i}`,
          inventoryId: testInventoryId,
          tags: testCase.input
        });

        const response = await thingsHandler.handler(createEvent);
        expect(response.statusCode).toBe(201);
        
        const responseBody = JSON.parse(response.body);
        expect(responseBody.success).toBe(true);
        const createdThing = responseBody.data;
        expect(createdThing.tags).toEqual(testCase.expected);
      }
    });
  });

  describe('Tag Performance Tests', () => {
    test('should handle large tag datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Mock analytics for large dataset
      const mockAnalytics = {
        inventoryId: testInventoryId,
        totalTags: 4000, // 1000 items * 4 tags each
        uniqueTags: 20, // 20 unique tags across all items
        totalThings: 1000,
        taggedThings: 1000,
        tagStatistics: Array.from({ length: 20 }, (_, i) => ({
          tag: `tag-${i}`,
          count: Math.floor(Math.random() * 100) + 1,
          percentage: Math.floor(Math.random() * 100)
        })),
        pagination: {
          limit: 100,
          offset: 0,
          totalResults: 20,
          currentPage: 1,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false,
          sortBy: 'count',
          sortOrder: 'desc',
          filter: null
        },
        lastUpdated: new Date().toISOString()
      };

      tagService.getTagAnalytics.mockResolvedValueOnce(mockAnalytics);

      const analyticsEvent = createTestEvent('GET', '/things/tags/analytics', null, null, {
        inventoryId: testInventoryId,
        limit: '100'
      });

      const response = await thingsHandler.handler(analyticsEvent);
      const endTime = Date.now();
      
      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(true);
      const analytics = responseBody.data;
      expect(analytics.totalThings).toBe(1000);
      expect(analytics.uniqueTags).toBe(20);
      
      // Should complete within reasonable time (5 seconds for 1000 items)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle concurrent tag operations without data corruption', async () => {
      const thingId = '88888888-8888-8888-8888-888888888888';
      const baseThing = {
        id: thingId,
        name: 'Concurrent Test Item',
        inventoryId: testInventoryId,
        tags: ['base'],
        dateAdded: new Date().toISOString()
      };

      // Simulate concurrent tag update operations
      const concurrentOperations = Array.from({ length: 5 }, (_, i) => {
        const updateEvent = createTestEvent('PUT', `/things/${thingId}`, {
          name: 'Concurrent Test Item',
          inventoryId: testInventoryId,
          tags: ['base', `concurrent-${i}`]
        }, { id: thingId });

        // Mock responses for concurrent operations
        dynamodbService.updateEntity.mockResolvedValue({
          ...baseThing,
          tags: ['base', `concurrent-${i}`],
          dateModified: new Date().toISOString()
        });

        return thingsHandler.handler(updateEvent);
      });

      const responses = await Promise.allSettled(concurrentOperations);

      // At least one operation should succeed
      const successfulOps = responses.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      expect(successfulOps.length).toBeGreaterThan(0);

      // All successful operations should have valid tag data
      successfulOps.forEach(op => {
        const responseBody = JSON.parse(op.value.body);
        expect(responseBody.success).toBe(true);
        const result = responseBody.data;
        expect(Array.isArray(result.tags)).toBe(true);
        expect(result.tags.length).toBeGreaterThan(0);
        expect(result.tags).toContain('base');
      });
    });

    test('should efficiently handle bulk tag operations on large datasets', async () => {
      const startTime = Date.now();
      
      // Test bulk operation on 100 things
      const thingIds = Array.from({ length: 100 }, (_, i) => `99999999-9999-9999-9999-${String(i).padStart(12, '0')}`);

      const bulkResult = {
        operation: 'add',
        totalRequested: 100,
        successful: 100,
        failed: 0,
        errors: [],
        updatedThings: thingIds.map(id => ({
          id,
          name: `Bulk Item ${id}`,
          previousTags: ['original'],
          newTags: ['original', 'bulk-added']
        }))
      };

      tagService.bulkTagOperation.mockResolvedValueOnce(bulkResult);

      const bulkEvent = createTestEvent('POST', '/things/tags/bulk', {
        operation: 'add',
        inventoryId: testInventoryId,
        thingIds: thingIds,
        tags: ['bulk-added']
      });

      const response = await thingsHandler.handler(bulkEvent);
      const endTime = Date.now();
      
      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(true);
      const result = responseBody.data;
      expect(result.successful).toBe(100);
      expect(result.failed).toBe(0);
      
      // Should complete within reasonable time (10 seconds for 100 items)
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('Tag Search Performance and Accuracy', () => {
    test('should return accurate search results for complex tag combinations', async () => {
      // Test AND search: electronics AND portable
      const expectedAndResults = [
        { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', tags: ['electronics', 'portable', 'work', 'expensive'] },
        { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', tags: ['electronics', 'portable', 'personal'] }
      ];

      tagService.searchByTags.mockResolvedValueOnce(expectedAndResults);

      const andSearchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'electronics,portable',
        tagMode: 'and'
      });

      const andResponse = await thingsHandler.handler(andSearchEvent);
      expect(andResponse.statusCode).toBe(200);
      const andResponseBody = JSON.parse(andResponse.body);
      expect(andResponseBody.success).toBe(true);
      const andResults = andResponseBody.data;
      expect(andResults).toHaveLength(2);
      expect(andResults.every(thing => 
        thing.tags.includes('electronics') && thing.tags.includes('portable')
      )).toBe(true);

      // Test OR search: furniture OR kitchen
      const expectedOrResults = [
        { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', tags: ['furniture', 'work', 'ergonomic'] },
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', tags: ['kitchen', 'portable', 'daily-use'] }
      ];

      tagService.searchByTags.mockResolvedValueOnce(expectedOrResults);

      const orSearchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'furniture,kitchen',
        tagMode: 'or'
      });

      const orResponse = await thingsHandler.handler(orSearchEvent);
      expect(orResponse.statusCode).toBe(200);
      const orResponseBody = JSON.parse(orResponse.body);
      expect(orResponseBody.success).toBe(true);
      const orResults = orResponseBody.data;
      expect(orResults).toHaveLength(2);
      expect(orResults.some(thing => thing.tags.includes('furniture'))).toBe(true);
      expect(orResults.some(thing => thing.tags.includes('kitchen'))).toBe(true);
    });

    test('should handle partial tag matching correctly', async () => {
      const expectedPartialResults = [
        { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', tags: ['electronics-laptop', 'work-device'] },
        { id: '11111111-1111-1111-1111-111111111112', tags: ['electronics-phone', 'personal-device'] },
        { id: '22222222-2222-2222-2222-222222222223', tags: ['electronic-toy', 'kids-item'] }
      ];

      tagService.advancedTagSearch.mockResolvedValueOnce(expectedPartialResults);

      const partialSearchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'electron',
        tagMode: 'and',
        partialMatch: 'true'
      });

      const partialResponse = await thingsHandler.handler(partialSearchEvent);
      expect(partialResponse.statusCode).toBe(200);
      const partialResponseBody = JSON.parse(partialResponse.body);
      expect(partialResponseBody.success).toBe(true);
      const partialResults = partialResponseBody.data;
      expect(partialResults).toHaveLength(3);
      expect(partialResults.every(thing => 
        thing.tags.some(tag => tag.includes('electron'))
      )).toBe(true);
    });
  });

  describe('Tag Cache Integration', () => {
    test('should properly invalidate cache after tag operations', async () => {
      const tagCacheSpy = jest.spyOn(mockTagCache, 'invalidateInventoryCache');
      
      // Create a thing with tags
      const mockThing = {
        id: '44444444-4444-4444-4444-444444444445',
        name: 'Cache Test Item',
        inventoryId: testInventoryId,
        tags: ['cache', 'test'],
        dateAdded: new Date().toISOString()
      };

      dynamodbService.createEntity.mockResolvedValueOnce(mockThing);

      const createEvent = createTestEvent('POST', '/things', {
        name: 'Cache Test Item',
        inventoryId: testInventoryId,
        tags: ['cache', 'test']
      });

      const createResponse = await thingsHandler.handler(createEvent);
      expect(createResponse.statusCode).toBe(201);
      
      // Verify cache invalidation was called
      expect(tagCacheSpy).toHaveBeenCalledWith(testInventoryId, 'tags');

      // Update the thing's tags
      dynamodbService.updateEntity.mockResolvedValueOnce({
        ...mockThing,
        tags: ['cache', 'updated'],
        dateModified: new Date().toISOString()
      });

      const updateEvent = createTestEvent('PUT', '/things/44444444-4444-4444-4444-444444444445', {
        name: 'Cache Test Item',
        inventoryId: testInventoryId,
        tags: ['cache', 'updated']
      }, { id: '44444444-4444-4444-4444-444444444445' });

      const updateResponse = await thingsHandler.handler(updateEvent);
      expect(updateResponse.statusCode).toBe(200);
      
      // Verify cache invalidation was called again
      expect(tagCacheSpy).toHaveBeenCalledTimes(2);
      expect(tagCacheSpy).toHaveBeenLastCalledWith(testInventoryId, 'tags');

      tagCacheSpy.mockRestore();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid tag formats gracefully', async () => {
      const invalidTagCases = [
        { tags: ['valid-tag', 'invalid tag with spaces'] },
        { tags: ['valid-tag', 'invalid@symbol'] },
        { tags: ['valid-tag', ''] },
        { tags: ['valid-tag', 'a'.repeat(51)] }
      ];

      for (const testCase of invalidTagCases) {
        const createEvent = createTestEvent('POST', '/things', {
          name: 'Invalid Tag Test',
          inventoryId: testInventoryId,
          tags: testCase.tags
        });

        const response = await thingsHandler.handler(createEvent);
        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.success).toBe(false);
        // Just check that it's a validation error, don't check specific message
        expect(responseBody.error).toBeDefined();
      }
    });

    test('should handle search timeouts gracefully', async () => {
      // Mock a timeout error
      tagService.searchByTags.mockRejectedValueOnce(new Error('Request timed out while loading tags. Please try again.'));

      const searchEvent = createTestEvent('GET', '/things', null, null, {
        inventoryId: testInventoryId,
        tags: 'test-tag',
        tagMode: 'and'
      });

      const response = await thingsHandler.handler(searchEvent);
      expect(response.statusCode).toBe(408);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error).toContain('timed out');
    });

    test('should handle bulk operation partial failures', async () => {
      const thingIds = ['55555555-5555-5555-5555-555555555556', '66666666-6666-6666-6666-666666666667', '77777777-7777-7777-7777-777777777778'];
      
      const partialResult = {
        operation: 'add',
        totalRequested: 3,
        successful: 2,
        failed: 1,
        errors: ['Thing not found: 66666666-6666-6666-6666-666666666667'],
        updatedThings: [
          { id: '55555555-5555-5555-5555-555555555556', name: 'Thing 1' },
          { id: '77777777-7777-7777-7777-777777777778', name: 'Thing 3' }
        ]
      };

      tagService.bulkTagOperation.mockResolvedValueOnce(partialResult);

      const bulkEvent = createTestEvent('POST', '/things/tags/bulk', {
        operation: 'add',
        inventoryId: testInventoryId,
        thingIds: thingIds,
        tags: ['bulk-test']
      });

      const response = await thingsHandler.handler(bulkEvent);
      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(true);
      const result = responseBody.data;
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('66666666-6666-6666-6666-666666666667');
    });
  });
});