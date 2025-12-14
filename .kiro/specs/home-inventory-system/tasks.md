# Implementation Plan

- [x] 1. Set up project infrastructure and AWS resources
  - Create AWS SAM template with Cognito User Pool, DynamoDB table, S3 bucket, and API Gateway
  - Configure Cognito password policies (min 8 chars, uppercase, lowercase, numbers)
  - Set up DynamoDB single-table design with pk (partition key) and sk (sort key)
  - Configure S3 bucket with private access and CORS for presigned URLs
  - Deploy infrastructure and capture output values (API URL, User Pool ID, Client ID, Bucket Name)
  - _Requirements: 1.1, 16.1, 16.5, 19.1, 19.2_

- [x] 2. Initialize frontend project with MUI CRUD Dashboard template
  - Create Vite + React + TypeScript project
  - Install Material-UI v7+ and dependencies
  - Integrate MUI CRUD Dashboard template (https://github.com/mui/material-ui/tree/v7.3.6/docs/data/material/getting-started/templates/crud-dashboard)
  - Set up project structure (components, services, types, utils)
  - Configure environment variables for AWS resources
  - _Requirements: 2.1, 20.2, 20.5_

- [x] 3. Implement authentication system
  - [x] 3.1 Install and configure AWS Amplify for Cognito integration
    - Set up Amplify with User Pool ID and Client ID
    - Configure authentication flow
    - _Requirements: 1.1, 1.2_
  
  - [x] 3.2 Create SignIn component with email/password form
    - Build form with validation
    - Integrate with Amplify Auth.signIn
    - Handle authentication errors
    - Redirect to main app on success
    - _Requirements: 1.2_
  
  - [x] 3.3 Create SignOut functionality in header
    - Add sign-out button
    - Call Amplify Auth.signOut
    - Clear local state and redirect to sign-in
    - _Requirements: 1.4_
  
  - [x] 3.4 Implement ProtectedRoute component
    - Check authentication state
    - Redirect to sign-in if not authenticated
    - Wrap all data routes with protection
    - _Requirements: 1.3_
  
  - [ ]* 3.5 Write property test for unauthenticated request rejection
    - **Property 1: Unauthenticated request rejection**
    - **Validates: Requirements 1.3, 16.1**

- [x] 4. Set up backend Lambda functions and DynamoDB service layer
  - [x] 4.1 Create DynamoDBService utility module
    - Implement createEntity(entityType, data) - generates UUID, timestamp, stores with pk/sk
    - Implement getEntity(entityType, id) - retrieves by pk and sk
    - Implement listEntities(entityType) - queries by pk
    - Implement updateEntity(entityType, id, data) - updates entity
    - Implement deleteEntity(entityType, id) - deletes entity
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [ ]* 4.2 Write property tests for DynamoDB storage patterns
    - **Property 41: Entity partition key format**
    - **Property 42: Entity sort key format**
    - **Property 43: Entity data structure**
    - **Property 44: Entity type query pattern**
    - **Property 45: Specific entity retrieval pattern**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5**
  
  - [x] 4.3 Create validation and response utility modules
    - ValidationUtils: validateRequired, validateUUID, sanitizeInput
    - ResponseUtils: success, error, corsHeaders
    - _Requirements: 3.3, 5.4_
  
  - [x] 4.4 Implement JWT authentication middleware
    - Verify JWT tokens from Cognito
    - Extract user info from token
    - Return 401 for invalid/expired tokens
    - _Requirements: 1.3, 1.5, 16.1, 16.2_
  
  - [ ]* 4.5 Write property test for expired token rejection
    - **Property 2: Expired token rejection**
    - **Validates: Requirements 1.5**

- [x] 5. Implement Things backend API
  - [x] 5.1 Create Things Lambda handler
    - GET /things - List all things (query pk="THINGS")
    - POST /things - Create thing with validation
    - PUT /things/{id} - Update thing
    - DELETE /things/{id} - Delete thing
    - Apply JWT authentication to all endpoints
    - _Requirements: 3.2, 5.3, 6.2, 18.1_
  
  - [ ]* 5.2 Write property test for entity creation with metadata
    - **Property 5: Entity creation with metadata**
    - **Validates: Requirements 3.2, 11.1, 12.1, 13.1, 14.1**
  
  - [ ]* 5.3 Write property test for required field validation
    - **Property 6: Required field validation**
    - **Validates: Requirements 3.3, 5.4**
  
  - [ ]* 5.4 Write property test for entity update persistence
    - **Property 9: Entity update persistence**
    - **Validates: Requirements 5.3, 5.5, 11.3, 12.3, 13.3, 14.3**
  
  - [ ]* 5.5 Write property test for confirmed deletion execution
    - **Property 11: Confirmed deletion execution**
    - **Validates: Requirements 6.2, 6.4**

- [x] 6. Implement Locations backend API
  - [x] 6.1 Create Locations Lambda handler
    - GET /locations - List all locations
    - POST /locations - Create location with address fields
    - PUT /locations/{id} - Update location
    - DELETE /locations/{id} - Delete location
    - _Requirements: 11.1, 11.3, 11.4_
  
  - [ ]* 6.2 Write property test for non-cascading deletion
    - **Property 13: Non-cascading deletion**
    - **Validates: Requirements 6.5**
  
  - [ ]* 6.3 Write property test for optional field acceptance
    - **Property 30: Optional field acceptance**
    - **Validates: Requirements 11.5**

- [x] 7. Implement Rooms backend API
  - [x] 7.1 Create Rooms Lambda handler
    - GET /rooms?locationId={id} - List rooms for a location
    - POST /rooms - Create room with locationId validation
    - PUT /rooms/{id} - Update room
    - DELETE /rooms/{id} - Delete room
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  
  - [ ]* 7.2 Write property test for room location requirement
    - **Property 32: Room location requirement**
    - **Validates: Requirements 12.5**

- [x] 8. Implement Categories and People backend APIs
  - [x] 8.1 Create Categories Lambda handler
    - GET /categories - List all categories
    - POST /categories - Create category
    - PUT /categories/{id} - Update category
    - DELETE /categories/{id} - Delete category
    - _Requirements: 13.1, 13.3, 13.4_
  
  - [x] 8.2 Create People Lambda handler
    - GET /people - List all people
    - POST /people - Create person
    - PUT /people/{id} - Update person
    - DELETE /people/{id} - Delete person
    - _Requirements: 14.1, 14.3, 14.4_
  
  - [ ]* 8.3 Write property tests for multi-reference support
    - **Property 33: Category multi-reference support**
    - **Property 34: Person multi-reference support**
    - **Validates: Requirements 13.5, 14.5**

- [x] 9. Implement photo upload/download backend
  - [x] 9.1 Create S3Service utility module
    - Implement generateUploadUrl(key, contentType) - creates presigned upload URL with 1 hour expiration
    - Implement generateDownloadUrl(key) - creates presigned download URL with 1 hour expiration
    - Implement deleteObject(key) - deletes S3 object
    - Validate file types (images only)
    - _Requirements: 7.6, 16.3_
  
  - [x] 9.2 Create Photo Lambda handler
    - POST /upload - Generate presigned URL for upload
    - GET /photo/{key} - Generate presigned URL for download
    - _Requirements: 7.2, 7.3, 7.6_
  
  - [ ]* 9.3 Write property test for presigned URL expiration
    - **Property 3: Presigned URL expiration**
    - **Validates: Requirements 7.6**

- [x] 10. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Create TypeScript interfaces and API client
  - [x] 11.1 Define TypeScript interfaces for all entities
    - Thing, Location, Room, Category, Person interfaces
    - Match backend data structures
    - Include all fields (including disposalDate, nextReviewDate)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_
  
  - [x] 11.2 Create API client service with Axios
    - Configure base URL and authentication headers
    - Implement CRUD methods for each entity type
    - Handle JWT token injection
    - Handle error responses
    - _Requirements: 1.3, 15.3, 16.1_

- [x] 12. Implement navigation and layout
  - [x] 12.1 Adapt MUI template sidebar for entity navigation
    - Configure navigation items: Things, Locations, Categories, People
    - Add icons for each navigation item
    - Implement collapsible sidebar with toggle
    - Show icons when collapsed, icons + labels when expanded
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 12.2 Set up React Router with protected routes
    - Define routes for each entity list view
    - Wrap routes with ProtectedRoute component
    - Implement navigation on sidebar item click
    - _Requirements: 2.5_
  
  - [ ]* 12.3 Write property test for navigation routing
    - **Property 4: Navigation routing**
    - **Validates: Requirements 2.5**

- [-] 13. Create reusable data table component
  - [x] 13.1 Build EntityTable component with MUI DataGrid
    - Accept columns, data, onEdit, onDelete, onRowClick as props
    - Implement column sorting (toggle asc/desc on header click)
    - Add global search input with filtering across all columns
    - Add per-column filter inputs
    - Display filtered item count
    - Add Edit and Delete action buttons per row
    - Implement pagination
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 13.2 Write property tests for table functionality
    - **Property 14: Column sort toggle**
    - **Property 15: Global search filtering**
    - **Property 16: Column-specific filtering**
    - **Property 17: Filtered item count accuracy**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
  
  - [ ]* 13.3 Write property test for search debouncing
    - **Property 39: Search and filter debouncing**
    - **Validates: Requirements 17.2**

- [x] 14. Create reusable form dialog component
  - [x] 14.1 Build EntityFormDialog component
    - Modal dialog with form
    - Accept fields config, initialData, onSubmit, onClose as props
    - Implement field validation (required fields marked with *)
    - Display validation errors inline
    - Cancel and Submit buttons
    - _Requirements: 3.1, 3.3, 5.1, 5.4_
  
  - [ ]* 14.2 Write property test for edit dialog pre-population
    - **Property 8: Edit dialog pre-population**
    - **Validates: Requirements 5.1**

- [x] 15. Implement Things management UI
  - [x] 15.1 Create Things list view with EntityTable
    - Display all Things with columns: name, description, location, room, owner, category, date added
    - Add button to open create dialog
    - Click name to open edit dialog
    - Edit and Delete buttons per row
    - _Requirements: 3.1, 4.1, 5.1, 5.2_
  
  - [x] 15.2 Create ThingFormDialog component
    - Extend EntityFormDialog with Thing-specific fields
    - Text inputs: name*, description, serial number, notes, purchased from, warranty details
    - Date pickers: date purchased, disposal date, next review date
    - Dropdowns: location, room, owner (person), category
    - Photo upload section (placeholder for now)
    - _Requirements: 3.1, 3.2, 18.1_
  
  - [x] 15.3 Wire up Thing CRUD operations
    - Create: Call POST /things API, close dialog, refresh table
    - Update: Call PUT /things/{id} API, close dialog, refresh table
    - Delete: Show confirmation dialog, call DELETE /things/{id} API, refresh table
    - _Requirements: 3.2, 3.5, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 15.4 Write property tests for CRUD UI updates
    - **Property 7: Successful creation UI update**
    - **Property 10: Delete confirmation requirement**
    - **Property 12: Cancelled deletion preservation**
    - **Property 40: Optimistic UI updates**
    - **Validates: Requirements 3.5, 6.1, 6.3, 17.4**
  
  - [ ]* 15.5 Write property tests for user feedback
    - **Property 36: Loading indicator display**
    - **Property 37: Success feedback display**
    - **Property 38: Error message display**
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 16. Implement photo upload functionality for Things
  - [x] 16.1 Create PhotoUploadZone component
    - Drag-and-drop area for image files
    - Browse button for file selection
    - File type validation (images only)
    - Multiple file support
    - Upload progress indicator
    - _Requirements: 7.1, 7.2_
  
  - [x] 16.2 Create PhotoPreviewGrid component
    - Grid layout displaying uploaded photos
    - Load photos using presigned download URLs
    - Remove button per photo
    - Lazy loading support
    - _Requirements: 7.4, 7.5, 17.3_
  
  - [x] 16.3 Integrate photo upload into ThingFormDialog
    - Add PhotoUploadZone and PhotoPreviewGrid to dialog
    - On file selection, call POST /upload to get presigned URL
    - Upload files to S3 using presigned URLs
    - Store S3 keys in Thing record photos array
    - Display existing photos when editing
    - Handle photo removal (delete key from array)
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [ ]* 16.4 Write property tests for photo management
    - **Property 18: Multiple photo upload**
    - **Property 19: Photo removal**
    - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 17. Implement Locations management UI with nested Rooms
  - [x] 17.1 Create Locations list view with expandable rows
    - Display all Locations with columns: name, address, town, country
    - Add expand button per row
    - When expanded, show all Things where locationId matches
    - Add button to open create dialog
    - _Requirements: 8.1, 11.2_
  
  - [ ]* 17.2 Write property test for location expandable row content
    - **Property 20: Location expandable row content**
    - **Validates: Requirements 8.1**
  
  - [x] 17.3 Create LocationFormDialog with address fields
    - Text inputs: name*, address line 1, address line 2, town, county, postcode, description
    - Country selector dropdown with search/filter
    - Store ISO country code, display country name
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.3_
  
  - [ ]* 17.4 Write property tests for country selection
    - **Property 26: Country dropdown filtering**
    - **Property 27: Country code storage**
    - **Property 28: Country name display**
    - **Property 29: Country pre-selection on edit**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
  
  - [x] 17.5 Add room management section to LocationFormDialog
    - Display all Rooms for current Location
    - Add button to create new Room (auto-associates with Location)
    - Edit button per Room (opens inline edit)
    - Delete button per Room (with confirmation)
    - Keep Location dialog open during Room operations
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 17.6 Write property tests for room management within Location
    - **Property 21: Location dialog room display**
    - **Property 22: Room creation from Location dialog**
    - **Property 23: Room edit dialog persistence**
    - **Property 24: Room deletion from Location dialog**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
  
  - [x] 17.7 Wire up Location CRUD operations
    - Create: Call POST /locations API
    - Update: Call PUT /locations/{id} API
    - Delete: Call DELETE /locations/{id} API with confirmation
    - _Requirements: 11.1, 11.3, 11.4_

- [x] 18. Implement Room form with floor selector
  - [x] 18.1 Create RoomFormDialog component
    - Text input: name*
    - Location dropdown (pre-selected when creating from Location dialog)
    - Floor selector with predefined options
    - _Requirements: 9.1, 12.1, 12.3_
  
  - [x] 18.2 Create FloorSelector component
    - Dropdown with options: Basement, Ground Floor, 1st Floor, 2nd Floor, 3rd Floor, 4th Floor, Attic
    - Custom button to toggle to text input
    - Toggle back to dropdown button
    - Preserve custom values when editing
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 18.3 Write property test for custom floor value persistence
    - **Property 25: Custom floor value persistence**
    - **Validates: Requirements 9.3, 9.4**
  
  - [x] 18.4 Wire up Room CRUD operations from Location dialog
    - Create: Call POST /rooms API with locationId
    - Update: Call PUT /rooms/{id} API
    - Delete: Call DELETE /rooms/{id} API with confirmation
    - _Requirements: 12.1, 12.3, 12.4_

- [x] 19. Implement Categories management UI
  - [x] 19.1 Create Categories list view
    - Display all Categories with columns: name, description, date added
    - Add button to open create dialog
    - Edit and Delete buttons per row
    - _Requirements: 13.2_
  
  - [x] 19.2 Create CategoryFormDialog component
    - Text inputs: name*, description
    - _Requirements: 13.1, 13.3_
  
  - [x] 19.3 Wire up Category CRUD operations
    - Create: Call POST /categories API
    - Update: Call PUT /categories/{id} API
    - Delete: Call DELETE /categories/{id} API with confirmation
    - _Requirements: 13.1, 13.3, 13.4_

- [x] 20. Implement People management UI
  - [x] 20.1 Create People list view
    - Display all People with columns: name, description, date added
    - Add button to open create dialog
    - Edit and Delete buttons per row
    - _Requirements: 14.2_
  
  - [x] 20.2 Create PersonFormDialog component
    - Text inputs: name*, description
    - _Requirements: 14.1, 14.3_
  
  - [x] 20.3 Wire up Person CRUD operations
    - Create: Call POST /people API
    - Update: Call PUT /people/{id} API
    - Delete: Call DELETE /people/{id} API with confirmation
    - _Requirements: 14.1, 14.3, 14.4_

- [x] 21. Implement entity relationship storage and display
  - [x] 21.1 Update Thing form to store relationship UUIDs
    - When Location selected, store locationId
    - When Room selected, store roomId
    - When Owner selected, store ownerId
    - When Category selected, store categoryId
    - _Requirements: 18.2, 18.3, 18.4, 18.5_
  
  - [ ]* 21.2 Write property test for entity relationship storage
    - **Property 35: Entity relationship storage**
    - **Validates: Requirements 18.2, 18.3, 18.4, 18.5**
  
  - [x] 21.3 Resolve and display relationship names in Things table
    - Fetch all Locations, Rooms, Categories, People on load
    - Map UUIDs to names for display in table
    - Handle orphaned references gracefully (show "Unknown" or empty)
    - _Requirements: 4.1, 12.2_
  
  - [ ]* 21.4 Write property test for room location name display
    - **Property 31: Room display within Location**
    - **Validates: Requirements 12.2**

- [x] 22. Implement error handling and user feedback
  - [x] 22.1 Add global error boundary component
    - Catch React errors
    - Display user-friendly error message
    - Log errors to console
    - _Requirements: 15.3_
  
  - [x] 22.2 Add loading states to all API calls
    - Show loading spinner during requests
    - Disable form submissions during loading
    - _Requirements: 15.1_
  
  - [x] 22.3 Add success/error toast notifications
    - Show success message after successful operations
    - Show error message with details on failures
    - Auto-dismiss after 5 seconds
    - _Requirements: 15.2, 15.3_
  
  - [x] 22.4 Handle authentication errors globally
    - Detect 401 responses
    - Clear auth state and redirect to sign-in
    - Display session expired message
    - _Requirements: 1.5, 16.2_

- [x] 23. Implement responsive design and accessibility
  - [x] 23.1 Test and adjust responsive breakpoints
    - Verify layout on desktop (1920x1080)
    - Verify layout on tablet (768x1024)
    - Verify layout on mobile (375x667)
    - Adjust sidebar behavior for mobile (overlay instead of push)
    - _Requirements: 20.2, 20.3, 20.4_
  
  - [x] 23.2 Ensure keyboard navigation works
    - Tab through all interactive elements
    - Enter/Space to activate buttons
    - Escape to close dialogs
    - _Requirements: 20.1_
  
  - [x] 23.3 Add ARIA labels and roles
    - Label all form inputs
    - Add roles to custom components
    - Ensure screen reader compatibility
    - _Requirements: 20.1_

- [x] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 25. Deploy application
  - [x] 25.1 Deploy backend with SAM
    - Run sam build
    - Run sam deploy
    - Capture output values (API URL, etc.)
    - _Requirements: All backend requirements_
  
  - [x] 25.2 Build and deploy frontend
    - Update .env.production with AWS resource values
    - Run npm run build
    - Deploy to S3 + CloudFront or Vercel
    - Configure custom domain if needed
    - _Requirements: All frontend requirements_
  
  - [x] 25.3 Verify end-to-end functionality
    - Test authentication flow
    - Test all CRUD operations
    - Test photo upload
    - Test relationships and nested room management
    - Verify on multiple browsers
    - _Requirements: 20.1_
