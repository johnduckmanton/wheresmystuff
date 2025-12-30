# Implementation Plan: Container Contents Summary

## Overview

This implementation plan breaks down the addition of a contents summary field to containers into discrete coding tasks. The approach follows the existing system patterns and ensures the field is properly integrated into all relevant components.

## Tasks

- [x] 1. Update TypeScript interfaces and types
  - Add contentsSummary field to Container interface in frontend/src/types/entities.ts
  - Make field optional with string type
  - _Requirements: 1.1, 4.3_

- [ ] 2. Update backend container schema and validation
  - [x] 2.1 Add contentsSummary to container schema in backend/utils/schemas.js
    - Set as optional string field with 200 character limit
    - Enable sanitization and trimming
    - _Requirements: 4.4, 4.5_

  - [x] 2.2 Update container service to handle contentsSummary
    - Modify createContainer and updateContainer methods
    - Ensure field is included in all container responses
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 3. Update container form components
  - [x] 3.1 Add contents summary field to ContainerDetailDialog
    - Add TextField component for contents summary input
    - Implement character counter showing "X/200 characters"
    - Add appropriate placeholder text and validation
    - _Requirements: 1.2, 1.3, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Display contents summary in container details view
    - Add contents summary display in Details tab
    - Show "No contents summary" when field is empty
    - Position appropriately in the layout
    - _Requirements: 2.1, 2.2, 2.4_

- [ ] 4. Update label generation service
  - [x] 4.1 Modify label SVG generation to include contents summary
    - Update createLabelSVG method in backend/services/labelService.js
    - Add contents summary text element to label layout
    - Implement text truncation for space constraints
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Update batch label generation
    - Ensure contents summary is included in batch operations
    - Test with generateLabelSheet method
    - _Requirements: 3.4_

- [ ] 5. Add form validation and user experience enhancements
  - [x] 5.1 Implement character limit validation
    - Prevent form submission when over 200 characters
    - Show warning styling when approaching limit
    - Display clear error messages
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 5.2 Add input sanitization on frontend
    - Trim whitespace before submission
    - Validate character count in real-time
    - _Requirements: 5.5_

- [ ] 6. Update API handlers and validation
  - [x] 6.1 Update container CRUD endpoints
    - Modify POST and PUT handlers in backend/handlers/containers.js
    - Ensure contentsSummary is properly validated and stored
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 6.2 Test API endpoints with contents summary
    - Verify field is accepted in create/update requests
    - Verify field is returned in get/list responses
    - Test validation error handling
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Testing and validation
  - [x] 7.1 Write unit tests for contents summary functionality
    - Test form validation and character counting
    - Test API validation and sanitization
    - Test label generation with contents summary
    - _Requirements: All_

  - [x] 7.2 Write property-based tests
    - Test contents summary length validation across random inputs
    - Test sanitization with various malicious inputs
    - Test label generation consistency
    - _Requirements: All_

- [ ] 8. Integration testing and deployment
  - [x] 8.1 Test complete user flow
    - Create container with contents summary
    - Edit contents summary
    - Generate QR label and verify contents appear
    - Test batch label generation
    - _Requirements: All_

  - [x] 8.2 Deploy and verify in staging environment
    - Test with real data
    - Verify existing containers work without contents summary
    - Test label printing functionality
    - _Requirements: All_

## Notes

- Tasks focus on code implementation and testing only
- Each task builds incrementally on previous work
- Property-based tests should run minimum 100 iterations
- Existing containers without contents summary should continue to work normally
- The field is optional to maintain backward compatibility