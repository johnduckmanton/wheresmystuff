// Mock for performance monitoring service
const mockStartTiming = jest.fn();
const mockEndTiming = jest.fn();
const mockRecordMetric = jest.fn();
const mockRecordError = jest.fn();

const performanceMonitoringService = {
  startTiming: mockStartTiming,
  endTiming: mockEndTiming,
  recordMetric: mockRecordMetric,
  recordError: mockRecordError,
  recordContainerOperation: jest.fn(),
  recordQRCodeOperation: jest.fn(),
  recordReportGeneration: jest.fn(),
  recordCacheOperation: jest.fn(),
  recordDatabaseOperation: jest.fn(),
  
  // Reset all mocks
  __resetMocks: () => {
    mockStartTiming.mockReset();
    mockEndTiming.mockReset();
    mockRecordMetric.mockReset();
    mockRecordError.mockReset();
  }
};

module.exports = performanceMonitoringService;