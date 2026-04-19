# Bugfix Requirements Document

## Introduction

Two related production-readiness bugs exist in the codebase. First, the frontend API client (`frontend/src/services/api.ts`) contains extensive debug `console.log` statements that run unconditionally in all environments, including production. These log sensitive authentication tokens (previews, full session objects), request/response payloads containing user data, and full HTTP headers to the browser console on every API call. This creates a security risk (token leakage via DevTools) and clutters the production console.

Second, multiple backend services use silent fallback defaults for required environment variables (`TABLE_NAME`, `BUCKET_NAME`, `QR_REPORT_BUCKET_NAME`, `OPENAI_API_KEY`). If a required environment variable is missing in production, the service silently operates against the wrong resource (e.g., wrong DynamoDB table or S3 bucket) instead of failing fast with a clear error.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN any API request is made in production THEN the system logs sensitive authentication token previews, full session objects, and token metadata to the browser console via unconditional `console.log` statements in the request interceptor

1.2 WHEN the `post()` method is called in production THEN the system logs the full request URL, request payload data, response status, response headers, and response data to the browser console

1.3 WHEN `generateUploadUrl()` or `generateDocumentUploadUrl()` is called in production THEN the system logs all parameter values (fileName, contentType, inventoryId, entityId, documentType) and the full request data object to the browser console

1.4 WHEN `generateQRCode()` or `uploadPhoto()` is called in production THEN the system logs container IDs, inventory IDs, file metadata, and API base URL to the browser console

1.5 WHEN the `TABLE_NAME` environment variable is missing in backend services (`dynamodb.js`, `milestoneService.js`, `collaborationService.js`, `storageService.js`, `notificationService.js`, `taskService.js`) THEN the system silently falls back to the hardcoded default `'home-inventory'` and queries the wrong DynamoDB table without any error or warning

1.6 WHEN the `BUCKET_NAME` environment variable is missing in `imageProcessor.js` THEN the system uses an undefined bucket name without failing fast, leading to silent S3 operation failures

1.7 WHEN the `QR_REPORT_BUCKET_NAME` environment variable is missing in `qrCode.js` THEN the system uses an undefined bucket name for QR code S3 operations without failing fast

1.8 WHEN the `OPENAI_API_KEY` environment variable is missing in `aiAnalysisService.js` THEN the system silently stores `undefined` as the API key rather than explicitly validating its presence at startup

### Expected Behavior (Correct)

2.1 WHEN any API request is made in a production build THEN the system SHALL NOT log authentication tokens, session objects, or token metadata to the browser console

2.2 WHEN the `post()` method is called in a production build THEN the system SHALL NOT log request payloads, response data, or HTTP headers to the browser console

2.3 WHEN `generateUploadUrl()`, `generateDocumentUploadUrl()`, or any other API method is called in a production build THEN the system SHALL NOT log parameter values or request data objects to the browser console

2.4 WHEN `generateQRCode()` or `uploadPhoto()` is called in a production build THEN the system SHALL NOT log IDs, file metadata, or API configuration to the browser console

2.5 WHEN the `TABLE_NAME` environment variable is missing at service initialization THEN the system SHALL throw a clear error immediately indicating the missing variable, rather than falling back to a default value

2.6 WHEN the `BUCKET_NAME` environment variable is missing at handler initialization THEN the system SHALL throw a clear error immediately indicating the missing variable

2.7 WHEN the `QR_REPORT_BUCKET_NAME` environment variable is missing at handler initialization THEN the system SHALL throw a clear error immediately indicating the missing variable

2.8 WHEN the `OPENAI_API_KEY` environment variable is missing at service initialization THEN the system SHALL log a warning or throw an error indicating the missing variable, rather than silently storing `undefined`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN any API request is made in development mode THEN the system SHALL CONTINUE TO provide useful debug logging for developer troubleshooting

3.2 WHEN the `post()` method encounters an error THEN the system SHALL CONTINUE TO log error details via `console.error` for debugging purposes in all environments

3.3 WHEN the response interceptor receives a 401 status THEN the system SHALL CONTINUE TO log the authentication failure, sign out the user, and trigger the auth error callback

3.4 WHEN all required environment variables are properly set THEN the backend services SHALL CONTINUE TO initialize and operate normally without any behavioral change

3.5 WHEN `isDevelopmentMode` is true in the frontend THEN the system SHALL CONTINUE TO call `logDevelopmentInfo()` and provide mock data functionality as before

3.6 WHEN the `AI_MOCK_MODE` environment variable is set to `'true'` THEN the AI analysis handler SHALL CONTINUE TO use mock analysis regardless of `OPENAI_API_KEY` presence
