// Mock for cache service
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();
const mockInvalidatePattern = jest.fn();

const cacheService = {
  get: mockGet,
  set: mockSet,
  delete: mockDelete,
  invalidatePattern: mockInvalidatePattern,
  getCachedContainerList: jest.fn(),
  cacheContainerList: jest.fn(),
  getCachedContainerContents: jest.fn(),
  cacheContainerContents: jest.fn(),
  getCachedQRCodeImage: jest.fn(),
  cacheQRCodeImage: jest.fn(),
  getCachedReportResult: jest.fn(),
  cacheReportResult: jest.fn(),
  invalidateInventoryCache: jest.fn(),
  invalidateContainerCache: jest.fn(),
  
  // Reset all mocks
  __resetMocks: () => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockDelete.mockReset();
    mockInvalidatePattern.mockReset();
  }
};

module.exports = cacheService;