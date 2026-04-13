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
  Container,
  MovingProject,

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

  async importCategoriesFromCSV(csvData: string, inventoryId: string): Promise<{
    message: string;
    imported: number;
    updated: number;
    failed: number;
    errors: string[];
    totalProcessed: number;
  }> {
    await mockDelay();
    
    // Parse CSV data (simplified for mock)
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Simple CSV parsing for mock
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        
        const categoryData: any = {};
        headers.forEach((header, index) => {
          if (values[index] !== undefined) {
            categoryData[header] = values[index];
          }
        });

        categoryData.inventoryId = inventoryId;

        // Check if category exists (by name)
        const existingIndex = this.data.categories.findIndex(
          c => c.name.toLowerCase() === categoryData.name?.toLowerCase() && c.inventoryId === inventoryId
        );

        if (existingIndex >= 0) {
          // Update existing
          this.data.categories[existingIndex] = {
            ...this.data.categories[existingIndex],
            ...categoryData,
            dateAdded: this.data.categories[existingIndex].dateAdded, // Keep original date
          };
          updated++;
        } else {
          // Create new
          const newCategory: Category = {
            id: this.generateId('cat'),
            dateAdded: new Date().toISOString(),
            ...categoryData,
          };
          this.data.categories.push(newCategory);
          imported++;
        }
      } catch (error) {
        failed++;
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }

    const totalProcessed = imported + updated;
    return {
      message: `Import completed: ${imported} new, ${updated} updated, ${failed} failed`,
      imported,
      updated,
      failed,
      errors,
      totalProcessed,
    };
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

  // Document API (Receipts and Warranties) - Mock
  async generateDocumentUploadUrl(
    fileName: string, 
    contentType: string, 
    inventoryId: string, 
    entityId: string,
    documentType: 'receipt' | 'warranty'
  ): Promise<{ uploadUrl: string; key: string }> {
    await mockDelay();
    console.log(`Mock: Generating document upload URL for ${fileName} (${documentType}) with type ${contentType} for inventory ${inventoryId} entity ${entityId}`);
    const key = `documents/${documentType}/mock-user/${inventoryId}/${entityId}/${Date.now()}-${fileName}`;
    return {
      uploadUrl: `mock://upload/${key}`,
      key
    };
  }

  async generateDocumentDownloadUrl(key: string): Promise<{ downloadUrl: string }> {
    await mockDelay();
    return {
      downloadUrl: `mock://download/${key}`
    };
  }

  async deleteDocument(_key: string): Promise<void> {
    await mockDelay();
    console.log('Mock: Document deleted');
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

  // Barcode Lookup API (Mock)
  async lookupBarcode(barcode: string, _inventoryId: string): Promise<any> {
    await mockDelay(1500); // Simulate API lookup time
    
    // Detect barcode type
    const cleaned = barcode.replace(/[-\s]/g, '');
    const isISBN = /^(978|979)\d{10}$/.test(cleaned) || /^\d{9}[\dX]$/.test(cleaned);
    
    if (isISBN) {
      // Mock book data
      return {
        success: true,
        source: 'openlibrary',
        barcodeType: 'isbn',
        barcode: cleaned,
        data: {
          itemName: 'The Great Gatsby',
          description: 'by F. Scott Fitzgerald. Published 2004 by Scribner. 180 pages.',
          suggestedCategory: 'Books',
          brand: 'Scribner',
          manufacturer: 'Scribner',
          model: null,
          imageUrl: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
          storedImageKey: 'barcode-images/mock-isbn/cover.jpg',
          metadata: {
            authors: ['F. Scott Fitzgerald'],
            publishDate: '2004',
            publisher: 'Scribner',
            pages: 180,
            isbn10: '0743273565',
            isbn13: '9780743273565',
            subjects: ['Fiction', 'Classics', 'American Literature']
          }
        },
        mockMode: true
      };
    } else {
      // Mock general product data
      return {
        success: true,
        source: 'upcdatabase',
        barcodeType: 'upc',
        barcode: cleaned,
        data: {
          itemName: 'Wireless Mouse',
          description: 'Logitech product. Model: M510. Category: Electronics.',
          suggestedCategory: 'Electronics',
          brand: 'Logitech',
          manufacturer: 'Logitech',
          model: 'M510',
          imageUrl: 'https://example.com/products/mouse.jpg',
          storedImageKey: 'barcode-images/mock-upc/product.jpg',
          metadata: {
            category: 'Electronics',
            upc: cleaned,
            ean: null,
            description: 'Wireless computer mouse with USB receiver'
          }
        },
        mockMode: true
      };
    }
  }

  // Container API (Mock)
  async getContainers(inventoryId?: string): Promise<Container[]> {
    await mockDelay();
    
    // Mock container data
    const mockContainers: Container[] = [
      {
        id: 'container-1',
        inventoryId: inventoryId || 'inv-1',
        name: 'Kitchen Box 1',
        type: 'box',
        size: 'Large',
        color: 'Brown',
        description: 'Kitchen utensils and small appliances',
        qrCode: 'QR-KITCHEN-001',
        qrCodeUrl: 'https://example.com/qr/kitchen-001.png',
        locationId: 'loc-1',
        handlingFlags: ['fragile'],
        itemCount: 15,
        estimatedValue: 250,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdBy: 'user-current',
        updatedBy: 'user-current',
        status: 'packed',
        metadata: {}
      },
      {
        id: 'container-2',
        inventoryId: inventoryId || 'inv-1',
        name: 'Bedroom Box 1',
        type: 'box',
        size: 'Medium',
        color: 'Blue',
        description: 'Clothes and personal items',
        qrCode: 'QR-BEDROOM-001',
        qrCodeUrl: 'https://example.com/qr/bedroom-001.png',
        locationId: 'loc-2',
        handlingFlags: [],
        itemCount: 8,
        estimatedValue: 150,
        createdAt: '2024-01-16T14:30:00.000Z',
        updatedAt: '2024-01-16T14:30:00.000Z',
        createdBy: 'user-current',
        updatedBy: 'user-current',
        status: 'packing',
        metadata: {}
      },
      {
        id: 'container-3',
        inventoryId: inventoryId || 'inv-1',
        name: 'Electronics Storage',
        type: 'crate',
        size: 'Large',
        color: 'Black',
        description: 'TV, gaming console, and cables',
        qrCode: 'QR-ELECTRONICS-001',
        qrCodeUrl: 'https://example.com/qr/electronics-001.png',
        locationId: 'loc-3',
        handlingFlags: ['fragile', 'valuable'],
        itemCount: 5,
        estimatedValue: 1200,
        createdAt: '2024-01-17T09:15:00.000Z',
        updatedAt: '2024-01-17T09:15:00.000Z',
        createdBy: 'user-current',
        updatedBy: 'user-current',
        status: 'stored',
        metadata: {}
      }
    ];
    
    return inventoryId ? mockContainers.filter(c => c.inventoryId === inventoryId) : mockContainers;
  }

  async getPackingInterfaceData(inventoryId: string): Promise<{
    things: Thing[];
    categories: Category[];
    locations: Location[];
    rooms: Room[];
    people: Person[];
    containers: Container[];
  }> {
    await mockDelay();
    return {
      things: await this.getThings(inventoryId),
      categories: await this.getCategories(inventoryId),
      locations: await this.getLocations(inventoryId),
      rooms: await this.getRooms(inventoryId),
      people: await this.getPeople(inventoryId),
      containers: await this.getContainers(inventoryId),
    };
  }

  async getContainer(id: string): Promise<Container> {
    await mockDelay();
    const containers = await this.getContainers();
    const container = containers.find(c => c.id === id);
    if (!container) throw new Error('Container not found');
    return container;
  }

  async createContainer(data: Omit<Container, 'id' | 'qrCode' | 'itemCount' | 'estimatedValue' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<Container> {
    await mockDelay();
    
    const newContainer: Container = {
      ...data,
      id: this.generateId('container'),
      qrCode: `QR-${data.name.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`,
      itemCount: 0,
      estimatedValue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-current',
      updatedBy: 'user-current',
    };
    
    return newContainer;
  }

  async updateContainer(id: string, data: Partial<Omit<Container, 'id' | 'qrCode' | 'createdAt' | 'createdBy'>>): Promise<Container> {
    await mockDelay();
    const container = await this.getContainer(id);
    
    return {
      ...container,
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: 'user-current',
    };
  }

  async deleteContainer(id: string): Promise<void> {
    await mockDelay();
    console.log(`Mock: Deleting container ${id}`);
  }

  // Moving Project API (Mock)
  async getProjects(inventoryId?: string): Promise<MovingProject[]> {
    await mockDelay();
    
    const mockProjects: MovingProject[] = [
      {
        id: 'project-1',
        inventoryId: inventoryId || 'inv-1',
        name: 'House Move to New City',
        description: 'Moving from current apartment to new house in Seattle',
        startDate: '2024-01-15T00:00:00.000Z',
        targetDate: '2024-02-15T00:00:00.000Z',
        status: 'active',
        sourceLocation: 'Current Apartment',
        destinationLocation: 'New House - Seattle',
        containerCount: 12,
        itemCount: 150,
        completionPercentage: 65,
        createdAt: '2024-01-10T10:00:00.000Z',
        updatedAt: '2024-01-18T15:30:00.000Z',
        createdBy: 'user-current',
        metadata: {}
      },
      {
        id: 'project-2',
        inventoryId: inventoryId || 'inv-1',
        name: 'Storage Unit Organization',
        description: 'Reorganizing items in storage unit for better access',
        startDate: '2024-01-20T00:00:00.000Z',
        targetDate: '2024-01-25T00:00:00.000Z',
        status: 'planning',
        sourceLocation: 'Storage Unit A',
        destinationLocation: 'Storage Unit A (Reorganized)',
        containerCount: 8,
        itemCount: 75,
        completionPercentage: 15,
        createdAt: '2024-01-18T09:00:00.000Z',
        updatedAt: '2024-01-18T09:00:00.000Z',
        createdBy: 'user-current',
        metadata: {}
      }
    ];
    
    return inventoryId ? mockProjects.filter(p => p.inventoryId === inventoryId) : mockProjects;
  }

  async getProject(id: string): Promise<MovingProject> {
    await mockDelay();
    const projects = await this.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return project;
  }

  async createProject(data: Omit<MovingProject, 'id' | 'containerCount' | 'itemCount' | 'completionPercentage' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<MovingProject> {
    await mockDelay();
    
    const newProject: MovingProject = {
      ...data,
      id: this.generateId('project'),
      containerCount: 0,
      itemCount: 0,
      completionPercentage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-current',
    };
    
    return newProject;
  }

  async updateProject(id: string, data: Partial<Omit<MovingProject, 'id' | 'createdAt' | 'createdBy'>>): Promise<MovingProject> {
    await mockDelay();
    const project = await this.getProject(id);
    
    return {
      ...project,
      ...data,
      updatedAt: new Date().toISOString(),
    };
  }

  async deleteProject(id: string): Promise<void> {
    await mockDelay();
    console.log(`Mock: Deleting project ${id}`);
  }

  async assignContainersToProject(projectId: string, data: { containerIds: string[]; inventoryId: string }): Promise<any> {
    await mockDelay();
    console.log(`Mock: Assigning containers ${data.containerIds.join(', ')} to project ${projectId}`);
    return { success: true, assignedCount: data.containerIds.length };
  }

  async removeContainersFromProject(projectId: string, data: { containerIds: string[]; inventoryId: string }): Promise<any> {
    await mockDelay();
    console.log(`Mock: Removing containers ${data.containerIds.join(', ')} from project ${projectId}`);
    return { success: true, removedCount: data.containerIds.length };
  }

  async assignItemsToProject(projectId: string, data: { itemIds: string[]; inventoryId: string }): Promise<any> {
    await mockDelay();
    console.log(`Mock: Assigning items ${data.itemIds.join(', ')} to project ${projectId}`);
    return { success: true, assignedCount: data.itemIds.length };
  }

  async removeItemsFromProject(projectId: string, data: { itemIds: string[]; inventoryId: string }): Promise<any> {
    await mockDelay();
    console.log(`Mock: Removing items ${data.itemIds.join(', ')} from project ${projectId}`);
    return { success: true, removedCount: data.itemIds.length };
  }

  // Packing API - Container Contents Management
  async getContainerContents(containerId: string, _inventoryId: string): Promise<{
    container: Container;
    items: Thing[];
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
    await mockDelay();
    const container = await this.getContainer(containerId);
    const items = this.data.things.filter(t => 
      t.inventoryId === _inventoryId && (t as any).containerId === containerId
    );
    
    const totalValue = items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const categories = new Set(items.filter(item => item.categoryId).map(item => item.categoryId)).size;
    const hasPhotos = items.some(item => item.photos && item.photos.length > 0);

    return {
      container,
      items,
      itemCount: items.length,
      totalValue,
      categories,
      summary: {
        itemCount: items.length,
        totalValue,
        categoriesCount: categories,
        hasPhotos,
      },
    };
  }

  async addItemsToContainer(containerId: string, _inventoryId: string, itemIds: string[]): Promise<{
    container: Container;
    packedItems: Thing[];
    packedCount: number;
    totalValue: number;
    newItemCount: number;
    newEstimatedValue: number;
  }> {
    await mockDelay();
    const container = await this.getContainer(containerId);
    const items = itemIds.map(id => this.data.things.find(t => t.id === id)).filter(Boolean) as Thing[];
    
    // Update items with container reference
    items.forEach(item => {
      (item as any).containerId = containerId;
      (item as any).packedAt = new Date().toISOString();
    });

    const totalValue = items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const newItemCount = container.itemCount + items.length;
    const newEstimatedValue = container.estimatedValue + totalValue;

    // Update container
    container.itemCount = newItemCount;
    container.estimatedValue = newEstimatedValue;

    return {
      container,
      packedItems: items,
      packedCount: items.length,
      totalValue,
      newItemCount,
      newEstimatedValue,
    };
  }

  async removeItemsFromContainer(containerId: string, _inventoryId: string, itemIds: string[]): Promise<{
    container: Container;
    unpackedItems: Thing[];
    unpackedCount: number;
    totalValue: number;
    newItemCount: number;
    newEstimatedValue: number;
  }> {
    await mockDelay();
    const container = await this.getContainer(containerId);
    const items = itemIds.map(id => this.data.things.find(t => t.id === id)).filter(Boolean) as Thing[];
    
    // Update items to remove container reference
    items.forEach(item => {
      (item as any).containerId = null;
      (item as any).packedAt = null;
    });

    const totalValue = items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const newItemCount = Math.max(0, container.itemCount - items.length);
    const newEstimatedValue = Math.max(0, container.estimatedValue - totalValue);

    // Update container
    container.itemCount = newItemCount;
    container.estimatedValue = newEstimatedValue;

    return {
      container,
      unpackedItems: items,
      unpackedCount: items.length,
      totalValue,
      newItemCount,
      newEstimatedValue,
    };
  }

  async createAndPackThing(thingData: Partial<Thing>, containerId: string, _inventoryId: string): Promise<{
    success: boolean;
    thing: Thing;
    container: Container;
    error?: string;
  }> {
    await mockDelay();
    
    // Create the thing
    const newThing: Thing = {
      id: `thing-${Date.now()}`,
      name: thingData.name || 'Unnamed Item',
      description: thingData.description,
      categoryId: thingData.categoryId,
      inventoryId: thingData.inventoryId || 'default-inventory',
      containerId: containerId,
      dateAdded: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...thingData,
    } as Thing;
    
    this.data.things.push(newThing);
    
    // Update container
    const container = await this.getContainer(containerId);
    container.itemCount = (container.itemCount || 0) + 1;
    container.estimatedValue = (container.estimatedValue || 0) + (newThing.purchasePrice || 0);
    
    return {
      success: true,
      thing: newThing,
      container,
    };
  }

  async transferItemsBetweenContainers(
    sourceContainerId: string,
    targetContainerId: string,
    _inventoryId: string,
    itemIds: string[]
  ): Promise<{
    sourceContainer: Container;
    targetContainer: Container;
    transferredItems: Thing[];
    transferredCount: number;
    totalValue: number;
    sourceNewItemCount: number;
    targetNewItemCount: number;
  }> {
    await mockDelay();
    const sourceContainer = await this.getContainer(sourceContainerId);
    const targetContainer = await this.getContainer(targetContainerId);
    const items = itemIds.map(id => this.data.things.find(t => t.id === id)).filter(Boolean) as Thing[];
    
    // Update items with new container reference
    items.forEach(item => {
      (item as any).containerId = targetContainerId;
      (item as any).packedAt = new Date().toISOString();
    });

    const totalValue = items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    
    // Update containers
    const sourceNewItemCount = Math.max(0, sourceContainer.itemCount - items.length);
    const targetNewItemCount = targetContainer.itemCount + items.length;
    
    sourceContainer.itemCount = sourceNewItemCount;
    sourceContainer.estimatedValue = Math.max(0, sourceContainer.estimatedValue - totalValue);
    
    targetContainer.itemCount = targetNewItemCount;
    targetContainer.estimatedValue = targetContainer.estimatedValue + totalValue;

    return {
      sourceContainer,
      targetContainer,
      transferredItems: items,
      transferredCount: items.length,
      totalValue,
      sourceNewItemCount,
      targetNewItemCount,
    };
  }

  async getAvailableItems(inventoryId: string, filters?: {
    locationId?: string;
    categoryId?: string;
    search?: string;
    limit?: number;
    lastEvaluatedKey?: any;
  }): Promise<{
    items: Thing[];
    count: number;
    lastEvaluatedKey?: any;
    hasMore: boolean;
    totalValue: number;
  }> {
    await mockDelay();
    let items = this.data.things.filter(t => 
      t.inventoryId === inventoryId && !(t as any).containerId
    );

    // Apply filters
    if (filters?.locationId) {
      items = items.filter(t => t.locationId === filters.locationId);
    }
    if (filters?.categoryId) {
      items = items.filter(t => t.categoryId === filters.categoryId);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(t => 
        t.name.toLowerCase().includes(search) || 
        (t.description && t.description.toLowerCase().includes(search))
      );
    }

    // Apply limit
    const limit = filters?.limit || 50;
    const limitedItems = items.slice(0, limit);
    const totalValue = limitedItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);

    return {
      items: limitedItems,
      count: limitedItems.length,
      hasMore: items.length > limit,
      totalValue,
    };
  }

  // QR Code API (Mock)
  async generateQRCode(containerId: string, _inventoryId: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<{
    qrCodeId: string;
    s3Key: string;
    size: string;
    containerId: string;
    generatedAt: string;
    downloadUrl: string;
  }> {
    await mockDelay();
    const qrCodeId = `CONT_${containerId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      qrCodeId,
      s3Key: `qr-codes/${containerId}/${size}_${Date.now()}.png`,
      size,
      containerId,
      generatedAt: new Date().toISOString(),
      downloadUrl: `https://mock-s3-url.com/qr-codes/${containerId}/${size}.png`
    };
  }

  // Note: Batch QR generation has been removed - generate QR codes per-container instead

  // QR Code Scanning API (Mock)
  async scanQRCode(qrCodeData: string, _inventoryId: string): Promise<{
    scanResult: {
      success: boolean;
      containerId: string;
      qrCodeId: string;
      generatedAt: string;
      timestamp: number;
    };
    container: Container;
    items: any[];
    itemCount: number;
    scannedAt: string;
  }> {
    await mockDelay();
    
    // Mock QR code validation
    if (!qrCodeData.startsWith('CONT_') && !qrCodeData.startsWith('QR-')) {
      throw new Error('Invalid QR code format');
    }

    // Find a mock container
    const container = this.data.containers.find(c => 
      c.qrCode === qrCodeData || qrCodeData.includes(c.id)
    ) || this.data.containers[0];

    if (!container) {
      throw new Error('Container not found');
    }

    // Get items in this container (mock)
    const items = this.data.things.filter(t => t.containerId === container.id);

    return {
      scanResult: {
        success: true,
        containerId: container.id,
        qrCodeId: qrCodeData,
        generatedAt: container.createdAt,
        timestamp: Date.now(),
      },
      container,
      items,
      itemCount: items.length,
      scannedAt: new Date().toISOString(),
    };
  }

  async lookupContainer(_inventoryId: string, containerId?: string, containerName?: string): Promise<{
    type: 'single_match' | 'multiple_matches';
    container?: Container;
    items?: any[];
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
    await mockDelay();

    if (containerId) {
      const container = this.data.containers.find(c => c.id === containerId);
      if (!container) {
        throw new Error('Container not found');
      }
      const items = this.data.things.filter(t => t.containerId === containerId);
      return {
        type: 'single_match',
        container,
        items,
        itemCount: items.length,
        lookedUpAt: new Date().toISOString(),
      };
    }

    if (containerName) {
      const matches = this.data.containers.filter(c => 
        c.name.toLowerCase().includes(containerName.toLowerCase())
      );
      
      if (matches.length === 1) {
        const container = matches[0];
        const items = this.data.things.filter(t => t.containerId === container.id);
        return {
          type: 'single_match',
          container,
          items,
          itemCount: items.length,
          lookedUpAt: new Date().toISOString(),
        };
      } else if (matches.length > 1) {
        return {
          type: 'multiple_matches',
          containers: matches.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            itemCount: this.data.things.filter(t => t.containerId === c.id).length,
            locationId: c.locationId,
          })),
          message: 'Multiple containers found. Please select one.',
        };
      }
    }

    throw new Error('No containers found');
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
    await mockDelay();
    
    // Mock scan history
    const mockScans = [
      {
        id: 'scan-1',
        userId: 'user-1',
        inventoryId: inventoryId || 'inv-1',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'qr_scan',
        success: true,
        containerId: this.data.containers[0]?.id,
        containerName: this.data.containers[0]?.name,
        qrCodeId: this.data.containers[0]?.qrCode,
        method: 'camera',
        itemCount: 5,
      },
      {
        id: 'scan-2',
        userId: 'user-1',
        inventoryId: inventoryId || 'inv-1',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        type: 'manual_lookup',
        success: true,
        containerId: this.data.containers[1]?.id,
        containerName: this.data.containers[1]?.name,
        method: 'name_search',
        itemCount: 3,
      },
    ];

    const filteredScans = options?.successOnly 
      ? mockScans.filter(s => s.success)
      : mockScans;

    return {
      scans: filteredScans.slice(0, options?.limit || 20),
      count: filteredScans.length,
      hasMore: false,
    };
  }

  async getRecentScans(_inventoryId: string, limit: number = 10): Promise<{
    recentScans: Array<{
      containerId: string;
      containerName: string;
      timestamp: string;
      method: string;
      itemCount: number;
    }>;
    count: number;
  }> {
    await mockDelay();
    
    const recentScans = this.data.containers.slice(0, limit).map((container, index) => ({
      containerId: container.id,
      containerName: container.name,
      timestamp: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
      method: index % 2 === 0 ? 'camera' : 'manual_entry',
      itemCount: this.data.things.filter(t => t.containerId === container.id).length,
    }));

    return {
      recentScans,
      count: recentScans.length,
    };
  }

  // Reports API (Mock)
  async generateLocationReport(
    locationId: string, 
    _inventoryId: string, 
    _options: any = {}
  ): Promise<any> {
    await mockDelay();
    
    // Mock report data
    const mockReport = {
      location: {
        id: locationId,
        name: 'Mock Location',
        description: 'Mock location for testing'
      },
      summary: {
        totalContainers: 3,
        totalItems: 15,
        totalValue: 450.75,
        categorySummary: {
          'Kitchen': { count: 8, value: 200.50 },
          'Electronics': { count: 4, value: 150.25 },
          'Books': { count: 3, value: 100.00 }
        }
      },
      containers: [
        {
          container: {
            id: 'container-1',
            name: 'Kitchen Box 1',
            type: 'box',
            status: 'packed',
            createdAt: '2024-01-01T00:00:00Z',
            handlingFlags: ['fragile']
          },
          itemCount: 8,
          estimatedValue: 200.50,
          items: [
            {
              id: 'item-1',
              name: 'Plates',
              categoryName: 'Kitchen',
              value: '50.00',
              quantity: 8
            }
          ]
        }
      ],
      filters: _options,
      generatedAt: new Date().toISOString(),
      generatedBy: 'mock-user'
    };

    if (_options.format === 'csv') {
      return 'Container Name,Container Type,Container Status,Item Count,Estimated Value\n"Kitchen Box 1","box","packed",8,200.50';
    }

    return mockReport;
  }

  async generateContainerManifest(
    _containerId: string, 
    _inventoryId: string, 
    options: any = {}
  ): Promise<any> {
    await mockDelay();
    
    const mockManifest = {
      container: {
        id: _containerId,
        name: 'Mock Container',
        type: 'box',
        status: 'packed',
        qrCode: 'QR123456',
        handlingFlags: ['fragile'],
        createdAt: '2024-01-01T00:00:00Z'
      },
      location: {
        id: 'location-1',
        name: 'Storage Room A'
      },
      summary: {
        itemCount: 5,
        totalValue: 125.00,
        categorySummary: {
          'Kitchen': { count: 3, value: 75.00 },
          'Electronics': { count: 2, value: 50.00 }
        }
      },
      items: [
        {
          id: 'item-1',
          name: 'Plates',
          category: 'Kitchen',
          value: 25.00,
          quantity: 4
        }
      ],
      generatedAt: new Date().toISOString(),
      generatedBy: 'mock-user'
    };

    if (options.format === 'csv') {
      return 'Item Name,Category,Description,Value,Quantity\n"Plates","Kitchen","",25.00,4';
    }

    return mockManifest;
  }

  async generateProjectReport(
    projectId: string, 
    _inventoryId: string, 
    options: any = {}
  ): Promise<any> {
    await mockDelay();
    
    const mockProjectReport = {
      project: {
        id: projectId,
        name: 'Mock Moving Project',
        description: 'Mock project for testing',
        startDate: '2024-01-01T00:00:00Z',
        status: 'active'
      },
      summary: {
        totalContainers: 5,
        totalItems: 25,
        totalValue: 750.00,
        completionPercentage: 60,
        statusSummary: {
          'packed': 3,
          'packing': 2
        },
        locationSummary: {
          'location-1': 3,
          'location-2': 2
        }
      },
      containers: [
        {
          container: {
            id: 'container-1',
            name: 'Project Box 1',
            type: 'box',
            status: 'packed'
          },
          itemCount: 5,
          estimatedValue: 150.00
        }
      ],
      generatedAt: new Date().toISOString(),
      generatedBy: 'mock-user'
    };

    if (options.format === 'csv') {
      return 'Container Name,Container Type,Container Status,Item Count,Estimated Value\n"Project Box 1","box","packed",5,150.00';
    }

    return mockProjectReport;
  }

  // Mock auth methods
  setAuthErrorCallback(callback: () => void) {
    // Mock implementation
    console.log('Mock: Auth error callback set', callback);
  }
  // Container Sharing API (Mock implementation)
  async createSharingLink(_containerId: string, options: any): Promise<any> {
    await mockDelay();
    // Mock implementation - return a fake sharing link
    return {
      shareId: this.generateId('share'),
      token: 'mock-token-' + Math.random().toString(36).substr(2, 16),
      shareUrl: `http://localhost:5173/shared/container/mock-share-id?token=mock-token`,
      expiresAt: options.expiresAt,
      privacySettings: {
        includeItemDetails: options.includeItemDetails ?? true,
        includePhotos: options.includePhotos ?? false,
        includeSensitiveData: options.includeSensitiveData ?? false
      },
      createdAt: new Date().toISOString()
    };
  }

  async getSharingLinks(_containerId: string, _inventoryId: string): Promise<any> {
    await mockDelay();
    // Mock implementation - return empty array
    return { sharingLinks: [] };
  }

  async deactivateSharingLink(_shareId: string): Promise<any> {
    await mockDelay();
    return { message: 'Sharing link deactivated' };
  }

  async deleteSharingLink(_shareId: string): Promise<any> {
    await mockDelay();
    return { message: 'Sharing link deleted' };
  }

  async getSharedContainer(_shareId: string, _token: string): Promise<any> {
    await mockDelay();
    
    // Mock implementation - return a sample shared container
    const mockContainer = this.data.containers[0] || {
      id: 'mock-container-1',
      name: 'Sample Shared Container',
      type: 'box',
      description: 'This is a mock shared container for development',
      status: 'packed',
      itemCount: 3,
      handlingFlags: ['fragile'],
      createdAt: new Date().toISOString()
    };

    const mockItems = this.data.things.slice(0, 3).map(thing => ({
      id: thing.id,
      name: thing.name,
      category: 'Sample Category',
      description: thing.description || 'Sample item description',
      photos: thing.photos || [],
      value: (thing as any).value,
      serialNumber: 'MOCK-123',
      model: 'Mock Model',
      brand: 'Mock Brand'
    }));

    return {
      shareId: _shareId,
      container: mockContainer,
      items: mockItems,
      itemCount: mockItems.length,
      privacySettings: {
        includeItemDetails: true,
        includePhotos: false,
        includeSensitiveData: false
      },
      description: 'Mock shared container for development',
      createdAt: new Date().toISOString(),
      accessCount: 1
    };
  }

  // Storage Management API Methods
  async checkStorageAlerts(_inventoryId: string): Promise<any> {
    await mockDelay();
    return {
      summary: {
        containersWithAlerts: 3,
        totalContainersInStorage: 10,
        highPriorityAlerts: 1,
        totalAlertCost: 150.00,
        totalStorageCost: 500.00,
        averageDuration: '45'
      }
    };
  }

  async getStorageAlerts(_inventoryId: string, _options: any = {}): Promise<any> {
    await mockDelay();
    return {
      alerts: [
        {
          id: 'alert-1',
          containerId: 'container-1',
          containerName: 'Storage Box 1',
          type: 'cost_threshold',
          priority: 'high',
          message: 'Storage cost exceeds threshold',
          isRead: false,
          createdAt: new Date().toISOString()
        }
      ],
      pagination: { page: 1, limit: 10, total: 1 }
    };
  }

  async markStorageAlertAsRead(_alertId: string, _inventoryId: string): Promise<void> {
    await mockDelay();
    // Mock implementation
  }

  async resolveStorageAlert(_alertId: string, _inventoryId: string, _resolution: string): Promise<void> {
    await mockDelay();
    // Mock implementation
  }

  async listStorageContainers(_inventoryId: string, _params: any = {}): Promise<any> {
    await mockDelay();
    return {
      containers: this.data.containers.slice(0, 5).map(container => ({
        ...container,
        storageInfo: {
          location: 'Storage Unit A',
          startDate: '2024-01-01',
          monthlyRate: 50.00,
          totalCost: 150.00
        }
      })),
      pagination: { page: 1, limit: 10, total: 5 }
    };
  }

  async getStorageInfo(_containerId: string, _inventoryId: string): Promise<any> {
    await mockDelay();
    return {
      storageInfo: {
        location: 'Storage Unit A',
        startDate: '2024-01-01',
        monthlyRate: 50.00,
        totalCost: 150.00,
        isActive: true
      }
    };
  }

  async getStorageCostProjections(_containerId: string, _inventoryId: string, months: number): Promise<any> {
    await mockDelay();
    return {
      projections: Array.from({ length: months }, (_, i) => ({
        month: i + 1,
        cost: 50.00,
        cumulativeCost: (i + 1) * 50.00
      }))
    };
  }

  async startStorageTracking(_containerId: string, _inventoryId: string, _locationId: string, _rate: number): Promise<void> {
    await mockDelay();
    // Mock implementation
  }

  async endStorageTracking(_containerId: string, _inventoryId: string): Promise<any> {
    await mockDelay();
    return {
      finalCost: 150.00,
      duration: 90,
      summary: 'Storage tracking ended'
    };
  }

  async updateStorageRate(_containerId: string, _inventoryId: string, _newRate: number): Promise<void> {
    await mockDelay();
    // Mock implementation
  }

  // Photo management methods
  async uploadPhoto(_file: File, _inventoryId: string): Promise<string> {
    await mockDelay();
    // Mock implementation - return a fake photo key
    return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async uploadAvatar(_file: File, _userId: string): Promise<string> {
    await mockDelay();
    return `avatars/mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async deletePhoto(_photoKey: string, _inventoryId: string): Promise<void> {
    await mockDelay();
    // Mock implementation
  }

  getPhotoUrl(photoKey: string): string {
    // Mock implementation - return a placeholder image URL
    return `https://via.placeholder.com/300x200?text=${encodeURIComponent(photoKey)}`;
  }

  // Analytics methods
  async getPackingMetrics(_inventoryId: string, _options: any = {}): Promise<any> {
    await mockDelay();
    return {
      metrics: {
        totalContainers: 25,
        totalItems: 150,
        avgItemsPerContainer: 6,
        avgValuePerContainer: 250,
        totalValue: 6250,
        typeBreakdown: {
          small: 10,
          medium: 12,
          large: 3
        },
        statusBreakdown: {
          packed: 20,
          in_progress: 3,
          empty: 2
        },
        packingVelocity: {
          containersPerDay: 2.5,
          trend: 'increasing'
        }
      },
      timeline: []
    };
  }

  async getContainerUtilization(_inventoryId: string): Promise<any> {
    await mockDelay();
    return {
      utilization: {
        utilizationScore: 75,
        wellPacked: 15,
        lightlyPacked: 8,
        overPacked: 2,
        emptyContainers: 0
      },
      efficiency: {
        efficiency: 78,
        optimalContainers: 22,
        wastedSpace: 3,
        recommendations: ['Consider consolidating lightly packed containers']
      }
    };
  }

  async getMovingProgress(_inventoryId: string, _projectId?: string): Promise<any> {
    await mockDelay();
    return {
      progress: {
        completionPercentage: 65,
        packedItems: 98,
        unpackedItems: 52,
        packedContainers: 20,
        emptyContainers: 5,
        totalContainers: 25,
        packingRate: 65,
        containersByStatus: {
          packed: 20,
          in_progress: 3,
          empty: 2
        }
      },
      completionTimeline: []
    };
  }

  async getStorageCosts(_inventoryId: string, _options: any = {}): Promise<any> {
    await mockDelay();
    return {
      costs: {
        totalMonthlyCost: 125.50,
        totalCost: 450.75,
        totalContainers: 15,
        avgDuration: 90,
        costBreakdown: []
      },
      projections: {
        nextMonth: 125.50,
        next3Months: 376.50,
        next6Months: 753.00,
        nextYear: 1506.00
      }
    };
  }

  async getRecommendations(_inventoryId: string): Promise<any> {
    await mockDelay();
    return {
      recommendations: [
        {
          title: 'Optimize Container Utilization',
          description: 'Several containers are lightly packed and could be consolidated',
          type: 'efficiency',
          priority: 'medium',
          action: 'Review containers with fewer than 5 items and consider consolidating'
        }
      ]
    };
  }

  // Tag-related API methods
  async getTags(inventoryId: string, options?: {
    q?: string;
    exclude?: string[];
    limit?: number;
  }): Promise<{ tags: string[] }> {
    await mockDelay();
    
    // Extract all tags from things in the inventory
    const things = this.data.things.filter(t => t.inventoryId === inventoryId);
    const allTags = new Set<string>();
    
    things.forEach(thing => {
      if (thing.tags && Array.isArray(thing.tags)) {
        thing.tags.forEach(tag => allTags.add(tag.toLowerCase()));
      }
    });
    
    let tags = Array.from(allTags);
    
    // Apply filters
    if (options?.exclude && options.exclude.length > 0) {
      const excludeSet = new Set(options.exclude.map(tag => tag.toLowerCase()));
      tags = tags.filter(tag => !excludeSet.has(tag));
    }
    
    if (options?.q) {
      const query = options.q.toLowerCase();
      tags = tags.filter(tag => tag.includes(query));
    }
    
    // Apply limit
    if (options?.limit) {
      tags = tags.slice(0, options.limit);
    }
    
    return { tags: tags.sort() };
  }

  async getTagAnalytics(inventoryId: string): Promise<{
    inventoryId: string;
    totalTags: number;
    uniqueTags: number;
    totalThings: number;
    taggedThings: number;
    tagStatistics: Array<{
      tag: string;
      count: number;
      percentage: number;
      firstUsed: string;
      lastUsed: string;
    }>;
    lastUpdated: string;
  }> {
    await mockDelay();
    
    const things = this.data.things.filter(t => t.inventoryId === inventoryId);
    const tagCounts = new Map<string, number>();
    let totalTagInstances = 0;
    let taggedThings = 0;
    
    things.forEach(thing => {
      if (thing.tags && Array.isArray(thing.tags) && thing.tags.length > 0) {
        taggedThings++;
        thing.tags.forEach(tag => {
          const normalizedTag = tag.toLowerCase();
          totalTagInstances++;
          tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
        });
      }
    });
    
    const tagStatistics = Array.from(tagCounts.entries()).map(([tag, count]) => ({
      tag,
      count,
      percentage: taggedThings > 0 ? Math.round((count / taggedThings) * 100) : 0,
      firstUsed: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    })).sort((a, b) => b.count - a.count);
    
    return {
      inventoryId,
      totalTags: totalTagInstances,
      uniqueTags: tagCounts.size,
      totalThings: things.length,
      taggedThings,
      tagStatistics,
      lastUpdated: new Date().toISOString(),
    };
  }

  async searchThingsByTags(inventoryId: string, options: {
    tags: string[];
    tagMode?: 'and' | 'or';
    partialMatch?: boolean;
  }): Promise<Thing[]> {
    await mockDelay();
    
    const things = this.data.things.filter(t => t.inventoryId === inventoryId);
    const searchTags = options.tags.map(tag => tag.toLowerCase());
    const mode = options.tagMode || 'and';
    
    return things.filter(thing => {
      if (!thing.tags || !Array.isArray(thing.tags) || thing.tags.length === 0) {
        return false;
      }
      
      const thingTags = thing.tags.map(tag => tag.toLowerCase());
      
      if (mode === 'and') {
        return searchTags.every(searchTag => 
          options.partialMatch 
            ? thingTags.some(thingTag => thingTag.includes(searchTag))
            : thingTags.includes(searchTag)
        );
      } else {
        return searchTags.some(searchTag => 
          options.partialMatch 
            ? thingTags.some(thingTag => thingTag.includes(searchTag))
            : thingTags.includes(searchTag)
        );
      }
    });
  }

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
    await mockDelay();
    
    const results = {
      operation: operation.operation,
      totalRequested: operation.thingIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      updatedThings: [] as Array<{
        id: string;
        name: string;
        previousTags: string[];
        newTags: string[];
      }>
    };

    for (const thingId of operation.thingIds) {
      try {
        const thingIndex = this.data.things.findIndex(t => t.id === thingId && t.inventoryId === inventoryId);
        
        if (thingIndex === -1) {
          results.failed++;
          results.errors.push(`Thing not found: ${thingId}`);
          continue;
        }

        const thing = this.data.things[thingIndex];
        const previousTags = [...(thing.tags || [])];
        let newTags = [...previousTags];

        // Apply the operation
        switch (operation.operation) {
          case 'add':
            for (const tag of operation.tags) {
              if (!newTags.includes(tag)) {
                newTags.push(tag);
              }
            }
            break;

          case 'remove':
            newTags = newTags.filter(tag => !operation.tags.includes(tag));
            break;

          case 'replace':
            newTags = [...operation.tags];
            break;
        }

        // Update the thing
        this.data.things[thingIndex] = {
          ...thing,
          tags: newTags,
        };

        results.successful++;
        results.updatedThings.push({
          id: thingId,
          name: thing.name,
          previousTags,
          newTags,
        });

      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to update ${thingId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  // Project Tasks API
  async getProjectTasks(_projectId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  async createTask(_projectId: string, data: any): Promise<any> {
    await mockDelay();
    return { id: this.generateId('task'), ...data };
  }

  async updateTask(_taskId: string, data: any): Promise<any> {
    await mockDelay();
    return { id: this.generateId('task'), ...data };
  }

  async deleteTask(_taskId: string): Promise<void> {
    await mockDelay();
  }

  async getOverdueTasks(_inventoryId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  // Project Milestones API
  async getProjectMilestones(_projectId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  async createMilestone(_projectId: string, data: any): Promise<any> {
    await mockDelay();
    return { id: this.generateId('milestone'), ...data };
  }

  async updateMilestone(_milestoneId: string, data: any): Promise<any> {
    await mockDelay();
    return { id: this.generateId('milestone'), ...data };
  }

  async completeMilestone(_milestoneId: string, _inventoryId: string): Promise<any> {
    await mockDelay();
    return { id: this.generateId('milestone'), status: 'completed' };
  }

  async deleteMilestone(_milestoneId: string): Promise<void> {
    await mockDelay();
  }

  async getOverdueMilestones(_inventoryId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  async getUpcomingMilestones(_inventoryId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  // Project Budget API
  async getProjectBudget(_projectId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  async createBudgetItem(_projectId: string, data: any): Promise<any> {
    await mockDelay();
    return { id: this.generateId('budget'), ...data };
  }

  async updateBudgetItem(_budgetItemId: string, data: any): Promise<any> {
    await mockDelay();
    return { id: this.generateId('budget'), ...data };
  }

  async deleteBudgetItem(_budgetItemId: string): Promise<void> {
    await mockDelay();
  }

  async getBudgetStats(_projectId: string, _inventoryId: string): Promise<any> {
    await mockDelay();
    return { totalEstimated: 0, totalActual: 0 };
  }

  // Project Things API
  async getProjectThings(_projectId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  async assignThingsToProject(_projectId: string, data: any): Promise<any> {
    await mockDelay();
    return { ...data };
  }

  async removeThingsFromProject(_projectId: string, data: any): Promise<any> {
    await mockDelay();
    return { ...data };
  }

  async getAvailableThingsForProject(_inventoryId: string): Promise<any[]> {
    await mockDelay();
    return [];
  }

  // Project Progress API
  async getProjectProgress(_projectId: string, _inventoryId: string): Promise<any> {
    await mockDelay();
    return {
      project: {},
      statistics: {},
      containers: [],
      tasks: [],
      milestones: []
    };
  }

  async getContainerQRCode(containerId: string, _inventoryId: string): Promise<{
    containerId: string;
    hasQRCode: boolean;
    qrCode?: string;
    downloadUrl?: string;
  }> {
    await mockDelay();
    const container = await this.getContainer(containerId);
    
    return {
      containerId,
      hasQRCode: !!container.qrCode,
      qrCode: container.qrCode,
      downloadUrl: container.qrCodeUrl,
    };
  }
}

export default MockApiClient;
