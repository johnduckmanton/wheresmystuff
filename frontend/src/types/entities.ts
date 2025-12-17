// Entity type definitions based on the design document

export interface Thing {
  id: string; // UUID
  inventoryId: string; // UUID reference to inventory
  name: string; // Required
  description?: string;
  serialNumber?: string;
  locationId?: string; // UUID reference
  roomId?: string; // UUID reference
  ownerId?: string; // UUID reference (Person)
  categoryId?: string; // UUID reference
  notes?: string;
  datePurchased?: string; // ISO date
  purchasedFrom?: string;
  purchasePrice?: number; // Purchase price in local currency
  warrantyDetails?: string;
  disposalDate?: string; // ISO date
  nextReviewDate?: string; // ISO date
  photos?: string[]; // Array of S3 keys
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
