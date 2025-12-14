# Security Enhancements Design Document

## Overview

This design document outlines the security enhancements for the Home Inventory Management System. The system currently implements basic authentication using AWS Cognito and JWT tokens. This enhancement adds multi-tenant inventory management with shared access, comprehensive input validation, secure photo access controls, rate limiting, audit logging, security headers, HTTPS enforcement, and AWS WAF/Shield protection.

The design follows AWS security best practices and implements defense-in-depth principles with multiple layers of security controls.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront (HTTPS)                       │
│                    + AWS Shield Standard                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AWS WAF                                  │
│              (Managed Rules + Custom Rules)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (HTTPS)                           │
│                  + Cognito Authorizer                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Lambda Functions                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. JWT Validation (existing)                            │   │
│  │  2. Inventory Access Control (new)                       │   │
│  │  3. Input Validation & Sanitization (enhanced)           │   │
│  │  4. Rate Limiting (new)                                  │   │
│  │  5. Audit Logging (new)                                  │   │
│  │  6. Security Headers (new)                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DynamoDB                                   │
│  - Inventory Table (new)                                         │
│  - Inventory Membership Table (new)                              │
│  - Entity Tables (modified with inventoryId)                     │
│  - Rate Limit Table (new)                                        │
│  - Audit Log Table (new)                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Security Layers

1. **Network Layer**: CloudFront with HTTPS, AWS Shield Standard for DDoS protection
2. **Application Layer**: AWS WAF with managed rules for OWASP Top 10 protection
3. **API Layer**: API Gateway with Cognito JWT authorization
4. **Business Logic Layer**: Lambda functions with inventory access control, rate limiting, and audit logging
5. **Data Layer**: DynamoDB with encryption at rest, S3 with encryption and access controls

## Components and Interfaces

### 1. Inventory Management Service

**Purpose**: Manages inventory creation, membership, and access control

**Interface**:
```javascript
// Create a new inventory
createInventory(userId, inventoryData) -> Inventory

// Add a member to an inventory
addInventoryMember(inventoryId, ownerId, memberUserId) -> Membership

// Remove a member from an inventory
removeInventoryMember(inventoryId, ownerId, memberUserId) -> void

// Check if user has access to inventory
hasInventoryAccess(userId, inventoryId) -> boolean

// Get all inventories for a user
getUserInventories(userId) -> Inventory[]

// Get inventory members
getInventoryMembers(inventoryId, userId) -> User[]
```

**Responsibilities**:
- Create and manage inventories
- Manage inventory membership
- Validate ownership and access rights
- Enforce access control policies

### 2. Enhanced Authorization Middleware

**Purpose**: Extends existing JWT validation with inventory-level access control

**Interface**:
```javascript
// Existing JWT authentication
authenticate(event) -> event (with user info)

// New inventory authorization
authorizeInventoryAccess(event, inventoryId) -> event (with access info)

// Combined authentication and authorization
authenticateAndAuthorize(event, inventoryId) -> event
```

**Responsibilities**:
- Validate JWT tokens (existing)
- Verify inventory access rights (new)
- Attach user and access context to requests
- Handle authorization failures

### 3. Input Validation and Sanitization Service

**Purpose**: Enhanced validation with comprehensive schema checking and sanitization

**Interface**:
```javascript
// Validate against schema
validateSchema(data, schema) -> ValidationResult

// Sanitize string input
sanitizeString(input, maxLength) -> string

// Sanitize object recursively
sanitizeObject(obj, schema) -> object

// Validate and sanitize combined
validateAndSanitize(data, schema) -> { valid: boolean, data: object, errors: string[] }
```

**Responsibilities**:
- Type checking and schema validation
- String sanitization (XSS prevention)
- Length validation
- Special character handling
- Recursive validation for nested objects

### 4. Rate Limiting Service

**Purpose**: Prevent API abuse and DoS attacks

**Interface**:
```javascript
// Check if request is within rate limit
checkRateLimit(userId, endpoint) -> { allowed: boolean, remaining: number, resetTime: number }

// Record a request
recordRequest(userId, endpoint) -> void

// Get rate limit status
getRateLimitStatus(userId, endpoint) -> RateLimitStatus
```

**Responsibilities**:
- Track requests per user per endpoint
- Enforce rate limits (100 requests/minute per endpoint)
- Return rate limit headers
- Log rate limit violations

### 5. Audit Logging Service

**Purpose**: Record security-relevant events for monitoring and forensics

**Interface**:
```javascript
// Log authentication event
logAuth(userId, success, ipAddress, userAgent) -> void

// Log data access event
logDataAccess(userId, action, entityType, entityId, inventoryId) -> void

// Log authorization failure
logAuthzFailure(userId, action, resource, reason) -> void

// Log rate limit violation
logRateLimit(userId, endpoint, timestamp) -> void

// Query audit logs
queryAuditLogs(filters) -> AuditLog[]
```

