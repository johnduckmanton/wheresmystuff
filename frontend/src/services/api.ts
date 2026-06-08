import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import type {
  Thing,
  Location,
  Room,
  Category,
  Person,
  Inventory,
  InventoryMembership,
  UserProfile,
  UserLookupResult,
  Invitation,
  Container,
  ContainerListResponse,
  MovingProject,
  ThingWithContainer,
  ApiResponse,
  TagAnalytics,
  TagSuggestions,
} from '../types';
import { isDevelopmentMode, logDevelopmentInfo } from '../config/development';
import MockApiClient from './mockApi';

// Callback for handling authentication errors
let authErrorCallback: (() => void) | null = null;

/**
 * Base API client configuration with Axios
 * Handles authentication, error responses, and CRUD operations for all entities
 * Validates: Requirements 1.5, 16.2
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to inject JWT token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (isDevelopmentMode) {
          console.log('🔍 Request Interceptor Debug:');
          console.log('- URL:', config.url);
          console.log('- Method:', config.method);
          console.log('- Base URL:', config.baseURL);
        }
        
        try {
          const session = await fetchAuthSession();
          if (isDevelopmentMode) {
            console.log('- Auth Session:', session);
            console.log('- Session tokens object:', session.tokens);
          }
          
          // Try both access token and ID token for API authentication
          // Access tokens are typically used for API calls, ID tokens for user info
          const accessToken = session.tokens?.accessToken;
          const idToken = session.tokens?.idToken;
          
          if (isDevelopmentMode) {
            console.log('- Access Token object:', accessToken);
            console.log('- ID Token object:', idToken);
          }
          
          let token: string | undefined;
          
          // Prefer access token for API calls
          if (accessToken) {
            if (typeof accessToken === 'string') {
              token = accessToken;
            } else if (accessToken && typeof accessToken.toString === 'function') {
              token = accessToken.toString();
            }
            if (isDevelopmentMode) {
              console.log('✅ Using access token for API authentication');
            }
          } else if (idToken) {
            // Fallback to ID token if access token not available
            if (typeof idToken === 'string') {
              token = idToken;
            } else if (idToken && typeof idToken.toString === 'function') {
              token = idToken.toString();
            }
            if (isDevelopmentMode) {
              console.log('⚠️ Using ID token for API authentication (fallback)');
            }
          }
          
          if (isDevelopmentMode) {
            console.log('- Token available:', !!token);
            console.log('- Token length:', token?.length || 0);
            console.log('- Token preview:', token?.substring(0, 50) + '...' || 'No token');
          }
          
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
            if (isDevelopmentMode) {
              console.log('✅ Authorization header set');
            }
          } else {
            console.warn('⚠️ No token available or no headers object');
            console.warn('- accessToken:', accessToken);
            console.warn('- idToken:', idToken);
          }
        } catch (error) {
          console.error('❌ Error fetching auth session:', error);
        }
        
        if (isDevelopmentMode) {
          console.log('- Final headers:', config.headers);
        }
        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse<unknown>>) => {
        if (error.response) {
          // Server responded with error status
          const errorMessage = error.response.data?.error || error.response.data?.message || 'An error occurred';
          console.error('API Error:', errorMessage, error.response.status);
          
          // Handle 401 Unauthorized - session expired
          if (error.response.status === 401) {
            console.error('Authentication failed - session expired');
            
            // Clear auth state
            try {
              await signOut();
            } catch (signOutError) {
              console.error('Error signing out:', signOutError);
            }
            
            // Trigger callback to show notification and redirect
            if (authErrorCallback) {
              authErrorCallback();
            }
          }
          
          return Promise.reject(new Error(errorMessage));
        } else if (error.request) {
          // Request made but no response received
          console.error('Network Error: No response received', error.request);
          return Promise.reject(new Error('Network error - please check your connection'));
        } else {
          // Error setting up the request
          console.error('Request Error:', error.message);
          return Promise.reject(error);
        }
      }
    );
  }

  /**
   * Set callback for authentication errors
   * Used to show notification and redirect to sign-in
   */
  setAuthErrorCallback(callback: () => void) {
    authErrorCallback = callback;
  }

  // Generic CRUD methods
  private async get<T>(url: string): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch data');
  }

  private async post<T>(url: string, data: unknown): Promise<T> {
    if (isDevelopmentMode) {
      console.log('🔍 API Client POST Debug:');
      console.log('- URL:', url);
      console.log('- Data:', data);
      console.log('- Full URL:', `${this.client.defaults.baseURL}${url}`);
    }
    
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data);
      if (isDevelopmentMode) {
        console.log('✅ HTTP POST successful:');
        console.log('- Status:', response.status);
        console.log('- Headers:', response.headers);
        console.log('- Data:', response.data);
      }
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      console.error('❌ API response indicates failure:', response.data);
      throw new Error(response.data.error || 'Failed to create resource');
    } catch (error: any) {
      console.error('❌ HTTP POST failed:', error);
      
      if (error?.response) {
        console.error('- Response Status:', error.response.status);
        console.error('- Response Headers:', error.response.headers);
        console.error('- Response Data:', error.response.data);
      } else if (error?.request) {
        console.error('- No response received:', error.request);
      } else {
        console.error('- Request setup error:', error?.message || String(error));
      }
      
      throw error;
    }
  }

  private async put<T>(url: string, data: unknown): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update resource');
  }

  private async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'Failed to delete resource');
  }

  // Things API
  async getThings(inventoryId?: string, options?: {
    tags?: string[];
    tagMode?: 'and' | 'or';
    search?: string;
    categoryId?: string;
    locationId?: string;
    partialMatch?: boolean;
  }): Promise<Thing[]> {
    let url = inventoryId ? `/things?inventoryId=${inventoryId}` : '/things';
    
    if (options) {
      const params = new URLSearchParams();
      if (inventoryId) params.append('inventoryId', inventoryId);
      
      if (options.tags && options.tags.length > 0) {
        params.append('tags', options.tags.join(','));
      }
      if (options.tagMode) params.append('tagMode', options.tagMode);
      if (options.search) params.append('search', options.search);
      if (options.categoryId) params.append('categoryId', options.categoryId);
      if (options.locationId) params.append('locationId', options.locationId);
      if (options.partialMatch) params.append('partialMatch', 'true');
      
      url = `/things?${params.toString()}`;
    }
    
    return this.get<Thing[]>(url);
  }

  async getThing(id: string): Promise<Thing> {
    return this.get<Thing>(`/things/${id}`);
  }

  async createThing(data: Omit<Thing, 'dateAdded'>): Promise<Thing> {
    // Ensure tags are properly formatted
    const thingData = {
      ...data,
      tags: data.tags || []
    };
    return this.post<Thing>('/things', thingData);
  }

  async updateThing(id: string, data: Partial<Omit<Thing, 'id' | 'dateAdded'>>): Promise<Thing> {
    // Ensure tags are properly formatted if provided
    const updateData = {
      ...data
    };
    if (data.tags !== undefined) {
      updateData.tags = data.tags || [];
    }
    return this.put<Thing>(`/things/${id}`, updateData);
  }

  async deleteThing(id: string, inventoryId?: string): Promise<void> {
    const url = inventoryId ? `/things/${id}?inventoryId=${inventoryId}` : `/things/${id}`;
    return this.delete<void>(url);
  }

  // Tag-related API methods
  async getTags(inventoryId: string, options?: {
    q?: string;
    exclude?: string[];
    limit?: number;
  }): Promise<TagSuggestions> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.q) params.append('q', options.q);
    if (options?.exclude && options.exclude.length > 0) {
      params.append('exclude', options.exclude.join(','));
    }
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.get<TagSuggestions>(`/things/tags?${params.toString()}`);
  }

  async getTagAnalytics(inventoryId: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'count' | 'tag' | 'percentage';
    sortOrder?: 'asc' | 'desc';
    filter?: string;
  }): Promise<TagAnalytics & {
    pagination?: {
      limit: number;
      offset: number;
      totalResults: number;
      currentPage: number;
      totalPages: number;
      hasMore: boolean;
      hasPrevious: boolean;
      sortBy: string;
      sortOrder: string;
      filter: string | null;
    };
  }> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options?.filter) params.append('filter', options.filter);

    return this.get<TagAnalytics & {
      pagination?: {
        limit: number;
        offset: number;
        totalResults: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        hasPrevious: boolean;
        sortBy: string;
        sortOrder: string;
        filter: string | null;
      };
    }>(`/things/tags/analytics?${params.toString()}`);
  }

  async getTagsPaginated(inventoryId: string, options?: {
    limit?: number;
    offset?: number;
    filter?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    inventoryId: string;
    tags: string[];
    pagination: {
      limit: number;
      offset: number;
      totalResults: number;
      currentPage: number;
      totalPages: number;
      hasMore: boolean;
      hasPrevious: boolean;
      sortOrder: string;
      filter: string | null;
    };
  }> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.filter) params.append('filter', options.filter);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);

    return this.get<{
      inventoryId: string;
      tags: string[];
      pagination: {
        limit: number;
        offset: number;
        totalResults: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        hasPrevious: boolean;
        sortOrder: string;
        filter: string | null;
      };
    }>(`/things/tags/paginated?${params.toString()}`);
  }

  async searchThingsByTags(inventoryId: string, options: {
    tags: string[];
    tagMode?: 'and' | 'or';
    partialMatch?: boolean;
  }): Promise<Thing[]> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    params.append('tags', options.tags.join(','));
    
    if (options.tagMode) params.append('tagMode', options.tagMode);
    if (options.partialMatch) params.append('partialMatch', 'true');

    return this.get<Thing[]>(`/things?${params.toString()}`);
  }

  // Comprehensive search method combining text and tag search
  async searchThings(inventoryId: string, searchQuery: {
    text?: string;
    tags?: string[];
    tagMode?: 'and' | 'or';
    categoryId?: string;
    locationId?: string;
    partialMatch?: boolean;
  }): Promise<Thing[]> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (searchQuery.text) params.append('search', searchQuery.text);
    if (searchQuery.tags && searchQuery.tags.length > 0) {
      params.append('tags', searchQuery.tags.join(','));
    }
    if (searchQuery.tagMode) params.append('tagMode', searchQuery.tagMode);
    if (searchQuery.categoryId) params.append('categoryId', searchQuery.categoryId);
    if (searchQuery.locationId) params.append('locationId', searchQuery.locationId);
    if (searchQuery.partialMatch) params.append('partialMatch', 'true');

    return this.get<Thing[]>(`/things?${params.toString()}`);
  }

  // Bulk tag operations
  async bulkTagOperation(inventoryId: string, operation: {
    operation: 'add' | 'remove' | 'replace';
    thingIds: string[];
    tags: string[];
  }): Promise<{
    operation: string;
    totalRequested: number;
    successful: number;
    failed: number;
    errors: string[];
    updatedThings: Array<{
      id: string;
      name: string;
      previousTags: string[];
      newTags: string[];
    }>;
  }> {
    return this.post('/things/tags/bulk', {
      inventoryId,
      ...operation
    });
  }

  // Locations API
  async getLocations(inventoryId?: string): Promise<Location[]> {
    const url = inventoryId ? `/locations?inventoryId=${inventoryId}` : '/locations';
    return this.get<Location[]>(url);
  }

  async getLocation(id: string, inventoryId?: string): Promise<Location> {
    const url = inventoryId ? `/locations/${id}?inventoryId=${inventoryId}` : `/locations/${id}`;
    return this.get<Location>(url);
  }

  async createLocation(data: Omit<Location, 'id' | 'dateAdded'>): Promise<Location> {
    return this.post<Location>('/locations', data);
  }

  async updateLocation(id: string, data: Partial<Omit<Location, 'id' | 'dateAdded'>>): Promise<Location> {
    return this.put<Location>(`/locations/${id}`, data);
  }

  async deleteLocation(id: string, inventoryId?: string): Promise<void> {
    const url = inventoryId ? `/locations/${id}?inventoryId=${inventoryId}` : `/locations/${id}`;
    return this.delete<void>(url);
  }

  // Rooms API
  async getRooms(locationId?: string, inventoryId?: string): Promise<Room[]> {
    let url = '/rooms';
    const params = [];
    if (locationId) params.push(`locationId=${locationId}`);
    if (inventoryId) params.push(`inventoryId=${inventoryId}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.get<Room[]>(url);
  }

  async getRoom(id: string, inventoryId?: string): Promise<Room> {
    const params = inventoryId ? `?inventoryId=${inventoryId}` : '';
    return this.get<Room>(`/rooms/${id}${params}`);
  }

  async createRoom(data: Omit<Room, 'id' | 'dateAdded'>): Promise<Room> {
    return this.post<Room>('/rooms', data);
  }

  async updateRoom(id: string, data: Partial<Omit<Room, 'id' | 'dateAdded'>>): Promise<Room> {
    return this.put<Room>(`/rooms/${id}`, data);
  }

  async deleteRoom(id: string, inventoryId?: string): Promise<void> {
    const url = inventoryId ? `/rooms/${id}?inventoryId=${inventoryId}` : `/rooms/${id}`;
    return this.delete<void>(url);
  }

  // Categories API
  async getCategories(inventoryId?: string): Promise<Category[]> {
    const url = inventoryId ? `/categories?inventoryId=${inventoryId}` : '/categories';
    return this.get<Category[]>(url);
  }

  async getCategory(id: string): Promise<Category> {
    return this.get<Category>(`/categories/${id}`);
  }

  async createCategory(data: Omit<Category, 'id' | 'dateAdded'>): Promise<Category> {
    return this.post<Category>('/categories', data);
  }

  async updateCategory(id: string, data: Partial<Omit<Category, 'id' | 'dateAdded'>>): Promise<Category> {
    return this.put<Category>(`/categories/${id}`, data);
  }

  async deleteCategory(id: string, inventoryId?: string): Promise<void> {
    const url = inventoryId ? `/categories/${id}?inventoryId=${inventoryId}` : `/categories/${id}`;
    return this.delete<void>(url);
  }

  async importCategoriesFromCSV(csvData: string, inventoryId: string): Promise<{
    message: string;
    imported: number;
    updated: number;
    failed: number;
    errors: string[];
    totalProcessed: number;
  }> {
    return this.post<{
      message: string;
      imported: number;
      updated: number;
      failed: number;
      errors: string[];
      totalProcessed: number;
    }>('/categories', { csvData, inventoryId });
  }

  // People API
  async getPeople(inventoryId?: string): Promise<Person[]> {
    const url = inventoryId ? `/people?inventoryId=${inventoryId}` : '/people';
    return this.get<Person[]>(url);
  }

  async getPerson(id: string): Promise<Person> {
    return this.get<Person>(`/people/${id}`);
  }

  async createPerson(data: Omit<Person, 'id' | 'dateAdded'>): Promise<Person> {
    return this.post<Person>('/people', data);
  }

  async updatePerson(id: string, data: Partial<Omit<Person, 'id' | 'dateAdded'>>): Promise<Person> {
    return this.put<Person>(`/people/${id}`, data);
  }

  async deletePerson(id: string, inventoryId?: string): Promise<void> {
    const url = inventoryId ? `/people/${id}?inventoryId=${inventoryId}` : `/people/${id}`;
    return this.delete<void>(url);
  }

  // Inventory API
  async getInventories(): Promise<Inventory[]> {
    return this.get<Inventory[]>('/inventories');
  }

  async getInventory(id: string): Promise<Inventory> {
    return this.get<Inventory>(`/inventories/${id}`);
  }

  async createInventory(data: Omit<Inventory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<Inventory> {
    return this.post<Inventory>('/inventories', data);
  }

  async updateInventory(id: string, data: Partial<Omit<Inventory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>): Promise<Inventory> {
    return this.put<Inventory>(`/inventories/${id}`, data);
  }

  async deleteInventory(id: string): Promise<void> {
    return this.delete<void>(`/inventories/${id}`);
  }

  // Inventory Membership API
  async getInventoryMembers(inventoryId: string): Promise<InventoryMembership[]> {
    return this.get<InventoryMembership[]>(`/inventories/${inventoryId}/members`);
  }

  async addInventoryMember(inventoryId: string, userId: string): Promise<InventoryMembership> {
    return this.post<InventoryMembership>(`/inventories/${inventoryId}/members`, { userId });
  }

  async removeInventoryMember(inventoryId: string, userId: string): Promise<void> {
    return this.delete<void>(`/inventories/${inventoryId}/members/${userId}`);
  }

  // User Management API
  async lookupUserByEmail(email: string): Promise<UserLookupResult> {
    return this.get<UserLookupResult>(`/users/lookup?email=${encodeURIComponent(email)}`);
  }

  async getUserProfile(userId?: string): Promise<UserProfile> {
    const url = userId ? `/users/${userId}/profile` : '/users/profile';
    return this.get<UserProfile>(url);
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.put<UserProfile>(`/users/${userId}/profile`, updates);
  }

  async uploadAvatar(file: File): Promise<string> {
    // Use the existing profile update endpoint with avatar upload flag
    const { uploadUrl, key } = await this.put<{ uploadUrl: string; key: string }>('/users/profile', {
      generateAvatarUploadUrl: true,
      fileName: file.name,
      contentType: file.type,
    });

    // Upload file directly to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Avatar upload failed: ${uploadResponse.statusText}`);
    }

    return key;
  }

  // Invitation Management API
  async getInvitations(inventoryId: string): Promise<Invitation[]> {
    return this.get<Invitation[]>(`/inventories/${inventoryId}/invitations`);
  }

  async createInvitation(inventoryId: string, data: {
    email: string;
    role: string;
    inventoryName?: string;
    inviterName?: string;
  }): Promise<Invitation> {
    return this.post<Invitation>(`/inventories/${inventoryId}/invitations`, data);
  }

  async cancelInvitation(inventoryId: string, invitationId: string): Promise<void> {
    return this.delete<void>(`/inventories/${inventoryId}/invitations/${invitationId}`);
  }

  async acceptInvitation(token: string): Promise<{
    message: string;
    inventoryId: string;
    role: string;
    membership: InventoryMembership;
  }> {
    return this.post<{
      message: string;
      inventoryId: string;
      role: string;
      membership: InventoryMembership;
    }>('/invitations/accept', { token });
  }

  // Member Role Management API
  async updateMemberRole(inventoryId: string, userId: string, role: string, reason?: string): Promise<InventoryMembership> {
    return this.put<InventoryMembership>(`/inventories/${inventoryId}/members/${userId}/role`, { role, reason });
  }

  // Photo API
  async generateUploadUrl(fileName: string, contentType: string, inventoryId: string, entityId: string): Promise<{ uploadUrl: string; key: string }> {
    // Debug logging
    if (isDevelopmentMode) {
      console.log('🔍 API Client generateUploadUrl Debug:');
      console.log('- fileName:', fileName);
      console.log('- contentType:', contentType);
      console.log('- inventoryId:', inventoryId);
      console.log('- entityId:', entityId);
      console.log('- inventoryId type:', typeof inventoryId);
      console.log('- inventoryId truthy:', !!inventoryId);
      console.log('- Request data:', { fileName, contentType, inventoryId, entityId });
    }
    
    // Validate parameters before making the request
    if (!inventoryId) {
      throw new Error(`generateUploadUrl: inventoryId is required but got: ${inventoryId}`);
    }
    if (!entityId) {
      throw new Error(`generateUploadUrl: entityId is required but got: ${entityId}`);
    }
    
    const requestData = { fileName, contentType, inventoryId, entityId };
    if (isDevelopmentMode) {
      console.log('🚀 Making POST request to /upload with:', requestData);
    }
    
    return this.post<{ uploadUrl: string; key: string }>('/upload', requestData);
  }

  async generateDownloadUrl(key: string): Promise<{ downloadUrl: string }> {
    // Use query parameter to handle complex keys with forward slashes
    const encodedKey = encodeURIComponent(key);
    return this.get<{ downloadUrl: string }>(`/photo?key=${encodedKey}`);
  }

  // Document API (Receipts and Warranties)
  async generateDocumentUploadUrl(
    fileName: string, 
    contentType: string, 
    inventoryId: string, 
    entityId: string,
    documentType: 'receipt' | 'warranty'
  ): Promise<{ uploadUrl: string; key: string }> {
    if (isDevelopmentMode) {
      console.log('🔍 API Client generateDocumentUploadUrl Debug:');
      console.log('- fileName:', fileName);
      console.log('- contentType:', contentType);
      console.log('- inventoryId:', inventoryId);
      console.log('- entityId:', entityId);
      console.log('- documentType:', documentType);
    }
    
    // Validate parameters
    if (!inventoryId) {
      throw new Error(`generateDocumentUploadUrl: inventoryId is required but got: ${inventoryId}`);
    }
    if (!entityId) {
      throw new Error(`generateDocumentUploadUrl: entityId is required but got: ${entityId}`);
    }
    if (!documentType || !['receipt', 'warranty'].includes(documentType)) {
      throw new Error(`generateDocumentUploadUrl: documentType must be 'receipt' or 'warranty' but got: ${documentType}`);
    }
    
    const requestData = { fileName, contentType, inventoryId, entityId, documentType };
    if (isDevelopmentMode) {
      console.log('🚀 Making POST request to /document/upload with:', requestData);
    }
    
    return this.post<{ uploadUrl: string; key: string }>('/document/upload', requestData);
  }

  async generateDocumentDownloadUrl(key: string): Promise<{ downloadUrl: string }> {
    // Use query parameter to handle complex keys with forward slashes
    const encodedKey = encodeURIComponent(key);
    return this.get<{ downloadUrl: string }>(`/document?key=${encodedKey}`);
  }

  async deleteDocument(key: string): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    return this.delete<void>(`/document/${encodedKey}`);
  }

  // AI Analysis API
  async analyzePhoto(photoKey: string, inventoryId: string): Promise<any> {
    return this.post<any>('/ai/analyze-photo', { photoKey, inventoryId });
  }

  // Barcode Lookup API
  async lookupBarcode(barcode: string, inventoryId: string): Promise<any> {
    return this.post<any>('/barcode/lookup', { barcode, inventoryId });
  }

  // Container API
  async getContainers(inventoryId?: string): Promise<ContainerListResponse> {
    const url = inventoryId ? `/containers?inventoryId=${inventoryId}` : '/containers';
    return this.get<ContainerListResponse>(url);
  }

  async getContainer(id: string, inventoryId?: string): Promise<Container> {
    const url = inventoryId ? `/containers/${id}?inventoryId=${inventoryId}` : `/containers/${id}`;
    return this.get<Container>(url);
  }

  async createContainer(data: Omit<Container, 'id' | 'qrCode' | 'itemCount' | 'estimatedValue' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<Container> {
    return this.post<Container>('/containers', data);
  }

  async updateContainer(id: string, data: Partial<Omit<Container, 'id' | 'qrCode' | 'createdAt' | 'createdBy'>>): Promise<Container> {
    return this.put<Container>(`/containers/${id}`, data);
  }

  async updateContainerStatus(id: string, data: { inventoryId: string; status: string; updateItemLocations?: boolean; targetLocationId?: string }): Promise<Container> {
    return this.put<Container>(`/containers/${id}/status`, data);
  }

  async deleteContainer(id: string, inventoryId?: string, force?: boolean): Promise<void> {
    let url = inventoryId ? `/containers/${id}?inventoryId=${inventoryId}` : `/containers/${id}`;
    if (force) {
      url += inventoryId ? '&force=true' : '?force=true';
    }
    return this.delete<void>(url);
  }

  // Container QR Code API
  async getContainerQRCode(containerId: string, inventoryId: string): Promise<{
    containerId: string;
    hasQRCode: boolean;
    downloadUrl?: string;
    qrCodeId?: string;
    generatedAt?: string;
    message?: string;
  }> {
    return this.get<{
      containerId: string;
      hasQRCode: boolean;
      downloadUrl?: string;
      qrCodeId?: string;
      generatedAt?: string;
      message?: string;
    }>(`/containers/${containerId}/qr-code?inventoryId=${inventoryId}`);
  }

  // Container Sharing API
  async createSharingLink(containerId: string, options: {
    inventoryId: string;
    expiresAt?: string;
    includeItemDetails?: boolean;
    includePhotos?: boolean;
    includeSensitiveData?: boolean;
    maxAccesses?: number;
    description?: string;
    allowedDomains?: string[];
  }): Promise<{
    shareId: string;
    token: string;
    shareUrl: string;
    expiresAt?: string;
    privacySettings: {
      includeItemDetails: boolean;
      includePhotos: boolean;
      includeSensitiveData: boolean;
    };
    createdAt: string;
  }> {
    return this.post<{
      shareId: string;
      token: string;
      shareUrl: string;
      expiresAt?: string;
      privacySettings: {
        includeItemDetails: boolean;
        includePhotos: boolean;
        includeSensitiveData: boolean;
      };
      createdAt: string;
    }>(`/containers/${containerId}/sharing-links`, options);
  }

  async getSharingLinks(containerId: string, inventoryId: string): Promise<{
    sharingLinks: Array<{
      shareId: string;
      shareUrl: string;
      description?: string;
      createdAt: string;
      expiresAt?: string;
      accessCount: number;
      maxAccesses?: number;
      isActive: boolean;
      privacySettings: {
        includeItemDetails: boolean;
        includePhotos: boolean;
        includeSensitiveData: boolean;
      };
      lastAccessedAt?: string;
    }>;
  }> {
    return this.get<{
      sharingLinks: Array<{
        shareId: string;
        shareUrl: string;
        description?: string;
        createdAt: string;
        expiresAt?: string;
        accessCount: number;
        maxAccesses?: number;
        isActive: boolean;
        privacySettings: {
          includeItemDetails: boolean;
          includePhotos: boolean;
          includeSensitiveData: boolean;
        };
        lastAccessedAt?: string;
      }>;
    }>(`/containers/${containerId}/sharing-links?inventoryId=${inventoryId}`);
  }

  async deactivateSharingLink(shareId: string): Promise<{ message: string }> {
    return this.put<{ message: string }>(`/sharing-link/${shareId}`, { action: 'deactivate' });
  }

  async deleteSharingLink(shareId: string): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/sharing-link/${shareId}`);
  }

  // Public endpoint for accessing shared containers (no authentication required)
  async getSharedContainer(shareId: string, token: string): Promise<{
    shareId: string;
    container: {
      id: string;
      name: string;
      type: string;
      description?: string;
      status: string;
      itemCount: number;
      handlingFlags: string[];
      createdAt: string;
      locationId?: string;
      estimatedValue?: number;
      storageStartDate?: string;
      storageRate?: number;
    };
    items: Array<{
      id: string;
      name: string;
      category: string;
      description?: string;
      photos?: string[];
      value?: number;
      serialNumber?: string;
      model?: string;
      brand?: string;
      purchasePrice?: number;
      datePurchased?: string;
    }>;
    itemCount: number;
    privacySettings: {
      includeItemDetails: boolean;
      includePhotos: boolean;
      includeSensitiveData: boolean;
    };
    description?: string;
    createdAt: string;
    expiresAt?: string;
    accessCount: number;
  }> {
    // Use a separate axios instance without authentication for public endpoints
    const publicClient = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await publicClient.get<ApiResponse<{
      shareId: string;
      container: {
        id: string;
        name: string;
        type: string;
        description?: string;
        status: string;
        itemCount: number;
        handlingFlags: string[];
        createdAt: string;
        locationId?: string;
        estimatedValue?: number;
        storageStartDate?: string;
        storageRate?: number;
      };
      items: Array<{
        id: string;
        name: string;
        category: string;
        description?: string;
        photos?: string[];
        value?: number;
        serialNumber?: string;
        model?: string;
        brand?: string;
        purchasePrice?: number;
        datePurchased?: string;
      }>;
      itemCount: number;
      privacySettings: {
        includeItemDetails: boolean;
        includePhotos: boolean;
        includeSensitiveData: boolean;
      };
      description?: string;
      createdAt: string;
      expiresAt?: string;
      accessCount: number;
    }>>(`/shared/container/${shareId}?token=${token}`);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to access shared container');
  }

  // Moving Project API
  async getProjects(inventoryId?: string): Promise<MovingProject[]> {
    const url = inventoryId ? `/projects?inventoryId=${inventoryId}` : '/projects';
    return this.get<MovingProject[]>(url);
  }

  async getProject(id: string): Promise<MovingProject> {
    return this.get<MovingProject>(`/projects/${id}`);
  }

  async createProject(data: Omit<MovingProject, 'id' | 'containerCount' | 'itemCount' | 'completionPercentage' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<MovingProject> {
    return this.post<MovingProject>('/projects', data);
  }

  async updateProject(id: string, data: Partial<Omit<MovingProject, 'id' | 'createdAt' | 'createdBy'>>): Promise<MovingProject> {
    return this.put<MovingProject>(`/projects/${id}`, data);
  }

  async deleteProject(id: string): Promise<void> {
    return this.delete<void>(`/projects/${id}`);
  }

  async assignContainersToProject(projectId: string, data: { containerIds: string[]; inventoryId: string }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/containers`, data);
  }

  async removeContainersFromProject(projectId: string, data: { containerIds: string[]; inventoryId: string }): Promise<any> {
    return this.client.delete(`/projects/${projectId}/containers`, { data });
  }

  async assignItemsToProject(projectId: string, data: { itemIds: string[]; inventoryId: string }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/items`, data);
  }

  async removeItemsFromProject(projectId: string, data: { itemIds: string[]; inventoryId: string }): Promise<any> {
    return this.client.delete(`/projects/${projectId}/items`, { data });
  }

  // Project Tasks API
  async getProjectTasks(projectId: string, inventoryId?: string): Promise<any[]> {
    const params = inventoryId ? `?inventoryId=${inventoryId}` : '';
    return this.get<any[]>(`/projects/${projectId}/tasks${params}`);
  }

  async createTask(projectId: string, data: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    category?: 'planning' | 'packing' | 'logistics' | 'moving_day' | 'unpacking' | 'setup' | 'admin' | 'other';
    assignedTo?: string;
    status?: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
    inventoryId: string;
  }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/tasks`, data);
  }

  async updateTask(taskId: string, data: Partial<{
    title: string;
    description: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'planning' | 'packing' | 'logistics' | 'moving_day' | 'unpacking' | 'setup' | 'admin' | 'other';
    assignedTo: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
    projectId: string;
    inventoryId: string;
  }>): Promise<any> {
    if (!data.projectId) {
      throw new Error('projectId is required for updating task');
    }
    return this.put<any>(`/projects/${data.projectId}/tasks/${taskId}`, data);
  }

  async deleteTask(taskId: string, projectId: string, inventoryId: string): Promise<void> {
    return this.delete<void>(`/projects/${projectId}/tasks/${taskId}?inventoryId=${inventoryId}`);
  }

  async getOverdueTasks(inventoryId: string): Promise<any[]> {
    return this.get<any[]>(`/tasks/overdue?inventoryId=${inventoryId}`);
  }

  // Project Milestones API
  async getProjectMilestones(projectId: string, inventoryId?: string): Promise<any[]> {
    const params = inventoryId ? `?inventoryId=${inventoryId}` : '';
    return this.get<any[]>(`/projects/${projectId}/milestones${params}`);
  }

  async createMilestone(projectId: string, data: {
    name: string;
    description?: string;
    date: string;
    inventoryId: string;
  }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/milestones`, data);
  }

  async updateMilestone(milestoneId: string, data: Partial<{
    name: string;
    description: string;
    date: string;
    completed: boolean;
    projectId: string;
    inventoryId: string;
  }>): Promise<any> {
    if (!data.projectId) {
      throw new Error('projectId is required for updating milestone');
    }
    return this.put<any>(`/projects/${data.projectId}/milestones/${milestoneId}`, data);
  }

  async completeMilestone(milestoneId: string, projectId: string, inventoryId: string): Promise<any> {
    return this.put<any>(`/projects/${projectId}/milestones/${milestoneId}/complete`, { 
      inventoryId 
    });
  }

  async deleteMilestone(milestoneId: string, projectId: string, inventoryId: string): Promise<void> {
    return this.delete<void>(`/projects/${projectId}/milestones/${milestoneId}?inventoryId=${inventoryId}`);
  }

  async getOverdueMilestones(inventoryId: string): Promise<any[]> {
    return this.get<any[]>(`/milestones/overdue?inventoryId=${inventoryId}`);
  }

  async getUpcomingMilestones(inventoryId: string): Promise<any[]> {
    return this.get<any[]>(`/milestones/upcoming?inventoryId=${inventoryId}`);
  }

  // Project Budget API
  async getProjectBudget(projectId: string, inventoryId?: string): Promise<any[]> {
    const params = inventoryId ? `?inventoryId=${inventoryId}` : '';
    return this.get<any[]>(`/projects/${projectId}/budget${params}`);
  }

  async createBudgetItem(projectId: string, data: {
    category: string;
    description: string;
    estimatedCost: number;
    actualCost?: number;
    status?: 'pending' | 'approved' | 'paid';
    inventoryId: string;
  }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/budget`, data);
  }

  async updateBudgetItem(budgetItemId: string, data: Partial<{
    category: string;
    description: string;
    estimatedCost: number;
    actualCost: number;
    status: 'pending' | 'approved' | 'paid';
    itemId: string;
    projectId: string;
    inventoryId: string;
  }>): Promise<any> {
    if (!data.projectId) {
      throw new Error('projectId is required for updating budget item');
    }
    return this.put<any>(`/projects/${data.projectId}/budget/${budgetItemId}`, data);
  }

  async deleteBudgetItem(budgetItemId: string, projectId: string, inventoryId: string): Promise<void> {
    return this.delete<void>(`/projects/${projectId}/budget/${budgetItemId}?inventoryId=${inventoryId}`);
  }

  async getBudgetStats(projectId: string, inventoryId: string): Promise<any> {
    return this.get<any>(`/budget/stats?projectId=${projectId}&inventoryId=${inventoryId}`);
  }

  // Project Things API
  async getProjectThings(projectId: string, inventoryId?: string): Promise<any[]> {
    const params = inventoryId ? `?inventoryId=${inventoryId}` : '';
    return this.get<any[]>(`/projects/${projectId}/things${params}`);
  }

  async assignThingsToProject(projectId: string, data: {
    thingIds: string[];
    inventoryId: string;
  }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/things`, data);
  }

  async removeThingsFromProject(projectId: string, data: {
    thingIds: string[];
    inventoryId: string;
  }): Promise<any> {
    return this.post<any>(`/projects/${projectId}/things/remove`, data);
  }

  async getAvailableThingsForProject(inventoryId: string): Promise<any[]> {
    return this.get<any[]>(`/things/available?inventoryId=${inventoryId}`);
  }

  // Project Progress API
  async getProjectProgress(projectId: string, inventoryId: string): Promise<{
    project: MovingProject;
    statistics: {
      totalContainers: number;
      packedContainers: number;
      emptyContainers: number;
      totalThings: number;
      totalValue: number;
      completionPercentage: number;
      containersByStatus: Record<string, number>;
    };
    containers: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      itemCount: number;
      estimatedValue: number;
      locationId?: string;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      dueDate?: string;
      priority?: string;
    }>;
    milestones: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: string;
    }>;
  }> {
    return this.get<any>(`/projects/${projectId}/progress?inventoryId=${inventoryId}`);
  }

  // Packing API - Container Contents Management
  async getContainerContents(containerId: string, inventoryId: string): Promise<{
    container: Container;
    items: ThingWithContainer[];
    itemCount: number;
    totalValue: number;
    categories: number;
    summary: {
      itemCount: number;
      totalValue: number;
      categoriesCount: number;
      hasPhotos: boolean;
    };
  }> {
    return this.get<any>(`/packing/containers/${containerId}/contents?inventoryId=${inventoryId}`);
  }

  async addItemsToContainer(containerId: string, inventoryId: string, itemIds: string[]): Promise<{
    container: Container;
    packedItems: ThingWithContainer[];
    packedCount: number;
    totalValue: number;
    newItemCount: number;
    newEstimatedValue: number;
  }> {
    return this.post<any>(`/packing/containers/${containerId}/add-items`, {
      inventoryId,
      itemIds,
    });
  }

  async removeItemsFromContainer(containerId: string, inventoryId: string, itemIds: string[]): Promise<{
    container: Container;
    unpackedItems: ThingWithContainer[];
    unpackedCount: number;
    totalValue: number;
    newItemCount: number;
    newEstimatedValue: number;
  }> {
    return this.post<any>(`/packing/containers/${containerId}/remove-items`, {
      inventoryId,
      itemIds,
    });
  }

  async transferItemsBetweenContainers(
    sourceContainerId: string,
    targetContainerId: string,
    inventoryId: string,
    itemIds: string[]
  ): Promise<{
    sourceContainer: Container;
    targetContainer: Container;
    transferredItems: ThingWithContainer[];
    transferredCount: number;
    totalValue: number;
    sourceNewItemCount: number;
    targetNewItemCount: number;
  }> {
    return this.post<any>('/packing/transfer-items', {
      inventoryId,
      sourceContainerId,
      targetContainerId,
      itemIds,
    });
  }

  async getAvailableItems(inventoryId: string, filters?: {
    locationId?: string;
    categoryId?: string;
    search?: string;
    limit?: number;
    lastEvaluatedKey?: any;
  }): Promise<{
    items: ThingWithContainer[];
    count: number;
    lastEvaluatedKey?: any;
    hasMore: boolean;
    totalValue: number;
  }> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (filters?.locationId) params.append('locationId', filters.locationId);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.lastEvaluatedKey) {
      params.append('lastEvaluatedKey', encodeURIComponent(JSON.stringify(filters.lastEvaluatedKey)));
    }

    return this.get<any>(`/packing/available-items?${params.toString()}`);
  }

  async getPackingInterfaceData(inventoryId: string): Promise<{
    things: Thing[];
    categories: Category[];
    locations: Location[];
    rooms: Room[];
    people: Person[];
    containers: Container[];
  }> {
    return this.get<any>(`/packing/interface-data?inventoryId=${inventoryId}`);
  }

  async createAndPackThing(thingData: Partial<Thing>, containerId: string, inventoryId: string): Promise<{
    thing: Thing;
    container: Container;
    success: boolean;
  }> {
    return this.post<any>('/packing/create-and-pack', {
      thingData,
      containerId,
      inventoryId,
    });
  }

  // Photo Search API
  async searchByPhoto(photoKey: string, inventoryId: string): Promise<{
    results: Array<{ thing: Thing; score: number; photoKey: string }>;
    queryPhotoKey: string;
  }> {
    return this.post<{ results: Array<{ thing: Thing; score: number; photoKey: string }>; queryPhotoKey: string }>(
      '/photo-search',
      { photoKey, inventoryId },
    );
  }

  async triggerPhotoSearchBackfill(inventoryId: string): Promise<{
    queued: number;
    skipped: number;
    errors: number;
  }> {
    return this.post<{ queued: number; skipped: number; errors: number }>(
      '/photo-search/backfill',
      { inventoryId },
    );
  }

  async getPhotoSearchBackfillStatus(inventoryId: string): Promise<{
    inventoryId: string;
    status: string;
    totalThings: number;
    embeddingsGenerated: number;
    pendingThings: number;
  }> {
    return this.get<{
      inventoryId: string;
      status: string;
      totalThings: number;
      embeddingsGenerated: number;
      pendingThings: number;
    }>(`/photo-search/status?inventoryId=${inventoryId}`);
  }

  // QR Code API
  async generateQRCode(containerId: string, inventoryId: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<{
    qrCodeId: string;
    s3Key: string;
    size: string;
    containerId: string;
    generatedAt: string;
    downloadUrl: string;
  }> {
    if (isDevelopmentMode) {
      console.log('🔍 API Client generateQRCode Debug:');
      console.log('- Container ID:', containerId);
      console.log('- Inventory ID:', inventoryId);
      console.log('- Size:', size);
      console.log('- Base URL:', this.client.defaults.baseURL);
    }
    
    try {
      const result = await this.post<any>(`/containers/${containerId}/qr-code?size=${size}&inventoryId=${inventoryId}`, {});
      if (isDevelopmentMode) {
        console.log('✅ QR Code API call successful:', result);
      }
      return result;
    } catch (error) {
      console.error('❌ QR Code API call failed:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Note: QR code and label generation is now handled per-container
  // - QR codes: Generated via POST /containers/{id}/qr-code
  // - Labels: Generated client-side using Canvas API in PrintableLabel component
  // Batch generation methods have been removed to simplify the codebase

  // QR Code Scanning API
  async scanQRCode(qrCodeData: string, inventoryId?: string): Promise<{
    scanResult: {
      success: boolean;
      containerId: string;
      qrCodeId: string;
      generatedAt: string;
      timestamp: number;
    };
    container: Container;
    items: ThingWithContainer[];
    itemCount: number;
    inventoryId: string; // The actual inventory ID where the container was found
    scannedAt: string;
  }> {
    const payload: { qrCodeData: string; inventoryId?: string } = { qrCodeData };
    if (inventoryId) {
      payload.inventoryId = inventoryId;
    }
    return this.post<{
      scanResult: {
        success: boolean;
        containerId: string;
        qrCodeId: string;
        generatedAt: string;
        timestamp: number;
      };
      container: Container;
      items: ThingWithContainer[];
      itemCount: number;
      inventoryId: string;
      scannedAt: string;
    }>('/qr-codes/scan', payload);
  }

  async lookupContainer(inventoryId: string, containerId?: string, containerName?: string): Promise<{
    type: 'single_match' | 'multiple_matches';
    container?: Container;
    items?: ThingWithContainer[];
    itemCount?: number;
    lookedUpAt?: string;
    containers?: Array<{
      id: string;
      name: string;
      type: string;
      itemCount: number;
      locationId?: string;
    }>;
    message?: string;
  }> {
    return this.post<any>('/containers/lookup', { inventoryId, containerId, containerName });
  }

  async getScanHistory(inventoryId?: string, options?: {
    limit?: number;
    lastEvaluatedKey?: string;
    successOnly?: boolean;
  }): Promise<{
    scans: Array<{
      id: string;
      userId: string;
      inventoryId: string;
      timestamp: string;
      type: string;
      success: boolean;
      containerId?: string;
      containerName?: string;
      qrCodeId?: string;
      method?: string;
      error?: string;
      itemCount?: number;
    }>;
    lastEvaluatedKey?: string;
    count: number;
    hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    if (inventoryId) params.append('inventoryId', inventoryId);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.lastEvaluatedKey) params.append('lastEvaluatedKey', options.lastEvaluatedKey);
    if (options?.successOnly) params.append('successOnly', 'true');

    return this.get<any>(`/qr-codes/history?${params.toString()}`);
  }

  async getRecentScans(inventoryId: string, limit: number = 10): Promise<{
    recentScans: Array<{
      containerId: string;
      containerName: string;
      timestamp: string;
      method: string;
      itemCount: number;
    }>;
    count: number;
  }> {
    return this.get<any>(`/qr-codes/recent?inventoryId=${inventoryId}&limit=${limit}`);
  }

  // Reports API
  async generateLocationReport(
    locationId: string, 
    inventoryId: string, 
    options: {
      categoryFilter?: string;
      containerTypeFilter?: string;
      statusFilter?: string;
      handlingFlagsFilter?: string[];
      dateRangeStart?: string;
      dateRangeEnd?: string;
      valueRangeMin?: number;
      valueRangeMax?: number;
      includeEmptyContainers?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      groupBy?: string;
      template?: string;
      includePhotos?: boolean;
      format?: 'json' | 'csv' | 'pdf';
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    const url = `/reports/location/${locationId}?${params.toString()}`;
    
    if (options.format === 'csv') {
      // For CSV export, we need to handle the response differently
      const response = await this.client.get(url, {
        responseType: 'text',
        headers: {
          'Accept': 'text/csv'
        }
      });
      return response.data;
    }
    
    return this.get<any>(url);
  }

  async generateContainerManifest(
    containerId: string, 
    inventoryId: string, 
    options: {
      format?: 'json' | 'csv' | 'pdf';
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options.format) {
      params.append('format', options.format);
    }

    const url = `/reports/container/${containerId}/manifest?${params.toString()}`;
    
    if (options.format === 'csv') {
      const response = await this.client.get(url, {
        responseType: 'text',
        headers: {
          'Accept': 'text/csv'
        }
      });
      return response.data;
    }
    
    return this.get<any>(url);
  }

  async generateProjectReport(
    projectId: string, 
    inventoryId: string, 
    options: {
      format?: 'json' | 'csv' | 'pdf';
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options.format) {
      params.append('format', options.format);
    }

    const url = `/reports/project/${projectId}?${params.toString()}`;
    
    if (options.format === 'csv') {
      const response = await this.client.get(url, {
        responseType: 'text',
        headers: {
          'Accept': 'text/csv'
        }
      });
      return response.data;
    }
    
    return this.get<any>(url);
  }

  // Analytics API
  async getPackingMetrics(inventoryId: string, options?: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.projectId) params.append('projectId', options.projectId);

    return this.get<any>(`/analytics/packing-metrics?${params.toString()}`);
  }

  async getContainerUtilization(inventoryId: string, options?: {
    containerType?: string;
    status?: string;
    locationId?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.containerType) params.append('containerType', options.containerType);
    if (options?.status) params.append('status', options.status);
    if (options?.locationId) params.append('locationId', options.locationId);

    return this.get<any>(`/analytics/container-utilization?${params.toString()}`);
  }

  async getMovingProgress(inventoryId: string, projectId?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (projectId) params.append('projectId', projectId);

    return this.get<any>(`/analytics/moving-progress?${params.toString()}`);
  }

  async getStorageCosts(inventoryId: string, options?: {
    startDate?: string;
    endDate?: string;
    locationId?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.locationId) params.append('locationId', options.locationId);

    return this.get<any>(`/analytics/storage-costs?${params.toString()}`);
  }

  async getRecommendations(inventoryId: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);

    return this.get<any>(`/analytics/recommendations?${params.toString()}`);
  }

  // Storage Management API
  async startStorageTracking(
    containerId: string,
    inventoryId: string,
    storageLocationId: string,
    storageRate?: number
  ): Promise<{
    container: Container;
    storageRecord: any;
    storageStartDate: string;
  }> {
    return this.post<any>(`/storage/${containerId}/start`, {
      inventoryId,
      storageLocationId,
      storageRate: storageRate || 0
    });
  }

  async endStorageTracking(
    containerId: string,
    inventoryId: string
  ): Promise<{
    container: Container;
    storageRecord: any;
    duration: any;
    totalCost: number;
  }> {
    return this.post<any>(`/storage/${containerId}/end`, {
      inventoryId
    });
  }

  async getStorageInfo(
    containerId: string,
    inventoryId: string
  ): Promise<{
    container: Container;
    isInStorage: boolean;
    storageInfo?: {
      storageStartDate: string;
      storageRate: number;
      currentDuration: {
        days: number;
        weeks: number;
        months: number;
        years: number;
      };
      currentCost: number;
      projectedMonthlyCost: number;
      projectedYearlyCost: number;
      warnings: Array<{
        type: string;
        message: string;
        severity: 'low' | 'medium' | 'high';
      }>;
    };
  }> {
    return this.get<any>(`/storage/${containerId}/info?inventoryId=${inventoryId}`);
  }

  async getStorageCostProjections(
    containerId: string,
    inventoryId: string,
    months?: number
  ): Promise<{
    container: Container;
    currentCost: number;
    monthlyRate: number;
    projections: Array<{
      month: number;
      monthlyCost: number;
      cumulativeCost: number;
      totalDays: number;
    }>;
  }> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    if (months) params.append('months', months.toString());

    return this.get<any>(`/storage/${containerId}/projections?${params.toString()}`);
  }

  async updateStorageRate(
    containerId: string,
    inventoryId: string,
    storageRate: number
  ): Promise<{
    container: Container;
    newRate: number;
    storageRecord?: any;
  }> {
    return this.put<any>(`/storage/${containerId}/rate`, {
      inventoryId,
      storageRate
    });
  }

  async listStorageContainers(
    inventoryId: string,
    options?: {
      storageLocationId?: string;
      minDuration?: number;
      maxDuration?: number;
      minCost?: number;
      maxCost?: number;
      sortBy?: 'storageStartDate' | 'duration' | 'cost' | 'containerName';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
    }
  ): Promise<{
    containers: Array<{
      container: Container;
      storageRecord: any;
      duration: {
        days: number;
        weeks: number;
        months: number;
        years: number;
      };
      currentCost: number;
      warnings: Array<{
        type: string;
        message: string;
        severity: 'low' | 'medium' | 'high';
      }>;
    }>;
    summary: {
      totalContainers: number;
      totalCurrentCost: number;
      averageDuration: number;
      containersWithWarnings: number;
    };
  }> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.storageLocationId) params.append('storageLocationId', options.storageLocationId);
    if (options?.minDuration !== undefined) params.append('minDuration', options.minDuration.toString());
    if (options?.maxDuration !== undefined) params.append('maxDuration', options.maxDuration.toString());
    if (options?.minCost !== undefined) params.append('minCost', options.minCost.toString());
    if (options?.maxCost !== undefined) params.append('maxCost', options.maxCost.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.get<any>(`/storage/list?${params.toString()}`);
  }

  // Storage Alerts API
  async checkStorageAlerts(inventoryId: string): Promise<{
    summary: {
      totalContainersInStorage: number;
      containersWithAlerts: number;
      highPriorityAlerts: number;
      totalAlertCost: number;
      totalStorageCost: number;
      averageDuration: number;
    };
    alerts: Array<{
      containerId: string;
      containerName: string;
      alerts: Array<{
        type: string;
        priority: 'low' | 'medium' | 'high';
        message: string;
        action: string;
        costImpact: number;
      }>;
      currentCost: number;
      duration: any;
    }>;
    recommendations: Array<{
      type: string;
      priority: 'low' | 'medium' | 'high';
      title: string;
      description: string;
      action: string;
      estimatedSavings?: number;
      affectedContainers?: number;
      containerId?: string;
      containerName?: string;
    }>;
    checkedAt: string;
  }> {
    return this.get<any>(`/storage-alerts/check?inventoryId=${inventoryId}`);
  }

  async createStorageAlert(alertData: {
    inventoryId: string;
    title: string;
    message: string;
    priority?: 'low' | 'medium' | 'high';
    containerId?: string;
    containerName?: string;
    action?: string;
    costImpact?: number;
    expiresAt?: string;
  }): Promise<{
    id: string;
    inventoryId: string;
    userId: string;
    type: string;
    priority: string;
    title: string;
    message: string;
    containerId?: string;
    containerName?: string;
    action?: string;
    costImpact?: number;
    isRead: boolean;
    isResolved: boolean;
    createdAt: string;
    expiresAt?: string;
  }> {
    return this.post<any>('/storage-alerts/create', alertData);
  }

  async getStorageAlerts(
    inventoryId: string,
    options?: {
      priority?: 'low' | 'medium' | 'high';
      isRead?: boolean;
      isResolved?: boolean;
      limit?: number;
    }
  ): Promise<{
    alerts: Array<{
      id: string;
      type: string;
      priority: 'low' | 'medium' | 'high';
      title: string;
      message: string;
      containerId?: string;
      containerName?: string;
      action?: string;
      costImpact?: number;
      isRead: boolean;
      isResolved: boolean;
      createdAt: string;
    }>;
    count: number;
  }> {
    const params = new URLSearchParams();
    params.append('inventoryId', inventoryId);
    
    if (options?.priority) params.append('priority', options.priority);
    if (options?.isRead !== undefined) params.append('isRead', options.isRead.toString());
    if (options?.isResolved !== undefined) params.append('isResolved', options.isResolved.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.get<any>(`/storage-alerts?${params.toString()}`);
  }

  async markStorageAlertAsRead(alertId: string, inventoryId: string): Promise<any> {
    return this.put<any>(`/storage-alerts/${alertId}/read`, { inventoryId });
  }

  async resolveStorageAlert(alertId: string, inventoryId: string, resolution: string): Promise<any> {
    return this.put<any>(`/storage-alerts/${alertId}/resolve`, { inventoryId, resolution });
  }

  // Photo management methods
  async uploadPhoto(file: File, inventoryId: string, entityId: string): Promise<string> {
    try {
      // Debug logging
      if (isDevelopmentMode) {
        console.log('🔍 API Client uploadPhoto Debug:');
        console.log('- file:', file);
        console.log('- inventoryId:', inventoryId);
        console.log('- entityId:', entityId);
        console.log('- inventoryId type:', typeof inventoryId);
        console.log('- entityId type:', typeof entityId);
        console.log('- inventoryId truthy:', !!inventoryId);
        console.log('- entityId truthy:', !!entityId);
      }
      
      // Validate parameters
      if (!inventoryId) {
        throw new Error(`uploadPhoto: inventoryId is required but got: ${inventoryId}`);
      }
      if (!entityId) {
        throw new Error(`uploadPhoto: entityId is required but got: ${entityId}`);
      }
      
      // Step 1: Generate upload URL
      const { uploadUrl, key } = await this.generateUploadUrl(
        file.name,
        file.type,
        inventoryId,
        entityId
      );

      // Step 2: Upload file directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Return the S3 key for the uploaded file
      return key;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  }

  async deletePhoto(photoKey: string, _inventoryId: string): Promise<void> {
    // Use DELETE method on /photo endpoint with key as path parameter
    const encodedKey = encodeURIComponent(photoKey);
    await this.delete(`/photo/${encodedKey}`);
  }

  async getPhotoUrl(photoKey: string): Promise<string> {
    try {
      // Get presigned download URL from backend
      const { downloadUrl } = await this.generateDownloadUrl(photoKey);
      return downloadUrl;
    } catch (error) {
      console.error('Error getting photo URL:', error);
      // Fallback to a placeholder or throw error
      throw error;
    }
  }


}

// Export singleton instance - use mock in development mode
let apiClient: ApiClient | MockApiClient;

if (isDevelopmentMode) {
  logDevelopmentInfo();
  apiClient = new MockApiClient();
} else {
  apiClient = new ApiClient();
}

export default apiClient;
