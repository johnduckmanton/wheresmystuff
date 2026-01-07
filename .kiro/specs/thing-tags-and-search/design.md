# Design Document: Thing Tags and Search

## Overview

The Thing Tags and Search feature extends the existing inventory system by adding a flexible tagging system to Things and implementing advanced search capabilities. The design leverages the existing DynamoDB single-table design and builds upon the current REST API architecture.

The system will support multiple tags per thing, autocomplete suggestions, and both AND/OR search operations. Tags will be stored as an array within the Thing entity to maintain simplicity while enabling powerful search capabilities through DynamoDB's filtering and indexing features.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Lambda        │
│   React App     │◄──►│   HTTP API      │◄──►│   Functions     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │   DynamoDB      │
                                               │   Single Table  │
                                               └─────────────────┘
```

### Tag Storage Strategy

Tags will be stored as an array field within the existing Thing entity in DynamoDB. This approach:
- Maintains data locality (no additional queries needed)
- Leverages existing CRUD operations
- Supports efficient filtering with DynamoDB's `contains` operator
- Keeps the single-table design intact

### Search Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Search Input  │    │   Search API    │    │   DynamoDB      │
│   Component     │◄──►│   Endpoint      │◄──►│   Scan/Query    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────►│   Tag Cache     │◄─────────────┘
                        │   (In-Memory)   │
                        └─────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. Enhanced Things Handler (`backend/handlers/things.js`)

**New Endpoints:**
- `GET /things?inventoryId={id}&tags={tag1,tag2}&tagMode={and|or}` - Search by tags
- `GET /things/tags?inventoryId={id}` - Get all tags for autocomplete
- `GET /things/tags/analytics?inventoryId={id}` - Get tag usage statistics

**Enhanced Existing Endpoints:**
- `GET /things?inventoryId={id}` - Include tags in response
- `POST /things` - Accept tags in request body
- `PUT /things/{id}` - Accept tags in request body

#### 2. Tag Service (`backend/services/tagService.js`)

```javascript
class TagService {
  // Extract unique tags from all things in an inventory
  async getInventoryTags(inventoryId)
  
  // Get tag usage statistics
  async getTagAnalytics(inventoryId)
  
  // Normalize and validate tag names
  normalizeTag(tagName)
  
  // Search things by tag combinations
  async searchByTags(inventoryId, tags, mode = 'and')
}
```

#### 3. Enhanced DynamoDB Service

**New Query Patterns:**
- Scan with tag filters using `contains` operator
- Aggregate tag statistics across inventory items
- Efficient tag-based filtering with proper indexing

### Frontend Components

#### 1. Tag Input Component (`frontend/src/components/TagInput.tsx`)

```typescript
interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
}
```

**Features:**
- Chip-based tag display
- Autocomplete with existing tags
- Keyboard navigation (Enter, Comma, Backspace)
- Tag validation and normalization

#### 2. Enhanced Search Component (`frontend/src/components/SearchBar.tsx`)

```typescript
interface SearchBarProps {
  onSearch: (query: SearchQuery) => void;
  inventoryId: string;
}

interface SearchQuery {
  text?: string;
  tags?: string[];
  tagMode: 'and' | 'or';
  categoryId?: string;
  locationId?: string;
}
```

**Features:**
- Combined text and tag search
- AND/OR toggle for tag search
- Tag autocomplete
- Search history

#### 3. Tag Analytics Component (`frontend/src/components/TagAnalytics.tsx`)

```typescript
interface TagAnalyticsProps {
  inventoryId: string;
}

interface TagStatistic {
  tag: string;
  count: number;
  percentage: number;
}
```

**Features:**
- Tag usage frequency
- Visual charts (bar chart, word cloud)
- Tag management (rename, delete unused)

## Data Models

### Enhanced Thing Entity

```typescript
interface Thing {
  // Existing fields...
  id: string;
  inventoryId: string;
  name: string;
  description?: string;
  // ... other existing fields
  
  // New tag field
  tags?: string[]; // Array of normalized tag names
  
  // Existing fields...
  dateAdded: string;
}
```

### Tag Analytics Model

```typescript
interface TagAnalytics {
  inventoryId: string;
  totalTags: number;
  uniqueTags: number;
  tagStatistics: TagStatistic[];
  lastUpdated: string;
}

