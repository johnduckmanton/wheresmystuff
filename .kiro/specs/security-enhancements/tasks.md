# Implementation Plan

- [x] 1. Set up infrastructure for HTTPS and AWS WAF
  - Update CloudFormation/SAM template to add CloudFront distribution with HTTPS
  - Configure AWS WAF WebACL with managed rules (Core Rule Set, Known Bad Inputs)
  - Associate WAF with CloudFront distribution
  - Configure custom domain with ACM certificate
  - Set up HTTP to HTTPS redirect
  - _Requirements: 11.1, 11.2, 12.2, 12.3, 12.4_

- [-] 2. Implement inventory data model and DynamoDB schema
  - [-] 2.1 Create inventory and membership data models
    - Define Inventory model with id, name, description, ownerId, timestamps
    - Define InventoryMembership model with inventoryId, userId, role, addedAt, addedBy
    - Update entity models to include inventoryId field
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Write property test for inventory creation
    - **Property 1: Inventory creation assigns ownership**
    - **Validates: Requirements 1.1**

  - [ ] 2.3 Write property test for entity-inventory association
    - **Property 2: Entity creation associates inventory**
    - **Validates: Requirements 1.2**

- [ ] 3. Implement inventory management service
  - [ ] 3.1 Create inventory CRUD operations
    - Implement createInventory function
    - Implement getUserInventories function
    - Implement updateInventory function
    - Implement deleteInventory function
    - _Requirements: 1.1_

  - [ ] 3.2 Create inventory membership management
    - Implement addInventoryMember function
    - Implement removeInventoryMember function
    - Implement getInventoryMembers function
    - Implement hasInventoryAccess function
    - _Requirements: 1.4, 1.8_

  - [ ] 3.3 Write property test for membership grant
    - **Property 4: Membership grant creates record**
    - **Validates: Requirements 1.4**

  - [ ] 3.4 Write property test for membership removal
    - **Property 7: Membership removal revokes access**
    - **Validates: Requirements 1.8**

- [ ] 4. Implement inventory-based authorization middleware
  - [ ] 4.1 Create authorization middleware
    - Implement authorizeInventoryAccess function
    - Integrate with existing authenticate middleware
    - Add inventory access check to all entity operations
    - _Requirements: 1.3, 1.5, 1.6, 1.7_

  - [ ] 4.2 Write property test for entity listing access control
    - **Property 3: Entity listing respects inventory access**
    - **Validates: Requirements 1.3**

  - [ ] 4.3 Write property test for unauthorized access rejection
    - **Property 5: Unauthorized access is rejected**
    - **Validates: Requirements 1.5**

  - [ ] 4.4 Write property test for write operation access control
    - **Property 6: Write operations require inventory access**
    - **Validates: Requirements 1.6, 1.7**

- [ ] 5. Enhance input validation and sanitization
  - [ ] 5.1 Implement comprehensive validation service
    - Create schema validation function with type checking
    - Implement string sanitization for XSS prevention
    - Add special character encoding/escaping
    - Implement recursive validation for nested objects
    - Add length validation for all string fields
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.2 Write property test for string sanitization
    - **Property 8: String sanitization removes malicious content**
    - **Validates: Requirements 2.1**

  - [ ] 5.3 Write property test for schema validation
    - **Property 9: Schema validation catches invalid data**
    - **Validates: Requirements 2.2**

  - [ ] 5.4 Write property test for special character encoding
    - **Property 10: Special characters are properly encoded**
    - **Validates: Requirements 2.4**

  - [ ] 5.5 Write property test for recursive validation
    - **Property 11: Recursive validation checks nested structures**
    - **Validates: Requirements 2.5**

  - [ ] 5.6 Update all handlers to use enhanced validation
    - Update things handler with new validation
    - Update locations handler with new validation
    - Update rooms handler with new validation
    - Update categories handler with new validation
    - Update people handler with new validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 6. Implement secure photo access control
  - [ ] 6.1 Update photo handler with inventory-based access control
    - Modify generateUploadUrl to include user ID in S3 key path
    - Modify generateDownloadUrl to verify entity access before generating URL
    - Set presigned URL expiration to 15 minutes
    - Add photo deletion with access verification
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 6.2 Write property test for upload URL user identifier
    - **Property 12: Upload URLs include user identifier**
    - **Validates: Requirements 3.1**

  - [ ] 6.3 Write property test for photo download access control
    - **Property 13: Photo download requires entity access**
    - **Validates: Requirements 3.2, 3.4**

  - [ ] 6.4 Write property test for presigned URL expiration
    - **Property 14: Presigned URLs have short expiration**
    - **Validates: Requirements 3.3**

  - [ ] 6.5 Write property test for photo deletion access control
    - **Property 15: Photo deletion requires access**
    - **Validates: Requirements 3.5**

