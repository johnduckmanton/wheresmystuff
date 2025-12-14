# Infrastructure Overview

## AWS Resources Created

This document provides a quick reference for the AWS infrastructure components.

### 1. Cognito User Pool

**Purpose**: Authentication and user management

**Configuration**:
- Username: Email address
- Auto-verified attributes: Email
- Password policy:
  - Minimum length: 8 characters
  - Requires uppercase: Yes
  - Requires lowercase: Yes
  - Requires numbers: Yes
  - Requires symbols: No
- Account recovery: Via verified email

**Outputs**:
- User Pool ID: Used for authentication configuration
- User Pool Client ID: Used for frontend authentication

### 2. DynamoDB Table

**Purpose**: Single-table design for all entity storage

**Configuration**:
- Table name: `home-inventory-{environment}`
- Billing mode: Pay-per-request (on-demand)
- Partition key (pk): String - Entity type
- Sort key (sk): String - UUID
- Point-in-time recovery: Enabled
- Streams: Enabled (NEW_AND_OLD_IMAGES)

**Entity Types** (pk values):
- `THINGS` - Inventory items
- `LOCATIONS` - Physical addresses
- `ROOMS` - Rooms within locations
- `CATEGORIES` - Item categories
- `PEOPLE` - Item owners

**Item Structure**:
```json
{
  "pk": "THINGS",
  "sk": "uuid-here",
  "data": {
    "name": "Item name",
    "description": "...",
    ...
  }
}
```

**Query Patterns**:
1. List all entities of type: Query by pk
2. Get specific entity: Query by pk + sk
3. Filter by attributes: Query by pk, filter in application

### 3. S3 Bucket

**Purpose**: Photo storage with presigned URL access

**Configuration**:
- Bucket name: `home-inventory-photos-{AccountId}-{environment}`
- Public access: Blocked (all settings)
- Versioning: Enabled
- CORS: Configured for presigned URLs
  - Allowed origins: * (configure for production)
  - Allowed methods: GET, PUT, POST, DELETE
  - Allowed headers: *
  - Max age: 3000 seconds

**Lifecycle Rules**:
- Delete incomplete multipart uploads after 7 days

**Object Key Pattern**:
```
photos/{thing-uuid}/{timestamp}-{filename}
```

### 4. API Gateway (HTTP API)

**Purpose**: RESTful API for frontend-backend communication

**Configuration**:
- Type: HTTP API (lower latency than REST API)
- Stage: Environment name (dev, prod, etc.)
- Authorization: Cognito JWT authorizer
- CORS: Enabled for all origins

**Endpoints**:

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | /things | ThingsFunction | List all things |
| POST | /things | ThingsFunction | Create thing |
| PUT | /things/{id} | ThingsFunction | Update thing |
| DELETE | /things/{id} | ThingsFunction | Delete thing |
| GET | /locations | LocationsFunction | List all locations |
| POST | /locations | LocationsFunction | Create location |
| PUT | /locations/{id} | LocationsFunction | Update location |
| DELETE | /locations/{id} | LocationsFunction | Delete location |
| GET | /rooms | RoomsFunction | List rooms (with query params) |
| POST | /rooms | RoomsFunction | Create room |
| PUT | /rooms/{id} | RoomsFunction | Update room |
| DELETE | /rooms/{id} | RoomsFunction | Delete room |
| GET | /categories | CategoriesFunction | List all categories |
| POST | /categories | CategoriesFunction | Create category |
| PUT | /categories/{id} | CategoriesFunction | Update category |
| DELETE | /categories/{id} | CategoriesFunction | Delete category |
| GET | /people | PeopleFunction | List all people |
| POST | /people | PeopleFunction | Create person |
| PUT | /people/{id} | PeopleFunction | Update person |
| DELETE | /people/{id} | PeopleFunction | Delete person |
| POST | /upload | PhotoFunction | Generate presigned upload URL |
| GET | /photo/{key} | PhotoFunction | Generate presigned download URL |

**Authentication**:
- All endpoints require valid JWT token in Authorization header
- JWT issued by Cognito User Pool
- Token validated by API Gateway authorizer

### 5. Lambda Functions

**Purpose**: Backend business logic

**Configuration**:
- Runtime: Node.js 20.x
- Memory: 512 MB
- Timeout: 30 seconds
- Environment variables:
  - TABLE_NAME: DynamoDB table name
  - BUCKET_NAME: S3 bucket name
  - USER_POOL_ID: Cognito User Pool ID

**Functions**:
1. **ThingsFunction** - Things CRUD operations
2. **LocationsFunction** - Locations CRUD operations
3. **RoomsFunction** - Rooms CRUD operations
4. **CategoriesFunction** - Categories CRUD operations
5. **PeopleFunction** - People CRUD operations
6. **PhotoFunction** - Photo upload/download URL generation

**IAM Permissions**:
- DynamoDB: Full CRUD access to InventoryTable
- S3: Full CRUD access to PhotoBucket (PhotoFunction only)

## Security

### Authentication Flow
1. User signs in with email/password via Cognito
2. Cognito returns JWT token
3. Frontend includes JWT in Authorization header
4. API Gateway validates JWT with Cognito
5. Lambda function executes if token is valid

### Data Access
- DynamoDB: Private, accessed only by Lambda functions
- S3: Private, accessed via presigned URLs (1-hour expiration)
- API: Protected by Cognito JWT authorizer

### CORS
- Currently configured for all origins (*)
- **Production**: Update to specific frontend domain

## Cost Optimization

**DynamoDB**:
- Pay-per-request billing (no idle costs)
- Efficient single-table design reduces costs

**Lambda**:
- Pay only for execution time
- 512 MB memory allocation balances cost and performance

**S3**:
- Standard storage class
- Lifecycle rules clean up incomplete uploads

**API Gateway**:
- HTTP API (cheaper than REST API)
- Pay per request

## Monitoring

**CloudWatch Logs**:
- Lambda function logs: `/aws/lambda/{FunctionName}`
- API Gateway logs: Enabled in stage settings

**CloudWatch Metrics**:
- Lambda: Invocations, errors, duration, throttles
- DynamoDB: Read/write capacity, throttles
- API Gateway: Request count, latency, errors

**Alarms** (to be configured):
- Lambda error rate > threshold
- API Gateway 5xx errors > threshold
- DynamoDB throttling events

## Backup and Recovery

**DynamoDB**:
- Point-in-time recovery enabled
- Can restore to any point in last 35 days

**S3**:
- Versioning enabled
- Can recover deleted or overwritten objects

## Scaling

**DynamoDB**:
- On-demand billing automatically scales
- No capacity planning required

**Lambda**:
- Automatically scales with concurrent requests
- Default: 1000 concurrent executions per region

**API Gateway**:
- Automatically scales
- Default: 10,000 requests per second per region

## Requirements Validation

This infrastructure satisfies the following requirements:

- **Requirement 1.1**: Cognito User Pool with password policy (min 8 chars, uppercase, lowercase, numbers) ✓
- **Requirement 16.1**: JWT authentication on all data endpoints ✓
- **Requirement 16.5**: S3 bucket with private access ✓
- **Requirement 19.1**: DynamoDB partition key = entity type ✓
- **Requirement 19.2**: DynamoDB sort key = UUID ✓
