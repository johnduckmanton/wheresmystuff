# Design Document - Moving & Storage System

## Overview

The Moving & Storage System extends the existing Home Inventory Management System with specialized functionality for organizing, tracking, and managing inventory items during moves and storage scenarios. The system introduces a container-based organization model with QR code tracking, bulk operations, and comprehensive reporting capabilities.

### Key Design Principles

1. **Seamless Integration**: Leverage existing inventory infrastructure and data models
2. **Mobile-First**: Optimize for mobile devices with camera scanning and touch interfaces
3. **Performance**: Fast operations for high-volume packing scenarios
4. **Data Integrity**: Maintain consistency between containers and inventory items
5. **Scalability**: Support from simple moves to complex multi-location scenarios

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Home Page  │  Moving Dashboard  │  Container Management   │
│  Packing UI │  QR Scanner        │  Reports & Analytics    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                            │
├─────────────────────────────────────────────────────────────┤
│  /containers  │  /packing  │  /qr-codes  │  /reports      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Lambda Functions                          │
├─────────────────────────────────────────────────────────────┤
│  Container Service  │  Packing Service  │  QR Service      │
│  Report Service     │  Analytics Service                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│  DynamoDB (Single Table)  │  S3 (QR Codes & Reports)       │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Existing Inventory System**: Containers reference existing Things, Locations, and Inventories
2. **Authentication**: Uses existing Cognito user pools and authorization
3. **Audit Logging**: Extends existing audit log service for container operations
4. **Photo Storage**: Leverages existing S3 bucket for QR code images

## Components and Interfaces

### Frontend Components

#### 1. Home Page Component
```typescript
interface HomePageProps {
  user: User;
  inventories: Inventory[];
}

// Displays module selection cards
// - Inventory Management (existing)
// - Moving & Storage (new)
```

#### 2. Moving Dashboard Component
```typescript
interface MovingDashboardProps {
  inventoryId: string;
  projects: MovingProject[];
  containers: Container[];
  stats: MovingStats;
}

// Displays:
// - Active moving projects
// - Container summary
// - Packing progress
// - Quick actions
```

#### 3. Container Management Component
```typescript
interface ContainerManagementProps {
  inventoryId: string;
  onContainerCreated: (container: Container) => void;
  onContainerUpdated: (container: Container) => void;
}

// Features:
// - Create/edit containers
// - View container list
// - Filter and search
// - Bulk operations
```

#### 4. Packing Interface Component
```typescript
interface PackingInterfaceProps {
  container: Container;
  availableItems: Thing[];
  onItemsAdded: (itemIds: string[]) => void;
}

// Features:
// - Fast item selection
// - Multi-select support
// - Search and filter
// - Visual feedback
```

#### 5. QR Code Scanner Component
```typescript
interface QRScannerProps {
  onScanSuccess: (containerId: string) => void;
  onScanError: (error: Error) => void;
}

// Features:
// - Camera access
// - QR code detection
// - Manual entry fallback
// - Scan history
```

#### 6. Container Contents Component
```typescript
interface ContainerContentsProps {
  container: Container;
  items: Thing[];
  onItemRemoved: (itemId: string) => void;
}

// Displays:
// - Item list with details
// - Photos and categories
// - Total value
// - Actions (remove, move)
```

#### 7. QR Code Generator Component
```typescript
interface QRCodeGeneratorProps {
  container: Container;
  size: 'small' | 'medium' | 'large';
  onGenerated: (qrCodeUrl: string) => void;
}

// Features:
// - QR code generation
// - Label formatting
// - Print preview
// - Batch generation
```

#### 8. Location Report Component
```typescript
interface LocationReportProps {
  locationId: string;
  containers: Container[];
  items: Thing[];
  exportFormat: 'pdf' | 'csv';
}

// Features:
// - Grouped by container
// - Summary statistics
// - Export options
// - Filtering
```

### Backend Services

#### 1. Container Service
```javascript
class ContainerService {
  async createContainer(inventoryId, containerData);
  async getContainer(containerId);
  async updateContainer(containerId, updates);
  async deleteContainer(containerId);
  async listContainers(inventoryId, filters);
  async moveContainer(containerId, newLocationId);
  async bulkMoveContainers(containerIds, newLocationId);
}
```