**Responsibilities**:
- Record authentication attempts
- Record CRUD operations
- Record authorization failures
- Record rate limit violations
- Provide tamper-evident logging
- Enable security analysis and forensics

### 6. Security Headers Middleware

**Purpose**: Add security headers to all HTTP responses

**Interface**:
```javascript
// Add security headers to response
addSecurityHeaders(response) -> response
```

**Headers Added**:
- `Content-Security-Policy`: Restrict resource loading
- `X-Content-Type-Options: nosniff`: Prevent MIME sniffing
- `X-Frame-Options: DENY`: Prevent clickjacking
- `Strict-Transport-Security`: Enforce HTTPS
- `X-XSS-Protection: 1; mode=block`: Enable XSS filtering

### 7. Photo Access Control Service

**Purpose**: Secure photo uploads and downloads with user verification

**Interface**:
```javascript
// Generate presigned upload URL
generateUploadUrl(userId, inventoryId, fileName) -> { url: string, key: string }

// Generate presigned download URL
generateDownloadUrl(userId, photoKey) -> string

// Verify photo access
verifyPhotoAccess(userId, photoKey) -> boolean
```

**Responsibilities**:
- Generate presigned URLs with user-scoped S3 keys
- Verify inventory access before generating download URLs
- Set short expiration times (15 minutes)
- Enforce photo isolation between inventories

## Data Models

### Inventory

```javascript
{
  id: string,              // UUID
  name: string,            // Inventory name
  description: string,     // Optional description
  ownerId: string,         // User ID of owner
  createdAt: string,       // ISO 8601 timestamp
  updatedAt: string,       // ISO 8601 timestamp
  
  // DynamoDB keys
  pk: "INVENTORY#<id>",
  sk: "METADATA"
}
```

### Inventory Membership

```javascript
{
  inventoryId: string,     // UUID of inventory
  userId: string,          // UUID of member user
  role: string,            // "owner" or "member"
  addedAt: string,         // ISO 8601 timestamp
  addedBy: string,         // User ID who added this member
  
  // DynamoDB keys
  pk: "INVENTORY#<inventoryId>",
  sk: "MEMBER#<userId>"
}
```

### Enhanced Entity Model (Things, Locations, etc.)

```javascript
{
  id: string,
  inventoryId: string,     // NEW: Links entity to inventory
  name: string,
  // ... other entity-specific fields
  
  // DynamoDB keys
  pk: "INVENTORY#<inventoryId>#<ENTITY_TYPE>",  // Modified
  sk: "<id>"
}
```

### Rate Limit Record

```javascript
{
  userId: string,
  endpoint: string,
  count: number,
  windowStart: number,     // Unix timestamp
  expiresAt: number,       // TTL for DynamoDB
  
  // DynamoDB keys
  pk: "RATELIMIT#<userId>#<endpoint>",
  sk: "<windowStart>"
}
```

### Audit Log

```javascript
{
  id: string,              // UUID
  timestamp: string,       // ISO 8601 timestamp
  eventType: string,       // "auth", "data_access", "authz_failure", "rate_limit"
  userId: string,          // User ID (if available)
  ipAddress: string,       // Client IP
  userAgent: string,       // Client user agent
  action: string,          // "create", "read", "update", "delete", "login", etc.
  resource: string,        // Resource identifier
  success: boolean,        // Whether action succeeded
  details: object,         // Additional event-specific details
  
  // DynamoDB keys
  pk: "AUDITLOG#<date>",   // Partition by date for efficient queries
  sk: "<timestamp>#<id>"
}
```

### AWS WAF Configuration

