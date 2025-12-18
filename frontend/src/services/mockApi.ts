// Mock API client for local development
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
} from '../types';
import { mockData, mockDelay } from '../config/development';

/**
 * Mock API client for offline development
 * Simulates the real API with local data and delays
 */
class MockApiClient {
  private data = { ...mockData };

  // Helper to generate IDs
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Things API
  async getThings(inventoryId?: string): Promise<Thing[]> {
    await mockDelay();
    if (inventoryId) {
      return this.data.things.filter(t => t.inventoryId === inventoryId);
    }
    return this.data.things;
  }

  async getThing(id: string): Promise<Thing> {
    await mockDelay();
    const thing = this.data.things.find(t => t.id === id);
    if (!thing) throw new Error('Thing not found');
    return thing;
  }

  async createThing(data: Omit<Thing, 'id' | 'dateAdded'>): Promise<Thing> {
    await mockDelay();
    const newThing: Thing = {
      ...data,
      id: this.generateId('thing'),
      dateAdded: new Date().toISOString(),
      photos: data.photos || [],
    };
    this.data.things.push(newThing);
    return newThing;
  }

  async updateThing(id: string, data: Partial<Omit<Thing, 'id' | 'dateAdded'>>): Promise<Thing> {
    await mockDelay();
    const index = this.data.things.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Thing not found');
    
    this.data.things[index] = { 
      ...this.data.things[index], 
      ...data,
      photos: data.photos || this.data.things[index].photos || []
    };
    return this.data.things[index];
  }

  async deleteThing(id: string, _inventoryId?: string): Promise<void> {
    await mockDelay();
    const index = this.data.things.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Thing not found');
    
    this.data.things.splice(index, 1);
  }

  // Locations API
  async getLocations(inventoryId?: string): Promise<Location[]> {
    await mockDelay();
    if (inventoryId) {
      return this.data.locations.filter(l => l.inventoryId === inventoryId);
    }
    return this.data.locations;
  }

  async getLocation(id: string): Promise<Location> {
    await mockDelay();
    const location = this.data.locations.find(l => l.id === id);
    if (!location) throw new Error('Location not found');
    return location;
  }

  async createLocation(data: Omit<Location, 'id' | 'dateAdded'>): Promise<Location> {
    await mockDelay();
    const newLocation: Location = {
      ...data,
      id: this.generateId('loc'),
      dateAdded: new Date().toISOString(),
    };
    this.data.locations.push(newLocation);
    return newLocation;
  }

  async updateLocation(id: string, data: Partial<Omit<Location, 'id' | 'dateAdded'>>): Promise<Location> {
    await mockDelay();
    const index = this.data.locations.findIndex(l => l.id === id);
    if (index === -1) throw new Error('Location not found');
    
    this.data.locations[index] = { ...this.data.locations[index], ...data };
    return this.data.locations[index];
  }

  async deleteLocation(id: string, _inventoryId?: string): Promise<void> {
    await mockDelay();
    const index = this.data.locations.findIndex(l => l.id === id);
    if (index === -1) throw new Error('Location not found');
    
    this.data.locations.splice(index, 1);
  }

  // Rooms API
  async getRooms(locationId?: string, inventoryId?: string): Promise<Room[]> {
    await mockDelay();
    let rooms = this.data.rooms;
    if (locationId) {
      rooms = rooms.filter(r => r.locationId === locationId);
    }
    if (inventoryId) {
      rooms = rooms.filter(r => r.inventoryId === inventoryId);
    }
    return rooms;
  }

  async getRoom(id: string): Promise<Room> {
    await mockDelay();
    const room = this.data.rooms.find(r => r.id === id);
    if (!room) throw new Error('Room not found');
    return room;
  }

  async createRoom(data: Omit<Room, 'id' | 'dateAdded'>): Promise<Room> {
    await mockDelay();
    const newRoom: Room = {
      ...data,
      id: this.generateId('room'),
      dateAdded: new Date().toISOString(),
    };
    this.data.rooms.push(newRoom);
    return newRoom;
  }

  async updateRoom(id: string, data: Partial<Omit<Room, 'id' | 'dateAdded'>>): Promise<Room> {
    await mockDelay();
    const index = this.data.rooms.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Room not found');
    
    this.data.rooms[index] = { ...this.data.rooms[index], ...data };
    return this.data.rooms[index];
  }

  async deleteRoom(id: string, _inventoryId?: string): Promise<void> {
    await mockDelay();
    const index = this.data.rooms.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Room not found');
    
    this.data.rooms.splice(index, 1);
  }

  // Categories API
  async getCategories(inventoryId?: string): Promise<Category[]> {
    await mockDelay();
    if (inventoryId) {
      return this.data.categories.filter(c => c.inventoryId === inventoryId);
    }
    return this.data.categories;
  }

  async getCategory(id: string): Promise<Category> {
    await mockDelay();
    const category = this.data.categories.find(c => c.id === id);
    if (!category) throw new Error('Category not found');
    return category;
  }