#### 2. Packing Service
```javascript
class PackingService {
  async addItemsToContainer(containerId, itemIds);
  async removeItemsFromContainer(containerId, itemIds);
  async moveItemsBetweenContainers(sourceId, targetId, itemIds);
  async getContainerContents(containerId);
  async validateContainerCapacity(containerId, itemIds);
}
```

#### 3. QR Code Service
```javascript
class QRCodeService {
  async generateQRCode(containerId, size);
  async generateBatchQRCodes(containerIds, size);
  async decodeQRCode(qrCodeData);
  async generatePrintableLabel(containerId, options);
}
```

#### 4. Report Service
```javascript
class ReportService {
  async generateLocationReport(locationId, format);
  async generateProjectReport(projectId, format);
  async generateContainerManifest(containerId, format);
  async exportContainerList(inventoryId, filters, format);
}
```

#### 5. Moving Project Service
```javascript
class MovingProjectService {
  async createProject(inventoryId, projectData);
  async getProject(projectId);
  async updateProject(projectId, updates);
  async deleteProject(projectId);
  async assignContainersToProject(projectId, containerIds);
  async getProjectProgress(projectId);
}
```

#### 6. Analytics Service
```javascript
class AnalyticsService {
  async getPackingMetrics(inventoryId, dateRange);
  async getContainerUtilization(inventoryId);
  async getMovingProgress(projectId);
  async getStorageCosts(inventoryId, dateRange);
}
```

## Data Models

### Container Entity

```typescript
interface Container {
  id: string;                    // UUID
  inventoryId: string;           // Reference to inventory
  projectId?: string;            // Optional project assignment
  name: string;                  // User-defined name
  type: ContainerType;           // Box, Bag, Crate, etc.
  size?: string;                 // Small, Medium, Large, Custom
  color?: string;                // Visual identifier
  description?: string;          // Additional notes
  qrCode: string;                // Unique QR code identifier
  qrCodeUrl?: string;            // S3 URL for QR code image
  locationId?: string;           // Current location
  handlingFlags: HandlingFlag[]; // Fragile, Heavy, Valuable, etc.
  itemCount: number;             // Number of items in container
  estimatedValue: number;        // Total value of contents
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  updatedBy: string;             // User ID
  status: ContainerStatus;       // Packed, InTransit, Stored, Unpacked
  storageStartDate?: string;     // When moved to storage
  storageRate?: number;          // Cost per month
  metadata: Record<string, any>; // Extensible metadata
}

enum ContainerType {
  Box = 'box',
  Bag = 'bag',
  Crate = 'crate',
  Bin = 'bin',
  Suitcase = 'suitcase',
  Trunk = 'trunk',
  Custom = 'custom'
}

enum HandlingFlag {
  Fragile = 'fragile',
  Heavy = 'heavy',
  Valuable = 'valuable',
  Priority = 'priority',
  KeepUpright = 'keep_upright',
  TemperatureSensitive = 'temperature_sensitive'
}

enum ContainerStatus {
  Empty = 'empty',
  Packing = 'packing',
  Packed = 'packed',
  InTransit = 'in_transit',
  Stored = 'stored',
  Unpacking = 'unpacking',
  Unpacked = 'unpacked'
}
```

### Moving Project Entity

```typescript
interface MovingProject {
  id: string;                    // UUID
  inventoryId: string;           // Reference to inventory
  name: string;                  // Project name
  description?: string;          // Project details
  startDate: string;             // ISO timestamp
  targetDate?: string;           // Target completion date
  completionDate?: string;       // Actual completion date
  status: ProjectStatus;         // Planning, Active, Completed, Archived
  sourceLocation?: string;       // Origin location
  destinationLocation?: string;  // Target location
  containerCount: number;        // Number of containers
  itemCount: number;             // Number of items
  completionPercentage: number;  // 0-100
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  metadata: Record<string, any>; // Extensible metadata
}

enum ProjectStatus {
  Planning = 'planning',
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Archived = 'archived'
}
```

### Container-Item Relationship

