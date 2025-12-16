const fc = require('fast-check');
const { 
  handleError, 
  createSecureErrorResponse, 
  createValidationErrorResponse,
  handleDatabaseError,
  handleServerError,
  ERROR_TYPES,
  GENERIC_ERROR_MESSAGES
} = require('../utils/errorHandler');

describe('Error Handling Property Tests', () => {
  /**
   * Feature: security-enhancements, Property 24: Client errors are generic
   * 
   * Property 24: Client errors are generic
   * For any error returned to the client, the error message should not contain 
   * stack traces, database schema details, or internal implementation details.
   * Validates: Requirements 7.1, 7.3
   */
  test('Property 24: Client errors are generic', async () => {
    await fc.assert(
      fc.property(
        // Generate various types of errors with potentially sensitive information
        fc.oneof(
          // Database errors with schema details
          fc.record({
            name: fc.constant('DynamoDBError'),
            message: fc.oneof(
              fc.constant('Table "users" does not exist'),
              fc.constant('Column "password_hash" not found'),
              fc.constant('Query failed: SELECT * FROM sensitive_table WHERE secret_key = ?'),
              fc.constant('ValidationException: The provided key element does not match the schema'),
              fc.constant('ResourceNotFoundException: Requested resource not found')
            ),
            code: fc.oneof(
              fc.constant('ResourceNotFoundException'),
              fc.constant('ValidationException'),
              fc.constant('ConditionalCheckFailedException')
            ),
            stack: fc.string().map(s => `Error: Database error\n    at DatabaseService.query (/app/services/db.js:123:45)\n    at ${s}`)
          }),
          
          // Server errors with stack traces
          fc.record({
            name: fc.constant('Error'),
            message: fc.oneof(
              fc.constant('Cannot read property "secretKey" of undefined'),
              fc.constant('ReferenceError: internalSecretFunction is not defined'),
              fc.constant('TypeError: Cannot access private field #privateData'),
              fc.constant('Internal server configuration error: API_SECRET_KEY not found')
            ),
            stack: fc.string().map(s => `Error: Internal error\n    at SecretService.getSecret (/app/services/secret.js:67:89)\n    at ${s}`)
          }),
          
          // Authentication errors with internal details
          fc.record({
            name: fc.constant('UnauthorizedError'),
            message: fc.oneof(
              fc.constant('JWT signature verification failed using secret key: abc123'),
              fc.constant('Token expired at 2023-12-01T10:30:00Z, current time: 2023-12-01T11:00:00Z'),
              fc.constant('User ID 12345 not found in internal user database table'),
              fc.constant('Authentication failed: invalid credentials for user@example.com')
            ),
            statusCode: fc.constant(401),
            stack: fc.string().map(s => `UnauthorizedError: Auth failed\n    at AuthService.verify (/app/auth/jwt.js:45:12)\n    at ${s}`)
          }),
          
          // Authorization errors with resource details
          fc.record({
            name: fc.constant('ForbiddenError'),
            message: fc.oneof(
              fc.constant('User lacks permission "admin:write" for resource "/internal/admin/users"'),
              fc.constant('Access denied to inventory ID: inv_12345_secret_internal'),
              fc.constant('Insufficient privileges: requires role "super_admin" but user has "user"'),
              fc.constant('Resource access denied: /api/v1/internal/sensitive-data')
            ),
            statusCode: fc.constant(403),
            stack: fc.string().map(s => `ForbiddenError: Access denied\n    at AuthzService.check (/app/auth/authz.js:78:90)\n    at ${s}`)
          }),
          
          // Validation errors with schema details
          fc.record({
            name: fc.constant('ValidationError'),
            message: fc.oneof(
              fc.constant('Schema validation failed at path "user.internal.secretField": value must be string'),
              fc.constant('Internal validation rule "checkSecretKey" failed for field "apiKey"'),
              fc.constant('Validation error in schema.definitions.internalUser.properties.sensitiveData'),
              fc.constant('Field validation failed: "password" must match internal regex pattern')
            ),
            statusCode: fc.constant(400),
            stack: fc.string().map(s => `ValidationError: Schema failed\n    at Validator.validate (/app/validation/schema.js:234:56)\n    at ${s}`)
          })
        ),
        
        // Generate request context
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          endpoint: fc.oneof(
            fc.constant('/api/things'),
            fc.constant('/api/users'),
            fc.constant('/api/admin/secrets'),
            fc.constant('/internal/sensitive')
          ),
          method: fc.oneof(fc.constant('GET'), fc.constant('POST'), fc.constant('PUT'), fc.constant('DELETE')),
          ipAddress: fc.ipV4(),
          userAgent: fc.string(),
          requestData: fc.object()
        }),
        
        (error, context) => {
          // Act: Handle the error using secure error handling
          const secureResponse = handleError(error, context);
          
          // Assert: Response should not contain sensitive information
          expect(secureResponse).toBeDefined();
          expect(secureResponse.error).toBeDefined();
          expect(secureResponse.statusCode).toBeDefined();
          expect(secureResponse.requestId).toBeDefined();
          
          // Assert: Error message should be generic, not expose internal details
          const errorMessage = secureResponse.error.toLowerCase();
          
          // Should not contain stack trace information
          expect(errorMessage).not.toContain('at ');
          expect(errorMessage).not.toContain('.js:');
          expect(errorMessage).not.toContain('error:');
          expect(errorMessage).not.toContain('stack');
          
          // Should not contain database schema details
          expect(errorMessage).not.toContain('table');
          expect(errorMessage).not.toContain('column');
          expect(errorMessage).not.toContain('select');
          expect(errorMessage).not.toContain('query');
          expect(errorMessage).not.toContain('database');
          expect(errorMessage).not.toContain('schema');
          
          // Should not contain internal paths or file names
          expect(errorMessage).not.toContain('/app/');
          expect(errorMessage).not.toContain('/internal/');
          expect(errorMessage).not.toContain('.js');
          expect(errorMessage).not.toContain('authservice');
          expect(errorMessage).not.toContain('databaseservice');
          
          // Should not contain sensitive field names or values
          expect(errorMessage).not.toContain('secret');
          expect(errorMessage).not.toContain('password');
          expect(errorMessage).not.toContain('key');
          expect(errorMessage).not.toContain('token');
          expect(errorMessage).not.toContain('credential');
          
          // Should not contain specific user IDs or resource identifiers
          expect(errorMessage).not.toContain('12345');
          expect(errorMessage).not.toContain('inv_');
          expect(errorMessage).not.toContain('user@');
          expect(errorMessage).not.toContain('abc123');
          
          // Should not contain internal configuration details
          expect(errorMessage).not.toContain('api_secret');
          expect(errorMessage).not.toContain('config');
          expect(errorMessage).not.toContain('environment');
          
          // Should use generic messages from predefined list
          const isGenericMessage = Object.values(GENERIC_ERROR_MESSAGES).some(
            genericMsg => errorMessage.includes(genericMsg.toLowerCase())
          );
          expect(isGenericMessage).toBe(true);
          
          // Assert: Status code should be appropriate
          expect([400, 401, 403, 404, 429, 500]).toContain(secureResponse.statusCode);
          
          // Assert: Request ID should be present for correlation
          expect(secureResponse.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test to ensure validation errors are safe but informative
  test('Validation errors are informative but safe', async () => {
    await fc.assert(
      fc.property(
        // Generate validation errors with potentially sensitive schema details
        fc.array(
          fc.oneof(
            fc.constant('schema.definitions.user.properties.secretField is required'),
            fc.constant('internal.validation.rules.passwordComplexity failed'),
            fc.constant('system.config.validation.apiKeyFormat does not match pattern'),
            fc.constant('database.schema.users.email must be valid email format'),
            fc.constant('Field "name" exceeds maximum length of 255 characters'),
            fc.constant('Field "email" has invalid format'),
            fc.constant('Required field "inventoryId" is missing')
          ),
          { minLength: 1, maxLength: 5 }
        ),
        
        (validationErrors) => {
          // Act: Create validation error response
          const response = createValidationErrorResponse(validationErrors);
          
          // Assert: Should be informative about field issues
          expect(response.error).toContain('Validation failed');
          
          // Assert: Should not expose internal schema structure
          expect(response.error).not.toContain('schema.');
          expect(response.error).not.toContain('internal.');
          expect(response.error).not.toContain('system.');
          expect(response.error).not.toContain('database.');
          expect(response.error).not.toContain('definitions.');
          expect(response.error).not.toContain('properties.');
          
          // Assert: Should still mention field names for user guidance
          if (validationErrors.some(err => err.includes('name'))) {
            expect(response.error.toLowerCase()).toContain('name');
          }
          if (validationErrors.some(err => err.includes('email'))) {
            expect(response.error.toLowerCase()).toContain('email');
          }
          
          // Assert: Should have appropriate status code
          expect(response.statusCode).toBe(400);
          
          // Assert: Should have request ID
          expect(response.requestId).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test that different error types return appropriate generic messages
  test('Different error types return appropriate generic messages', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(ERROR_TYPES.AUTHENTICATION),
          fc.constant(ERROR_TYPES.AUTHORIZATION),
          fc.constant(ERROR_TYPES.VALIDATION),
          fc.constant(ERROR_TYPES.NOT_FOUND),
          fc.constant(ERROR_TYPES.RATE_LIMIT),
          fc.constant(ERROR_TYPES.SERVER),
          fc.constant(ERROR_TYPES.DATABASE),
          fc.constant(ERROR_TYPES.EXTERNAL_SERVICE)
        ),
        fc.integer({ min: 400, max: 599 }),
        
        (errorType, statusCode) => {
          // Act: Create secure error response
          const response = createSecureErrorResponse(errorType, null, statusCode);
          
          // Assert: Should use generic message for the error type
          expect(response.error).toBe(GENERIC_ERROR_MESSAGES[errorType]);
          
          // Assert: Should have correct status code
          expect(response.statusCode).toBe(statusCode);
          
          // Assert: Should have request ID
          expect(response.requestId).toBeDefined();
          
          // Assert: Message should be generic and safe
          expect(response.error).not.toContain('internal');
          expect(response.error).not.toContain('stack');
          expect(response.error).not.toContain('schema');
          expect(response.error).not.toContain('database');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 25: Server errors are logged with details
   * 
   * Property 25: Server errors are logged with details
   * For any error that occurs, detailed error information including stack traces 
   * should be logged server-side for debugging.
   * Validates: Requirements 7.2
   */
  test('Property 25: Server errors are logged with details', async () => {
    // Mock console.error to capture log output
    const originalConsoleError = console.error;
    const loggedMessages = [];
    console.error = (...args) => {
      loggedMessages.push(args);
    };

    await fc.assert(
      fc.property(
        // Generate various types of errors with detailed information
        fc.oneof(
          // Server errors with stack traces
          fc.record({
            name: fc.oneof(fc.constant('Error'), fc.constant('TypeError'), fc.constant('ReferenceError')),
            message: fc.oneof(
              fc.constant('Cannot read property "secretKey" of undefined'),
              fc.constant('ReferenceError: internalSecretFunction is not defined'),
              fc.constant('TypeError: Cannot access private field #privateData'),
              fc.constant('Internal server configuration error: API_SECRET_KEY not found'),
              fc.constant('Database connection failed: timeout after 30 seconds')
            ),
            stack: fc.string().map(s => `Error: Internal error\n    at SecretService.getSecret (/app/services/secret.js:67:89)\n    at Controller.handleRequest (/app/controllers/main.js:123:45)\n    at ${s}`),
            statusCode: fc.constant(500)
          }),
          
          // Database errors with detailed information
          fc.record({
            name: fc.constant('DynamoDBError'),
            message: fc.oneof(
              fc.constant('Table "users_internal_prod" does not exist'),
              fc.constant('Column "password_hash_encrypted" not found in table schema'),
              fc.constant('Query failed: SELECT * FROM sensitive_user_data WHERE internal_id = ?'),
              fc.constant('ValidationException: The provided key element does not match the schema definition')
            ),
            code: fc.oneof(
              fc.constant('ResourceNotFoundException'),
              fc.constant('ValidationException'),
              fc.constant('ConditionalCheckFailedException')
            ),
            stack: fc.string().map(s => `DynamoDBError: Database error\n    at DatabaseService.query (/app/services/db.js:234:56)\n    at UserRepository.findById (/app/repositories/user.js:89:12)\n    at ${s}`),
            statusCode: fc.constant(500)
          }),
          
          // Authentication errors with internal details
          fc.record({
            name: fc.constant('UnauthorizedError'),
            message: fc.oneof(
              fc.constant('JWT signature verification failed using secret key: sk_prod_abc123xyz789'),
              fc.constant('Token expired at 2023-12-01T10:30:00Z, current time: 2023-12-01T11:00:00Z, user_id: usr_12345'),
              fc.constant('User ID usr_67890_internal not found in production user database table'),
              fc.constant('Authentication failed: invalid credentials for user@company-internal.com')
            ),
            statusCode: fc.constant(401),
            stack: fc.string().map(s => `UnauthorizedError: Auth failed\n    at AuthService.verify (/app/auth/jwt.js:145:67)\n    at AuthMiddleware.authenticate (/app/middleware/auth.js:78:90)\n    at ${s}`)
          })
        ),
        
        // Generate request context with sensitive information
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          endpoint: fc.oneof(
            fc.constant('/api/internal/users'),
            fc.constant('/admin/sensitive-data'),
            fc.constant('/api/v1/production/secrets'),
            fc.constant('/internal/database-admin')
          ),
          method: fc.oneof(fc.constant('GET'), fc.constant('POST'), fc.constant('PUT'), fc.constant('DELETE')),
          ipAddress: fc.ipV4(),
          userAgent: fc.string(),
          requestData: fc.record({
            sensitiveField: fc.string(),
            internalId: fc.string(),
            secretKey: fc.string(),
            databaseConnection: fc.string()
          })
        }),
        
        (error, context) => {
          // Clear previous log messages
          loggedMessages.length = 0;
          
          // Act: Handle the error using secure error handling
          const secureResponse = handleError(error, context);
          
          // Assert: Should have logged detailed error information
          expect(loggedMessages.length).toBeGreaterThan(0);
          
          // Find the detailed error log message
          const detailedLogMessage = loggedMessages.find(args => 
            args.length > 1 && 
            args[0] === 'Detailed Error Log:' && 
            typeof args[1] === 'string'
          );
          
          expect(detailedLogMessage).toBeDefined();
          
          // Parse the logged JSON
          const loggedData = JSON.parse(detailedLogMessage[1]);
          
          // Assert: Detailed log should contain sensitive information for debugging
          expect(loggedData.timestamp).toBeDefined();
          expect(loggedData.requestId).toBeDefined();
          expect(loggedData.errorType).toBeDefined();
          expect(loggedData.message).toBe(error.message); // Original error message
          expect(loggedData.stack).toBe(error.stack); // Full stack trace
          expect(loggedData.userId).toBeDefined();
          expect(loggedData.endpoint).toBe(context.endpoint);
          expect(loggedData.method).toBe(context.method);
          expect(loggedData.statusCode).toBeDefined();
          expect(loggedData.name).toBe(error.name);
          
          // Assert: Should include request data for debugging (even if sensitive)
          expect(loggedData.requestData).toBeDefined();
          
          // Assert: Should include all error properties for debugging
          if (error.code) {
            expect(loggedData.code).toBe(error.code);
          }
          
          // Assert: Stack trace should be preserved in server logs
          expect(loggedData.stack).toContain('/app/');
          expect(loggedData.stack).toContain('.js:');
          
          // Assert: Original error message should be preserved in server logs
          expect(loggedData.message).not.toBe('Internal server error'); // Should not be generic
          
          // Assert: Client response should still be secure (different from logged data)
          expect(secureResponse.error).not.toBe(error.message); // Client gets generic message
          expect(secureResponse.error).not.toContain('secret');
          expect(secureResponse.error).not.toContain('internal');
          expect(secureResponse.error).not.toContain('password');
          
          // Assert: Request ID should match between client response and server log
          expect(secureResponse.requestId).toBe(loggedData.requestId);
        }
      ),
      { numRuns: 100 }
    );

    // Restore original console.error
    console.error = originalConsoleError;
  });

  /**
   * Feature: security-enhancements, Property 26: Validation errors are informative but safe
   * 
   * Property 26: Validation errors are informative but safe
   * For any validation error, the error message should specify which fields failed 
   * validation without exposing internal validation logic or system architecture.
   * Validates: Requirements 7.5
   */
  test('Property 26: Validation errors are informative but safe', async () => {
    await fc.assert(
      fc.property(
        // Generate validation errors with potentially sensitive schema details
        fc.array(
          fc.oneof(
            // Schema-related errors with internal structure
            fc.constant('schema.definitions.user.properties.secretField is required'),
            fc.constant('internal.validation.rules.passwordComplexity failed for field "password"'),
            fc.constant('system.config.validation.apiKeyFormat does not match pattern for field "apiKey"'),
            fc.constant('database.schema.users.email must be valid email format'),
            fc.constant('validation.engine.core.fieldValidator rejected field "sensitiveData"'),
            
            // Field-specific errors that should be preserved
            fc.constant('Field "name" exceeds maximum length of 255 characters'),
            fc.constant('Field "email" has invalid format'),
            fc.constant('Required field "inventoryId" is missing'),
            fc.constant('Field "age" must be a number'),
            fc.constant('Field "tags" must be an array'),
            
            // Internal system references
            fc.constant('ValidationEngine.CoreValidator.validateString failed for "description"'),
            fc.constant('SchemaProcessor.processField encountered error in "metadata.internalId"'),
            fc.constant('SystemValidator.checkConstraints failed for user.profile.secretKey'),
            
            // Mixed safe and unsafe content
            fc.constant('Field "username" is required but schema.internal.userValidation.rules failed'),
            fc.constant('Invalid format for "phoneNumber" - system.validation.phoneRegex pattern not matched')
          ),
          { minLength: 1, maxLength: 5 }
        ),
        
        (validationErrors) => {
          // Act: Create validation error response
          const response = createValidationErrorResponse(validationErrors);
          
          // Assert: Should be informative about field issues
          expect(response.error).toContain('Validation failed');
          expect(response.statusCode).toBe(400);
          expect(response.requestId).toBeDefined();
          
          // Assert: Should not expose internal schema structure
          expect(response.error).not.toContain('schema.');
          expect(response.error).not.toContain('internal.');
          expect(response.error).not.toContain('system.');
          expect(response.error).not.toContain('database.');
          expect(response.error).not.toContain('definitions.');
          expect(response.error).not.toContain('properties.');
          expect(response.error).not.toContain('config.');
          expect(response.error).not.toContain('rules.');
          expect(response.error).not.toContain('ValidationEngine.');
          expect(response.error).not.toContain('SchemaProcessor.');
          expect(response.error).not.toContain('SystemValidator.');
          expect(response.error).not.toContain('CoreValidator.');
          
          // Assert: Should not expose sensitive field names
          expect(response.error).not.toContain('secretField');
          expect(response.error).not.toContain('secretKey');
          expect(response.error).not.toContain('password'); // Should be replaced with 'field'
          expect(response.error).not.toContain('apiKey'); // Should be replaced with 'field'
          expect(response.error).not.toContain('sensitiveData');
          expect(response.error).not.toContain('internalId');
          
          // Assert: Should still mention safe field names for user guidance
          const errorMessage = response.error.toLowerCase();
          
          // Check if original errors contained safe field names that should be preserved
          const hasSafeFieldNames = validationErrors.some(err => 
            err.includes('"name"') || 
            err.includes('"email"') || 
            err.includes('"inventoryId"') ||
            err.includes('"age"') ||
            err.includes('"tags"') ||
            err.includes('"username"') ||
            err.includes('"phoneNumber"') ||
            err.includes('"description"')
          );
          
          if (hasSafeFieldNames) {
            // At least one safe field name should be preserved
            const hasSafeFieldInResponse = 
              errorMessage.includes('name') ||
              errorMessage.includes('email') ||
              errorMessage.includes('inventoryid') ||
              errorMessage.includes('age') ||
              errorMessage.includes('tags') ||
              errorMessage.includes('username') ||
              errorMessage.includes('phonenumber') ||
              errorMessage.includes('description');
            
            expect(hasSafeFieldInResponse).toBe(true);
          }
          
          // Assert: Should provide helpful validation guidance
          if (validationErrors.some(err => err.includes('required'))) {
            expect(errorMessage).toContain('required');
          }
          
          if (validationErrors.some(err => err.includes('format') || err.includes('pattern'))) {
            expect(errorMessage).toContain('format');
          }
          
          if (validationErrors.some(err => err.includes('length') || err.includes('exceeds'))) {
            expect(errorMessage.includes('length') || errorMessage.includes('exceeds')).toBe(true);
          }
          
          // Assert: Should not contain dot notation references
          expect(response.error).not.toMatch(/\w+\.\w+/); // No word.word patterns
          
          // Assert: Should be a clean, user-friendly message
          expect(response.error).not.toContain('ValidationEngine');
          expect(response.error).not.toContain('SchemaProcessor');
          expect(response.error).not.toContain('SystemValidator');
          expect(response.error).not.toContain('CoreValidator');
          
          // Assert: Should not expose internal method names or class names
          expect(response.error).not.toContain('validateString');
          expect(response.error).not.toContain('processField');
          expect(response.error).not.toContain('checkConstraints');
          expect(response.error).not.toContain('passwordComplexity');
          expect(response.error).not.toContain('phoneRegex');
          
          // Assert: Error message should be reasonably concise
          expect(response.error.length).toBeLessThan(500); // Reasonable length limit
          
          // Assert: Should not have excessive whitespace or formatting issues
          expect(response.error).not.toMatch(/\s{2,}/); // No multiple consecutive spaces
          expect(response.error.trim()).toBe(response.error); // No leading/trailing whitespace
        }
      ),
      { numRuns: 100 }
    );
  });
});