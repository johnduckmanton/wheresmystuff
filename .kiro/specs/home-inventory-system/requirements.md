# Requirements Document

## Introduction

The Home Inventory Management System is a web-based application that enables users to track and manage their personal belongings across multiple locations. The system provides comprehensive inventory management with support for items (things), physical locations, rooms, categories, and ownership tracking. Users can upload photos, organize items hierarchically, and perform advanced filtering and sorting operations. The system is built on AWS infrastructure with a React frontend, utilizing Cognito for authentication, DynamoDB for data storage, and S3 for photo management.

## Glossary

- **System**: The Home Inventory Management System
- **User**: An authenticated person using the system
- **Thing**: An item in the inventory being tracked
- **Location**: A physical address where items are stored
- **Room**: A specific room within a location
- **Category**: A classification type for items
- **Person**: An individual who owns items in the inventory
- **Entity**: Any of the five core data types (Things, Locations, Rooms, Categories, People)
- **Data Table**: A sortable, filterable table displaying entity records
- **Modal Dialog**: A popup form for creating or editing entities
- **Presigned URL**: A temporary secure URL for accessing S3 resources
- **Cognito**: AWS authentication service
- **DynamoDB**: AWS NoSQL database service
- **S3**: AWS Simple Storage Service for file storage

## Requirements

### Requirement 1

**User Story:** As a user, I want to register and authenticate with the system, so that my inventory data is secure and private.

#### Acceptance Criteria

1. WHEN a user registers with email and password, THE System SHALL create a new account in AWS Cognito with password requirements of minimum 8 characters, uppercase, lowercase, and numbers
2. WHEN a user provides valid credentials, THE System SHALL authenticate the user and issue a JWT token
3. WHEN a user attempts to access any data endpoint without authentication, THE System SHALL reject the request and return an unauthorized error
4. WHEN an authenticated user signs out, THE System SHALL invalidate the session and redirect to the sign-in page
5. WHEN a user session expires, THE System SHALL require re-authentication before allowing further data access

### Requirement 2

**User Story:** As a user, I want to navigate between different sections of the application, so that I can access different types of inventory data.

#### Acceptance Criteria

1. WHEN a user views the application, THE System SHALL display a collapsible sidebar with navigation items for Things, Locations, Categories, and People
2. WHEN a user clicks the sidebar toggle button, THE System SHALL collapse or expand the sidebar while maintaining icon visibility
3. WHILE the sidebar is collapsed, THE System SHALL display only icons for navigation items
4. WHILE the sidebar is expanded, THE System SHALL display both icons and full text labels for navigation items
5. WHEN a user clicks a navigation item, THE System SHALL navigate to the corresponding entity list view

### Requirement 3

**User Story:** As a user, I want to create new items in my inventory, so that I can track my belongings.

#### Acceptance Criteria

1. WHEN a user clicks the Add button above the Things data table, THE System SHALL open a modal dialog with a form for creating a new Thing
2. WHEN a user submits a Thing form with a valid name, THE System SHALL create the Thing record in DynamoDB with a unique UUID and auto-generated date added timestamp
3. WHEN a user submits a Thing form without a required name field, THE System SHALL prevent submission and display a validation error
4. WHEN a user clicks Cancel in the create dialog, THE System SHALL close the dialog without creating a record
5. WHEN a Thing is successfully created, THE System SHALL close the dialog, refresh the data table, and display the new Thing

### Requirement 4

**User Story:** As a user, I want to view all my inventory items in a sortable and filterable table, so that I can easily find specific items.

#### Acceptance Criteria

1. WHEN a user navigates to the Things view, THE System SHALL display all Things in a data table with columns for name, description, location, room, owner, category, and date added
2. WHEN a user clicks a column header, THE System SHALL sort the table by that column in ascending order on first click and descending order on second click
3. WHEN a user types in the global search field, THE System SHALL filter the table to show only rows matching the search term across all columns
4. WHEN a user types in a column filter field, THE System SHALL filter the table to show only rows matching that specific column value
5. WHEN filters are applied, THE System SHALL display the count of filtered items

### Requirement 5

**User Story:** As a user, I want to edit existing items, so that I can update information as it changes.

#### Acceptance Criteria

1. WHEN a user clicks an item name in the data table, THE System SHALL open a modal dialog pre-populated with the existing item data
2. WHEN a user clicks the Edit button for a row, THE System SHALL open the same edit modal dialog
3. WHEN a user modifies fields and submits the edit form, THE System SHALL update the record in DynamoDB with the new values
4. WHEN a user submits an edit form with invalid data, THE System SHALL prevent submission and display validation errors
5. WHEN an item is successfully updated, THE System SHALL close the dialog and refresh the data table with updated values

### Requirement 6

**User Story:** As a user, I want to delete items I no longer need to track, so that my inventory stays current.

