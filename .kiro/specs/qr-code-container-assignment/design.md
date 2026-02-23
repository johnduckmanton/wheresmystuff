# Design Document: QR Code Container Assignment

## Overview

This feature integrates QR code generation, scanning, and label printing capabilities into the existing container management system. The design builds upon the existing QR code service, container service, and scan history service to provide a seamless experience for users to identify and track containers using QR codes.

The system automatically generates QR codes when containers are created, allows users to scan QR codes to quickly locate containers and view their contents, and provides printable labels for physical attachment to containers. The implementation follows the existing architecture patterns and integrates with the current DynamoDB data model, S3 storage, and Lambda-based API handlers.

Key design principles:
- Non-blocking QR code generation (container creation succeeds even if QR generation fails)
- Cross-inventory container search for flexible QR scanning
- Comprehensive scan history tracking for audit and user convenience
- Support for both camera-based scanning and manual lookup fallback
- Printable labels in multiple sizes for different container types

## Architecture

### System Components

The feature consists of the following components:

1. **QR Code Service** (existing, enhanced)
   - Generates unique QR codes for containers
   - Validates and decodes QR code data
   - Stores QR code images in S3
   - Handles batch QR code generation

2. **Label Service** (existing, enhanced)
   - Generates printable labels with QR codes
   - Supports multiple label sizes (small, medium, large)
   - Creates label sheets for batch printing
   - Stores labels in S3 with presigned URLs

3. **Scan History Service** (existing)
   - Records all scan events (successful and failed)
   - Tracks scan methods (camera, manual lookup)
   - Provides scan history with filtering and pagination
   - Maintains recent scans for quick access

4. **Container Service** (existing, enhanced)
   - Integrates QR code generation during container creation
   - Provides cross-inventory container search
   - Retrieves container contents for scan results
   - Updates container records with QR code metadata

5. **QR Code Handler** (existing, enhanced)
   - API endpoints for QR code operations
   - Handles authentication and authorization
   - Coordinates between services
   - Manages error responses and logging

### Data Flow

#### Container Creation with QR Code
```
User creates container
  → Container Service validates and creates container
  → QR Code Service generates unique QR code
  → QR code image stored in S3
  → Container record updated with QR code metadata
  → Container returned to user with QR code URL
```

#### QR Code Scanning
```
User scans QR code
  → QR Code Service validates and decodes QR code
  → Container Service searches across user's inventories
  → Container and contents retrieved
  → Scan event recorded in history
  → Container details and items returned to user
```

#### Label Generation
```
User requests label
  → Container Service retrieves container data
  → Label Service generates label with QR code
  → Label stored in S3
  → Presigned download URL returned to user
```

### Integration Points

- **DynamoDB**: Container records, scan history, inventory access control
- **S3**: QR code images, label images (QR_REPORT_BUCKET_NAME)
- **Cognito**: User authentication and authorization
- **API Gateway**: RESTful endpoints for all operations
- **CloudWatch**: Logging and security event tracking

## Components and Interfaces

### QR Code Service

**Location**: `backend/services/qrCodeService.js`

**Key Methods**:

```javascript
class QRCodeService {
  // Generate unique QR code ID for a container
  generateQRCodeId(containerId): string
  
  // Generate QR code image buffer
  generateQRCodeImage(qrCodeId, options): Promise<Buffer>
  
  // Store QR code image in S3
  storeQRCodeImage(containerId, imageBuffer, size): Promise<string>
  
  // Generate complete QR code for container
  generateContainerQRCode(containerId, size): Promise<QRCodeData>
  
  // Batch generate QR codes
  generateBatchQRCodes(containerIds, size): Promise<BatchResult>
  
  // Decode QR code to extract container info
  decodeQRCodeId(qrCodeId): Object
  
  // Validate QR code format and authenticity
  validateQRCode(qrCodeId): boolean
  
  // Scan and validate QR code
  scanQRCode(qrCodeData): ScanResult
}
```

**QR Code Format**:
```
CONT_{containerId}_{timestamp}_{uniqueId}
Example: CONT_abc123_1704067200000_a1b2c3d4
```

