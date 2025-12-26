# Inventory System Integration

This document describes the integration between the inventory management system and the moving & storage system, including data synchronization, migration tools, and consistency validation.

## Overview

The inventory system integration ensures seamless operation between the core inventory management features and the new moving & storage capabilities. This includes:

- **Data Synchronization**: Real-time sync between inventory items and containers
- **Conflict Resolution**: Handling concurrent updates and data conflicts
- **Data Migration**: Tools to migrate existing inventory data to support containers
- **Consistency Validation**: Automated checks to ensure data integrity

## Data Synchronization Service

### Purpose
The Data Synchronization Service ensures that changes in one module are properly reflected in the other, maintaining data consistency across the entire system.

### Key Features

#### Container Move Synchronization
When a container is moved to a new location, all items within that container are automatically updated to reflect the new location.

```javascript
const result = await dataSynchronizationService.synchronizeContainerMove(
  containerId,
  inventoryId,
  newLocationId,
  userId
);
```

#### Item Transfer Synchronization
When items are moved between containers, their location and container references are updated atomically.

```javascript
const result = await dataSynchronizationService.synchronizeItemTransfer(
  itemIds,
  sourceContainerId,
  targetContainerId,
  inventoryId,
  userId
);
```

#### Data Consistency Validation
Validates that container item counts, estimated values, and location references are consistent.

```javascript
const result = await dataSynchronizationService.validateDataConsistency(
  inventoryId,
  userId
);
```

#### Conflict Detection and Resolution
Detects concurrent updates and provides resolution strategies.

```javascript
// Detect conflicts
const conflict = await dataSynchronizationService.detectConcurrentUpdateConflict(
  entityType,
  entityId,
  inventoryId,
  expectedVersion
);

// Resolve conflicts
const result = await dataSynchronizationService.resolveConcurrentUpdateConflict(
  conflict,
  localChanges,
  strategy, // 'merge', 'overwrite', or 'reject'
  userId
);
```

## Data Migration Service

### Purpose
The Data Migration Service provides tools to migrate existing inventory data to support the new container-based organization system.

### Key Features

#### Inventory Migration
Migrates an entire inventory to support containers by automatically creating containers and assigning items.

```javascript
const result = await dataMigrationService.migrateInventoryToContainerSupport(
  inventoryId,
  userId,
  {
    createDefaultContainers: true,
    groupByLocation: true,
    groupByCategory: false,
    maxItemsPerContainer: 50,
    dryRun: false
  }
);
```

#### Container Creation from Locations
Creates containers based on existing location data, grouping items by their current locations.

```javascript
const result = await dataMigrationService.createContainersFromLocations(
  inventoryId,
  userId,
  {
    containerPrefix: 'Location Container',
    maxItemsPerContainer: 50,
    dryRun: false
  }
);
```

#### Bulk Container Creation
Creates multiple containers from specifications.

```javascript
const containerSpecs = [
  { name: 'Kitchen Box 1', type: 'box', locationId: 'kitchen-id' },
  { name: 'Bedroom Bag 1', type: 'bag', locationId: 'bedroom-id' }
];

const result = await dataMigrationService.bulkCreateContainers(
  inventoryId,
  containerSpecs,
  userId
);
```

#### Data Validation and Cleanup
Validates and cleans up existing data to ensure consistency.

```javascript
const result = await dataMigrationService.validateAndCleanupData(
  inventoryId,
  userId,
  {
    fixOrphanedItems: true,
    updateContainerCounts: true,
    removeEmptyContainers: false,
    dryRun: false
  }
);
```

## Migration Scripts

### Inventory to Containers Migration Script
A command-line script to migrate existing inventories to support containers.

```bash
# Basic migration
node backend/scripts/migrate-inventory-to-containers.js

# Dry run to see what would be changed
node backend/scripts/migrate-inventory-to-containers.js --dry-run

# Migrate specific inventory
node backend/scripts/migrate-inventory-to-containers.js --inventory-id abc-123-def

# Group by category instead of location
node backend/scripts/migrate-inventory-to-containers.js --group-by-category

# Smaller containers with output file
node backend/scripts/migrate-inventory-to-containers.js --max-items 25 --output results.json
```