```typescript
interface ContainerItem {
  containerId: string;           // Container reference
  itemId: string;                // Thing reference
  addedAt: string;               // ISO timestamp
  addedBy: string;               // User ID
  position?: number;             // Optional ordering
}
```

### Extended Thing Entity

```typescript
// Extends existing Thing entity with container reference
interface Thing {
  // ... existing fields ...
  containerId?: string;          // Current container (if packed)
  packedAt?: string;             // When added to container
  previousLocationId?: string;   // Location before packing
}
```

### DynamoDB Single Table Design

```
PK                          SK                          EntityType    Attributes
─────────────────────────────────────────────────────────────────────────────────
INV#{inventoryId}          CONTAINER#{containerId}     Container     {...}
INV#{inventoryId}          PROJECT#{projectId}         Project       {...}
CONTAINER#{containerId}    ITEM#{itemId}               ContainerItem {...}
PROJECT#{projectId}        CONTAINER#{containerId}     ProjectCont   {...}
QR#{qrCode}                CONTAINER#{containerId}     QRMapping     {...}
USER#{userId}              CONTAINER#{containerId}     UserContainer {...}
```

### GSI Indexes

1. **ContainerLocationIndex**: Query containers by location
   - PK: `LOC#{locationId}`
   - SK: `CONTAINER#{containerId}`

2. **ProjectContainerIndex**: Query containers by project
   - PK: `PROJECT#{projectId}`
   - SK: `CONTAINER#{containerId}`

3. **QRCodeIndex**: Fast QR code lookup
   - PK: `QR#{qrCode}`
   - SK: `CONTAINER#{containerId}`

## API Endpoints

### Container Management

```
POST   /containers
GET    /containers
GET    /containers/{id}
PUT    /containers/{id}
DELETE /containers/{id}
POST   /containers/{id}/move
POST   /containers/bulk-move
```

### Packing Operations

```
POST   /containers/{id}/items
DELETE /containers/{id}/items/{itemId}
GET    /containers/{id}/contents
POST   /containers/{id}/items/bulk
POST   /containers/transfer-items
```

### QR Code Operations

```
GET    /containers/{id}/qr-code
POST   /containers/{id}/qr-code/generate
POST   /containers/qr-codes/batch
GET    /qr-codes/{code}/container
POST   /qr-codes/scan
```

### Moving Projects

```
POST   /projects
GET    /projects
GET    /projects/{id}
PUT    /projects/{id}
DELETE /projects/{id}
POST   /projects/{id}/containers
GET    /projects/{id}/progress
```

### Reports and Analytics

```
GET    /reports/location/{locationId}
GET    /reports/project/{projectId}
GET    /reports/container/{containerId}/manifest
GET    /analytics/packing-metrics
GET    /analytics/container-utilization
GET    /analytics/storage-costs
```

## Error Handling

### Container-Specific Errors

```typescript
enum ContainerError {
  CONTAINER_NOT_FOUND = 'Container not found',
  CONTAINER_NOT_EMPTY = 'Cannot delete non-empty container',
  ITEM_ALREADY_PACKED = 'Item is already in another container',
  INVALID_QR_CODE = 'Invalid or unrecognized QR code',
  CONTAINER_CAPACITY_EXCEEDED = 'Container capacity exceeded',
  PROJECT_NOT_FOUND = 'Moving project not found',
  INVALID_CONTAINER_STATUS = 'Invalid container status transition'
}
```

### Error Response Format

```json
{
  "error": "CONTAINER_NOT_EMPTY",
  "message": "Cannot delete container 'Kitchen Box 1' because it contains 15 items",
  "details": {
    "containerId": "abc-123",
    "itemCount": 15
  }
}
```

## Testing Strategy

### Unit Tests

1. **Container Service Tests**
   - Container CRUD operations
   - Validation logic
   - Status transitions

2. **Packing Service Tests**
   - Item assignment
   - Bulk operations
   - Capacity validation

3. **QR Code Service Tests**
   - QR generation
   - Code decoding
   - Label formatting

### Integration Tests

1. **Container-Item Integration**
   - Adding items updates container
   - Moving container updates items
   - Deleting container handles items

2. **Project-Container Integration**
   - Project assignment
   - Progress calculation
   - Container filtering