```yaml
WebACL:
  - AWS Managed Rules - Core Rule Set (CRS)
  - AWS Managed Rules - Known Bad Inputs
  - Custom Rate Limiting Rule (optional, as backup to application-level)
  
Rules:
  - AWSManagedRulesCommonRuleSet:
      - SQL injection protection
      - XSS protection
      - Path traversal protection
      - Remote file inclusion protection
  
  - AWSManagedRulesKnownBadInputsRuleSet:
      - Known malicious patterns
      - CVE-based protections
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Inventory Access Control Properties

**Property 1: Inventory creation assigns ownership**
*For any* user creating an inventory, the created inventory should have that user as the owner with an owner role in the membership table.
**Validates: Requirements 1.1**

**Property 2: Entity creation associates inventory**
*For any* entity creation operation, the created entity should have the inventoryId field set to the specified inventory.
**Validates: Requirements 1.2**

**Property 3: Entity listing respects inventory access**
*For any* user requesting a list of entities, the returned list should contain only entities from inventories where the user is an owner or member.
**Validates: Requirements 1.3**

**Property 4: Membership grant creates record**
*For any* inventory owner granting access to another user, a membership record should be created linking the user to the inventory with the correct role.
**Validates: Requirements 1.4**

**Property 5: Unauthorized access is rejected**
*For any* user attempting to access an entity from an inventory they don't have access to, the request should be rejected with an authorization error.
**Validates: Requirements 1.5**

**Property 6: Write operations require inventory access**
*For any* user attempting to update or delete an entity, the operation should only succeed if the user has access to the entity's inventory.
**Validates: Requirements 1.6, 1.7**

**Property 7: Membership removal revokes access**
*For any* inventory member who is removed, that user should no longer have access to any entities in that inventory.
**Validates: Requirements 1.8**

### Input Validation Properties

**Property 8: String sanitization removes malicious content**
*For any* string input containing potentially malicious patterns (script tags, SQL injection attempts), the sanitized output should not contain executable code.
**Validates: Requirements 2.1**

**Property 9: Schema validation catches invalid data**
*For any* entity data with invalid types or missing required fields, schema validation should reject the data and return validation errors.
**Validates: Requirements 2.2**

**Property 10: Special characters are properly encoded**
*For any* input containing special characters, the sanitized output should have those characters properly escaped or encoded to prevent injection attacks.
**Validates: Requirements 2.4**

**Property 11: Recursive validation checks nested structures**
*For any* nested object or array with invalid data at any depth, recursive validation should detect and report the validation error.
**Validates: Requirements 2.5**

### Photo Access Control Properties

**Property 12: Upload URLs include user identifier**
*For any* photo upload operation, the generated presigned URL should include the user's identifier in the S3 key path.
**Validates: Requirements 3.1**

**Property 13: Photo download requires entity access**
*For any* user requesting a photo download, a download URL should only be generated if the user has access to the entity associated with that photo.
**Validates: Requirements 3.2, 3.4**

**Property 14: Presigned URLs have short expiration**
*For any* presigned URL generated, the expiration time should be no more than 15 minutes from generation time.
**Validates: Requirements 3.3**

**Property 15: Photo deletion requires access**
*For any* user attempting to delete a photo, the deletion should only succeed if the user has access to the entity associated with that photo.
**Validates: Requirements 3.5**

### Rate Limiting Properties

**Property 16: Request tracking increments counter**
*For any* API request made by a user to an endpoint, the request counter for that user-endpoint-window combination should increment by one.
**Validates: Requirements 4.1**

**Property 17: Window expiry resets counter**
*For any* rate limit counter, after the time window expires, the counter should be reset to zero for new requests.
**Validates: Requirements 4.4**

**Property 18: Rate limit violations are logged**
*For any* user exceeding the rate limit, an audit log entry should be created with the user identifier, endpoint, and timestamp.
**Validates: Requirements 4.5**

### Audit Logging Properties

**Property 19: Authentication attempts are logged**
*For any* authentication attempt, an audit log entry should be created containing the timestamp, user identifier, IP address, and success status.
**Validates: Requirements 5.1**

**Property 20: Write operations are logged**
*For any* create, update, or delete operation, an audit log entry should be created containing the action, entity type, entity ID, and user identifier.
**Validates: Requirements 5.2**

**Property 21: Authorization failures are logged**
*For any* authorization failure, an audit log entry should be created containing the attempted action, user identifier, target resource, and failure reason.
**Validates: Requirements 5.3**

**Property 22: Audit logs have integrity protection**
*For any* audit log entry written, the entry should include cryptographic integrity checks (hash or signature) to detect tampering.
**Validates: Requirements 5.5**

### Security Headers Properties

**Property 23: All responses include security headers**
*For any* HTTP response, the response should include all required security headers: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, and X-XSS-Protection with correct values.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Error Handling Properties

**Property 24: Client errors are generic**
*For any* error returned to the client, the error message should not contain stack traces, database schema details, or internal implementation details.
**Validates: Requirements 7.1, 7.3**

**Property 25: Server errors are logged with details**
*For any* error that occurs, detailed error information including stack traces should be logged server-side for debugging.
**Validates: Requirements 7.2**

**Property 26: Validation errors are informative but safe**
*For any* validation error, the error message should specify which fields failed validation without exposing internal validation logic or system architecture.
**Validates: Requirements 7.5**

### JWT Validation Properties

**Property 27: JWT validation checks all claims**
*For any* JWT token being validated, the validation should verify the signature, issuer, audience, and expiration before accepting the token.
**Validates: Requirements 8.4**

**Property 28: JWT validation failures are logged**
*For any* JWT validation failure, an audit log entry should be created and an authentication error should be returned to the client.
**Validates: Requirements 8.5**

### CORS Protection Properties

**Property 29: Origin validation for state-changing requests**
*For any* state-changing request (POST, PUT, DELETE), the system should validate that the Origin or Referer header matches the expected application domain.
**Validates: Requirements 9.1, 9.3**

## Error Handling

### Error Categories

1. **Authentication Errors (401)**
   - Invalid or expired JWT
   - Missing authorization header
   - JWT signature verification failure

2. **Authorization Errors (403)**
   - User lacks access to inventory
   - User attempting to access another user's resources
   - Invalid inventory membership

3. **Validation Errors (400)**
   - Invalid input format
   - Missing required fields
   - Schema validation failures
   - String length violations

4. **Rate Limit Errors (429)**
   - Request rate exceeded
   - Includes Retry-After header

5. **Server Errors (500)**
   - Database errors
   - S3 errors
   - Unexpected exceptions

### Error Response Format

```javascript
{
  error: string,           // Generic error message for client
  statusCode: number,      // HTTP status code
  requestId: string        // For correlation with server logs
}
```

### Error Logging

All errors are logged server-side with:
- Full stack trace
- Request context (user, endpoint, parameters)
- Timestamp
- Error category
- Request ID for correlation

## Testing Strategy

### Unit Testing

Unit tests will cover:
- Individual validation functions with various inputs
- Sanitization functions with malicious patterns
- Access control logic with different user-inventory combinations
- Rate limiting counter logic
- Audit log formatting
- Security header generation
- Error message formatting

### Property-Based Testing

Property-based tests will be implemented using **fast-check** for JavaScript/Node.js. Each correctness property listed above will be implemented as a property-based test.

**Configuration**:
- Minimum 100 iterations per property test
- Custom generators for:
  - User IDs (UUIDs)
  - Inventory IDs (UUIDs)
  - Entity data with various field combinations
  - Malicious input patterns (XSS, SQL injection)
  - JWT tokens with various claims
  - HTTP requests with various headers

**Test Tagging**:
Each property-based test will include a comment tag in this format:
```javascript
// Feature: security-enhancements, Property X: [property description]
```

### Integration Testing

Integration tests will verify:
- End-to-end inventory creation and membership management
- Complete request flow through authentication, authorization, and business logic
- Photo upload and download with access control
- Rate limiting across multiple requests
- Audit log creation for various operations

### Security Testing

Security-specific tests will include:
- Penetration testing with OWASP ZAP or similar tools
- SQL injection and XSS attempt verification
- CORS policy validation
- TLS configuration verification
- JWT token manipulation attempts
- Rate limit bypass attempts

### Infrastructure Testing

Infrastructure tests will verify:
- CloudFront HTTPS enforcement
- AWS WAF rule effectiveness
- API Gateway Cognito authorizer configuration
- DynamoDB encryption at rest
- S3 bucket security policies

## Deployment Considerations

### CloudFront Configuration

- Enable HTTPS only (redirect HTTP to HTTPS)
- Associate with AWS WAF WebACL
- Configure custom domain with ACM certificate
- Enable AWS Shield Standard (automatic)
- Set security headers at edge

### API Gateway Configuration

- Enable Cognito authorizer on all protected routes
- Configure CORS with specific origin (no wildcards in production)
- Enable CloudWatch logging
- Set throttling limits as backup to application-level rate limiting

### Lambda Configuration

- Set environment variables for security configuration
- Enable X-Ray tracing for security monitoring
- Configure VPC access if needed for enhanced security
- Set appropriate IAM roles with least privilege

### DynamoDB Configuration

- Enable encryption at rest
- Enable point-in-time recovery
- Configure TTL for rate limit records (auto-cleanup)
- Set up CloudWatch alarms for unusual access patterns

### S3 Configuration

- Enable encryption at rest (AES-256 or KMS)
- Block all public access
- Enable versioning for photo recovery
- Configure lifecycle policies for old versions
- Enable CloudTrail logging for access auditing

### Monitoring and Alerting

Set up CloudWatch alarms for:
- High rate of authentication failures
- High rate of authorization failures
- Rate limit violations exceeding threshold
- WAF rule blocks exceeding threshold
- Unusual API error rates
- DynamoDB throttling events

## Security Maintenance

### Regular Security Tasks

1. **Weekly**:
   - Review audit logs for suspicious patterns
   - Check CloudWatch alarms and metrics
   - Review WAF blocked requests

2. **Monthly**:
   - Run dependency vulnerability scans
   - Review and update WAF rules if needed
   - Analyze rate limit patterns
   - Review user access patterns

3. **Quarterly**:
   - Conduct security assessment
   - Review and update security policies
   - Test incident response procedures
   - Update TLS configuration if needed

4. **Annually**:
   - Full security audit
   - Penetration testing
   - Review and update security documentation
   - Security training for team

### Incident Response

In case of security incident:
1. Identify and contain the threat
2. Review audit logs for scope of impact
3. Revoke compromised credentials
4. Patch vulnerabilities
5. Notify affected users if required
6. Document incident and lessons learned
7. Update security controls to prevent recurrence
