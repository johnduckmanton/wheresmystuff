# DynamoDB Schema Documentation

This document describes the DynamoDB table schema for the Home Inventory Management System with security enhancements.

## Single Table Design

The system uses a single DynamoDB table (`home-inventory-{environment}`) with a single table design pattern to store all data types efficiently.

## Table Structure

### Primary Keys
- **Partition Key (pk)**: Primary partition key
- **Sort Key (sk)**: Primary sort key

### Global Secondary Indexes

#### GSI1 - User and Inventory Queries
- **Partition Key (gsi1pk)**: Secondary partition key for user-based queries
- **Sort Key (gsi1sk)**: Secondary sort key for user-based queries
- **Projection**: ALL attributes

#### AuditLogDateIndex - Date-based Audit Log Queries
- **Partition Key (gsi1pk)**: Date-based partition for audit logs
- **Sort Key (gsi1sk)**: Timestamp-based sort for audit logs
- **Projection**: ALL attributes

### Time To Live (TTL)
- **Attribute**: `ttl`
- **Purpose**: Automatic cleanup of rate limit records and old audit logs

## Data Patterns

### 1. Inventory Metadata

**Access Pattern**: Get inventory details by ID

```
pk: INVENTORY#<inventoryId>
sk: METADATA
gsi1pk: USER#<ownerId>
gsi1sk: INVENTORY#<inventoryId>

Attributes:
{
  id: "<inventoryId>",
  name: "My Inventory",
  description: "Inventory description",
  ownerId: "<userId>",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

### 2. Inventory Membership

**Access Pattern**: Get inventory members, check user access to inventory

```
pk: INVENTORY#<inventoryId>
sk: MEMBER#<userId>
gsi1pk: USER#<userId>
gsi1sk: MEMBER#<inventoryId>

Attributes:
{
  inventoryId: "<inventoryId>",
  userId: "<userId>",
  role: "owner|member",
  addedAt: "2024-01-01T00:00:00.000Z",
  addedBy: "<addedByUserId>"
}
```

### 3. Entities (Things, Locations, Rooms, Categories, People)

**Access Pattern**: Get entities by inventory and type, get specific entity

```
pk: INVENTORY#<inventoryId>#<ENTITY_TYPE>
sk: <entityId>
gsi1pk: INVENTORY#<inventoryId>
gsi1sk: <ENTITY_TYPE>#<entityId>

Attributes:
{
  data: {
    id: "<entityId>",
    inventoryId: "<inventoryId>",
    name: "Entity Name",
    description: "Entity description",
    dateAdded: "2024-01-01T00:00:00.000Z",
    // ... entity-specific fields
  }
}
```

**Entity Types**:
- `THINGS` - Physical items
- `LOCATIONS` - Physical locations/addresses
- `ROOMS` - Rooms within locations
- `CATEGORIES` - Item categories
- `PEOPLE` - People associated with items

### 4. Rate Limit Records

**Access Pattern**: Check and update rate limits per user per endpoint

```
pk: RATELIMIT#<userId>#<endpoint>
sk: <windowStart>
ttl: <expirationTimestamp>

Attributes:
{
  userId: "<userId>",
  endpoint: "/things",
  count: 15,
  windowStart: 1704067200,
  expiresAt: 1704067260
}
```

### 5. Audit Log Records

**Access Pattern**: Query audit logs by date, by user, by event type

```
pk: AUDITLOG#<date>
sk: <timestamp>#<logId>
gsi1pk: AUDITLOG#<eventType>
gsi1sk: <timestamp>#<logId>
ttl: <expirationTimestamp> (optional, for log retention)

Attributes:
{
  id: "<logId>",
  timestamp: "2024-01-01T00:00:00.000Z",
  eventType: "auth|data_access|authz_failure|rate_limit",
  userId: "<userId>",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  action: "create|read|update|delete|login|logout",
  resource: "INVENTORY#<inventoryId>#THINGS#<thingId>",
  success: true,
  details: {
    // Event-specific details
  },
  integrity: "<hmac-signature>"
}
```

## Query Patterns

### User Operations

1. **Get user's inventories**:
   ```
   GSI1: gsi1pk = USER#<userId> AND begins_with(gsi1sk, "INVENTORY#")
   ```

2. **Get user's inventory memberships**:
   ```
   GSI1: gsi1pk = USER#<userId> AND begins_with(gsi1sk, "MEMBER#")
   ```

### Inventory Operations

3. **Get inventory metadata**:
   ```
   Primary: pk = INVENTORY#<inventoryId> AND sk = METADATA
   ```

4. **Get inventory members**:
   ```
   Primary: pk = INVENTORY#<inventoryId> AND begins_with(sk, "MEMBER#")
   ```

5. **Get all entities in inventory**:
   ```
   GSI1: gsi1pk = INVENTORY#<inventoryId>
   ```

6. **Get specific entity type in inventory**:
   ```
   Primary: pk = INVENTORY#<inventoryId>#<ENTITY_TYPE>
   ```

7. **Get specific entity**:
   ```
   Primary: pk = INVENTORY#<inventoryId>#<ENTITY_TYPE> AND sk = <entityId>
   ```

### Security Operations

8. **Check rate limit**:
   ```
   Primary: pk = RATELIMIT#<userId>#<endpoint> AND sk = <currentWindow>
   ```

9. **Get audit logs by date**:
   ```
   Primary: pk = AUDITLOG#<date>
   ```

10. **Get audit logs by event type**:
    ```
    AuditLogDateIndex: gsi1pk = AUDITLOG#<eventType>
    ```

## Access Control

### Inventory Access Check
To verify if a user has access to an inventory:

1. Query: `pk = INVENTORY#<inventoryId> AND sk = MEMBER#<userId>`
2. If record exists, user has access with the specified role
3. If no record, user has no access

### Entity Access Check
To verify if a user can access an entity:

1. Extract `inventoryId` from entity data
2. Perform inventory access check (above)
3. If user has inventory access, they can access the entity

## Performance Considerations

### Hot Partitions
- Audit logs are partitioned by date to distribute load
- Rate limits are partitioned by user and endpoint
- Entities are partitioned by inventory and type

### Query Efficiency
- Most queries use either primary key or GSI for efficient access
- Batch operations use batch get/write for multiple items
- Pagination is supported for large result sets

### Cost Optimization
- TTL automatically removes expired rate limit records
- TTL can be configured for audit log retention
- On-demand billing scales with actual usage

## Migration Considerations

### From Single-User to Multi-User
The migration script handles:

1. **User Identification**: Scans existing data to identify unique users
2. **Inventory Creation**: Creates default inventory for each user
3. **Membership Creation**: Creates owner membership records
4. **Entity Migration**: Updates entity keys to include inventory ID
5. **Data Validation**: Ensures migration integrity

### Backward Compatibility
- Old entity access patterns are updated during migration
- New code handles both old and new data formats during transition
- Migration can be run incrementally for large datasets

## Security Features

### Data Isolation
- Entities are partitioned by inventory ID
- Users can only access inventories they're members of
- Cross-inventory data access is prevented at the query level

### Audit Trail
- All operations are logged with cryptographic integrity
- Logs include user context, IP address, and operation details
- Failed operations are logged for security monitoring

### Rate Limiting
- Per-user, per-endpoint rate limiting
- Automatic cleanup of expired rate limit records
- Configurable limits and time windows