  async createCategory(data: Omit<Category, 'id' | 'dateAdded'>): Promise<Category> {
    await mockDelay();
    const newCategory: Category = {
      ...data,
      id: this.generateId('cat'),
      dateAdded: new Date().toISOString(),
      description: data.description || '',
      color: data.color || '#4ECDC4',
      icon: data.icon || 'category',
    };
    this.data.categories.push(newCategory);
    return newCategory;
  }

  async updateCategory(id: string, data: Partial<Omit<Category, 'id' | 'dateAdded'>>): Promise<Category> {
    await mockDelay();
    const index = this.data.categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Category not found');
    
    this.data.categories[index] = { ...this.data.categories[index], ...data };
    return this.data.categories[index];
  }

  async deleteCategory(id: string, _inventoryId?: string): Promise<void> {
    await mockDelay();
    const index = this.data.categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Category not found');
    
    this.data.categories.splice(index, 1);
  }

  // People API
  async getPeople(inventoryId?: string): Promise<Person[]> {
    await mockDelay();
    if (inventoryId) {
      return this.data.people.filter(p => p.inventoryId === inventoryId);
    }
    return this.data.people;
  }

  async getPerson(id: string): Promise<Person> {
    await mockDelay();
    const person = this.data.people.find(p => p.id === id);
    if (!person) throw new Error('Person not found');
    return person;
  }

  async createPerson(data: Omit<Person, 'id' | 'dateAdded'>): Promise<Person> {
    await mockDelay();
    const newPerson: Person = {
      ...data,
      id: this.generateId('person'),
      dateAdded: new Date().toISOString(),
      email: data.email || '',
      phone: data.phone || '',
    };
    this.data.people.push(newPerson);
    return newPerson;
  }

  async updatePerson(id: string, data: Partial<Omit<Person, 'id' | 'dateAdded'>>): Promise<Person> {
    await mockDelay();
    const index = this.data.people.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Person not found');
    
    this.data.people[index] = { ...this.data.people[index], ...data };
    return this.data.people[index];
  }

  async deletePerson(id: string, _inventoryId?: string): Promise<void> {
    await mockDelay();
    const index = this.data.people.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Person not found');
    
    this.data.people.splice(index, 1);
  }

  // Inventory API
  async getInventories(): Promise<Inventory[]> {
    await mockDelay();
    return this.data.inventories;
  }

  async getInventory(id: string): Promise<Inventory> {
    await mockDelay();
    const inventory = this.data.inventories.find(i => i.id === id);
    if (!inventory) throw new Error('Inventory not found');
    return inventory;
  }

  async createInventory(data: Omit<Inventory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<Inventory> {
    await mockDelay();
    const newInventory: Inventory = {
      ...data,
      id: this.generateId('inv'),
      ownerId: 'user-1', // Mock user ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: data.description || '',
    };
    this.data.inventories.push(newInventory);
    return newInventory;
  }

  async updateInventory(id: string, data: Partial<Omit<Inventory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>): Promise<Inventory> {
    await mockDelay();
    const index = this.data.inventories.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Inventory not found');
    
    this.data.inventories[index] = { 
      ...this.data.inventories[index], 
      ...data,
      updatedAt: new Date().toISOString()
    };
    return this.data.inventories[index];
  }

  async deleteInventory(id: string): Promise<void> {
    await mockDelay();
    const index = this.data.inventories.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Inventory not found');
    
    this.data.inventories.splice(index, 1);
  }

  // Inventory Membership API (simplified for mock)
  async getInventoryMembers(inventoryId: string): Promise<InventoryMembership[]> {
    await mockDelay();
    return [
      {
        inventoryId,
        userId: 'user-1',
        role: 'owner',
        addedAt: new Date().toISOString(),
        addedBy: 'user-1'
      }
    ];
  }

  async addInventoryMember(inventoryId: string, userId: string): Promise<InventoryMembership> {
    await mockDelay();
    return {
      inventoryId,
      userId,
      role: 'member',
      addedAt: new Date().toISOString(),
      addedBy: 'user-1'
    };
  }

  async removeInventoryMember(inventoryId: string, userId: string): Promise<void> {
    await mockDelay();
    // Mock implementation - just delay
    console.log(`Mock: Removing user ${userId} from inventory ${inventoryId}`);
  }

  // Photo API (simplified for mock)
  async generateUploadUrl(fileName: string, contentType: string, inventoryId: string, entityId: string): Promise<{ uploadUrl: string; key: string }> {
    await mockDelay();
    console.log(`Mock: Generating upload URL for ${fileName} with type ${contentType} for inventory ${inventoryId} entity ${entityId}`);
    const key = `photos/mock-user/${inventoryId}/${entityId}/${Date.now()}-${fileName}`;
    return {
      uploadUrl: `mock://upload/${key}`,
      key
    };
  }

  async generateDownloadUrl(key: string): Promise<{ downloadUrl: string }> {
    await mockDelay();
    return {
      downloadUrl: `mock://download/${key}`
    };
  }

  // User Management API (Mock)
  async lookupUserByEmail(email: string): Promise<UserLookupResult> {
    await mockDelay();
    
    // Mock some users for testing
    const mockUsers = [
      {
        userId: 'user-123',
        email: 'john@example.com',
        username: 'john@example.com',
        displayName: 'John Doe',
        emailVerified: true,
        userStatus: 'CONFIRMED'
      },
      {
        userId: 'user-456',
        email: 'jane@example.com',
        username: 'jane@example.com',
        displayName: 'Jane Smith',
        emailVerified: true,
        userStatus: 'CONFIRMED'
      }
    ];

    const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      return {
        found: true,
        ...user
      };
    }

    return {
      found: false,
      message: 'User not found'
    };
  }

