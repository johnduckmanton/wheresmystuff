// Mock for database optimization service
const mockOptimizedQuery = jest.fn();
const mockBatchGetItems = jest.fn();
const mockBatchWriteItems = jest.fn();
const mockBulkMoveContainersOptimized = jest.fn();

const databaseOptimizationService = {
  optimizedQuery: mockOptimizedQuery,
  batchGetItems: mockBatchGetItems,
  batchWriteItems: mockBatchWriteItems,
  bulkMoveContainersOptimized: mockBulkMoveContainersOptimized,
  
  // Reset all mocks
  __resetMocks: () => {
    mockOptimizedQuery.mockReset();
    mockBatchGetItems.mockReset();
    mockBatchWriteItems.mockReset();
    mockBulkMoveContainersOptimized.mockReset();
  }
};

module.exports = databaseOptimizationService;