### Label Service

**Location**: `backend/services/labelService.js`

**Key Methods**:

```javascript
class LabelService {
  // Get label dimensions for size
  getLabelDimensions(size): Dimensions
  
  // Generate label for single container
  generateLabel(containerData, size): Promise<Buffer>
  
  // Create label SVG
  createLabelSVG(containerData, qrCodeSvg, dimensions): string
  
  // Batch generate labels
  generateBatchLabels(containersData, size): Promise<BatchResult>
  
  // Store label image in S3
  storeLabelImage(containerId, labelBuffer, size): Promise<string>
  
  // Generate label sheet for multiple containers
  generateLabelSheet(containersData, size, options): Promise<Buffer>
}
```

### Scan History Service

**Location**: `backend/services/scanHistoryService.js`

**Key Methods**:

```javascript
class ScanHistoryService {
  // Record scan event
  recordScan(userId, inventoryId, scanData): Promise<ScanEntry>
  
  // Get scan history with filtering
  getScanHistory(userId, options): Promise<HistoryResult>
  
  // Get recent successful scans
  getRecentSuccessfulScans(userId, inventoryId, limit): Promise<Array>
  
  // Cleanup old scan history
  cleanupOldScans(userId, daysToKeep): Promise<number>
}
```

### Container Service Enhancements

**Location**: `backend/services/containerService.js`

**Enhanced Methods**:

```javascript
class ContainerService {
  // Create container with automatic QR code generation
  async createContainer(containerData, userId): Promise<Container>
  
  // Find container across all user inventories
  async findContainerAcrossInventories(containerId, userId): Promise<ContainerResult>
  
  // Get container contents for scan results
  async getContainerContents(containerId, inventoryId, userId): Promise<ContentsResult>
}
```

### API Endpoints

**Location**: `backend/handlers/qrCode.js`

**Endpoints**:

1. `POST /containers/{containerId}/qr-code?inventoryId={id}&size={size}`
   - Generate QR code for container
   - Returns: QR code data with download URL

2. `POST /qr-codes/batch`
   - Generate QR codes for multiple containers
   - Body: `{ containerIds: [], size: 'medium' }`
   - Returns: Batch result with successful and failed generations

3. `POST /qr-codes/scan`
   - Scan QR code and retrieve container
   - Body: `{ qrCodeData: string, inventoryId?: string }`
   - Returns: Container details, items, and inventory ID

4. `POST /qr-codes/decode`
   - Decode and validate QR code
   - Body: `{ qrCodeId: string }`
   - Returns: Decoded container information

5. `POST /containers/lookup`
   - Manual container lookup (fallback)
   - Body: `{ containerId?: string, containerName?: string, inventoryId: string }`
   - Returns: Container details or multiple matches

6. `GET /qr-codes/history?inventoryId={id}&limit={n}&successOnly={bool}`
   - Get scan history
   - Returns: Paginated scan history

7. `GET /qr-codes/recent?inventoryId={id}&limit={n}`
   - Get recent successful scans
   - Returns: Recent scans for quick access

8. `POST /containers/{containerId}/label?inventoryId={id}&size={size}`
   - Generate printable label
   - Returns: Label data with download URL

9. `POST /labels/batch`
   - Generate labels for multiple containers
   - Body: `{ containerIds: [], inventoryId: string, size: 'medium', sheetFormat: false }`
   - Returns: Batch result with download URLs

## Data Models

### Container Model Enhancement

**Location**: `backend/models/container.js`

**Additional Fields**:

```javascript
{
  // Existing fields...
  qrCode: string,              // QR code identifier (e.g., "CONT_abc123_1704067200000_a1b2c3d4")
  qrCodeUrl: string,           // S3 key for QR code image
  qrCodeGeneratedAt: string    // ISO timestamp of QR code generation
}
```

### Scan History Entry

**DynamoDB Structure**:

