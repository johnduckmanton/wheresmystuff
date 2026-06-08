# Implementation Plan: Quick Pack & Photo Search

## Overview

This plan implements two complementary features: (1) Quick Pack Mode for rapid photo-capture packing, and (2) Photo Search for visual similarity search across inventory items. Tasks are organized in build order — infrastructure first, then backend services, backend handlers, frontend components, and finally integration wiring. Property-based tests are placed close to the code they validate.

## Tasks

- [x] 1. Infrastructure — DynamoDB Embeddings Table and SAM template updates
  - [x] 1.1 Add EmbeddingsTable resource to `template.yaml`
    - Add `AWS::DynamoDB::Table` resource with `inventoryId` (PK) and `thingId` (SK)
    - Set `BillingMode: PAY_PER_REQUEST`, SSE enabled, PITR conditional on production
    - Add environment tags for `Environment` and `Purpose: ImageEmbeddings`
    - _Requirements: 9.2_

  - [x] 1.2 Add PhotoSearchFunction Lambda to `template.yaml`
    - Define `AWS::Serverless::Function` with `CodeUri: backend/`, `Handler: handlers/photoSearch.handler`
    - Set `MemorySize: 512`, `Timeout: 30`
    - Add environment variables: `EMBEDDINGS_TABLE_NAME`, `OPENAI_API_KEY`, `AI_MOCK_MODE`
    - Add policies: `DynamoDBCrudPolicy` for EmbeddingsTable and InventoryTable, `S3CrudPolicy` for PhotoBucket
    - Define HttpApi events for `POST /photo-search`, `POST /photo-search/backfill`, `GET /photo-search/status`
    - _Requirements: 7.3, 7.5, 9.4_

  - [x] 1.3 Update existing Lambda functions in `template.yaml`
    - Add `EMBEDDINGS_TABLE_NAME` environment variable to `ThingsFunction` and `PackingFunction`
    - Add `DynamoDBCrudPolicy` for EmbeddingsTable to `ThingsFunction` and `PackingFunction`
    - _Requirements: 6.1, 9.1_

- [x] 2. Backend — Embedding Service
  - [x] 2.1 Create `backend/services/embeddingService.js`
    - Implement `storeEmbedding(inventoryId, thingId, embedding, photoKey, modelVersion)` — PutCommand to EmbeddingsTable
    - Implement `getEmbedding(inventoryId, thingId)` — GetCommand by composite key
    - Implement `getInventoryEmbeddings(inventoryId)` — QueryCommand on partition key for all embeddings in an inventory
    - Implement `deleteEmbedding(inventoryId, thingId)` — DeleteCommand by composite key
    - Implement `getThingsWithoutEmbeddings(inventoryId)` — Query Things with photos, cross-reference EmbeddingsTable
    - Implement `normalizeVector(vector)` — Divide each element by Euclidean magnitude
    - Implement `cosineSimilarity(a, b)` — Dot product of two unit vectors
    - Use `EMBEDDINGS_TABLE_NAME` environment variable for table name
    - Follow CommonJS module pattern with JSDoc comments
    - _Requirements: 6.2, 9.1, 9.2, 12.1, 12.3, 12.4_

  - [ ]* 2.2 Write property tests for embedding serialization round-trip
    - **Property 14: Embedding serialization round-trip**
    - Test in `backend/tests/embeddingService.test.js`
    - Generate arbitrary arrays of finite floats, serialize to JSON, deserialize, verify each element differs by less than 1e-10
    - **Validates: Requirements 12.1, 12.2**

  - [ ]* 2.3 Write property tests for cosine similarity mathematical properties
    - **Property 15: Cosine similarity mathematical properties**
    - Test in `backend/tests/embeddingService.test.js`
    - For any two unit vectors of equal dimension, verify result is between -1 and 1; for a vector compared with itself, verify result ≈ 1.0
    - **Validates: Requirements 12.3**

  - [ ]* 2.4 Write property tests for vector normalization
    - **Property 16: Vector normalization to unit length**
    - Test in `backend/tests/embeddingService.test.js`
    - For any non-zero vector, verify normalized magnitude ≈ 1.0 within 1e-10 tolerance
    - **Validates: Requirements 12.4**

- [x] 3. Backend — AI Analysis Service Extensions
  - [x] 3.1 Add `generateEmbedding(photoKey)` method to `backend/services/aiAnalysisService.js`
    - Generate presigned download URL for the photo
    - Call OpenAI embeddings API (or vision model) to produce an image embedding vector
    - Return `{embedding: number[], model: string}`
    - Log API call with operation type `embedding_generation` for cost tracking
    - _Requirements: 6.1, 6.5, 10.2_

  - [x] 3.2 Add `mockGenerateEmbedding(photoKey)` method to `backend/services/aiAnalysisService.js`
    - Generate a deterministic pseudo-random vector based on photoKey hash
    - Return same shape as `generateEmbedding`: `{embedding: number[], model: string}`
    - Used when `AI_MOCK_MODE=true` or `OPENAI_API_KEY` is not set
    - _Requirements: 10.5_

