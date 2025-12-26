# AWS SDK v3 Mocking Guide for Jest

## The Problem

AWS SDK v3 uses ES6 modules and a different architecture than v2, which requires different mocking patterns. The common issues are:

1. **Module Import Order**: Mocks must be defined before imports
2. **Constructor vs Factory Pattern**: SDK v3 uses factory functions
3. **Command Pattern**: SDK v3 uses command objects instead of method calls

## The Solution

### 1. Proper Mock Setup Pattern

```javascript
// ❌ WRONG - Mocking after import
const service = require('../services/myService');
jest.mock('@aws-sdk/lib-dynamodb');

// ✅ CORRECT - Mock before any imports
const mockSend = jest.fn();
const mockDocClient = { send: mockSend };

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient)
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  BatchWriteCommand: jest.fn()
}));

// Now import services
const service = require('../services/myService');
```

### 2. Complete Mock Template

Create this file as `backend/tests/__mocks__/aws-sdk-v3.js`:

```javascript
// Shared mock for AWS SDK v3
const mockSend = jest.fn();
const mockDocClient = { send: mockSend };
const mockS3Client = { send: jest.fn() };

const awsSdkMocks = {
  // DynamoDB mocks
  '@aws-sdk/client-dynamodb': {
    DynamoDBClient: jest.fn(() => ({}))
  },
  
  '@aws-sdk/lib-dynamodb': {
    DynamoDBDocumentClient: {
      from: jest.fn(() => mockDocClient)
    },
    PutCommand: jest.fn(),
    GetCommand: jest.fn(),
    UpdateCommand: jest.fn(),
    DeleteCommand: jest.fn(),
    QueryCommand: jest.fn(),
    ScanCommand: jest.fn(),
    BatchWriteCommand: jest.fn()
  },
  
  // S3 mocks
  '@aws-sdk/client-s3': {
    S3Client: jest.fn(() => mockS3Client),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn()
  },
  
  // S3 Presigner mocks
  '@aws-sdk/s3-request-presigner': {
    getSignedUrl: jest.fn()
  }
};

// Helper functions
const getMockDocClient = () => mockDocClient;
const getMockS3Client = () => mockS3Client;
const getMockSend = () => mockSend;

module.exports = {
  awsSdkMocks,
  getMockDocClient,
  getMockS3Client,
  getMockSend
};
```

### 3. Using the Mock Template

```javascript
// At the top of your test file
const { awsSdkMocks, getMockDocClient, getMockSend } = require('./__mocks__/aws-sdk-v3');

// Apply all mocks
Object.keys(awsSdkMocks).forEach(module => {
  jest.mock(module, () => awsSdkMocks[module]);
});

// Now import your services
const myService = require('../services/myService');

describe('My Service Tests', () => {
  const mockSend = getMockSend();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
  });
  
  test('should work correctly', async () => {
    // Mock the DynamoDB response
    mockSend.mockResolvedValue({
      Item: { id: 'test-123', name: 'Test Item' }
    });
    
    const result = await myService.getItem('test-123');
    
    expect(result).toBeDefined();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
```

## Fixing Existing Tests

### Step 1: Update Jest Configuration

Add to `backend/jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  
  // Add this to handle ES6 modules
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Mock AWS SDK modules globally
  moduleNameMapper: {
    '@aws-sdk/(.*)': '<rootDir>/tests/__mocks__/@aws-sdk/$1'
  }
};
```

### Step 2: Create Global Setup

Update `backend/tests/setup.js`:

```javascript
// Global test setup
const { awsSdkMocks } = require('./__mocks__/aws-sdk-v3');

// Apply AWS SDK mocks globally
Object.keys(awsSdkMocks).forEach(module => {
  jest.mock(module, () => awsSdkMocks[module]);
});

// Set environment variables for tests
process.env.TABLE_NAME = 'test-table';
process.env.AWS_REGION = 'us-east-1';
```

### Step 3: Fix Individual Test Files

For each failing test file:

1. **Move mocks to the top**
2. **Use the shared mock pattern**
3. **Import services after mocks**
4. **Use mockSend instead of trying to mock DynamoDBDocumentClient.from**

## Example: Fixed Container Sharing Test

```javascript
// Fixed version of containerSharing.test.js
const { getMockSend, getMockDocClient } = require('./__mocks__/aws-sdk-v3');

// Mock other services
jest.mock('../services/containerService');
jest.mock('../services/auditLogService');

// Import after mocking
const containerSharingService = require('../services/containerSharingService');
const containerService = require('../services/containerService');

describe('Container Sharing Service', () => {
  const mockSend = getMockSend();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
  });
  
  test('should create sharing link', async () => {
    containerService.getContainer = jest.fn().mockResolvedValue({
      id: 'container-123',
      name: 'Test Container'
    });
    
    mockSend.mockResolvedValue({});
    
    const result = await containerSharingService.createSharingLink(
      'container-123',
      'inventory-123',
      'user-123'
    );
    
    expect(result).toBeDefined();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
```

## Common Patterns

### Testing DynamoDB Operations

```javascript
test('should save item to DynamoDB', async () => {
  mockSend.mockResolvedValue({});
  
  await service.saveItem({ id: 'test', name: 'Test' });
  
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({
        TableName: 'test-table',
        Item: expect.objectContaining({
          id: 'test',
          name: 'Test'
        })
      })
    })
  );
});
```

### Testing S3 Operations

```javascript
test('should upload to S3', async () => {
  const mockS3Send = getMockS3Client().send;
  mockS3Send.mockResolvedValue({
    Location: 'https://s3.amazonaws.com/bucket/key'
  });
  
  const result = await service.uploadFile('test.txt', 'content');
  
  expect(result.Location).toBeDefined();
  expect(mockS3Send).toHaveBeenCalledTimes(1);
});
```

## Troubleshooting

### Issue: "Cannot read properties of undefined"
**Solution**: Make sure mocks are defined before imports

### Issue: "mockReturnValue is not a function"
**Solution**: Use the shared mock pattern instead of trying to mock after import

### Issue: "Module not found"
**Solution**: Check that all AWS SDK modules are properly mocked

### Issue: "Jest did not exit"
**Solution**: Add proper cleanup in afterEach/afterAll hooks

## Quick Fix Script

Run this to fix all existing test files:

```bash
# Create the shared mock
mkdir -p backend/tests/__mocks__
# Copy the aws-sdk-v3.js mock file

# Update each failing test file to use the new pattern
# This can be done manually or with a script
```

This approach will fix all the DynamoDB mocking issues you're experiencing.