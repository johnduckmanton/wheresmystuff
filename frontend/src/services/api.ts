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
  ApiResponse,
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
        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();
          
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error fetching auth session:', error);
        }
        
        return config;
      },
      (error) => {
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
    const response = await this.client.post<ApiResponse<T>>(url, data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create resource');
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
  async getThings(inventoryId?: string): Promise<Thing[]> {
    const url = inventoryId ? `/things?inventoryId=${inventoryId}` : '/things';
    return this.get<Thing[]>(url);
  }

  async getThing(id: string): Promise<Thing> {
    return this.get<Thing>(`/things/${id}`);
  }

  async createThing(data: Omit<Thing, 'dateAdded'>): Promise<Thing> {
    return this.post<Thing>('/things', data);
  }

  async updateThing(id: string, data: Partial<Omit<Thing, 'id' | 'dateAdded'>>): Promise<Thing> {
    return this.put<Thing>(`/things/${id}`, data);
  }

  async deleteThing(id: string, inventoryId?: string): Promise<void> {
    const url = inventoryId ? `/things/${id}?inventoryId=${inventoryId}` : `/things/${id}`;
    return this.delete<void>(url);
  }

  // Locations API
  async getLocations(inventoryId?: string): Promise<Location[]> {
    const url = inventoryId ? `/locations?inventoryId=${inventoryId}` : '/locations';
    return this.get<Location[]>(url);
  }

  async getLocation(id: string): Promise<Location> {
    return this.get<Location>(`/locations/${id}`);
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

  async getRoom(id: string): Promise<Room> {
    return this.get<Room>(`/rooms/${id}`);
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
    const url = userId ? `/users/profile/${userId}` : '/users/profile';
    return this.get<UserProfile>(url);
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.put<UserProfile>(`/users/profile/${userId}`, updates);
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
    return this.post<{ uploadUrl: string; key: string }>('/upload', { fileName, contentType, inventoryId, entityId });
  }

  async generateDownloadUrl(key: string): Promise<{ downloadUrl: string }> {
    // Use query parameter to handle complex keys with forward slashes
    const encodedKey = encodeURIComponent(key);
    return this.get<{ downloadUrl: string }>(`/photo?key=${encodedKey}`);
  }

  // AI Analysis API
  async analyzePhoto(photoKey: string, inventoryId: string): Promise<any> {
    return this.post<any>('/ai/analyze-photo', { photoKey, inventoryId });
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
