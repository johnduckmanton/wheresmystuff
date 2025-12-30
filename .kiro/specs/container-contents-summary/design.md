# Design Document

## Overview

This design document outlines the implementation approach for adding a contents summary field to containers in the inventory management system. The enhancement will allow users to provide a brief description of container contents, which will be displayed in the UI and included in QR label prints.

## Architecture

The implementation follows the existing system architecture with updates to:
- Frontend TypeScript interfaces and React components
- Backend Node.js API handlers and validation schemas
- Label generation service for QR code printing
- Database schema (DynamoDB) to store the new field

## Components and Interfaces

### Frontend Components

#### Container Interface Update
```typescript
interface Container {
  // ... existing fields
  contentsSummary?: string; // New optional field, max 200 characters
}
```

#### ContainerDetailDialog Enhancement
- Add contents summary display in the Details tab
- Position between description and photos sections
- Show "No contents summary" when field is empty
- Use Typography component with appropriate styling

#### Container Form Components
- Add TextField for contents summary input
- Implement character counter (showing "X/200 characters")
- Add placeholder text: "Brief description of container contents (e.g., 'Kitchen utensils and small appliances')"
- Apply validation styling when approaching/exceeding limit

### Backend Components

#### Container Schema Update
```javascript
const containerSchema = {
  // ... existing fields
  contentsSummary: {
    type: 'string',
    required: false,
    maxLength: 200,
    sanitize: true,
    trim: true
  }
};
```

#### Container Service Updates
- Update createContainer() to handle contentsSummary
- Update updateContainer() to handle contentsSummary
- Ensure contentsSummary is included in all container responses
- Add validation for maximum length and sanitization

#### Label Service Enhancement
- Modify generateLabel() to include contents summary
- Update createLabelSVG() to add contents summary text element
- Implement text truncation for label space constraints
- Adjust label layout to accommodate new text while maintaining QR code visibility

## Data Models

### Container Data Model
```typescript
interface Container {
  id: string;
  inventoryId: string;
  projectId?: string;
  name: string;
  type: ContainerType;
  size?: string;
  color?: string;
  description?: string;
  contentsSummary?: string; // NEW FIELD - max 200 chars
  photos?: string[];
  qrCode: string;
  qrCodeUrl?: string;
  locationId?: string;
  handlingFlags: HandlingFlag[];
  itemCount: number;
  estimatedValue: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  status: ContainerStatus;
  storageStartDate?: string;
  storageRate?: number;
  metadata: Record<string, any>;
}
```

### Label Layout Design
```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │       QR CODE           │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│        Container Name           │
│        Type: Box                │
│        Contents: Kitchen items  │ ← NEW LINE
│        Created: 12/29/2024      │
│        ID: CONTAINER_ABC123     │
└─────────────────────────────────┘
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Contents Summary Length Validation
*For any* container creation or update request with contentsSummary, the field length should not exceed 200 characters and the request should be rejected if it does
**Validates: Requirements 4.4**

### Property 2: Contents Summary Sanitization
*For any* container with contentsSummary containing potentially harmful content, the stored value should be sanitized and safe for display
**Validates: Requirements 4.5**

### Property 3: Label Contents Summary Inclusion
*For any* container with a non-empty contentsSummary, generating a QR label should include the contents summary text on the label
**Validates: Requirements 3.1**

### Property 4: Form Character Counter Accuracy
*For any* text input in the contents summary field, the character counter should accurately reflect the current input length
**Validates: Requirements 5.1**

### Property 5: Contents Summary Persistence
*For any* container with contentsSummary set, retrieving the container should return the same contentsSummary value
**Validates: Requirements 4.3**

## Error Handling

### Frontend Error Handling
- Character limit exceeded: Show inline error message and prevent form submission
- Network errors during save: Show retry option with error details
- Invalid characters: Show sanitization warning if applicable

### Backend Error Handling
- Validation errors: Return 400 with specific field error details
- Database errors: Log error and return generic 500 response
- Missing container: Return 404 for update operations

### Label Generation Error Handling
- Long contents summary: Truncate gracefully with ellipsis
- Special characters: Ensure proper SVG escaping
- Missing contents summary: Skip the field in label generation

## Testing Strategy

### Unit Tests
- Test container schema validation with various contentsSummary values
- Test character counter component with different input lengths
- Test label generation with and without contents summary
- Test form submission with valid and invalid contents summary

### Property-Based Tests
- Generate random containers with contentsSummary and verify length constraints
- Generate random text inputs and verify sanitization works correctly
- Generate containers and verify contents summary appears in generated labels
- Test form character counter with random text inputs

### Integration Tests
- Test complete flow: create container with contents summary → generate label → verify contents appear
- Test container update flow with contents summary changes
- Test API endpoints with contents summary in request/response

Each property test should run a minimum of 100 iterations and be tagged with:
**Feature: container-contents-summary, Property {number}: {property_text}**