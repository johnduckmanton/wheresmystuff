# Design Document

## Overview

The Home Inventory Management System is a full-stack web application built on AWS serverless architecture. The system follows a three-tier architecture with a React frontend, AWS Lambda backend, and DynamoDB database. The design emphasizes security through AWS Cognito authentication, scalability through serverless components, and user experience through Material-UI components and responsive design.

The application manages five core entities (Things, Locations, Rooms, Categories, People) with rich relationships between them. Photos are stored in S3 with secure presigned URL access. The frontend implements advanced data table features including sorting, filtering, and expandable rows. The backend uses a single-table DynamoDB design for efficient queries and cost optimization.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Application (Vite)                            │  │
│  │  - Material-UI Components                            │  │
│  │  - React Router for Navigation                       │  │
│  │  - AWS Amplify for Auth                              │  │
│  │  - Axios for API calls                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS API Gateway                         │
│                      (HTTP API)                              │
│  - JWT Authorization                                         │
│  - CORS Configuration                                        │
│  - Route Integration                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Lambda                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Handler Functions (Node.js)                         │  │
│  │  - Things CRUD                                        │  │
│  │  - Locations CRUD                                     │  │
│  │  - Rooms CRUD                                         │  │
│  │  - Categories CRUD                                    │  │
│  │  - People CRUD                                        │  │
│  │  - Photo Upload/Download                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│     AWS DynamoDB         │  │        AWS S3            │
│  - Single Table Design   │  │  - Photo Storage         │
│  - Entity Storage        │  │  - Presigned URLs        │
│  - Query by PK/SK        │  │  - Private Bucket        │
└──────────────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    AWS Cognito                               │
│  - User Pool                                                 │
│  - JWT Token Generation                                      │
│  - Password Policy Enforcement                               │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack Rationale