#### Acceptance Criteria

1. WHEN a user clicks the Delete button for a row, THE System SHALL display a confirmation dialog before deletion
2. WHEN a user confirms deletion, THE System SHALL remove the record from DynamoDB
3. WHEN a user cancels the deletion confirmation, THE System SHALL close the dialog without deleting the record
4. WHEN an item is successfully deleted, THE System SHALL refresh the data table and remove the deleted item from view
5. WHEN a Location or Room is deleted, THE System SHALL preserve associated Things without cascading deletion

### Requirement 7

**User Story:** As a user, I want to upload photos of my items, so that I have visual records of my belongings.

#### Acceptance Criteria

1. WHEN a user opens the Thing edit dialog, THE System SHALL display a photo upload interface with drag-and-drop and browse button options
2. WHEN a user drags and drops image files onto the upload area, THE System SHALL accept the files and display upload progress
3. WHEN a user selects multiple photos, THE System SHALL upload all photos to S3 and store the S3 keys in the Thing record
4. WHEN photos are uploaded, THE System SHALL display a preview grid of all photos associated with the Thing
5. WHEN a user clicks remove on a photo, THE System SHALL delete the S3 key from the Thing record and remove the photo from the preview grid
6. WHEN the System displays photos, THE System SHALL generate presigned URLs with 1 hour expiration for secure access

### Requirement 8

**User Story:** As a user, I want to manage locations with nested room management, so that I can organize items hierarchically.

#### Acceptance Criteria

1. WHEN a user clicks the expand button on a Location row, THE System SHALL display all Things associated with that Location in an expanded section
2. WHEN a user opens the Location edit dialog, THE System SHALL display a room management section showing all Rooms for that Location
3. WHEN a user adds a new Room from within the Location edit dialog, THE System SHALL create the Room and automatically associate it with the current Location
4. WHEN a user edits a Room from within the Location edit dialog, THE System SHALL update the Room record without closing the Location dialog
5. WHEN a user deletes a Room from within the Location edit dialog, THE System SHALL remove the Room record after confirmation

### Requirement 9

**User Story:** As a user, I want to specify room floors with predefined options or custom text, so that I can accurately describe room locations.

#### Acceptance Criteria

1. WHEN a user creates or edits a Room, THE System SHALL display a floor dropdown with options: Basement, Ground Floor, 1st Floor, 2nd Floor, 3rd Floor, 4th Floor, and Attic
2. WHEN a user clicks the Custom button, THE System SHALL replace the dropdown with a text input field for free-form entry
3. WHEN a user enters custom floor text and saves, THE System SHALL store the custom value in the Room record
4. WHEN a user edits a Room with a custom floor value, THE System SHALL display the custom text input with the preserved value
5. WHEN a user toggles back from custom to dropdown, THE System SHALL restore the dropdown selection interface

### Requirement 10

**User Story:** As a user, I want to select countries from a standardized list, so that location addresses are consistent and valid.

#### Acceptance Criteria

1. WHEN a user creates or edits a Location, THE System SHALL display a country dropdown with all ISO country codes and names
2. WHEN a user types in the country field, THE System SHALL filter the dropdown to show matching countries
3. WHEN a user selects a country, THE System SHALL store the ISO country code in the Location record
4. WHEN the System displays a Location, THE System SHALL show the full country name corresponding to the stored ISO code
5. WHEN a user opens an edit dialog for a Location, THE System SHALL pre-select the country based on the stored ISO code

### Requirement 11

**User Story:** As a user, I want to create and manage locations, so that I can organize where my items are stored.

#### Acceptance Criteria

1. WHEN a user submits a Location form with a valid name, THE System SHALL create the Location record with name, address fields, and auto-generated date added
2. WHEN a user views the Locations data table, THE System SHALL display all Locations with sortable and filterable columns
3. WHEN a user edits a Location, THE System SHALL update all address fields including address line 1, address line 2, town, county, postcode, and country
4. WHEN a user deletes a Location, THE System SHALL remove the Location record after confirmation
5. THE System SHALL allow optional description field for Locations

### Requirement 12

**User Story:** As a user, I want to create and manage rooms within locations, so that I can specify exact locations within buildings.

#### Acceptance Criteria

1. WHEN a user submits a Room form with a valid name and location reference, THE System SHALL create the Room record with auto-generated date added
2. WHEN a user manages Rooms from within a Location, THE System SHALL display all Rooms associated with that Location
3. WHEN a user edits a Room, THE System SHALL allow updating the name, location reference, and floor
4. WHEN a user deletes a Room, THE System SHALL remove the Room record after confirmation
5. WHEN a Room is created, THE System SHALL require a Location reference to establish the relationship

### Requirement 13

**User Story:** As a user, I want to create and manage categories, so that I can classify my items by type.

#### Acceptance Criteria

