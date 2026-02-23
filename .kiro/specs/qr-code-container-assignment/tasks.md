# Implementation Plan: QR Code Container Assignment

## Overview

This implementation plan breaks down the QR code container assignment feature into discrete coding tasks. The feature integrates QR code generation, scanning, label printing, and scan history tracking into the existing container management system. Tasks are organized to build incrementally, with early validation through testing and checkpoints to ensure quality.

## Tasks

- [x] 1. Set up QR code data models and utilities
  - [x] 1.1 Add QR code fields to Container model
    - Add `qrCode`, `qrCodeUrl`, and `qrCodeGeneratedAt` fields to container schema
    - Update container validation to handle optional QR code fields
    - _Requirements: 1.2, 1.3_
  
  - [x] 1.2 Create QR code format utilities
    - Implement `generateQRCodeId(containerId)` to create unique QR code identifiers with format `CONT_{containerId}_{timestamp}_{uniqueId}`
    - Implement `decodeQRCodeId(qrCodeId)` to extract container ID from QR code
    - Implement `validateQRCodeFormat(qrCodeId)` to validate QR code structure
    - _Requirements: 1.1, 1.4, 9.1, 9.3_
  
  - [ ]* 1.3 Write property tests for QR code format utilities
    - **Property 1: QR Code Generation Uniqueness** - Verify two containers generate unique QR codes
    - **Property 4: QR Code Round-Trip Encoding** - Verify encoding and decoding returns same container ID
    - **Property 28: QR Code Format Validation** - Verify format validation before decode
    - **Validates: Requirements 1.1, 1.4, 9.1**

- [x] 2. Implement QR Code Service core functionality
  - [x] 2.1 Create QRCodeService class with image generation
    - Implement `generateQRCodeImage(qrCodeId, options)` using QR code library
    - Support size options: small (200x200), medium (400x400), large (600x600)
    - Return image buffer in PNG format
    - _Requirements: 1.1, 1.6_
  
  - [x] 2.2 Implement S3 storage for QR code images
    - Implement `storeQRCodeImage(containerId, imageBuffer, size)` to upload to S3
    - Use bucket structure: `qr-codes/{containerId}/{size}_{timestamp}.png`
    - Return S3 key for stored image
    - Handle S3 upload errors with retry logic
    - _Requirements: 1.3_
  
  - [x] 2.3 Implement complete QR code generation workflow
    - Implement `generateContainerQRCode(containerId, size)` that combines ID generation, image creation, and S3 storage
    - Return QRCodeData object with qrCodeId, s3Key, size, containerId, generatedAt, imageUrl, downloadUrl
    - Generate presigned download URL for QR code image
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 2.4 Write property tests for QR Code Service
    - **Property 3: QR Code Image Storage in S3** - Verify S3 storage and key return
    - **Property 19: Label Size Support** - Verify correct dimensions for each size
    - **Validates: Requirements 1.3, 5.6**

- [x] 3. Integrate QR code generation with container creation
  - [x] 3.1 Enhance Container Service to generate QR codes on creation
    - Modify `createContainer` method to call QR Code Service after container creation
    - Update container record with QR code metadata (qrCode, qrCodeUrl, qrCodeGeneratedAt)
    - Implement non-blocking error handling: log errors but don't fail container creation
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [ ]* 3.2 Write property tests for container creation with QR codes
    - **Property 2: QR Code Storage in Container Record** - Verify container record contains QR code ID
    - **Property 5: Container Creation Resilience** - Verify container created even if QR generation fails
    - **Validates: Requirements 1.2, 1.5**
  
  - [ ]* 3.3 Write unit tests for container creation integration
    - Test successful container creation with QR code
    - Test container creation when QR generation fails
    - Test QR code metadata stored correctly
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 4. Checkpoint - Verify container creation with QR codes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement QR code scanning and validation
  - [x] 5.1 Implement QR code validation in QRCodeService
    - Implement `validateQRCode(qrCodeId)` to check format and required fields
    - Validate QR code is not expired (timestamp within reasonable range)
    - Return validation errors with descriptive messages
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 5.2 Implement QR code scanning workflow
    - Implement `scanQRCode(qrCodeData)` that validates, decodes, and returns scan result
    - Return ScanResult with success status, decoded data, or error message
    - Log security events for invalid QR codes
    - _Requirements: 2.1, 2.4, 9.4, 9.5_
  
  - [ ]* 5.3 Write property tests for QR code validation
    - **Property 8: Invalid QR Code Error Handling** - Verify descriptive errors for invalid codes
    - **Property 30: Security Event Logging** - Verify security events logged for invalid scans
    - **Validates: Requirements 2.4, 9.2, 9.4, 9.5**