- [x] 4. Backend — Photo Search Service
  - [x] 4.1 Create `backend/services/photoSearchService.js`
    - Implement `searchByPhoto(photoKey, inventoryId, userId)`:
      - Generate embedding for query photo (using AI service, respecting mock mode)
      - Normalize query embedding to unit length
      - Retrieve all embeddings for the inventory from EmbeddingsTable
      - Compute cosine similarity between query and each stored embedding
      - Filter results with score > 0.5, sort descending, limit to 20
      - Batch-fetch Thing details from main DynamoDB table for matched thingIds
      - Return `{results: [{thing, score, photoKey}], queryPhotoKey}`
    - Implement `triggerBackfill(inventoryId, userId)`:
      - Get Things with photos but no embeddings
      - Queue embedding generation for each (with rate limiting to avoid API overload)
      - Return `{queued, skipped, errors}`
    - Follow CommonJS module pattern
    - _Requirements: 7.3, 7.5, 8.4, 9.3, 9.4_

  - [ ]* 4.2 Write property tests for search result filtering and limiting
    - **Property 11: Search result filtering and limiting**
    - Test in `backend/tests/embeddingService.test.js`
    - Generate arbitrary sets of embeddings and a query embedding, verify at most 20 results returned and all scores > 0.5
    - **Validates: Requirements 8.4**

  - [ ]* 4.3 Write property tests for search results sorted by descending score
    - **Property 9: Search results sorted by descending score**
    - Test in `backend/tests/embeddingService.test.js`
    - For any array of search results, verify scores are in strictly non-increasing order
    - **Validates: Requirements 7.4**

- [x] 5. Checkpoint — Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend — Photo Search Handler
  - [x] 6.1 Create `backend/handlers/photoSearch.js`
    - Implement Lambda handler following existing pattern: `withCorsValidation(withRateLimit(handler))`
    - Route `POST /photo-search` → `handleSearchByPhoto`: validate photoKey and inventoryId, authorize inventory access, delegate to `photoSearchService.searchByPhoto()`
    - Route `POST /photo-search/backfill` → `handleTriggerBackfill`: validate inventoryId, authorize, delegate to `photoSearchService.triggerBackfill()`
    - Route `GET /photo-search/status` → `handleGetBackfillStatus`: validate inventoryId, return backfill status
    - Use `authenticate(event)`, `authorizeInventoryAccess()`, `validateUUID()`, `sanitizeInput()`
    - Return responses via `success()` / `error()` / `secureError()`
    - _Requirements: 7.3, 8.4, 8.5, 8.6, 9.4_

  - [ ]* 6.2 Write unit tests for photo search handler
    - Test in `backend/tests/photoSearch.test.js`
    - Test handler routing, input validation (missing photoKey, invalid inventoryId), auth checks
    - Test error responses for invalid photo quality, no results
    - _Requirements: 7.3, 8.5, 8.6_