- **React + Vite**: Fast development experience, modern build tooling, excellent developer experience
- **Material-UI v7+**: Comprehensive component library, accessibility built-in, consistent design system
  - Using the CRUD Dashboard template as the foundation (https://github.com/mui/material-ui/tree/v7.3.6/docs/data/material/getting-started/templates/crud-dashboard)
  - Provides pre-built layout with sidebar navigation, data tables, and responsive design
- **AWS Lambda**: Serverless compute, automatic scaling, pay-per-use pricing
- **DynamoDB**: NoSQL flexibility, single-digit millisecond latency, automatic scaling
- **S3**: Durable object storage, presigned URLs for secure access, cost-effective
- **Cognito**: Managed authentication, JWT tokens, password policy enforcement
- **API Gateway HTTP API**: Lower latency than REST API, simpler configuration, JWT authorizer support

## UI/UX Design

### Base Template

The application uses the **Material-UI CRUD Dashboard template** as its foundation:
- **Template URL**: https://github.com/mui/material-ui/tree/v7.3.6/docs/data/material/getting-started/templates/crud-dashboard
- **Version**: Material-UI v7.3.6+
- **Features**: Pre-built responsive layout, sidebar navigation, data tables with sorting/filtering, professional business aesthetic

### Layout Structure

- **Fixed Header**: App logo/title, user info, sign-out button
- **Collapsible Sidebar**: Navigation items (Things, Locations, Categories, People) with icons
- **Main Content Area**: Data tables with pagination, sorting, and filtering
- **Modal Dialogs**: Forms for create/edit operations
- **Responsive Design**: Adapts to desktop, tablet, and mobile screens

### Design Principles

- Material Design guidelines
- Clean, minimal aesthetic
- Consistent spacing and shadows
- Professional business appearance
- Accessibility compliant (WCAG standards)

## Components and Interfaces

### Frontend Components

#### 1. Authentication Components

**SignIn Component**
- Email and password input fields
- Form validation
- Integration with AWS Amplify Auth
- Error message display
- Redirect to main app on success

**SignOut Component**
- Sign out button in header
- Calls Amplify signOut
- Redirects to sign-in page

**ProtectedRoute Component**
- Wraps authenticated routes
- Checks authentication state
- Redirects to sign-in if not authenticated

#### 2. Layout Components

**AppLayout Component**
- Fixed header with logo and user info
- Collapsible sidebar navigation
- Main content area
- Responsive breakpoints

**Sidebar Component**
- Navigation items: Things, Locations, Categories, People
- Icons for each item
- Toggle button for collapse/expand
- Active route highlighting

**Header Component**
- App logo/title
- User email display
- Sign out button

#### 3. Data Table Components

**EntityTable Component** (Reusable)
- Props: columns, data, onEdit, onDelete, onRowClick, expandable
- Column sorting (ascending/descending)
- Global search input
- Per-column filter inputs
- Item count display
- Action buttons (Edit, Delete)
- Pagination controls
- Expandable row support

**ExpandableLocationRow Component**
- Displays Things associated with Location
- Nested table showing item details
- Triggered by expand button

#### 4. Form Dialog Components

**EntityFormDialog Component** (Reusable)
- Props: open, onClose, onSubmit, initialData, fields, title
- Modal dialog with form
- Field validation
- Required field indicators (*)
- Cancel and Submit buttons
- Error message display

**ThingFormDialog Component**
- Extends EntityFormDialog
- Photo upload interface
- Drag-and-drop zone
- Photo preview grid
- Remove photo buttons
- Dropdown selectors for Location, Room, Owner, Category
- Date pickers for Date Purchased, Disposal Date, Next Review Date

**LocationFormDialog Component**
- Extends EntityFormDialog
- Address fields
- Country dropdown with search
- Embedded room management section
- Add/Edit/Delete rooms inline

**RoomFormDialog Component**
- Extends EntityFormDialog
- Floor dropdown with predefined options
- Custom floor text input toggle
- Location selector

#### 5. Photo Upload Components

**PhotoUploadZone Component**
- Drag-and-drop area
- Browse button
- File type validation (images only)
- Multiple file support
- Upload progress indicator

**PhotoPreviewGrid Component**
- Grid layout of uploaded photos
- Presigned URL image loading
- Remove button per photo
- Lazy loading support

#### 6. Specialized Input Components

**CountrySelector Component**
- Dropdown with all ISO countries
- Search/filter capability
- Displays country name, stores ISO code
- Integration with react-select or MUI Autocomplete

**FloorSelector Component**
- Dropdown with predefined floors
- Custom button to toggle text input
- Preserves custom values
- Toggle back to dropdown

### Backend Components

#### 1. Lambda Handler Functions

**Things Handler**
- GET /things - List all things for authenticated user
- POST /things - Create new thing
- PUT /things/{id} - Update thing
- DELETE /things/{id} - Delete thing
- Validates JWT token
- Interacts with DynamoDB

**Locations Handler**
- GET /locations - List all locations
- POST /locations - Create location
- PUT /locations/{id} - Update location
- DELETE /locations/{id} - Delete location

**Rooms Handler**
- GET /rooms?locationId={id} - List rooms for a location (used by Location dialog)
- POST /rooms - Create room
- PUT /rooms/{id} - Update room
- DELETE /rooms/{id} - Delete room

**Categories Handler**
- GET /categories - List all categories
- POST /categories - Create category
- PUT /categories/{id} - Update category
- DELETE /categories/{id} - Delete category

**People Handler**
- GET /people - List all people
- POST /people - Create person
- PUT /people/{id} - Update person
- DELETE /people/{id} - Delete person

**Photo Handler**
- POST /upload - Generate presigned URL for upload
- GET /photo/{key} - Generate presigned URL for download
- Validates file types
- Sets 1-hour expiration

#### 2. Service Layer

**DynamoDBService**
- `createEntity(entityType, data)` - Create new entity
- `getEntity(entityType, id)` - Get single entity
- `listEntities(entityType)` - List all entities of type
- `updateEntity(entityType, id, data)` - Update entity
- `deleteEntity(entityType, id)` - Delete entity
- `queryByPartitionKey(pk)` - Query all items with PK

**S3Service**
- `generateUploadUrl(key, contentType)` - Create presigned upload URL
- `generateDownloadUrl(key)` - Create presigned download URL
- `deleteObject(key)` - Delete S3 object
- Validates file types and sizes

**AuthService**
- `verifyToken(token)` - Verify JWT from Cognito
- `getUserFromToken(token)` - Extract user info from JWT
- Middleware for Lambda authorizer

#### 3. Utility Modules

**ValidationUtils**
- `validateRequired(fields)` - Check required fields
- `validateEmail(email)` - Email format validation
- `validateUUID(id)` - UUID format validation
- `sanitizeInput(data)` - Sanitize user input

**ResponseUtils**
- `success(data, statusCode)` - Format success response
- `error(message, statusCode)` - Format error response
- `corsHeaders()` - Generate CORS headers

### API Interfaces

#### Request/Response Formats

**Thing Entity**
```typescript
interface Thing {
  id: string;  // UUID
  name: string;  // Required
  description?: string;
  serialNumber?: string;
  locationId?: string;  // UUID reference
  roomId?: string;  // UUID reference
  ownerId?: string;  // UUID reference (Person)
  categoryId?: string;  // UUID reference
  notes?: string;
  datePurchased?: string;  // ISO date
  purchasedFrom?: string;
  warrantyDetails?: string;
  disposalDate?: string;  // ISO date
  nextReviewDate?: string;  // ISO date
  photos?: string[];  // Array of S3 keys
  dateAdded: string;  // ISO date, auto-generated
}
```

**Location Entity**
```typescript
interface Location {
  id: string;  // UUID
  name: string;  // Required
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  county?: string;
  postcode?: string;
  country?: string;  // ISO country code
  description?: string;
  dateAdded: string;  // ISO date, auto-generated
}
```

**Room Entity**
```typescript
interface Room {
  id: string;  // UUID
  name: string;  // Required
  locationId: string;  // UUID reference, required
  floor?: string;  // Predefined or custom
  dateAdded: string;  // ISO date, auto-generated
}
```

**Category Entity**
```typescript
interface Category {
  id: string;  // UUID
  name: string;  // Required
  description?: string;
  dateAdded: string;  // ISO date, auto-generated
}
```

**Person Entity**
```typescript
interface Person {
  id: string;  // UUID
  name: string;  // Required
  description?: string;
  dateAdded: string;  // ISO date, auto-generated
}
```

**API Response Format**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## Data Models

### DynamoDB Single Table Design

**Table Name**: `home-inventory`

**Primary Key Structure**:
- Partition Key (pk): Entity type string
- Sort Key (sk): UUID string

**Entity Type Values**:
- `THINGS`
- `LOCATIONS`
- `ROOMS`
- `CATEGORIES`
- `PEOPLE`

**Item Structure**:
```json
{
  "pk": "THINGS",
  "sk": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "name": "MacBook Pro",
    "description": "15-inch laptop",
    "serialNumber": "C02XYZ123",
    "locationId": "660e8400-e29b-41d4-a716-446655440001",
    "roomId": "770e8400-e29b-41d4-a716-446655440002",
    "ownerId": "880e8400-e29b-41d4-a716-446655440003",
    "categoryId": "990e8400-e29b-41d4-a716-446655440004",
    "notes": "Work laptop",
    "datePurchased": "2024-01-15",
    "purchasedFrom": "Apple Store",
    "warrantyDetails": "3 years AppleCare",
    "disposalDate": null,
    "nextReviewDate": "2025-06-01",
    "photos": ["photos/550e8400.jpg", "photos/550e8400-2.jpg"],
    "dateAdded": "2025-01-01T10:00:00Z"
  }
}
```

**Query Patterns**:

1. **List all entities of a type**:
   - Query: `pk = "THINGS"`
   - Returns: All Things

2. **Get specific entity**:
   - Query: `pk = "THINGS" AND sk = "uuid"`
   - Returns: Single Thing

3. **List rooms by location** (application-level filter):
   - Query: `pk = "ROOMS"`
   - Filter: `data.locationId = "location-uuid"`

4. **List things by location** (application-level filter):
   - Query: `pk = "THINGS"`
   - Filter: `data.locationId = "location-uuid"`

**Indexes**: None required for initial implementation (all queries use partition key)

### S3 Storage Structure

**Bucket Name**: `home-inventory-photos-{account-id}`

**Object Key Pattern**: `photos/{thing-uuid}/{timestamp}-{filename}`

**Example**: `photos/550e8400-e29b-41d4-a716-446655440000/1704110400000-laptop.jpg`

**Bucket Configuration**:
- Private access (no public read)
- Versioning enabled
- Lifecycle policy: Delete incomplete multipart uploads after 7 days
- CORS configuration for presigned URL uploads

### Relationships

**Entity Relationship Diagram**:
```
┌──────────────┐
│   Location   │
│              │
│ - id         │
│ - name       │
│ - address... │
└──────┬───────┘
       │
       │ 1:N
       │
┌──────▼───────┐
│     Room     │
│              │
│ - id         │
│ - name       │
│ - locationId │◄────┐
│ - floor      │     │
└──────┬───────┘     │
       │             │
       │ 1:N         │ N:1
       │             │
┌──────▼─────────────┴───┐
│        Thing           │
│                        │
│ - id                   │
│ - name                 │
│ - locationId           │
│ - roomId               │
│ - ownerId              │
│ - categoryId           │
│ - photos[]             │
│ - ...                  │
└──┬──────────┬──────────┘
   │          │
   │ N:1      │ N:1
   │          │
┌──▼──────┐ ┌▼──────────┐
│Category │ │  Person   │
│         │ │           │
│ - id    │ │ - id      │
│ - name  │ │ - name    │
└─────────┘ └───────────┘
```

**Relationship Rules**:
- Things can reference one Location (optional)
- Things can reference one Room (optional)
- Things can reference one Person as owner (optional)
- Things can reference one Category (optional)
- Rooms must reference one Location (required)
- Deleting Location/Room does not cascade to Things (references become orphaned)
- Frontend should handle orphaned references gracefully


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated:
- Authentication rejection properties (1.3, 16.1, 16.2) all test the same behavior
- Deletion properties (6.2, 11.4, 12.4, 13.4, 14.4) follow the same pattern
- Table display properties (11.2, 13.2, 14.2) are covered by general table functionality
- Presigned URL expiration (7.6, 16.3) test the same behavior
- Relationship storage properties (18.2-18.5) follow the same pattern and can be combined

The following properties represent unique, non-redundant correctness guarantees:

### Authentication and Security Properties

**Property 1: Unauthenticated request rejection**
*For any* data endpoint and any request without a valid JWT token, the system should reject the request and return an unauthorized error.
**Validates: Requirements 1.3, 16.1**

**Property 2: Expired token rejection**
*For any* request with an expired JWT token, the system should reject the request and require re-authentication.
**Validates: Requirements 1.5**

**Property 3: Presigned URL expiration**
*For any* S3 presigned URL generated by the system, the expiration time should be set to exactly 1 hour from generation.
**Validates: Requirements 7.6**

### Navigation Properties

**Property 4: Navigation routing**
*For any* navigation item clicked, the system should navigate to the corresponding entity list view route.
**Validates: Requirements 2.5**

### CRUD Operation Properties

**Property 5: Entity creation with metadata**
*For any* valid entity (Thing, Location, Room, Category, Person) submitted with required fields, the system should create a record with a unique UUID and auto-generated ISO timestamp in the dateAdded field.
**Validates: Requirements 3.2, 11.1, 12.1, 13.1, 14.1**

**Property 6: Required field validation**
*For any* entity form submission missing required fields, the system should prevent submission and display validation errors.
**Validates: Requirements 3.3, 5.4**

**Property 7: Successful creation UI update**
*For any* successful entity creation, the system should close the dialog, refresh the data table, and display the new entity in the list.
**Validates: Requirements 3.5**

**Property 8: Edit dialog pre-population**
*For any* entity in the data table, clicking the name should open an edit dialog pre-populated with that entity's current data.
**Validates: Requirements 5.1**

**Property 9: Entity update persistence**
*For any* valid entity edit submission, the system should update the record in DynamoDB with the new values and reflect changes in the UI.
**Validates: Requirements 5.3, 5.5, 11.3, 12.3, 13.3, 14.3**

**Property 10: Delete confirmation requirement**
*For any* entity, clicking the delete button should display a confirmation dialog before performing deletion.
**Validates: Requirements 6.1**

**Property 11: Confirmed deletion execution**
*For any* confirmed deletion, the system should remove the record from DynamoDB and remove it from the data table view.
**Validates: Requirements 6.2, 6.4**

**Property 12: Cancelled deletion preservation**
*For any* cancelled deletion confirmation, the system should close the dialog without deleting the record.
**Validates: Requirements 6.3**

**Property 13: Non-cascading deletion**
*For any* Location or Room deletion, all Things that reference the deleted entity should remain in the database with their references intact (orphaned references).
**Validates: Requirements 6.5**

### Data Table Properties

**Property 14: Column sort toggle**
*For any* column header clicked, the system should sort the table by that column in ascending order on first click and descending order on second click.
**Validates: Requirements 4.2**

**Property 15: Global search filtering**
*For any* search term entered in the global search field, the system should display only rows where at least one column value contains the search term.
**Validates: Requirements 4.3**

**Property 16: Column-specific filtering**
*For any* filter value entered in a column filter field, the system should display only rows where that specific column value matches the filter.
**Validates: Requirements 4.4**

**Property 17: Filtered item count accuracy**
*For any* filter state (global or column-specific), the displayed item count should equal the number of visible rows in the table.
**Validates: Requirements 4.5**

### Photo Management Properties

**Property 18: Multiple photo upload**
*For any* set of image files selected or dropped, the system should upload all photos to S3, store all S3 keys in the Thing record, and display all photos in the preview grid.
**Validates: Requirements 7.3, 7.4**

**Property 19: Photo removal**
*For any* photo in the preview grid, clicking remove should delete the S3 key from the Thing record and remove the photo from the preview grid.
**Validates: Requirements 7.5**

### Location and Room Management Properties

**Property 20: Location expandable row content**
*For any* Location row, clicking the expand button should display all Things where locationId matches the Location's UUID.
**Validates: Requirements 8.1**

**Property 21: Location dialog room display**
*For any* Location edit dialog opened, the room management section should display all Rooms where locationId matches the Location's UUID.
**Validates: Requirements 8.2**

**Property 22: Room creation from Location dialog**
*For any* new Room created from within a Location edit dialog, the Room should be created with locationId automatically set to the current Location's UUID.
**Validates: Requirements 8.3**

**Property 23: Room edit dialog persistence**
*For any* Room edited from within a Location edit dialog, the Room should be updated and the Location dialog should remain open.
**Validates: Requirements 8.4**

**Property 24: Room deletion from Location dialog**
*For any* Room deleted from within a Location edit dialog, the Room should be removed after confirmation.
**Validates: Requirements 8.5**

**Property 25: Custom floor value persistence**
*For any* Room with a custom floor value entered and saved, editing that Room should display the custom text input with the preserved custom value.
**Validates: Requirements 9.3, 9.4**

### Country Selection Properties

**Property 26: Country dropdown filtering**
*For any* text typed in the country field, the dropdown should display only countries where the name or code contains the typed text.
**Validates: Requirements 10.2**

**Property 27: Country code storage**
*For any* country selected from the dropdown, the system should store the ISO country code in the Location record.
**Validates: Requirements 10.3**

**Property 28: Country name display**
*For any* Location with a stored country code, displaying the Location should show the full country name corresponding to that ISO code.
**Validates: Requirements 10.4**

**Property 29: Country pre-selection on edit**
*For any* Location with a stored country code, opening the edit dialog should pre-select the country in the dropdown based on the stored ISO code.
**Validates: Requirements 10.5**

### Entity Relationship Properties

**Property 30: Optional field acceptance**
*For any* Location created or updated, the description field should be optional and accept null or empty values.
**Validates: Requirements 11.5**

**Property 31: Room display within Location**
*For any* Location being managed, the system should display all Rooms associated with that Location by filtering Rooms where locationId matches the Location's UUID.
**Validates: Requirements 12.2**

**Property 32: Room location requirement**
*For any* Room creation attempt without a locationId reference, the system should reject the submission and display a validation error.
**Validates: Requirements 12.5**

**Property 33: Category multi-reference support**
*For any* Category, multiple Things should be able to store that Category's UUID as their categoryId without conflict.
**Validates: Requirements 13.5**

**Property 34: Person multi-reference support**
*For any* Person, multiple Things should be able to store that Person's UUID as their ownerId without conflict.
**Validates: Requirements 14.5**

**Property 35: Entity relationship storage**
*For any* Thing associated with a Location, Room, Owner (Person), or Category, the system should store the corresponding UUID reference in the appropriate field (locationId, roomId, ownerId, categoryId).
**Validates: Requirements 18.2, 18.3, 18.4, 18.5**

### User Feedback Properties

**Property 36: Loading indicator display**
*For any* API operation initiated, the system should display a loading indicator during the request until completion or failure.
**Validates: Requirements 15.1**

**Property 37: Success feedback display**
*For any* successful API operation, the system should display a success message or visual confirmation.
**Validates: Requirements 15.2**

**Property 38: Error message display**
*For any* failed API operation, the system should display an error message with information about what went wrong.
**Validates: Requirements 15.3**

### Performance Properties

**Property 39: Search and filter debouncing**
*For any* rapid sequence of keystrokes in search or filter fields, the system should debounce the input and only trigger filtering after a delay (e.g., 300ms) since the last keystroke.
**Validates: Requirements 17.2**

**Property 40: Optimistic UI updates**
*For any* CRUD operation initiated, the system should update the UI immediately (optimistically) before receiving server confirmation.
**Validates: Requirements 17.4**

### DynamoDB Storage Properties

**Property 41: Entity partition key format**
*For any* entity stored in DynamoDB, the partition key (pk) should be set to the entity type string (THINGS, LOCATIONS, ROOMS, CATEGORIES, or PEOPLE).
**Validates: Requirements 19.1**

**Property 42: Entity sort key format**
*For any* entity stored in DynamoDB, the sort key (sk) should be set to a unique UUID string.
**Validates: Requirements 19.2**

**Property 43: Entity data structure**
*For any* entity stored in DynamoDB, all entity attributes should be stored within a data JSON object field.
**Validates: Requirements 19.3**

**Property 44: Entity type query pattern**
*For any* query to retrieve all entities of a given type, the system should query DynamoDB using the partition key matching the entity type.
**Validates: Requirements 19.4**

**Property 45: Specific entity retrieval pattern**
*For any* query to retrieve a specific entity, the system should query DynamoDB using both the partition key (entity type) and sort key (UUID).
**Validates: Requirements 19.5**

## Error Handling

### Frontend Error Handling

**Network Errors**:
- Catch all API request failures
- Display user-friendly error messages
- Provide retry options for transient failures
- Log errors to console for debugging

**Validation Errors**:
- Validate required fields before submission
- Display inline error messages near invalid fields
- Prevent form submission until validation passes
- Clear error messages when user corrects input

**Authentication Errors**:
- Detect 401 responses from API
- Clear local authentication state
- Redirect to sign-in page
- Display message indicating session expired

**Photo Upload Errors**:
- Validate file types (images only)
- Validate file sizes (e.g., max 10MB per photo)
- Display error for invalid files
- Handle S3 upload failures gracefully

**Orphaned Reference Handling**:
- Display "Unknown" or empty value for invalid references
- Provide UI indication that reference is broken
- Allow user to update reference to valid entity
- Don't crash when rendering orphaned references

### Backend Error Handling

**Lambda Error Responses**:
```javascript
// Success response
{
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
  body: JSON.stringify({ success: true, data: result })
}

// Error response
{
  statusCode: 400/401/404/500,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
  body: JSON.stringify({ success: false, error: 'Error message' })
}
```

**DynamoDB Error Handling**:
- Catch `ResourceNotFoundException` for missing items
- Catch `ConditionalCheckFailedException` for conflicts
- Retry transient errors with exponential backoff
- Return appropriate HTTP status codes

**S3 Error Handling**:
- Validate presigned URL generation
- Handle bucket access errors
- Catch upload/download failures
- Return meaningful error messages

**Authentication Error Handling**:
- Verify JWT token on every request
- Return 401 for invalid/expired tokens
- Handle Cognito service errors
- Log authentication failures

**Validation Error Handling**:
- Validate required fields
- Validate UUID formats for references
- Validate data types
- Return 400 with validation error details

### Error Logging

**Frontend Logging**:
- Console.error for all caught errors
- Include request details and error context
- Optional: Send errors to monitoring service (e.g., Sentry)

**Backend Logging**:
- CloudWatch Logs for all Lambda invocations
- Log error stack traces
- Log request/response details
- Set appropriate log levels (ERROR, WARN, INFO)

## Testing Strategy

### Unit Testing

**Frontend Unit Tests** (Vitest + React Testing Library):

1. **Component Tests**:
   - EntityTable: sorting, filtering, pagination logic
   - EntityFormDialog: validation, submission
   - PhotoUploadZone: file validation, drag-and-drop
   - CountrySelector: filtering, selection
   - FloorSelector: toggle between dropdown and custom

2. **Utility Function Tests**:
   - Validation functions (validateRequired, validateEmail, validateUUID)
   - Date formatting functions
   - Data transformation functions

3. **Service Tests**:
   - API client functions (mock axios)
   - Authentication service functions
   - S3 presigned URL generation

**Backend Unit Tests** (Jest):

1. **Handler Tests**:
   - Test each CRUD endpoint with mocked DynamoDB
   - Test authentication middleware
   - Test photo upload/download handlers

2. **Service Tests**:
   - DynamoDBService methods with mocked AWS SDK
   - S3Service methods with mocked AWS SDK
   - Validation utilities

3. **Integration Tests**:
   - Test Lambda handlers with local DynamoDB
   - Test complete request/response cycles
   - Test error handling paths

### Property-Based Testing

**Property-Based Testing Library**: fast-check (JavaScript/TypeScript)

**Configuration**: Each property-based test should run a minimum of 100 iterations to ensure adequate coverage of the input space.

**Test Tagging**: Each property-based test MUST include a comment tag in this exact format:
```javascript
// Feature: home-inventory-system, Property {number}: {property_text}
```

**Frontend Property Tests**:

1. **Property 5: Entity creation with metadata**
   - Generate random valid entities
   - Verify UUID and timestamp are added
   - Test for Things, Locations, Rooms, Categories, People

2. **Property 6: Required field validation**
   - Generate entities missing required fields
   - Verify validation errors are shown
   - Test all entity types

3. **Property 14: Column sort toggle**
   - Generate random table data
   - Verify sort order toggles correctly
   - Test all sortable columns

4. **Property 15: Global search filtering**
   - Generate random search terms and table data
   - Verify only matching rows are displayed
   - Test across all columns

5. **Property 16: Column-specific filtering**
   - Generate random filter values and table data
   - Verify only matching rows for specific column
   - Test all filterable columns

6. **Property 17: Filtered item count accuracy**
   - Generate random filter states
   - Verify count matches visible rows
   - Test with various filter combinations

7. **Property 39: Search and filter debouncing**
   - Generate rapid keystroke sequences
   - Verify filtering is debounced
   - Measure delay between last keystroke and filter execution

**Backend Property Tests**:

1. **Property 1: Unauthenticated request rejection**
   - Generate random endpoints and requests without tokens
   - Verify all return 401 unauthorized
   - Test all CRUD endpoints

2. **Property 2: Expired token rejection**
   - Generate expired JWT tokens
   - Verify all requests are rejected
   - Test token expiration boundary

3. **Property 3: Presigned URL expiration**
   - Generate presigned URLs
   - Verify expiration is exactly 1 hour
   - Test for upload and download URLs

4. **Property 11: Confirmed deletion execution**
   - Generate random entities and delete them
   - Verify records are removed from DynamoDB
   - Test all entity types

5. **Property 13: Non-cascading deletion**
   - Generate Locations/Rooms with associated Things
   - Delete Locations/Rooms
   - Verify Things remain with orphaned references

6. **Property 27: Country code storage**
   - Generate random country selections
   - Verify ISO codes are stored, not names
   - Test all countries in the list

7. **Property 35: Entity relationship storage**
   - Generate Things with various relationships
   - Verify UUID references are stored correctly
   - Test all relationship types

8. **Property 41-45: DynamoDB storage properties**
   - Generate random entities
   - Verify partition key, sort key, and data structure
   - Test query patterns for retrieval

### End-to-End Testing

**E2E Testing Framework**: Playwright or Cypress

**Critical User Flows**:

1. **Authentication Flow**:
   - Sign up new user
   - Sign in with valid credentials
   - Access protected routes
   - Sign out

2. **Thing Management Flow**:
   - Create new Thing with all fields
   - Upload photos
   - Edit Thing
   - Delete Thing
   - Search and filter Things

3. **Location and Room Flow**:
   - Create Location
   - Add Rooms from Location dialog
   - Edit Room from Location dialog
   - Expand Location to see Things
   - Delete Room

4. **Category and People Flow**:
   - Create Category
   - Create Person
   - Associate Thing with Category and Owner
   - Verify relationships display correctly

### Manual Testing Checklist

**Browser Compatibility**:
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on Edge

**Responsive Design**:
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)