interface TagStatistic {
  tag: string;
  count: number;
  percentage: number;
  firstUsed: string;
  lastUsed: string;
}
```

### Search Request Model

```typescript
interface TagSearchRequest {
  inventoryId: string;
  tags: string[];
  tagMode: 'and' | 'or';
  textQuery?: string;
  categoryId?: string;
  locationId?: string;
  limit?: number;
  lastEvaluatedKey?: any;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Let me analyze the acceptance criteria to determine which are testable as properties:

### Property Reflection

After reviewing all the testable properties from the prework analysis, I identified several areas where properties can be consolidated:

**Redundancy Analysis:**
- Properties 2.1, 2.2, and 7.3 all test character validation - can be combined into one comprehensive validation property
- Properties 1.2 and 7.5 both test data persistence and integrity - can be combined
- Properties 3.1 and 3.3 test AND/OR search logic - can be combined into one search behavior property
- Properties 4.1, 4.2, 4.4, and 4.5 all test autocomplete behavior - can be combined
- Properties 8.1, 8.2, 8.4, 8.5, and 8.6 all test API functionality - can be combined

**Final Property Set:**
After consolidation, the unique properties that provide distinct validation value are:
1. Tag persistence and data integrity
2. Tag input validation and normalization
3. Search functionality (AND/OR operations)
4. Autocomplete behavior
5. Tag analytics and management
6. UI interaction behavior
7. API functionality

### Correctness Properties

**Property 1: Tag Persistence and Integrity**
*For any* thing and any valid tag, adding the tag to the thing should result in the tag being retrievable when the thing is loaded, and removing the tag should result in it no longer being associated with that thing while preserving it on other things
**Validates: Requirements 1.2, 1.3, 7.2, 7.5**

**Property 2: Tag Input Validation and Normalization**
*For any* tag input, the system should accept only alphanumeric characters, hyphens, and underscores, enforce a maximum length of 50 characters, convert to lowercase, and prevent duplicate tags on the same thing
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 7.1, 7.3**

**Property 3: Tag Search Functionality**
*For any* set of tags and search mode (AND/OR), the search engine should return exactly those things that match the specified criteria, with AND returning things having all tags and OR returning things having any of the tags
**Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6**

**Property 4: Tag Autocomplete Behavior**
*For any* partial tag input, the system should provide relevant suggestions from existing tags, ranked by usage frequency, limited to 10 suggestions, and excluding tags already applied to the current thing
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

**Property 5: Tag Analytics Accuracy**
*For any* inventory with tagged things, the analytics should accurately count tag usage, display tags sorted by frequency, show correct association counts, and support tag management operations
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

**Property 6: UI Interaction Consistency**
*For any* tag input interaction (typing, pressing Enter/comma, clicking remove), the UI should respond consistently by creating tags, displaying them as removable chips, and updating the underlying data
**Validates: Requirements 1.1, 1.5, 2.5, 2.6, 2.7**

**Property 7: API Functionality Completeness**
*For any* tag-related API operation, the system should provide appropriate endpoints, include tag data in responses, support bulk operations, accept query parameters, and return correct HTTP status codes with detailed error messages
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

**Property 8: Multiple Tag Support**
*For any* thing, the system should support adding multiple tags (up to the maximum limit), storing them as an array, and maintaining their order and uniqueness
**Validates: Requirements 1.4**

**Property 9: Data Migration and Import Consistency**
*For any* imported or migrated tag data, the system should normalize tag names to maintain consistency and preserve data integrity
**Validates: Requirements 7.4**

**Property 10: Large Dataset Handling**
*For any* inventory with more than 1,000 unique tags, the tag management interface should implement pagination to maintain usability
**Validates: Requirements 6.5**

## Error Handling

### Tag Validation Errors
- **Invalid Characters**: Return 400 with specific character validation message
- **Tag Too Long**: Return 400 with length limit information
- **Duplicate Tags**: Silently ignore or return 409 with duplicate warning
- **Maximum Tags Exceeded**: Return 400 with limit information

### Search Errors
- **Invalid Tag Format**: Return 400 with format requirements
- **Search Timeout**: Return 408 with retry suggestion
- **No Results**: Return 200 with empty array and helpful message

### API Errors
- **Missing Inventory Access**: Return 403 with access requirements
- **Invalid Tag Parameters**: Return 400 with parameter format guide
- **Database Errors**: Return 500 with generic error message (log details)

### Frontend Error Handling
- **Network Errors**: Show retry button with exponential backoff
- **Validation Errors**: Show inline validation messages
- **Search Errors**: Show error state with clear recovery options

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific scenarios with property-based tests for comprehensive coverage:

**Unit Tests:**
- Specific tag validation scenarios (empty tags, special characters)
- Edge cases (maximum tags, very long tag names)
- Error conditions (network failures, invalid responses)
- Integration points between components
- UI interaction examples (clicking, typing, selecting)

**Property-Based Tests:**
- Universal tag validation across all input combinations
- Search functionality with randomly generated tag sets
- Autocomplete behavior with various inventory configurations
- Data persistence across different tag operations
- API functionality with comprehensive request/response validation

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: thing-tags-and-search, Property {number}: {property_text}**

**Testing Libraries:**
- **Backend**: Jest with fast-check for property-based testing
- **Frontend**: Jest + React Testing Library with fast-check
- **API**: Supertest for endpoint testing
- **Integration**: Cypress for end-to-end tag workflows

### Test Data Generation

**Tag Generators:**
- Valid tags: alphanumeric + hyphens + underscores, 1-50 characters
- Invalid tags: special characters, empty strings, too long
- Tag arrays: various combinations and sizes
- Search queries: different tag combinations and modes

**Thing Generators:**
- Things with various tag combinations
- Large inventories for performance testing
- Edge cases (no tags, maximum tags, duplicate scenarios)

The testing approach ensures both specific functionality works correctly and universal properties hold across all possible inputs and scenarios.