- [x] 6. Implement cross-inventory container search
  - [x] 6.1 Add cross-inventory search to Container Service
    - Implement `findContainerAcrossInventories(containerId, userId)` to search all accessible inventories
    - Query DynamoDB for container across user's inventories
    - Verify user has access to found container's inventory
    - Return container with inventory ID or access denied error
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 6.2 Write property tests for cross-inventory search
    - **Property 25: Cross-Inventory Container Search** - Verify search across all accessible inventories
    - **Property 26: Inventory ID in Cross-Inventory Response** - Verify inventoryId included in response
    - **Property 27: Access Control Enforcement** - Verify access denied for unauthorized inventories
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 7. Implement container contents retrieval
  - [x] 7.1 Add container contents method to Container Service
    - Implement `getContainerContents(containerId, inventoryId, userId)` to retrieve container with items
    - Query items table for all items in container
    - Include item details: name, quantity, category
    - Calculate and include item count
    - Include location information (name, hierarchy, room if applicable)
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_
  
  - [ ]* 7.2 Write property tests for container contents
    - **Property 7: Complete Container Response** - Verify response includes container details and items
    - **Property 13: Item Count Accuracy** - Verify itemCount equals items array length
    - **Property 14: Complete Item Details** - Verify items include name, quantity, category
    - **Property 15: Contents Summary Inclusion** - Verify contentsSummary included
    - **Validates: Requirements 2.3, 4.1, 4.2, 4.3, 4.5**
  
  - [ ]* 7.3 Write unit tests for location and room information
    - Test location information included when assigned
    - Test unassigned location indication
    - Test room information included when applicable
    - Test empty container returns empty items array
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.4_

- [x] 8. Implement Scan History Service
  - [x] 8.1 Create ScanHistoryService class with DynamoDB operations
    - Implement `recordScan(userId, inventoryId, scanData)` to create scan history entry
    - Use DynamoDB structure: pk=`USER#{userId}#SCAN_HISTORY`, sk=`{timestamp}#{scanId}`
    - Set TTL to 90 days from scan time
    - Include all scan metadata: type, success, containerId, containerName, qrCodeId, method, error, itemCount
    - _Requirements: 2.6, 2.7, 6.1, 6.2, 6.7_
  
  - [x] 8.2 Implement scan history retrieval with filtering
    - Implement `getScanHistory(userId, options)` with pagination support
    - Support filtering by inventoryId
    - Support filtering by successOnly flag
    - Return results in reverse chronological order
    - Include pagination token for next page
    - _Requirements: 6.3, 6.4, 6.5, 6.6_
  
  - [x] 8.3 Implement recent scans retrieval
    - Implement `getRecentSuccessfulScans(userId, inventoryId, limit)` for quick access
    - Return only successful scans
    - Default limit to 10 scans
    - _Requirements: 6.1, 6.3_
  
  - [ ]* 8.4 Write property tests for scan history
    - **Property 9: Scan History Recording for Success** - Verify successful scans recorded with correct data
    - **Property 10: Scan History Recording for Failure** - Verify failed scans recorded with error
    - **Property 20: Scan History Chronological Order** - Verify reverse chronological ordering
    - **Property 21: Scan History Pagination** - Verify pagination respects limit
    - **Property 22: Scan History Inventory Filtering** - Verify inventory filter works
    - **Property 23: Scan History Success Filtering** - Verify successOnly filter works
    - **Property 24: Scan Method Recording** - Verify method field recorded
    - **Validates: Requirements 2.6, 2.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [x] 9. Checkpoint - Verify scanning and history tracking
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Label Service
  - [x] 10.1 Create LabelService class with dimension configuration
    - Implement `getLabelDimensions(size)` returning width/height for small (2x3 inches), medium (3x4 inches), large (4x6 inches)
    - Define label layout constants (margins, font sizes, QR code positioning)
    - _Requirements: 5.6_
  
  - [x] 10.2 Implement label SVG generation
    - Implement `createLabelSVG(containerData, qrCodeSvg, dimensions)` to create label markup
    - Include QR code image in label
    - Include container name with appropriate font size
    - Include container type
    - Use high contrast for better scanning
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [x] 10.3 Implement label image generation and storage
    - Implement `generateLabel(containerData, size)` to create label image buffer
    - Convert SVG to PNG image
    - Implement `storeLabelImage(containerId, labelBuffer, size)` to upload to S3
    - Use bucket structure: `labels/{containerId}/{size}_{timestamp}.png`
    - Generate presigned download URL
    - Return LabelData with s3Key, downloadUrl, size, generatedAt
    - _Requirements: 5.1, 5.5, 5.7_
  
  - [ ]* 10.4 Write property tests for Label Service
    - **Property 16: Label Generation Success** - Verify label generated for valid container
    - **Property 17: Label Content Completeness** - Verify label includes QR code, name, type
    - **Property 18: Label Download URL** - Verify S3 storage and presigned URL
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7**