```javascript
{
  pk: "USER#{userId}#SCAN_HISTORY",
  sk: "{timestamp}#{scanId}",
  id: string,                  // Unique scan ID
  userId: string,              // User who performed scan
  inventoryId: string,         // Inventory ID
  timestamp: string,           // ISO timestamp
  type: string,                // 'qr_scan', 'manual_lookup', 'container_search'
  success: boolean,            // Scan success status
  containerId: string,         // Container ID (if found)
  containerName: string,       // Container name (if found)
  qrCodeId: string,           // QR code identifier
  method: string,              // 'camera', 'manual_entry', 'name_search', 'id_lookup'
  error: string,              // Error message (if failed)
  itemCount: number,          // Number of items in container
  ttl: number                 // TTL for automatic cleanup (90 days)
}
```

### QR Code Data Structure

```javascript
{
  qrCodeId: string,           // Unique QR code identifier
  s3Key: string,              // S3 object key
  size: string,               // 'small', 'medium', 'large'
  containerId: string,        // Container ID
  generatedAt: string,        // ISO timestamp
  imageUrl: string,           // Full S3 URL
  downloadUrl: string         // Presigned download URL
}
```

### Label Data Structure

```javascript
{
  containerId: string,        // Container ID
  containerName: string,      // Container name
  s3Key: string,             // S3 object key for label
  size: string,              // 'small', 'medium', 'large'
  downloadUrl: string,       // Presigned download URL
  generatedAt: string        // ISO timestamp
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

After analyzing the acceptance criteria, I've identified the following properties. Note that I've performed property reflection to eliminate redundancy and combine related properties where appropriate.

### Property 1: QR Code Generation Uniqueness

*For any* two containers created in the system, their generated QR code identifiers should be unique.

**Validates: Requirements 1.1**

### Property 2: QR Code Storage in Container Record

*For any* container with a generated QR code, the container record should contain the QR code identifier in the qrCode field.

**Validates: Requirements 1.2**

### Property 3: QR Code Image Storage in S3

*For any* QR code generation, the QR code image should be stored in S3 and the S3 key should be returned in the response.

**Validates: Requirements 1.3**

### Property 4: QR Code Round-Trip Encoding

*For any* container ID and inventory ID, encoding them in a QR code and then decoding should return the same container ID and inventory ID.

**Validates: Requirements 1.4, 2.1**

### Property 5: Container Creation Resilience

*For any* container creation where QR code generation fails, the container should still be created successfully and the error should be logged.

**Validates: Requirements 1.5**

### Property 6: Container Retrieval After Scan

*For any* valid QR code that is successfully decoded, the system should retrieve the corresponding container record from the database.

**Validates: Requirements 2.2**

### Property 7: Complete Container Response

*For any* successful container lookup, the response should include both container details and the list of items in the container.

**Validates: Requirements 2.3, 4.1**

### Property 8: Invalid QR Code Error Handling

*For any* QR code with invalid format or expired timestamp, the system should return a descriptive error message without attempting database lookup.

**Validates: Requirements 2.4, 9.2**

### Property 9: Scan History Recording for Success

*For any* successful QR code scan, a scan history entry should be created with success=true, the container ID, container name, and timestamp.

**Validates: Requirements 2.6, 6.1, 6.2**

### Property 10: Scan History Recording for Failure

*For any* failed QR code scan, a scan history entry should be created with success=false and the error reason.

**Validates: Requirements 2.7**

### Property 11: Location Information in Scan Response

*For any* successful QR code scan, the response should include the container's location information (or indicate unassigned if no location).

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 12: Room Information Inclusion

*For any* container location that is associated with a room, the scan response should include the room information.

**Validates: Requirements 3.4**

### Property 13: Item Count Accuracy

*For any* container, the returned itemCount field should equal the length of the items array.

**Validates: Requirements 4.2**

### Property 14: Complete Item Details

*For any* item in a container scan response, the item should include name, quantity, and category fields.

**Validates: Requirements 4.3**

### Property 15: Contents Summary Inclusion

*For any* container scan response, the response should include the container's contentsSummary field.

**Validates: Requirements 4.5**

### Property 16: Label Generation Success

*For any* container with valid data, the system should successfully generate a printable label image.

**Validates: Requirements 5.1**

### Property 17: Label Content Completeness

*For any* generated label, the label should include the QR code image, container name, and container type.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 18: Label Download URL

*For any* label generation, the system should store the label in S3 and return a presigned download URL.

**Validates: Requirements 5.5, 5.7**

### Property 19: Label Size Support

*For any* label size parameter (small, medium, or large), the system should generate a label with appropriate dimensions.

**Validates: Requirements 5.6**

### Property 20: Scan History Chronological Order

*For any* scan history query, the results should be ordered in reverse chronological order (newest first).

**Validates: Requirements 6.3**

### Property 21: Scan History Pagination

*For any* scan history query with a limit parameter, the system should return at most that many results and provide a pagination token if more results exist.

**Validates: Requirements 6.4**

### Property 22: Scan History Inventory Filtering

*For any* scan history query with an inventoryId filter, all returned scans should belong to that inventory.

**Validates: Requirements 6.5**

### Property 23: Scan History Success Filtering

*For any* scan history query with successOnly=true, all returned scans should have success=true.

**Validates: Requirements 6.6**

### Property 24: Scan Method Recording

*For any* scan event, the scan history entry should include the method field indicating how the scan was performed (camera, manual_entry, name_search, id_lookup).

**Validates: Requirements 6.7**

### Property 25: Cross-Inventory Container Search

*For any* QR code scan without an inventoryId parameter, the system should search across all inventories the user has access to.

**Validates: Requirements 8.1**

### Property 26: Inventory ID in Cross-Inventory Response

*For any* successful cross-inventory container search, the response should include the inventoryId where the container was found.

**Validates: Requirements 8.2**

### Property 27: Access Control Enforcement

*For any* container access attempt, if the user does not have access to the container's inventory, the system should return an access denied error.

**Validates: Requirements 8.3, 8.4**

### Property 28: QR Code Format Validation

*For any* QR code input, the system should validate the format before attempting to decode or lookup the container.

**Validates: Requirements 9.1**

### Property 29: Required Fields Validation

*For any* QR code, the decoded data should contain both containerId and inventoryId fields (note: based on the QR code format, inventoryId is not encoded, only containerId).

**Validates: Requirements 9.3**

### Property 30: Security Event Logging

*For any* invalid QR code scan attempt, a security event should be logged with the validation error details.

**Validates: Requirements 9.4, 9.5**

### Property 31: Direct Container Lookup

*For any* valid container ID provided in a manual lookup, the system should retrieve that specific container.

**Validates: Requirements 10.1**

### Property 32: Container Name Search

*For any* container name provided in a manual lookup, the system should return all containers matching that name.

**Validates: Requirements 10.2**

### Property 33: Multiple Match Handling

*For any* container name search with multiple matches, the system should return a list of all matching containers for user selection.

**Validates: Requirements 10.3**

### Property 34: Exact Match Priority

*For any* container name search with an exact match, the system should return that container's full details.

**Validates: Requirements 10.4**

### Property 35: Manual Lookup History Recording

*For any* manual lookup operation, a scan history entry should be created with method type "manual_lookup".

**Validates: Requirements 10.5**

## Error Handling

### QR Code Generation Errors

**Strategy**: Non-blocking error handling
- Container creation proceeds even if QR code generation fails
- Errors are logged with full context (container ID, error message, stack trace)
- QR codes can be regenerated later via dedicated endpoint
- User is notified of QR generation failure but container is still usable

**Error Types**:
- S3 upload failures: Retry with exponential backoff, log error
- QR code library errors: Log error, continue without QR code
- Invalid container data: Validate before QR generation

### QR Code Scanning Errors

**Strategy**: Fail fast with descriptive errors
- Invalid format: Return error immediately without database lookup
- Expired QR code: Return error with expiration information
- Container not found: Return 404 with clear message
- Access denied: Return 403 with permission information

**Error Types**:
- `INVALID_QR_CODE`: Format validation failed
- `QR_DECODE_ERROR`: Unable to decode QR code data
- `CONTAINER_NOT_FOUND`: Container doesn't exist or user lacks access
- `ACCESS_DENIED`: User doesn't have permission to access inventory

### Label Generation Errors

**Strategy**: Validate inputs before generation
- Container not found: Return 404 error
- Access denied: Return 403 error
- Invalid size parameter: Return 400 error with valid options
- S3 upload failure: Retry with exponential backoff

**Error Types**:
- `CONTAINER_NOT_FOUND`: Container doesn't exist
- `ACCESS_DENIED`: User lacks permission
- `INVALID_SIZE`: Size parameter not in [small, medium, large]
- `LABEL_GENERATION_ERROR`: Image generation failed

### Scan History Errors

**Strategy**: Best-effort recording
- Scan history recording failures should not block scan operations
- Errors are logged but don't affect user experience
- Failed history writes are retried once

**Error Types**:
- `HISTORY_WRITE_ERROR`: Failed to write scan history
- `INVALID_PAGINATION_TOKEN`: Malformed lastEvaluatedKey

### Security Error Handling

**Strategy**: Log security events and fail securely
- All invalid QR code attempts are logged
- Access denied attempts are logged with user and resource info
- Rate limiting on scan endpoints to prevent abuse
- Suspicious patterns trigger security alerts

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific QR code format examples
- Empty container edge case (Requirement 4.4)
- Default size configuration (Requirement 1.6)
- 404 error for non-existent container (Requirement 2.5)
- Manual lookup without inventory ID (Requirement 10.6)
- Integration between services
- Error handling scenarios
- S3 upload mocking
- DynamoDB query mocking

**Property-Based Tests**: Verify universal properties across all inputs
- All 35 correctness properties listed above
- Minimum 100 iterations per property test
- Random generation of containers, QR codes, scan events
- Comprehensive input coverage through randomization

### Property-Based Testing Configuration

**Library**: `fast-check` (JavaScript/TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property reference
- Tag format: `Feature: qr-code-container-assignment, Property {number}: {property_text}`

**Example Property Test Structure**:

```javascript
import fc from 'fast-check';

