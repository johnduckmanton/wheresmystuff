import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import type {
  Thing,
  Location,
  Room,
  Category,
  Person,
  ApiResponse,
} from '../types';

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
  async getThings(): Promise<Thing[]> {
    return this.get<Thing[]>('/things');
  }

  async getThing(id: string): Promise<Thing> {
    return this.get<Thing>(`/things/${id}`);
  }

  async createThing(data: Omit<Thing, 'id' | 'dateAdded'>): Promise<Thing> {
    return this.post<Thing>('/things', data);
  }

  async updateThing(id: string, data: Partial<Omit<Thing, 'id' | 'dateAdded'>>): Promise<Thing> {
    return this.put<Thing>(`/things/${id}`, data);
  }

  async deleteThing(id: string): Promise<void> {
    return this.delete<void>(`/things/${id}`);
  }

  // Locations API
  async getLocations(): Promise<Location[]> {
    return this.get<Location[]>('/locations');
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

  async deleteLocation(id: string): Promise<void> {
    return this.delete<void>(`/locations/${id}`);
  }

  // Rooms API
  async getRooms(locationId?: string): Promise<Room[]> {
    const url = locationId ? `/rooms?locationId=${locationId}` : '/rooms';
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

  async deleteRoom(id: string): Promise<void> {
    return this.delete<void>(`/rooms/${id}`);
  }

  // Categories API
  async getCategories(): Promise<Category[]> {
    return this.get<Category[]>('/categories');
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

  async deleteCategory(id: string): Promise<void> {
    return this.delete<void>(`/categories/${id}`);
  }

  // People API
  async getPeople(): Promise<Person[]> {
    return this.get<Person[]>('/people');
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

  async deletePerson(id: string): Promise<void> {
    return this.delete<void>(`/people/${id}`);
  }

  // Photo API
  async generateUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; key: string }> {
    return this.post<{ uploadUrl: string; key: string }>('/upload', { key, contentType });
  }

  async generateDownloadUrl(key: string): Promise<{ downloadUrl: string }> {
    return this.get<{ downloadUrl: string }>(`/photo/${key}`);
  }
}

// Export singleton instance
const apiClient = new ApiClient();
export default apiClient;
