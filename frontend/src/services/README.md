# Services Directory

This directory contains service modules for API communication and business logic:

## Implemented Services

- **api.ts** - Base API client with Axios configuration
  - Configured with base URL from environment variables
  - Automatic JWT token injection via AWS Amplify
  - Error handling with interceptors
  - CRUD methods for all entity types (Things, Locations, Rooms, Categories, People)
  - Photo upload/download URL generation

## Planned Services

- **authService.ts** - Authentication service using AWS Amplify (if needed for additional auth logic)

## Usage

```typescript
import apiClient from './services/api';

// Example: Fetch all things
const things = await apiClient.getThings();

// Example: Create a new location
const location = await apiClient.createLocation({
  name: 'Home',
  addressLine1: '123 Main St',
  town: 'Springfield',
  country: 'US'
});

// Example: Update a thing
await apiClient.updateThing(thingId, {
  name: 'Updated Name',
  description: 'New description'
});

// Example: Delete a category
await apiClient.deleteCategory(categoryId);
```