1. WHEN a user submits a Category form with a valid name, THE System SHALL create the Category record with name, optional description, and auto-generated date added
2. WHEN a user views the Categories data table, THE System SHALL display all Categories with sortable and filterable columns
3. WHEN a user edits a Category, THE System SHALL update the name and description fields
4. WHEN a user deletes a Category, THE System SHALL remove the Category record after confirmation
5. THE System SHALL allow Categories to be referenced by multiple Things

### Requirement 14

**User Story:** As a user, I want to create and manage people records, so that I can track item ownership.

#### Acceptance Criteria

1. WHEN a user submits a Person form with a valid name, THE System SHALL create the Person record with name, optional description, and auto-generated date added
2. WHEN a user views the People data table, THE System SHALL display all People with sortable and filterable columns
3. WHEN a user edits a Person, THE System SHALL update the name and description fields
4. WHEN a user deletes a Person, THE System SHALL remove the Person record after confirmation
5. THE System SHALL allow People to be referenced as owners by multiple Things

### Requirement 15

**User Story:** As a user, I want the application to provide immediate feedback on my actions, so that I know operations are processing or complete.

#### Acceptance Criteria

1. WHEN a user performs any API operation, THE System SHALL display a loading indicator during the request
2. WHEN an API operation completes successfully, THE System SHALL display a success message or visual confirmation
3. WHEN an API operation fails, THE System SHALL display an error message with actionable information
4. WHEN a user hovers over interactive elements, THE System SHALL provide visual hover state feedback
5. WHEN the System performs transitions between states, THE System SHALL use smooth animations

### Requirement 16

**User Story:** As a user, I want all API endpoints to be secured, so that my data is protected from unauthorized access.

#### Acceptance Criteria

1. WHEN a request is made to any data endpoint, THE System SHALL require a valid JWT token in the Authorization header
2. WHEN a request is made without a valid token, THE System SHALL return a 401 unauthorized response
3. WHEN the System generates S3 presigned URLs, THE System SHALL set expiration to 1 hour
4. WHEN the System serves API requests, THE System SHALL enforce CORS policies to allow only authorized origins
5. THE System SHALL prevent direct public access to the S3 bucket

### Requirement 17

**User Story:** As a user, I want the application to be responsive and performant, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN the application loads initially, THE System SHALL complete the initial render within 3 seconds on standard broadband connections
2. WHEN a user types in search or filter fields, THE System SHALL debounce input to avoid excessive filtering operations
3. WHEN the System loads photos, THE System SHALL implement lazy loading to defer loading until photos are needed
4. WHEN a user performs CRUD operations, THE System SHALL update the UI optimistically before server confirmation
5. WHEN the System fetches data, THE System SHALL implement efficient query patterns to minimize database reads

### Requirement 18

**User Story:** As a user, I want to track detailed information about my items, so that I have comprehensive records.

#### Acceptance Criteria

1. WHEN a user creates a Thing, THE System SHALL allow entry of name, description, serial number, notes, date purchased, purchased from, warranty details, disposal date, and next review date
2. WHEN a user associates a Thing with a Location, THE System SHALL store the Location UUID reference in the Thing record
3. WHEN a user associates a Thing with a Room, THE System SHALL store the Room UUID reference in the Thing record
4. WHEN a user associates a Thing with an Owner, THE System SHALL store the Person UUID reference in the Thing record
5. WHEN a user associates a Thing with a Category, THE System SHALL store the Category UUID reference in the Thing record

### Requirement 19

**User Story:** As a developer, I want the system to use a single-table DynamoDB design, so that queries are efficient and costs are optimized.

#### Acceptance Criteria

1. WHEN the System stores any entity, THE System SHALL use a partition key of the entity type (THINGS, LOCATIONS, ROOMS, CATEGORIES, PEOPLE)
2. WHEN the System stores any entity, THE System SHALL use a sort key of a unique UUID
3. WHEN the System stores entity data, THE System SHALL store all attributes in a data JSON object
4. WHEN the System queries entities, THE System SHALL query by partition key to retrieve all entities of a given type
5. WHEN the System retrieves a specific entity, THE System SHALL use both partition key and sort key for direct access

### Requirement 20

**User Story:** As a user, I want the application to work across modern browsers and devices, so that I can access my inventory anywhere.

#### Acceptance Criteria

1. WHEN a user accesses the application on Chrome, Firefox, Safari, or Edge, THE System SHALL render and function correctly
2. WHEN a user accesses the application on a desktop screen, THE System SHALL display the full layout with sidebar navigation
3. WHEN a user accesses the application on a tablet, THE System SHALL adapt the layout responsively
4. WHEN a user accesses the application on a mobile device, THE System SHALL provide a mobile-friendly responsive interface
5. THE System SHALL use Material-UI components that support responsive design patterns
