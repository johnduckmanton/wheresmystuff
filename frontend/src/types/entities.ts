// Entity type definitions based on the design document

export interface Thing {
  id: string; // UUID
  inventoryId: string; // UUID reference to inventory
  name: string; // Required
  description?: string;
  make?: string; // Optional make/brand
  model?: string; // Optional model
  serialNumber?: string;
  locationId?: string; // UUID reference
  roomId?: string; // UUID reference
  ownerId?: string; // UUID reference (Person)
  categoryId?: string; // UUID reference
  containerId?: string; // UUID reference to container (if packed)
  notes?: string;
  datePurchased?: string; // ISO date
  purchasedFrom?: string;
  purchasePrice?: number; // Purchase price in local currency
  warrantyDetails?: string;
  disposalDate?: string; // ISO date
  nextReviewDate?: string; // ISO date
  photos?: string[]; // Array of S3 keys
  tags?: string[]; // Array of tag names for categorization and search
  dateAdded: string; // ISO date, auto-generated
}

export interface Location {
  id: string; // UUID
  inventoryId: string; // UUID reference to inventory
  name: string; // Required
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  county?: string;
  postcode?: string;
  country?: string; // ISO country code
  description?: string;
  dateAdded: string; // ISO date, auto-generated
}

export interface Room {
  id: string; // UUID
  inventoryId: string; // UUID reference to inventory
  name: string; // Required
  locationId: string; // UUID reference, required
  floor?: string; // Predefined or custom
  dateAdded: string; // ISO date, auto-generated
}

export interface Category {
  id: string; // UUID
  inventoryId: string; // UUID reference to inventory
  name: string; // Required
  description?: string;
  color?: string; // Hex color code (e.g., #FF5733)
  icon?: string; // Icon identifier
  dateAdded: string; // ISO date, auto-generated
}

export interface Person {
  id: string; // UUID
  inventoryId: string; // UUID reference to inventory
  name: string; // Required
  description?: string; // Keep for backward compatibility
  email?: string;
  phone?: string;
  relationship?: string;
  notes?: string;
  photos?: string[]; // Array of S3 keys
  dateAdded: string; // ISO date, auto-generated
}