- [x] 7. Backend — Modify existing handlers for embedding lifecycle
  - [x] 7.1 Modify `backend/handlers/things.js` — delete embedding on Thing deletion
    - In `handleDelete`, after successful Thing deletion, call `embeddingService.deleteEmbedding(inventoryId, id)`
    - Wrap in try/catch — log failure but do not block Thing deletion
    - _Requirements: 9.1_

  - [x] 7.2 Modify `backend/handlers/packing.js` — fire-and-forget embedding generation after create-and-pack
    - In `handleCreateAndPack`, after successful response, trigger async embedding generation
    - Check if Thing has photos; if so, call `aiAnalysisService.generateEmbedding(photoKey)` then `embeddingService.storeEmbedding(...)`
    - Use fire-and-forget pattern (don't await, log errors)
    - Respect mock mode (`AI_MOCK_MODE`)
    - _Requirements: 6.1, 6.4_

- [x] 8. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend — LiveViewfinder component
  - [x] 9.1 Create `frontend/src/components/packing/LiveViewfinder.tsx`
    - Implement persistent camera component using `requestIOSCameraPermission()` from `iosCamera.ts`
    - Render `<video>` element with `autoPlay`, `playsInline`, `muted` attributes
    - Implement capture: draw current video frame to offscreen `<canvas>`, export as JPEG blob at 80% quality, resize to max 1024px
    - Position capture button at bottom-center for one-handed thumb access
    - Add haptic feedback via `navigator.vibrate(50)` on capture
    - Show brief white flash overlay on capture without interrupting preview
    - Implement gallery fallback via file input when camera is unavailable
    - Call `stopIOSCameraStream()` on unmount for proper cleanup
    - Props: `onCapture: (imageBlob: Blob) => void`, `onClose: () => void`, `disabled?: boolean`
    - _Requirements: 2.1, 2.2, 2.6, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 9.2 Write property test for image optimization constraints
    - **Property 13: Image optimization constraints**
    - Test in `frontend/src/components/packing/__tests__/LiveViewfinder.test.tsx`
    - For any captured image of arbitrary dimensions, verify optimized output has largest dimension ≤ 1024px and is JPEG format
    - **Validates: Requirements 11.2**

- [x] 10. Frontend — useSnapQueue hook
  - [x] 10.1 Create `frontend/src/hooks/useSnapQueue.ts`
    - Implement `SnapQueueItem` interface with states: `queued | uploading | analyzing | confirming | creating | complete | failed`
    - Implement `addPhoto(blob)` — adds item to queue, returns item ID
    - Implement sequential FIFO processing: only one item in `uploading` or `analyzing` at a time
    - Implement rate limiting: minimum 3-second interval between processing consecutive items
    - Implement `confirmItem(id)` — accept AI suggestion, trigger create-and-pack
    - Implement `editItem(id, data)` — edit and confirm with modified data
    - Implement `retryItem(id)` — retry failed item from last successful state
    - Implement `discardItem(id)` — remove item from queue
    - Implement `deleteCompletedItem(id)` — delete Thing from inventory and container
    - Implement exponential backoff on 503: delays of 1s, 2s, 4s with max 3 retries
    - Implement network loss handling: pause processing, retain items, resume on reconnect
    - Compute `sessionStats`: `{captured, completed, failed}` from queue state
    - Use existing `apiClient` for upload, AI analysis, and create-and-pack calls
    - Use `photoQueue` service for upload sequencing
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.4, 3.6, 4.3, 5.1, 5.2, 5.4, 5.5, 10.1_

  - [ ]* 10.2 Write property tests for useSnapQueue
    - **Property 1: Capture grows the queue**
    - Test in `frontend/src/components/packing/__tests__/useSnapQueue.test.ts`
    - For any capture action, verify queue length increases by exactly one
    - **Validates: Requirements 2.2**

  - [ ]* 10.3 Write property test for sequential FIFO processing
    - **Property 3: Sequential FIFO processing**
    - Test in `frontend/src/components/packing/__tests__/useSnapQueue.test.ts`
    - Verify items process in insertion order with at most one in active processing state
    - **Validates: Requirements 2.5**

  - [ ]* 10.4 Write property test for session summary accuracy
    - **Property 6: Session summary accuracy**
    - Test in `frontend/src/components/packing/__tests__/useSnapQueue.test.ts`
    - For any queue state, verify `captured` = total items, `completed` = count of `complete`, `failed` = count of `failed`
    - **Validates: Requirements 4.4**

  - [ ]* 10.5 Write property test for queue resilience on failure
    - **Property 7: Queue resilience on failure**
    - Test in `frontend/src/components/packing/__tests__/useSnapQueue.test.ts`
    - Verify failed items don't block subsequent processing and retain imageBlob, photoKey, analysisResult
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 10.6 Write property test for exponential backoff on 503
    - **Property 8: Exponential backoff on 503**
    - Test in `frontend/src/components/packing/__tests__/useSnapQueue.test.ts`
    - Verify retry delays follow exponential backoff and stop after 3 attempts
    - **Validates: Requirements 5.5**

  - [ ]* 10.7 Write property test for processing rate limit
    - **Property 12: Processing rate limit**
    - Test in `frontend/src/components/packing/__tests__/useSnapQueue.test.ts`
    - Verify minimum 3-second interval between start of processing consecutive items
    - **Validates: Requirements 10.1**

- [x] 11. Frontend — ConfirmationCard component
  - [x] 11.1 Create `frontend/src/components/packing/ConfirmationCard.tsx`
    - Display AI-suggested name and category with Accept and Edit buttons
    - Highlight low-confidence fields (overall ≤ 0.6) with amber warning chip and warning icon
    - Edit mode: expand to show inline TextField for name, description, and Select for category
    - Render as slide-up Paper with `position: absolute` at bottom of viewfinder area
    - Use MUI `Slide` transition for smooth appearance
    - Props: `item: SnapQueueItem`, `categories: Category[]`, `onAccept`, `onEdit`, `onDiscard`, `lowConfidenceThreshold?: number`
    - _Requirements: 3.2, 3.3, 3.5, 3.7_

  - [ ]* 11.2 Write property tests for ConfirmationCard
    - **Property 4: ConfirmationCard displays analysis fields**
    - Test in `frontend/src/components/packing/__tests__/ConfirmationCard.test.tsx`
    - For any valid analysis result, verify card displays name, category, Accept button, Edit button
    - **Validates: Requirements 3.2**

  - [ ]* 11.3 Write property test for low-confidence highlighting
    - **Property 5: Low-confidence field highlighting**
    - Test in `frontend/src/components/packing/__tests__/ConfirmationCard.test.tsx`
    - Verify warning indicator appears if and only if confidence ≤ 0.6
    - **Validates: Requirements 3.3**

- [x] 12. Checkpoint — Core frontend components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend — QuickPackMode orchestrator
  - [x] 13.1 Create `frontend/src/components/packing/QuickPackMode.tsx`
    - Compose `LiveViewfinder` + `useSnapQueue` + `ConfirmationCard` + thumbnail strip
    - Layout: full-height flex — header bar (container name, session counter, exit button), center (LiveViewfinder with ConfirmationCard overlay), bottom (horizontal scrollable thumbnail strip)
    - Thumbnail strip shows queue items with status indicators (uploading spinner, analyzing animation, confirming highlight, complete checkmark, failed error icon)
    - Tapping completed thumbnail opens compact detail panel for viewing/editing Thing
    - Tapping failed thumbnail offers retry, manual entry, or discard options
    - On exit: close viewfinder, compute session summary, call `onExit` with stats
    - Props: `container: Container`, `inventoryId: string`, `categories: Category[]`, `onExit`, `onContainerUpdated?`
    - _Requirements: 1.4, 1.5, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 5.3_

  - [ ]* 13.2 Write property test for thumbnail status rendering
    - **Property 2: Thumbnail status reflects queue item state**
    - Test in `frontend/src/components/packing/__tests__/SnapQueueThumbnail.test.tsx`
    - For any SnapQueueItem status, verify the corresponding status indicator is rendered
    - **Validates: Requirements 2.4**

- [x] 14. Frontend — PhotoSearchResults and PhotoSearchButton
  - [x] 14.1 Create `frontend/src/components/PhotoSearchResults.tsx`
    - Display query photo at top as reference
    - Each result card: side-by-side query photo | matched Thing photo, similarity percentage badge, Thing name, location, container assignment
    - Tap result → action options: "View Thing" and "View Container"
    - Empty state: "No matching items found. Try text-based search instead."
    - Error state: alert with retry button
    - Loading state: skeleton cards
    - Props: `queryPhotoKey`, `results`, `onSelectResult`, `onNavigateToContainer`, `onClose`, `isLoading?`, `error?`
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ]* 14.2 Write property test for search result display
    - **Property 10: Search result displays required fields**
    - Test in `frontend/src/components/__tests__/PhotoSearchResults.test.tsx`
    - For any search result, verify similarity percentage, Thing name, location, and container assignment are rendered
    - **Validates: Requirements 8.2**

  - [x] 14.3 Create `frontend/src/components/PhotoSearchButton.tsx`
    - Reusable trigger component with `variant: 'icon' | 'button'`
    - Opens dialog with camera capture / gallery picker
    - Uploads query photo, calls `POST /photo-search`, displays `PhotoSearchResults`
    - Props: `inventoryId: string`, `variant?`, `onResultSelect?`
    - _Requirements: 7.1, 7.2_