**Accessibility**:
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Color contrast meets WCAG standards
- [ ] Focus indicators visible

**Performance**:
- [ ] Initial load under 3 seconds
- [ ] Photo lazy loading works
- [ ] Search/filter debouncing works
- [ ] Optimistic updates feel responsive

## Deployment

### Infrastructure as Code

**AWS SAM Template** (template.yaml):

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs18.x
    Environment:
      Variables:
        TABLE_NAME: !Ref InventoryTable
        BUCKET_NAME: !Ref PhotoBucket

Resources:
  # Cognito User Pool
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: home-inventory-users
      UsernameAttributes:
        - email
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true

  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      UserPoolId: !Ref UserPool
      ClientName: home-inventory-client
      GenerateSecret: false

  # DynamoDB Table
  InventoryTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: home-inventory
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE

  # S3 Bucket
  PhotoBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub home-inventory-photos-${AWS::AccountId}
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      CorsConfiguration:
        CorsRules:
          - AllowedOrigins:
              - '*'
            AllowedMethods:
              - GET
              - PUT
              - POST
            AllowedHeaders:
              - '*'

  # API Gateway
  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - '*'
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        AllowHeaders:
          - '*'
      Auth:
        Authorizers:
          CognitoAuthorizer:
            IdentitySource: $request.header.Authorization
            JwtConfiguration:
              Audience:
                - !Ref UserPoolClient
              Issuer: !Sub https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPool}

  # Lambda Functions
  ThingsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: backend/
      Handler: handlers/things.handler
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref InventoryTable
      Events:
        ListThings:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /things
            Method: GET
            Auth:
              Authorizer: CognitoAuthorizer
        CreateThing:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /things
            Method: POST
            Auth:
              Authorizer: CognitoAuthorizer
        UpdateThing:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /things/{id}
            Method: PUT
            Auth:
              Authorizer: CognitoAuthorizer
        DeleteThing:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /things/{id}
            Method: DELETE
            Auth:
              Authorizer: CognitoAuthorizer

  # Similar functions for Locations, Rooms, Categories, People, Photos...

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com
  UserPoolId:
    Description: Cognito User Pool ID
    Value: !Ref UserPool
  UserPoolClientId:
    Description: Cognito User Pool Client ID
    Value: !Ref UserPoolClient
  BucketName:
    Description: S3 Bucket Name
    Value: !Ref PhotoBucket
