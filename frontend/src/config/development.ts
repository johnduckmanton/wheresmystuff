// Development mode configuration
// This file provides mock data and offline functionality for local development

export const isDevelopmentMode = import.meta.env.MODE === 'development' && !import.meta.env.VITE_API_URL;

import type { Thing, Location, Room, Category, Person, Inventory } from '../types';

// Mock data for development
export const mockData: {
  inventories: Inventory[];
  things: Thing[];
  locations: Location[];
  rooms: Room[];
  categories: Category[];
  people: Person[];
} = {
  inventories: [
    {
      id: 'inv-1',
      name: 'My Home Inventory',
      description: 'Main household items',
      ownerId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-2', 
      name: 'Office Inventory',
      description: 'Work equipment and supplies',
      ownerId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
  things: [
    {
      id: 'thing-1',
      name: 'Laptop',
      description: 'MacBook Pro 16-inch',
      inventoryId: 'inv-1',
      categoryId: 'cat-1',
      locationId: 'loc-1',
      roomId: 'room-1',
      dateAdded: new Date().toISOString(),
      photos: [],
      notes: 'Primary work laptop'
    },
    {
      id: 'thing-2',
      name: 'Coffee Maker',
      description: 'Breville Barista Express',
      inventoryId: 'inv-1',
      categoryId: 'cat-2',
      locationId: 'loc-1',
      roomId: 'room-2',
      dateAdded: new Date().toISOString(),
      photos: [],
      notes: 'Daily use coffee machine'
    }
  ],
  locations: [
    {
      id: 'loc-1',
      name: 'Home',
      description: 'Main residence',
      inventoryId: 'inv-1',
      addressLine1: '123 Main St',
      dateAdded: new Date().toISOString()
    }
  ],
  rooms: [
    {
      id: 'room-1',
      name: 'Home Office',
      inventoryId: 'inv-1',
      locationId: 'loc-1',
      dateAdded: new Date().toISOString()
    },
    {
      id: 'room-2',
      name: 'Kitchen',
      inventoryId: 'inv-1',
      locationId: 'loc-1',
      dateAdded: new Date().toISOString()
    }
  ],
  categories: [
    {
      id: 'cat-1',
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      inventoryId: 'inv-1',
      dateAdded: new Date().toISOString()
    },
    {
      id: 'cat-2',
      name: 'Kitchen Appliances',
      description: 'Cooking and food preparation equipment',
      inventoryId: 'inv-1',
      dateAdded: new Date().toISOString()
    }
  ],
  people: [
    {
      id: 'person-1',
      name: 'John Doe',
      description: 'Household member',
      email: 'john@example.com',
      phone: '555-0123',
      relationship: 'Family',
      notes: 'Primary household member',
      inventoryId: 'inv-1',
      dateAdded: new Date().toISOString(),
      photos: []
    }
  ]
};

// Mock API delay to simulate network requests
export const mockDelay = (ms: number = 500) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Development mode helpers
export const logDevelopmentInfo = () => {
  if (isDevelopmentMode) {
    console.log('🚀 Running in development mode with mock data');
    console.log('📝 To connect to real API, set VITE_API_URL in .env.local');
  }
};