- [x] 11. Implement batch operations
  - [x] 11.1 Implement batch QR code generation
    - Implement `generateBatchQRCodes(containerIds, size)` in QRCodeService
    - Process containers in parallel with Promise.all
    - Return BatchResult with successful and failed generations
    - Handle individual failures without blocking batch
    - _Requirements: 1.1, 1.3_
  
  - [x] 11.2 Implement batch label generation
    - Implement `generateBatchLabels(containersData, size)` in LabelService
    - Process labels in parallel
    - Return BatchResult with download URLs for each label
    - Optionally implement `generateLabelSheet(containersData, size, options)` for multi-label sheets
    - _Requirements: 5.1, 5.5, 5.7_
  
  - [x]* 11.3 Write unit tests for batch operations
    - Test batch QR code generation with multiple containers
    - Test batch label generation with multiple containers
    - Test partial failure handling in batch operations
    - _Requirements: 1.1, 5.1_

- [x] 12. Implement manual container lookup
  - [x] 12.1 Add manual lookup methods to Container Service
    - Implement container lookup by ID with inventory ID required
    - Implement container lookup by name with inventory ID required
    - Handle multiple name matches by returning list of containers
    - Handle exact name match by returning full container details
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_
  
  - [ ]* 12.2 Write property tests for manual lookup
    - **Property 31: Direct Container Lookup** - Verify lookup by ID retrieves correct container
    - **Property 32: Container Name Search** - Verify name search returns matching containers
    - **Property 33: Multiple Match Handling** - Verify multiple matches returned as list
    - **Property 34: Exact Match Priority** - Verify exact match returns full details
    - **Property 35: Manual Lookup History Recording** - Verify manual lookups recorded with correct method
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 13. Implement API endpoints in QR Code Handler
  - [x] 13.1 Create POST /containers/{containerId}/qr-code endpoint
    - Extract containerId from path, inventoryId and size from query params
    - Validate user has access to container's inventory
    - Call QRCodeService.generateContainerQRCode
    - Return QR code data with download URL
    - Handle errors with appropriate status codes
    - _Requirements: 1.1, 1.3_
  
  - [x] 13.2 Create POST /qr-codes/batch endpoint
    - Extract containerIds and size from request body
    - Validate user has access to all containers
    - Call QRCodeService.generateBatchQRCodes
    - Return batch result with successful and failed generations
    - _Requirements: 1.1, 1.3_
  
  - [x] 13.3 Create POST /qr-codes/scan endpoint
    - Extract qrCodeData and optional inventoryId from request body
    - Call QRCodeService.scanQRCode to validate and decode
    - Call ContainerService.findContainerAcrossInventories or direct lookup
    - Call ContainerService.getContainerContents to retrieve items
    - Call ScanHistoryService.recordScan to log scan event
    - Return container details, items, and inventory ID
    - Handle errors and record failed scans
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 8.1, 8.2_
  
  - [x] 13.4 Create POST /qr-codes/decode endpoint
    - Extract qrCodeId from request body
    - Call QRCodeService.validateQRCode and decodeQRCodeId
    - Return decoded container information
    - _Requirements: 2.1, 9.1_
  
  - [x] 13.5 Create POST /containers/lookup endpoint
    - Extract containerId, containerName, and inventoryId from request body
    - Validate inventoryId is provided
    - Call Container Service manual lookup methods
    - Call ScanHistoryService.recordScan with method "manual_lookup"
    - Return container details or list of matches
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [x] 13.6 Create GET /qr-codes/history endpoint
    - Extract inventoryId, limit, successOnly from query params
    - Call ScanHistoryService.getScanHistory
    - Return paginated scan history
    - _Requirements: 6.3, 6.4, 6.5, 6.6_
  
  - [x] 13.7 Create GET /qr-codes/recent endpoint
    - Extract inventoryId and limit from query params
    - Call ScanHistoryService.getRecentSuccessfulScans
    - Return recent scans for quick access
    - _Requirements: 6.1, 6.3_
  
  - [x] 13.8 Create POST /containers/{containerId}/label endpoint
    - Extract containerId from path, inventoryId and size from query params
    - Validate user has access to container
    - Retrieve container data
    - Call LabelService.generateLabel
    - Return label data with download URL
    - _Requirements: 5.1, 5.5, 5.7_
  
  - [x] 13.9 Create POST /labels/batch endpoint
    - Extract containerIds, inventoryId, size, sheetFormat from request body
    - Validate user has access to all containers
    - Retrieve containers data
    - Call LabelService.generateBatchLabels or generateLabelSheet
    - Return batch result with download URLs
    - _Requirements: 5.1, 5.5, 5.7_
  
  - [ ]* 13.10 Write integration tests for API endpoints
    - Test authentication and authorization for all endpoints
    - Test error responses and status codes
    - Test presigned URL generation
    - Test pagination and filtering
    - _Requirements: All API-related requirements_

