// Jest setup file for backend tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.TABLE_NAME = 'test-table';
process.env.BUCKET_NAME = 'test-bucket';
process.env.QR_REPORT_BUCKET_NAME = 'test-qr-report-bucket';
process.env.USER_POOL_ID = 'us-east-1_TestPool';
process.env.USER_POOL_CLIENT_ID = 'test-client-id';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.SECURITY_LOG_GROUP = '/aws/lambda/test-security-logs';
process.env.EMBEDDINGS_TABLE_NAME = 'test-embeddings-table';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  error: jest.fn(),
  warn: jest.fn(),
  // Silence info and log
  info: jest.fn(),
  log: jest.fn(),
};

// Mock setInterval and setTimeout globally to prevent timers from hanging tests
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;
const originalClearInterval = global.clearInterval;
const originalClearTimeout = global.clearTimeout;

let timerIds = new Set();

global.setInterval = jest.fn((callback, delay, ...args) => {
  // Don't actually create intervals in tests
  return Symbol('mock-interval');
});

global.setTimeout = jest.fn((callback, delay, ...args) => {
  // Don't actually create timeouts in tests
  return Symbol('mock-timeout');
});

global.clearInterval = jest.fn();
global.clearTimeout = jest.fn();

// Mock the services that create timers at module load time
// This must be done before any test files import these services
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

// Restore timers after all tests
afterAll(() => {
  global.setInterval = originalSetInterval;
  global.setTimeout = originalSetTimeout;
  global.clearInterval = originalClearInterval;
  global.clearTimeout = originalClearTimeout;
});