  async getUserProfile(userId?: string): Promise<UserProfile> {
    await mockDelay();
    
    // Mock current user profile
    return {
      userId: userId || 'user-current',
      email: 'current@example.com',
      username: 'current@example.com',
      displayName: 'Current User',
      emailVerified: true,
      userStatus: 'CONFIRMED',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    await mockDelay();
    
    // Mock profile update
    return {
      userId,
      email: 'current@example.com',
      username: 'current@example.com',
      displayName: updates.displayName || 'Current User',
      emailVerified: true,
      userStatus: 'CONFIRMED',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
  }

  // Invitation Management API (Mock)
  async getInvitations(inventoryId: string): Promise<Invitation[]> {
    await mockDelay();
    
    // Mock some pending invitations
    return [
      {
        invitationId: 'inv-1',
        inventoryId,
        email: 'pending@example.com',
        role: 'member',
        invitedBy: 'user-current',
        status: 'pending',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days from now
      }
    ];
  }

  async createInvitation(inventoryId: string, data: {
    email: string;
    role: string;
    inventoryName?: string;
    inviterName?: string;
  }): Promise<Invitation> {
    await mockDelay();
    
    return {
      invitationId: this.generateId('inv'),
      inventoryId,
      email: data.email,
      role: data.role as 'member' | 'administrator' | 'read_only',
      invitedBy: 'user-current',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    };
  }

  async cancelInvitation(inventoryId: string, invitationId: string): Promise<void> {
    await mockDelay();
    console.log(`Mock: Cancelling invitation ${invitationId} for inventory ${inventoryId}`);
  }

  async acceptInvitation(token: string): Promise<{
    message: string;
    inventoryId: string;
    role: string;
    membership: InventoryMembership;
  }> {
    await mockDelay();
    
    // Mock successful invitation acceptance
    const mockInventoryId = 'inv-mock-123';
    const mockRole = 'member';
    
    console.log(`Mock: Accepting invitation with token ${token}`);
    
    return {
      message: 'Invitation accepted successfully',
      inventoryId: mockInventoryId,
      role: mockRole,
      membership: {
        inventoryId: mockInventoryId,
        userId: 'user-current',
        role: mockRole,
        addedAt: new Date().toISOString(),
        addedBy: 'inviter-user-id',
        permissions: {
          canAddMembers: false,
          canRemoveMembers: false,
          canModifySettings: false,
          canDeleteInventory: false,
          canManageItems: true,
          canViewItems: true,
          canViewMembers: true,
        }
      }
    };
  }

  // Member Role Management API (Mock)
  async updateMemberRole(inventoryId: string, userId: string, role: string, _reason?: string): Promise<InventoryMembership> {
    await mockDelay();
    
    return {
      inventoryId,
      userId,
      role,
      addedAt: new Date().toISOString(),
      addedBy: 'user-current',
      permissions: {
        canAddMembers: role === 'administrator' || role === 'owner',
        canRemoveMembers: role === 'administrator' || role === 'owner',
        canModifySettings: role === 'administrator' || role === 'owner',
        canDeleteInventory: role === 'owner',
        canManageItems: role !== 'read_only',
        canViewItems: true,
        canViewMembers: true
      }
    };
  }

  // AI Analysis API (Mock)
  async analyzePhoto(_photoKey: string, _inventoryId: string): Promise<any> {
    await mockDelay(2000); // Simulate AI processing time
    
    return {
      success: true,
      analysis: {
        itemName: 'Wireless Bluetooth Headphones',
        description: 'Black over-ear wireless headphones with adjustable headband and cushioned ear cups. Appears to be in excellent condition with minimal wear signs.',
        suggestedCategory: 'Electronics',
        extractedText: {
          brandNames: ['Sony'],
          modelNumbers: ['WH-1000XM4'],
          serialNumbers: ['SN123456789'],
          otherText: ['Wireless', 'Bluetooth', 'Noise Canceling']
        },
        estimatedValue: 250,
        confidence: {
          overall: 0.87,
          itemName: 0.9,
          description: 0.85,
          category: 0.85
        }
      },
      processingTimeMs: 2000,
      mockMode: true
    };
  }

  // Mock auth methods
  setAuthErrorCallback(callback: () => void) {
    // Mock implementation
    console.log('Mock: Auth error callback set', callback);
  }
}

export default MockApiClient;