3. **Location Synchronization**
   - Container move updates items
   - Bulk moves maintain consistency
   - Location reports accuracy

### End-to-End Tests

1. **Packing Workflow**
   - Create container
   - Add items
   - Generate QR code
   - Scan and verify

2. **Moving Workflow**
   - Create project
   - Pack containers
   - Move to new location
   - Generate reports

3. **Storage Workflow**
   - Move to storage
   - Track duration
   - Calculate costs
   - Retrieve items

## Security Considerations

### Authorization

1. **Container Access**: Users can only access containers in their inventories
2. **Project Access**: Project operations require inventory ownership
3. **Shared Links**: Time-limited, read-only access with audit logging
4. **QR Code Security**: QR codes include validation tokens

### Data Privacy

1. **Shared Views**: Exclude sensitive item details based on settings
2. **Audit Logging**: All container operations logged with user context
3. **Export Controls**: Limit export frequency and size
4. **QR Code Expiry**: Optional expiration for shared QR codes

## Performance Optimization

### Caching Strategy

1. **Container Lists**: Cache frequently accessed container lists (5 min TTL)
2. **QR Code Images**: Cache generated QR codes in S3 with CloudFront
3. **Report Data**: Cache report results for repeated requests (15 min TTL)
4. **Analytics**: Pre-calculate metrics on write operations

### Batch Operations

1. **Bulk Item Assignment**: Process up to 100 items per request
2. **Batch QR Generation**: Generate up to 50 QR codes simultaneously
3. **Bulk Container Moves**: Update up to 20 containers per operation

### Database Optimization

1. **Composite Keys**: Efficient querying with PK/SK patterns
2. **GSI Usage**: Minimize scan operations with targeted indexes
3. **Pagination**: Limit result sets to 50 items per page
4. **Projection**: Return only required fields in list operations

## Mobile Considerations

### Camera Integration

1. **QR Scanner**: Use device camera API with fallback to file upload
2. **Photo Capture**: Support container photos for visual identification
3. **Offline Support**: Queue operations when offline, sync when online

### Touch Optimization

1. **Large Touch Targets**: Minimum 44x44px for all interactive elements
2. **Swipe Gestures**: Support swipe for common actions
3. **Pull to Refresh**: Update container lists with pull gesture

### Responsive Design

1. **Mobile-First**: Optimize for small screens, enhance for desktop
2. **Progressive Enhancement**: Core features work without JavaScript
3. **Adaptive Layouts**: Adjust UI based on screen size and orientation

## Deployment Strategy

### Phase 1: Core Container Management
- Container CRUD operations
- Basic packing interface
- QR code generation
- Simple reports

### Phase 2: Enhanced Features
- Moving projects
- Advanced analytics
- Batch operations
- Storage management

### Phase 3: Mobile Optimization
- QR code scanning
- Camera integration
- Offline support
- Mobile-specific UI

### Phase 4: Advanced Features
- Shared links
- Cost tracking
- AI-powered suggestions
- Integration with moving services

## Monitoring and Metrics

### Key Metrics

1. **Container Operations**: Creation, updates, deletions per day
2. **Packing Activity**: Items packed per hour, average items per container
3. **QR Code Usage**: Scans per day, scan success rate
4. **Report Generation**: Report requests, export formats, generation time
5. **Error Rates**: Failed operations, validation errors, system errors

### Alerts

1. **High Error Rate**: Alert when error rate exceeds 5%
2. **Slow Operations**: Alert when operations exceed 3 seconds
3. **Storage Costs**: Alert when storage costs exceed thresholds
4. **Data Inconsistency**: Alert on container-item mismatches

## Future Enhancements

1. **AI-Powered Packing Suggestions**: Recommend optimal container assignments
2. **Barcode Integration**: Support barcode scanning in addition to QR codes
3. **Moving Company Integration**: Share container lists with movers
4. **Insurance Integration**: Generate insurance documentation
5. **3D Container Visualization**: Visual representation of packed items
6. **Voice Commands**: Pack items using voice input
7. **Smart Notifications**: Remind users of unpacked containers
8. **Collaborative Packing**: Multiple users packing simultaneously