- [ ] 7. Implement rate limiting service
  - [ ] 7.1 Create rate limiting service
    - Implement checkRateLimit function with DynamoDB counter
    - Implement recordRequest function
    - Set rate limit to 100 requests per minute per endpoint
    - Configure DynamoDB TTL for automatic cleanup
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 7.2 Add rate limiting middleware to all handlers
    - Create rate limiting middleware wrapper
    - Apply to all API endpoints
    - Return 429 status with Retry-After header when exceeded
    - _Requirements: 4.2, 4.3_

  - [ ] 7.3 Write property test for request tracking
    - **Property 16: Request tracking increments counter**
    - **Validates: Requirements 4.1**

  - [ ] 7.4 Write property test for window expiry
    - **Property 17: Window expiry resets counter**
    - **Validates: Requirements 4.4**

  - [ ] 7.5 Write property test for rate limit logging
    - **Property 18: Rate limit violations are logged**
    - **Validates: Requirements 4.5**

- [ ] 8. Implement audit logging service
  - [ ] 8.1 Create audit logging service
    - Implement logAuth function for authentication events
    - Implement logDataAccess function for CRUD operations
    - Implement logAuthzFailure function for authorization failures
    - Implement logRateLimit function for rate limit violations
    - Add cryptographic integrity checks (HMAC) to log entries
    - Store logs in DynamoDB with date-based partitioning
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 8.2 Integrate audit logging into all handlers
    - Add authentication logging to auth middleware
    - Add data access logging to all CRUD operations
    - Add authorization failure logging to access control checks
    - Add rate limit logging to rate limiting middleware
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 8.3 Write property test for authentication logging
    - **Property 19: Authentication attempts are logged**
    - **Validates: Requirements 5.1**

  - [ ] 8.4 Write property test for write operation logging
    - **Property 20: Write operations are logged**
    - **Validates: Requirements 5.2**

  - [ ] 8.5 Write property test for authorization failure logging
    - **Property 21: Authorization failures are logged**
    - **Validates: Requirements 5.3**

  - [ ] 8.6 Write property test for audit log integrity
    - **Property 22: Audit logs have integrity protection**
    - **Validates: Requirements 5.5**

- [ ] 9. Implement security headers middleware
  - [ ] 9.1 Create security headers middleware
    - Implement addSecurityHeaders function
    - Add Content-Security-Policy header
    - Add X-Content-Type-Options: nosniff header
    - Add X-Frame-Options: DENY header
    - Add Strict-Transport-Security header with max-age 31536000
    - Add X-XSS-Protection: 1; mode=block header
    - Apply to all HTTP responses
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 9.2 Write property test for security headers
    - **Property 23: All responses include security headers**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

- [ ] 10. Implement secure error handling
  - [ ] 10.1 Create error handling utilities
    - Implement generic error response formatter
    - Implement server-side detailed error logger
    - Update all handlers to use secure error handling
    - Ensure no stack traces or schema details in client responses
    - Ensure validation errors are informative but safe
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 10.2 Write property test for client error safety
    - **Property 24: Client errors are generic**
    - **Validates: Requirements 7.1, 7.3**

  - [ ] 10.3 Write property test for server error logging
    - **Property 25: Server errors are logged with details**
    - **Validates: Requirements 7.2**

  - [ ] 10.4 Write property test for validation error messages
    - **Property 26: Validation errors are informative but safe**
    - **Validates: Requirements 7.5**

- [ ] 11. Enhance JWT validation
  - [ ] 11.1 Update JWT validation middleware
    - Ensure signature verification is enabled
    - Add issuer validation
    - Add audience validation
    - Add expiration validation
    - Add validation failure logging
    - _Requirements: 8.2, 8.4, 8.5_

  - [ ] 11.2 Write property test for JWT validation
    - **Property 27: JWT validation checks all claims**
    - **Validates: Requirements 8.4**

  - [ ] 11.3 Write property test for JWT validation failure logging
    - **Property 28: JWT validation failures are logged**
    - **Validates: Requirements 8.5**