- [x] 15. Frontend — Integration and wiring
  - [x] 15.1 Add photo search API methods to `frontend/src/services/api.ts`
    - Add `searchByPhoto(photoKey: string, inventoryId: string)` method
    - Add `triggerPhotoSearchBackfill(inventoryId: string)` method
    - Add `getPhotoSearchBackfillStatus(inventoryId: string)` method
    - _Requirements: 7.3, 9.4_

  - [x] 15.2 Add "Quick Pack" option to `CreationMethodSelector` in `frontend/src/components/packing/CreationMethodSelector.tsx`
    - Add a "Quick Pack" button alongside existing AI Photo Upload, Barcode Scan, Manual Entry options
    - _Requirements: 1.1_

  - [x] 15.3 Wire QuickPackMode into `PackingInterface.tsx`
    - Add `quickPack` as a creation method option
    - When selected, verify container is selected (prompt if not per Requirement 1.3)
    - Render `QuickPackMode` component with active container and categories
    - On exit, return to creation method selector, preserve selected container, show session summary
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 15.4 Add `PhotoSearchButton` to Things view and PackingInterface
    - Add `PhotoSearchButton` to the Things list view search area
    - Add `PhotoSearchButton` to the PackingInterface toolbar
    - Wire `onResultSelect` to navigate to Thing detail or Container detail
    - _Requirements: 7.1_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend uses Node.js 20.x with CommonJS (`require`/`module.exports`)
- Frontend uses React 19 with TypeScript, MUI v7, Vitest for testing
- All embedding operations are fire-and-forget — Thing creation never fails due to embedding errors
- Mock mode (`AI_MOCK_MODE=true`) is used in development to avoid OpenAI API costs