- [x] 14. Checkpoint - Verify all API endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Add QR code display to container details
  - [x] 15.1 Update container details page to show QR code
    - Fetch QR code URL from container record
    - Display QR code image on container details page
    - Add button to download QR code
    - Add button to generate label
    - Handle case where QR code doesn't exist (offer to generate)
    - _Requirements: 1.7_
  
  - [ ]* 15.2 Write unit tests for container details QR code display
    - Test QR code displayed when available
    - Test generate button shown when QR code missing
    - Test download and label generation buttons
    - _Requirements: 1.7_

- [x] 16. Implement error handling and logging
  - [x] 16.1 Add comprehensive error handling to all services
    - Implement retry logic for S3 operations with exponential backoff
    - Add error logging with full context (container ID, user ID, error message, stack trace)
    - Ensure non-blocking error handling for QR generation during container creation
    - Add security event logging for invalid QR codes and access denied attempts
    - _Requirements: 1.5, 9.4, 9.5_
  
  - [ ]* 16.2 Write unit tests for error handling
    - Test S3 upload failure retry logic
    - Test container creation continues when QR generation fails
    - Test security event logging for invalid scans
    - Test error messages are descriptive
    - _Requirements: 1.5, 2.4, 9.4, 9.5_

- [x] 17. Final checkpoint - Complete integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and integration points
- Checkpoints ensure incremental validation at key milestones
- The implementation uses TypeScript/JavaScript as specified in the design document
- All QR code images and labels are stored in S3 bucket specified by QR_REPORT_BUCKET_NAME environment variable
- Scan history entries automatically expire after 90 days using DynamoDB TTL