### Data Validation Script
A command-line script to validate data consistency and perform cleanup operations.

```bash
# Basic validation
node backend/scripts/validate-container-data.js

# Validate and auto-fix issues
node backend/scripts/validate-container-data.js --auto-fix

# Full cleanup with dry run
node backend/scripts/validate-container-data.js --cleanup --remove-empty --dry-run

# Validate specific inventory with strict mode
node backend/scripts/validate-container-data.js --inventory-id abc-123 --strict
```

## API Endpoints

### Data Synchronization Endpoints

- `POST /data-sync/container-move` - Synchronize container move
- `POST /data-sync/item-transfer` - Synchronize item transfer
- `POST /data-sync/validate-consistency` - Validate data consistency
- `POST /data-sync/resolve-inconsistencies` - Resolve data inconsistencies
- `POST /data-sync/detect-conflicts` - Detect concurrent update conflicts
- `POST /data-sync/resolve-conflicts` - Resolve concurrent update conflicts

### Data Migration Endpoints

- `POST /data-migration/migrate-inventory` - Migrate inventory to container support
- `POST /data-migration/create-from-locations` - Create containers from locations
- `POST /data-migration/bulk-create-containers` - Bulk create containers
- `POST /data-migration/validate-cleanup` - Validate and cleanup data

## Error Handling

### Common Error Types

1. **Access Denied**: User doesn't have access to the inventory
2. **Validation Errors**: Data doesn't meet validation requirements
3. **Conflict Errors**: Concurrent updates detected
4. **Consistency Errors**: Data inconsistencies found
5. **Migration Errors**: Issues during data migration

### Error Response Format

```json
{
  "success": false,
  "error": "ERROR_TYPE",
  "message": "Human-readable error message",
  "details": {
    "additionalInfo": "value"
  }
}
```

## Audit Logging

All synchronization and migration operations are logged for audit purposes:

- **Sync Operations**: Container moves, item transfers, conflict resolutions
- **Migration Operations**: Inventory migrations, bulk operations, data cleanup
- **Validation Operations**: Consistency checks, error corrections

## Best Practices

### Before Migration
1. **Backup Data**: Always backup your data before running migration scripts
2. **Dry Run**: Use dry run mode to preview changes before applying them
3. **Test Environment**: Test migrations in a development environment first

### During Migration
1. **Monitor Progress**: Watch for errors and warnings during migration
2. **Validate Results**: Run consistency validation after migration
3. **Handle Errors**: Address any errors or inconsistencies found

### After Migration
1. **Verify Data**: Ensure all data migrated correctly
2. **Test Functionality**: Test both inventory and moving features
3. **Monitor Performance**: Watch for any performance impacts

### Ongoing Maintenance
1. **Regular Validation**: Run consistency checks periodically
2. **Monitor Conflicts**: Watch for and resolve concurrent update conflicts
3. **Audit Logs**: Review audit logs for unusual activity

## Troubleshooting

### Common Issues

1. **Orphaned Items**: Items referencing non-existent containers
   - **Solution**: Run data cleanup with `fixOrphanedItems: true`

2. **Inconsistent Counts**: Container item counts don't match actual items
   - **Solution**: Run data cleanup with `updateContainerCounts: true`

3. **Location Mismatches**: Items and containers have different locations
   - **Solution**: Run consistency validation and resolve inconsistencies

4. **Concurrent Update Conflicts**: Multiple users modifying the same data
   - **Solution**: Implement conflict resolution strategies in your application

### Getting Help

If you encounter issues with the integration:

1. Check the audit logs for detailed error information
2. Run the validation script to identify specific problems
3. Use dry run mode to test fixes before applying them
4. Review the error messages and details for guidance

## Performance Considerations

### Large Inventories
- Use pagination when processing large numbers of items
- Consider running migrations during off-peak hours
- Monitor database performance during bulk operations

### Concurrent Users
- Implement optimistic locking to handle concurrent updates
- Use conflict resolution strategies appropriate for your use case
- Consider user notifications for conflict situations

### Database Optimization
- Ensure proper indexing for container and item queries
- Use batch operations for bulk updates
- Monitor query performance and optimize as needed