- [ ] 12. Implement CORS protection
  - [ ] 12.1 Update API Gateway CORS configuration
    - Configure allowed origins to specific domain (no wildcards)
    - Implement origin validation middleware for state-changing requests
    - Validate Origin or Referer header for credentialed requests
    - Return CORS errors for invalid origins
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 12.2 Write property test for origin validation
    - **Property 29: Origin validation for state-changing requests**
    - **Validates: Requirements 9.1, 9.3**

- [ ] 13. Update DynamoDB schema and migrate data
  - [ ] 13.1 Create migration script for existing data
    - Create default inventory for each existing user
    - Update all existing entities to include inventoryId
    - Create membership records for inventory owners
    - Test migration with sample data
    - _Requirements: 1.1, 1.2_

  - [ ] 13.2 Update SAM template with new tables
    - Add Inventory table definition
    - Add InventoryMembership table definition
    - Add RateLimit table with TTL configuration
    - Add AuditLog table with date-based partitioning
    - Update existing table schemas to include inventoryId
    - _Requirements: 1.1, 4.1, 5.1_

- [ ] 14. Create inventory management API endpoints
  - [ ] 14.1 Create inventory handler
    - Implement GET /inventories (list user's inventories)
    - Implement POST /inventories (create inventory)
    - Implement PUT /inventories/{id} (update inventory)
    - Implement DELETE /inventories/{id} (delete inventory)
    - _Requirements: 1.1_

  - [ ] 14.2 Create inventory membership handler
    - Implement GET /inventories/{id}/members (list members)
    - Implement POST /inventories/{id}/members (add member)
    - Implement DELETE /inventories/{id}/members/{userId} (remove member)
    - _Requirements: 1.4, 1.8_

  - [ ] 14.3 Update SAM template with new API routes
    - Add inventory routes to API Gateway
    - Add membership routes to API Gateway
    - Configure Cognito authorizer for new routes
    - _Requirements: 1.1, 1.4_

- [ ] 15. Update frontend for inventory management
  - [ ] 15.1 Create inventory management UI
    - Create inventory list page
    - Create inventory creation dialog
    - Create inventory settings page
    - Add inventory selector to main navigation
    - _Requirements: 1.1_

  - [ ] 15.2 Create inventory membership UI
    - Create member management page
    - Create add member dialog
    - Create member list with remove functionality
    - _Requirements: 1.4, 1.8_

  - [ ] 15.3 Update entity forms to include inventory selection
    - Add inventory selector to thing form
    - Add inventory selector to location form
    - Add inventory selector to room form
    - Add inventory selector to category form
    - Add inventory selector to person form
    - _Requirements: 1.2_

- [ ] 16. Set up dependency vulnerability scanning
  - [ ] 16.1 Configure npm audit in CI/CD pipeline
    - Add npm audit check to build script
    - Configure to fail on high/critical vulnerabilities
    - Add automated dependency updates with Dependabot or similar
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 17. Configure monitoring and alerting
  - [ ] 17.1 Set up CloudWatch alarms
    - Create alarm for high authentication failure rate
    - Create alarm for high authorization failure rate
    - Create alarm for rate limit violations
    - Create alarm for WAF blocks
    - Create alarm for API error rates
    - _Requirements: 4.5, 5.1, 5.3_

  - [ ] 17.2 Create security dashboard
    - Create CloudWatch dashboard for security metrics
    - Add widgets for authentication failures
    - Add widgets for authorization failures
    - Add widgets for rate limit violations
    - Add widgets for WAF blocks
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Deploy and verify security enhancements
  - [ ] 19.1 Deploy infrastructure updates
    - Deploy SAM template with CloudFront, WAF, and new tables
    - Verify HTTPS enforcement
    - Verify WAF rules are active
    - Run migration script for existing data
    - _Requirements: 11.1, 11.2, 12.2_

  - [ ] 19.2 Verify security controls
    - Test HTTPS redirect
    - Test WAF blocking with SQL injection attempts
    - Test WAF blocking with XSS attempts
    - Test rate limiting
    - Test inventory access control
    - Test audit logging
    - Verify security headers in responses
    - _Requirements: 11.1, 11.2, 12.3, 12.4, 4.2, 1.3, 5.1, 6.1_

- [ ] 20. Create security documentation
  - [ ] 20.1 Document security features
    - Create security overview document
    - Document inventory access control model
    - Document rate limiting configuration
    - Document audit log format and querying
    - Document incident response procedures
    - _Requirements: All_

  - [ ] 20.2 Create security maintenance guide
    - Document weekly security tasks
    - Document monthly security tasks
    - Document quarterly security tasks
    - Document annual security tasks
    - _Requirements: All_
