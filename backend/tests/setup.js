// Jest setup file for backend tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.SECURITY_LOG_GROUP = '/aws/lambda/test-security-logs';

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