```

### Frontend Deployment

**Build Process**:
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output: dist/ directory
```

**Deployment Options**:

1. **S3 + CloudFront**:
   - Upload dist/ to S3 bucket
   - Configure CloudFront distribution
   - Set up custom domain with Route 53
   - Enable HTTPS with ACM certificate

2. **Vercel** (Alternative):
   - Connect GitHub repository
   - Configure build settings
   - Automatic deployments on push
   - Built-in CDN and HTTPS

**Environment Variables** (.env.production):
```
VITE_API_URL=https://api.example.com
VITE_USER_POOL_ID=eu-west-1_xxxxx
VITE_USER_POOL_CLIENT_ID=xxxxx
VITE_AWS_REGION=eu-west-1
VITE_BUCKET_NAME=home-inventory-photos-xxxxx
```

### Backend Deployment

**SAM Deployment**:
```bash
# Build
sam build

# Deploy
sam deploy --guided

# Subsequent deployments
sam deploy
```

**CI/CD Pipeline** (GitHub Actions example):
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: aws-actions/setup-sam@v1
      - run: sam build
      - run: sam deploy --no-confirm-changeset

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run build
      - uses: aws-actions/configure-aws-credentials@v1
      - run: aws s3 sync dist/ s3://bucket-name/
```

### Monitoring and Observability

**CloudWatch Dashboards**:
- Lambda invocation counts and errors
- API Gateway request counts and latency
- DynamoDB read/write capacity
- S3 bucket metrics

**Alarms**:
- Lambda error rate > 5%
- API Gateway 5xx errors
- DynamoDB throttling events
- High Lambda duration

**Logging**:
- CloudWatch Logs for all Lambda functions
- Log retention: 30 days
- Log insights queries for debugging

### Security Considerations

**IAM Roles**:
- Least privilege principle
- Separate roles for each Lambda function
- No hardcoded credentials

**Secrets Management**:
- Use AWS Secrets Manager for sensitive data
- Rotate credentials regularly
- Never commit secrets to version control

**Network Security**:
- API Gateway with JWT authorization
- S3 bucket with private access only
- CORS configured for specific origins in production

**Data Protection**:
- Encryption at rest for DynamoDB
- Encryption in transit (HTTPS only)
- S3 bucket encryption enabled

## Future Enhancements

The following features are out of scope for the initial implementation but may be added in future iterations:

1. **Barcode Scanning**: Mobile app integration for scanning item barcodes
2. **Export Functionality**: Export inventory to CSV/PDF formats
3. **Bulk Operations**: Select multiple items for batch updates or deletion
4. **Audit Log**: Track all changes to items with timestamps and user info
5. **Advanced Search**: Multi-criteria search with boolean operators
6. **Tags/Labels**: Flexible tagging system for items
7. **Value Tracking**: Track purchase price and current value
8. **Insurance Integration**: Export data for insurance claims
9. **Sharing/Collaboration**: Share inventory with family members
10. **Mobile App**: Native iOS/Android applications
11. **Offline Support**: Progressive Web App with offline capabilities
12. **Custom Fields**: User-defined fields for entities
13. **Reports**: Generate inventory reports and statistics
14. **Notifications**: Email/SMS alerts for warranty expirations
15. **Multi-language Support**: Internationalization (i18n)