describe('Feature: qr-code-container-assignment', () => {
  it('Property 4: QR Code Round-Trip Encoding', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // containerId
        fc.uuid(), // inventoryId
        (containerId, inventoryId) => {
          // Encode container ID in QR code
          const qrCodeId = qrCodeService.generateQRCodeId(containerId);
          
          // Decode QR code
          const decoded = qrCodeService.decodeQRCodeId(qrCodeId);
          
          // Verify round-trip
          expect(decoded.containerId).toBe(containerId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Data Generators

**Container Generator**:
```javascript
const containerArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.constantFrom('box', 'bin', 'bag', 'crate'),
  inventoryId: fc.uuid(),
  locationId: fc.option(fc.uuid()),
  itemCount: fc.nat({ max: 1000 }),
  contentsSummary: fc.string({ maxLength: 500 })
});
```

**QR Code Generator**:
```javascript
const qrCodeArb = fc.tuple(
  fc.uuid(), // containerId
  fc.nat(), // timestamp
  fc.hexaString({ minLength: 8, maxLength: 8 }) // uniqueId
).map(([containerId, timestamp, uniqueId]) => 
  `CONT_${containerId}_${timestamp}_${uniqueId}`
);
```

**Scan Event Generator**:
```javascript
const scanEventArb = fc.record({
  type: fc.constantFrom('qr_scan', 'manual_lookup', 'container_search'),
  success: fc.boolean(),
  containerId: fc.option(fc.uuid()),
  containerName: fc.option(fc.string()),
  qrCodeId: fc.option(qrCodeArb),
  method: fc.constantFrom('camera', 'manual_entry', 'name_search', 'id_lookup'),
  error: fc.option(fc.string())
});
```

### Integration Testing

**API Integration Tests**:
- Test complete request/response cycles
- Verify authentication and authorization
- Test error responses and status codes
- Verify S3 presigned URL generation
- Test pagination and filtering

**Service Integration Tests**:
- Test interaction between Container Service and QR Code Service
- Test interaction between QR Code Handler and Scan History Service
- Verify DynamoDB queries and updates
- Test S3 upload and retrieval

### End-to-End Testing

**User Workflows**:
1. Create container → Verify QR code generated → Scan QR code → Verify container retrieved
2. Generate label → Download label → Verify label contains QR code and container info
3. Scan QR code → View scan history → Verify scan recorded
4. Manual lookup → Verify container found → Verify history recorded
5. Cross-inventory scan → Verify correct inventory identified

### Performance Testing

**Load Testing**:
- Batch QR code generation with 50 containers
- Concurrent scan operations
- Scan history queries with large datasets
- Label sheet generation with multiple containers

**Benchmarks**:
- QR code generation: < 500ms per code
- QR code scan: < 1000ms end-to-end
- Label generation: < 2000ms per label
- Scan history query: < 500ms for 50 results

### Security Testing

**Security Test Cases**:
- Attempt to scan QR code for container in inaccessible inventory
- Attempt to generate label for container without permission
- Attempt to access scan history of another user
- Submit malformed QR code data
- Submit expired QR codes
- Rate limiting on scan endpoints

## Implementation Notes

### QR Code Format Considerations

The current QR code format (`CONT_{containerId}_{timestamp}_{uniqueId}`) does not include the inventory ID. This means:
- Cross-inventory search is required for all scans
- QR codes remain valid even if container is moved between inventories
- Inventory ID is determined at scan time by searching user's accessible inventories

**Alternative Consideration**: Include inventory ID in QR code format for faster lookups, but this would require QR code regeneration if containers move between inventories.

### Caching Strategy

The system currently has caching disabled for container operations to prevent stale data. For QR codes:
- QR code images are cached in the QR Code Service
- Cache key: `qr-code:{containerId}:{size}`
- Cache TTL: 24 hours
- Cache invalidation: On container deletion

### S3 Bucket Configuration

**Bucket**: `QR_REPORT_BUCKET_NAME` environment variable
**Structure**:
```
qr-codes/
  {containerId}/
    small_{timestamp}.png
    medium_{timestamp}.png
    large_{timestamp}.png
labels/
  {containerId}/
    small_{timestamp}.png
    medium_{timestamp}.png
    large_{timestamp}.png
  batch/
    sheet_{size}_{timestamp}.png
```

### Scan History TTL

Scan history entries have a 90-day TTL to automatically clean up old data. This is implemented using DynamoDB TTL feature on the `ttl` field.

### Frontend Integration

**Components to Update**:
- `QRCodeScanner.tsx`: Camera-based QR scanning
- `QRCodeGenerator.tsx`: Display QR code for container
- `ContainerDetailDialog.tsx`: Show QR code and generate label button
- `BatchQRCodeGenerator.tsx`: Batch QR code generation
- New component: `ScanHistoryView.tsx`: Display scan history

**API Service Methods**:
```typescript
// frontend/src/services/api.ts
export const qrCodeApi = {
  generateQRCode: (containerId: string, inventoryId: string, size: string) => Promise<QRCodeData>,
  scanQRCode: (qrCodeData: string, inventoryId?: string) => Promise<ScanResult>,
  getScanHistory: (inventoryId?: string, options?: HistoryOptions) => Promise<HistoryResult>,
  generateLabel: (containerId: string, inventoryId: string, size: string) => Promise<LabelData>,
  lookupContainer: (params: LookupParams) => Promise<ContainerResult>
};
```

### Mobile Considerations

**Camera Access**:
- Request camera permissions on mobile devices
- Handle iOS camera quirks (see `utils/iosCamera.ts`)
- Provide manual entry fallback if camera unavailable

**Offline Support**:
- Queue scan operations when offline (see `hooks/useOfflineQueue.ts`)
- Sync scan history when connection restored
- Cache recent scans for offline viewing

### Accessibility

**QR Code Scanning**:
- Provide manual entry alternative for users who cannot use camera
- Screen reader announcements for scan results
- Keyboard navigation for scan history

**Label Generation**:
- High contrast QR codes for better scanning
- Large text options for label content
- Alternative text descriptions for QR code images
