const fc = require('fast-check');

// Mock all dependencies
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('../services/s3');
jest.mock('../services/inventoryService');
jest.mock('../middleware/auth');
jest.mock('../utils/validation');

// Import after mocking
const { handler } = require('../handlers/photo');

describe('Photo Property Tests', () => {
  let mockAuthenticate, mockAuthorizeInventoryAccess, mockHasInventoryAccess;
  let mockGenerateUploadUrl, mockGenerateDownloadUrl, mockDeleteObject;
  let mockValidateUUID;

  beforeEach(() => {
    // Get mock functions
    mockAuthenticate = require('../middleware/auth').authenticate;
    mockAuthorizeInventoryAccess = require('../middleware/auth').authorizeInventoryAccess;
    mockHasInventoryAccess = require('../services/inventoryService').hasInventoryAccess;
    mockGenerateUploadUrl = require('../services/s3').generateUploadUrl;
    mockGenerateDownloadUrl = require('../services/s3').generateDownloadUrl;
    mockDeleteObject = require('../services/s3').deleteObject;
    mockValidateUUID = require('../utils/validation').validateUUID;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up default mock behaviors
    mockAuthenticate.mockResolvedValue({});
    mockAuthorizeInventoryAccess.mockResolvedValue({});
    mockHasInventoryAccess.mockResolvedValue(true);
    mockGenerateUploadUrl.mockResolvedValue('https://example.com/upload-url');
    mockGenerateDownloadUrl.mockResolvedValue('https://example.com/download-url');
    mockDeleteObject.mockResolvedValue({});
    mockValidateUUID.mockReturnValue(true);
  });

  /**
   * Feature: security-enhancements, Property 12: Upload URLs include user identifier
   * 
   * Property 12: Upload URLs include user identifier
   * For any photo upload operation, the generated presigned URL should include the user's 
   * identifier in the S3 key path.
   * Validates: Requirements 3.1
   */
  test('Property 12: Upload URLs include user identifier', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random inventory ID (UUID format)
        fc.uuid(),
        // Generate random entity ID (UUID format)
        fc.uuid(),
        // Generate random file name
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // Generate random content type
        fc.constantFrom('image/jpeg', 'image/png', 'image/gif'),
        
        async (userId, inventoryId, entityId, fileName, contentType) => {
          // Reset mocks for this iteration
          jest.clearAllMocks();
          
          // Arrange: Create mock event for upload request
          const mockEvent = {
            requestContext: {
              http: {
                method: 'POST'
              }
            },
            headers: {
              Authorization: 'Bearer mock-token'
            },
            body: JSON.stringify({
              fileName: fileName.trim(),
              contentType: contentType,
              inventoryId: inventoryId,
              entityId: entityId
            }),
            user: {
              userId: userId,
              email: 'test@example.com',
              username: 'testuser'
            }
          };

          // Set up mocks to simulate successful authentication and authorization
          mockAuthenticate.mockImplementation((event) => {
            event.user = mockEvent.user;
            return Promise.resolve(event);
          });
          
          mockGenerateUploadUrl.mockResolvedValue('https://example.com/upload-url');

          // Act: Call the photo handler
          const result = await handler(mockEvent);

          // Assert: Verify successful response
          expect(result.statusCode).toBe(201);
          const responseBody = JSON.parse(result.body);
          expect(responseBody.success).toBe(true);
          expect(responseBody.data.uploadUrl).toBeDefined();
          expect(responseBody.data.key).toBeDefined();
          expect(responseBody.data.expiresIn).toBe(900); // 15 minutes

          // Assert: Verify generateUploadUrl was called with correct parameters
          expect(mockGenerateUploadUrl).toHaveBeenCalledTimes(1);
          const [key, calledContentType, secure] = mockGenerateUploadUrl.mock.calls[0];
          
          // Assert: Key should include user identifier in the path
          expect(key).toContain(userId);
          expect(key).toMatch(new RegExp(`^photos/${userId}/`));
          
          // Assert: Key should also include inventory and entity IDs
          expect(key).toContain(inventoryId);
          expect(key).toContain(entityId);
          
          // Assert: Key should follow the expected format
          const expectedKeyPattern = new RegExp(`^photos/${userId}/${inventoryId}/${entityId}/\\d+-`);
          expect(key).toMatch(expectedKeyPattern);
          
          // Assert: Other parameters should be correct
          expect(calledContentType).toBe(contentType);
          expect(secure).toBe(true); // Should use secure expiration
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 13: Photo download requires entity access
   * 
   * Property 13: Photo download requires entity access
   * For any user requesting a photo download, a download URL should only be generated 
   * if the user has access to the entity associated with that photo.
   * Validates: Requirements 3.2, 3.4
   */
  test('Property 13: Photo download requires entity access', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random inventory ID (UUID format)
        fc.uuid(),
        // Generate random entity ID (UUID format)
        fc.uuid(),
        // Generate random file name
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // Generate boolean for whether user has access
        fc.boolean(),
        
        async (userId, inventoryId, entityId, fileName, hasAccess) => {
          // Reset mocks for this iteration
          jest.clearAllMocks();
          
          // Arrange: Create photo key in expected format
          const sanitizedFileName = fileName.trim().replace(/[^a-zA-Z0-9.-]/g, '_');
          const timestamp = Date.now();
          const photoKey = `photos/${userId}/${inventoryId}/${entityId}/${timestamp}-${sanitizedFileName}`;
          
          // Arrange: Create mock event for download request
          const mockEvent = {
            requestContext: {
              http: {
                method: 'GET'
              }
            },
            headers: {
              Authorization: 'Bearer mock-token'
            },
            pathParameters: {
              key: encodeURIComponent(photoKey)
            },
            user: {
              userId: userId,
              email: 'test@example.com',
              username: 'testuser'
            }
          };

          // Set up mocks
          mockAuthenticate.mockImplementation((event) => {
            event.user = mockEvent.user;
            return Promise.resolve(event);
          });
          
          mockHasInventoryAccess.mockResolvedValue(hasAccess);
          mockGenerateDownloadUrl.mockResolvedValue('https://example.com/download-url');

          // Act: Call the photo handler
          const result = await handler(mockEvent);

          if (hasAccess) {
            // Assert: Should succeed when user has access
            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.downloadUrl).toBeDefined();
            expect(responseBody.data.key).toBe(photoKey);
            expect(responseBody.data.expiresIn).toBe(900); // 15 minutes

            // Assert: Verify generateDownloadUrl was called with correct parameters
            expect(mockGenerateDownloadUrl).toHaveBeenCalledTimes(1);
            const [key, secure] = mockGenerateDownloadUrl.mock.calls[0];
            expect(key).toBe(photoKey);
            expect(secure).toBe(true); // Should use secure expiration

            // Assert: Verify inventory access was checked
            expect(mockHasInventoryAccess).toHaveBeenCalledWith(userId, inventoryId);
            
          } else {
            // Assert: Should fail when user doesn't have access
            expect(result.statusCode).toBe(403);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error).toContain('Access denied');

            // Assert: generateDownloadUrl should not be called
            expect(mockGenerateDownloadUrl).not.toHaveBeenCalled();

            // Assert: Verify inventory access was checked
            expect(mockHasInventoryAccess).toHaveBeenCalledWith(userId, inventoryId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 14: Presigned URLs have short expiration
   * 
   * Property 14: Presigned URLs have short expiration
   * For any presigned URL generated, the expiration time should be no more than 15 minutes 
   * from generation time.
   * Validates: Requirements 3.3
   */
  test('Property 14: Presigned URLs have short expiration', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random inventory ID (UUID format)
        fc.uuid(),
        // Generate random entity ID (UUID format)
        fc.uuid(),
        // Generate random file name
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // Generate random content type
        fc.constantFrom('image/jpeg', 'image/png', 'image/gif'),
        // Generate operation type (upload or download)
        fc.constantFrom('upload', 'download'),
        
        async (userId, inventoryId, entityId, fileName, contentType, operation) => {
          // Reset mocks for this iteration
          jest.clearAllMocks();
          
          let mockEvent;
          
          if (operation === 'upload') {
            // Arrange: Create mock event for upload request
            mockEvent = {
              requestContext: {
                http: {
                  method: 'POST'
                }
              },
              headers: {
                Authorization: 'Bearer mock-token'
              },
              body: JSON.stringify({
                fileName: fileName.trim(),
                contentType: contentType,
                inventoryId: inventoryId,
                entityId: entityId
              }),
              user: {
                userId: userId,
                email: 'test@example.com',
                username: 'testuser'
              }
            };
          } else {
            // Arrange: Create photo key and mock event for download request
            const sanitizedFileName = fileName.trim().replace(/[^a-zA-Z0-9.-]/g, '_');
            const timestamp = Date.now();
            const photoKey = `photos/${userId}/${inventoryId}/${entityId}/${timestamp}-${sanitizedFileName}`;
            
            mockEvent = {
              requestContext: {
                http: {
                  method: 'GET'
                }
              },
              headers: {
                Authorization: 'Bearer mock-token'
              },
              pathParameters: {
                key: encodeURIComponent(photoKey)
              },
              user: {
                userId: userId,
                email: 'test@example.com',
                username: 'testuser'
              }
            };
          }

          // Set up mocks
          mockAuthenticate.mockImplementation((event) => {
            event.user = mockEvent.user;
            return Promise.resolve(event);
          });
          
          mockGenerateUploadUrl.mockResolvedValue('https://example.com/upload-url');
          mockGenerateDownloadUrl.mockResolvedValue('https://example.com/download-url');

          // Act: Call the photo handler
          const result = await handler(mockEvent);

          // Assert: Verify successful response
          expect(result.statusCode).toBe(operation === 'upload' ? 201 : 200);
          const responseBody = JSON.parse(result.body);
          expect(responseBody.success).toBe(true);
          
          // Assert: Verify expiration time is 15 minutes (900 seconds)
          expect(responseBody.data.expiresIn).toBe(900);
          expect(responseBody.data.expiresIn).toBeLessThanOrEqual(900); // No more than 15 minutes

          if (operation === 'upload') {
            // Assert: Verify generateUploadUrl was called with secure=true
            expect(mockGenerateUploadUrl).toHaveBeenCalledTimes(1);
            const [, , secure] = mockGenerateUploadUrl.mock.calls[0];
            expect(secure).toBe(true);
          } else {
            // Assert: Verify generateDownloadUrl was called with secure=true
            expect(mockGenerateDownloadUrl).toHaveBeenCalledTimes(1);
            const [, secure] = mockGenerateDownloadUrl.mock.calls[0];
            expect(secure).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 15: Photo deletion requires access
   * 
   * Property 15: Photo deletion requires access
   * For any user attempting to delete a photo, the deletion should only succeed if the user 
   * has access to the entity associated with that photo.
   * Validates: Requirements 3.5
   */
  test('Property 15: Photo deletion requires access', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random inventory ID (UUID format)
        fc.uuid(),
        // Generate random entity ID (UUID format)
        fc.uuid(),
        // Generate random file name
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // Generate boolean for whether user has access
        fc.boolean(),
        
        async (userId, inventoryId, entityId, fileName, hasAccess) => {
          // Reset mocks for this iteration
          jest.clearAllMocks();
          
          // Arrange: Create photo key in expected format
          const sanitizedFileName = fileName.trim().replace(/[^a-zA-Z0-9.-]/g, '_');
          const timestamp = Date.now();
          const photoKey = `photos/${userId}/${inventoryId}/${entityId}/${timestamp}-${sanitizedFileName}`;
          
          // Arrange: Create mock event for delete request
          const mockEvent = {
            requestContext: {
              http: {
                method: 'DELETE'
              }
            },
            headers: {
              Authorization: 'Bearer mock-token'
            },
            pathParameters: {
              key: encodeURIComponent(photoKey)
            },
            user: {
              userId: userId,
              email: 'test@example.com',
              username: 'testuser'
            }
          };

          // Set up mocks
          mockAuthenticate.mockImplementation((event) => {
            event.user = mockEvent.user;
            return Promise.resolve(event);
          });
          
          mockHasInventoryAccess.mockResolvedValue(hasAccess);
          mockDeleteObject.mockResolvedValue({});

          // Act: Call the photo handler
          const result = await handler(mockEvent);

          if (hasAccess) {
            // Assert: Should succeed when user has access
            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.message).toContain('deleted successfully');
            expect(responseBody.data.key).toBe(photoKey);

            // Assert: Verify deleteObject was called with correct key
            expect(mockDeleteObject).toHaveBeenCalledTimes(1);
            expect(mockDeleteObject).toHaveBeenCalledWith(photoKey);

            // Assert: Verify inventory access was checked
            expect(mockHasInventoryAccess).toHaveBeenCalledWith(userId, inventoryId);
            
          } else {
            // Assert: Should fail when user doesn't have access
            expect(result.statusCode).toBe(403);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error).toContain('Access denied');

            // Assert: deleteObject should not be called
            expect(mockDeleteObject).not.toHaveBeenCalled();

            // Assert: Verify inventory access was checked
            expect(mockHasInventoryAccess).toHaveBeenCalledWith(userId, inventoryId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});