export interface Inventory {
  id: string; // UUID
  name: string; // Required
  description?: string;
  ownerId: string; // UUID of owner
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export interface InventoryMembership {
  inventoryId: string; // UUID of inventory
  userId: string; // UUID of member user
  role: string; // "owner", "administrator", "member", or "read_only"
  addedAt: string; // ISO 8601 timestamp
  addedBy: string; // User ID who added this member
  updatedAt?: string; // ISO 8601 timestamp of last role change
  updatedBy?: string; // User ID who last updated this member's role
  permissions?: {
    canAddMembers: boolean;
    canRemoveMembers: boolean;
    canModifySettings: boolean;
    canDeleteInventory: boolean;
    canManageItems: boolean;
    canViewItems: boolean;
    canViewMembers: boolean;
  };
  // Enriched user profile information
  userProfile?: {
    email: string;
    displayName: string;
    username: string;
  } | null;
  addedByProfile?: {
    email: string;
    displayName: string;
    username: string;
  } | null;
  updatedByProfile?: {
    email: string;
    displayName: string;
    username: string;
  } | null;
}

export interface UserProfile {
  userId: string; // UUID from Cognito
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  userStatus: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  found?: boolean; // For lookup responses
}

export interface UserLookupResult {
  found: boolean;
  userId?: string;
  email?: string;
  username?: string;
  displayName?: string;
  emailVerified?: boolean;
  userStatus?: string;
  message?: string;
}

export interface Invitation {
  invitationId: string;
  inventoryId: string;
  email: string;
  role: 'member' | 'administrator' | 'read_only';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// Container types for Moving & Storage System
export const ContainerType = {
  Box: 'box',
  Bag: 'bag',
  Crate: 'crate',
  Bin: 'bin',
  Suitcase: 'suitcase',
  Trunk: 'trunk',
  Custom: 'custom'
} as const;

export type ContainerType = typeof ContainerType[keyof typeof ContainerType];

export const HandlingFlag = {
  Fragile: 'fragile',
  Heavy: 'heavy',
  Valuable: 'valuable',
  Priority: 'priority',
  KeepUpright: 'keep_upright',
  TemperatureSensitive: 'temperature_sensitive'
} as const;

export type HandlingFlag = typeof HandlingFlag[keyof typeof HandlingFlag];

export const ContainerStatus = {
  Empty: 'empty',
  Packing: 'packing',
  Packed: 'packed',
  InTransit: 'in_transit',
  Stored: 'stored',
  Unpacking: 'unpacking',
  Unpacked: 'unpacked'
} as const;

export type ContainerStatus = typeof ContainerStatus[keyof typeof ContainerStatus];

export interface Container {
  id: string;                    // UUID
  inventoryId: string;           // Reference to inventory
  projectId?: string;            // Optional project assignment
  name: string;                  // User-defined name
  type: ContainerType;           // Box, Bag, Crate, etc.
  size?: string;                 // Small, Medium, Large, Custom
  color?: string;                // Visual identifier
  description?: string;          // Additional notes
  contentsSummary?: string;      // Brief description of container contents (max 200 chars)
  photos?: string[];             // Array of S3 keys for container photos
  qrCode: string;                // Unique QR code identifier
  qrCodeUrl?: string;            // S3 URL for QR code image
  locationId?: string;           // Current location
  handlingFlags: HandlingFlag[]; // Fragile, Heavy, Valuable, etc.
  itemCount: number;             // Number of items in container
  estimatedValue: number;        // Total value of contents
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  updatedBy: string;             // User ID
  status: ContainerStatus;       // Packed, InTransit, Stored, Unpacked
  storageStartDate?: string;     // When moved to storage
  storageRate?: number;          // Cost per month
  metadata: Record<string, any>; // Extensible metadata
}

// Moving Project types
export const ProjectStatus = {
  Planning: 'planning',
  Active: 'active',
  Paused: 'paused',
  Completed: 'completed',
  Archived: 'archived'
} as const;

export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export interface MovingProject {
  id: string;                    // UUID
  inventoryId: string;           // Reference to inventory
  name: string;                  // Project name
  description?: string;          // Project details
  startDate: string;             // ISO timestamp
  targetDate?: string;           // Target completion date
  completionDate?: string;       // Actual completion date
  status: ProjectStatus;         // Planning, Active, Completed, Archived
  sourceLocation?: string;       // Origin location
  destinationLocation?: string;  // Target location
  containerCount: number;        // Number of containers
  itemCount: number;             // Number of items
  completionPercentage: number;  // 0-100
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  metadata: Record<string, any>; // Extensible metadata
}

// Container-Item relationship
export interface ContainerItem {
  containerId: string;           // Container reference
  itemId: string;                // Thing reference
  addedAt: string;               // ISO timestamp
  addedBy: string;               // User ID
  position?: number;             // Optional ordering
}

// Extended Thing entity with container reference
export interface ThingWithContainer extends Thing {
  containerId?: string;          // Current container (if packed)
  packedAt?: string;             // When added to container
  previousLocationId?: string;   // Location before packing
  tags?: string[];               // Inherited from Thing, but explicitly included for clarity
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tag-related interfaces for search and analytics
export interface TagAnalytics {
  inventoryId: string;
  totalTags: number;
  uniqueTags: number;
  totalThings: number;
  taggedThings: number;
  tagStatistics: TagStatistic[];
  lastUpdated: string;
}

export interface TagStatistic {
  tag: string;
  count: number;
  percentage: number;
  firstUsed: string;
  lastUsed: string;
}

export interface SearchQuery {
  text?: string;
  tags?: string[];
  tagMode: 'and' | 'or';
  categoryId?: string;
  locationId?: string;
  partialMatch?: boolean;
}

// Tag autocomplete response
export interface TagSuggestions {
  tags: string[];
}
