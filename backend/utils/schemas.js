/**
 * Schema definitions for entity validation
 */

// Common field schemas
const commonFields = {
  id: {
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  },
  inventoryId: {
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  },
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 255
  },
  description: {
    type: 'string',
    maxLength: 1000
  },
  createdAt: {
    type: 'string'
  },
  updatedAt: {
    type: 'string'
  }
};

// Thing schema
const thingSchema = {
  type: 'object',
  required: ['name', 'inventoryId'],
  properties: {
    id: commonFields.id,
    inventoryId: commonFields.inventoryId,
    name: commonFields.name,
    description: commonFields.description,
    locationId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    roomId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    categoryId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    ownerId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    value: {
      type: 'number',
      min: 0
    },
    purchasePrice: {
      type: 'number',
      min: 0
    },
    datePurchased: {
      type: 'string'
    },
    purchasedFrom: {
      type: 'string',
      maxLength: 200
    },
    warrantyDetails: {
      type: 'string',
      maxLength: 500
    },
    disposalDate: {
      type: 'string'
    },
    nextReviewDate: {
      type: 'string'
    },
    serialNumber: {
      type: 'string',
      maxLength: 100
    },
    model: {
      type: 'string',
      maxLength: 100
    },
    brand: {
      type: 'string',
      maxLength: 100
    },
    condition: {
      type: 'string',
      maxLength: 50
    },
    notes: {
      type: 'string',
      maxLength: 2000
    },
    photos: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        maxLength: 500,
        noSanitize: true
      }
    },
    tags: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'string',
        maxLength: 50
      }
    },
    // Container reference fields for Moving & Storage System
    containerId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    packedAt: {
      type: 'string'
    },
    previousLocationId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    dateAdded: {
      type: 'string'
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Location schema
const locationSchema = {
  type: 'object',
  required: ['name', 'inventoryId'],
  properties: {
    id: commonFields.id,
    inventoryId: commonFields.inventoryId,
    name: commonFields.name,
    description: commonFields.description,
    address: {
      type: 'string',
      maxLength: 500
    },
    addressLine1: {
      type: 'string',
      maxLength: 200
    },
    addressLine2: {
      type: 'string',
      maxLength: 200
    },
    town: {
      type: 'string',
      maxLength: 100
    },
    county: {
      type: 'string',
      maxLength: 100
    },
    postcode: {
      type: 'string',
      maxLength: 20
    },
    country: {
      type: 'string',
      maxLength: 2
    },
    type: {
      type: 'string',
      maxLength: 50
    },
    notes: {
      type: 'string',
      maxLength: 2000
    },
    photos: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        maxLength: 500,
        noSanitize: true
      }
    },
    dateAdded: {
      type: 'string'
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Room schema
const roomSchema = {
  type: 'object',
  required: ['name', 'inventoryId', 'locationId'],
  properties: {
    id: commonFields.id,
    inventoryId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    name: commonFields.name,
    description: commonFields.description,
    locationId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    floor: {
      type: 'string',
      maxLength: 50
    },
    type: {
      type: 'string',
      maxLength: 50
    },
    notes: {
      type: 'string',
      maxLength: 2000
    },
    photos: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        maxLength: 500,
        noSanitize: true
      }
    },
    dateAdded: {
      type: 'string'
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Category schema
const categorySchema = {
  type: 'object',
  required: ['name', 'inventoryId'],
  properties: {
    id: commonFields.id,
    inventoryId: commonFields.inventoryId,
    name: commonFields.name,
    description: commonFields.description,
    color: {
      type: 'string',
      maxLength: 7,
      pattern: /^#[0-9A-Fa-f]{6}$/
    },
    icon: {
      type: 'string',
      maxLength: 50
    },
    dateAdded: {
      type: 'string'
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Person schema
const personSchema = {
  type: 'object',
  required: ['name', 'inventoryId'],
  properties: {
    id: commonFields.id,
    inventoryId: commonFields.inventoryId,
    name: commonFields.name,
    description: commonFields.description,
    email: {
      type: 'string',
      maxLength: 255,
      pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    },
    phone: {
      type: 'string',
      maxLength: 20
    },
    relationship: {
      type: 'string',
      maxLength: 100
    },
    notes: {
      type: 'string',
      maxLength: 2000
    },
    photos: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'string',
        maxLength: 500,
        noSanitize: true
      }
    },
    dateAdded: {
      type: 'string'
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Inventory schema
const inventorySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    id: commonFields.id,
    name: commonFields.name,
    description: commonFields.description,
    ownerId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Container schema
const containerSchema = {
  type: 'object',
  required: ['name', 'inventoryId', 'createdBy'],
  properties: {
    id: commonFields.id,
    inventoryId: commonFields.inventoryId,
    projectId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    name: commonFields.name,
    type: {
      type: 'string',
      enum: ['box', 'bag', 'crate', 'bin', 'suitcase', 'trunk', 'custom']
    },
    size: {
      type: 'string',
      maxLength: 50
    },
    color: {
      type: 'string',
      maxLength: 7,
      pattern: /^#[0-9A-Fa-f]{6}$/
    },
    description: commonFields.description,
    contentsSummary: {
      type: 'string',
      maxLength: 200,
      sanitize: true,
      trim: true
    },
    qrCode: {
      type: 'string',
      maxLength: 100
    },
    qrCodeUrl: {
      type: 'string',
      maxLength: 500
    },
    locationId: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    handlingFlags: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        enum: ['fragile', 'heavy', 'valuable', 'priority', 'keep_upright', 'temperature_sensitive']
      }
    },
    itemCount: {
      type: 'number',
      min: 0
    },
    estimatedValue: {
      type: 'number',
      min: 0
    },
    createdBy: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    updatedBy: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    status: {
      type: 'string',
      enum: ['empty', 'packing', 'packed', 'in_transit', 'stored', 'unpacking', 'unpacked']
    },
    storageStartDate: {
      type: 'string'
    },
    storageRate: {
      type: 'number',
      min: 0
    },
    metadata: {
      type: 'object'
    },
    photos: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        maxLength: 500,
        noSanitize: true
      }
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

// Container Sharing schema
const containerSharingSchema = {
  type: 'object',
  required: ['inventoryId'],
  properties: {
    inventoryId: commonFields.inventoryId,
    expiresAt: {
      type: 'string'
    },
    includeItemDetails: {
      type: 'boolean'
    },
    includePhotos: {
      type: 'boolean'
    },
    includeSensitiveData: {
      type: 'boolean'
    },
    maxAccesses: {
      type: 'number',
      min: 1,
      max: 1000
    },
    description: {
      type: 'string',
      maxLength: 500
    },
    allowedDomains: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        maxLength: 100
      }
    }
  },
  additionalProperties: false
};

// Moving Project schema
const movingProjectSchema = {
  type: 'object',
  required: ['name', 'inventoryId', 'createdBy'],
  properties: {
    id: commonFields.id,
    inventoryId: commonFields.inventoryId,
    name: commonFields.name,
    description: {
      type: 'string',
      maxLength: 1000
    },
    startDate: {
      type: 'string'
    },
    targetDate: {
      type: 'string'
    },
    completionDate: {
      type: 'string'
    },
    status: {
      type: 'string',
      enum: ['planning', 'active', 'paused', 'completed', 'archived']
    },
    sourceLocation: {
      type: 'string',
      maxLength: 200
    },
    destinationLocation: {
      type: 'string',
      maxLength: 200
    },
    containerCount: {
      type: 'number',
      min: 0
    },
    itemCount: {
      type: 'number',
      min: 0
    },
    completionPercentage: {
      type: 'number',
      min: 0,
      max: 100
    },
    createdBy: {
      type: 'string',
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    metadata: {
      type: 'object'
    },
    createdAt: commonFields.createdAt,
    updatedAt: commonFields.updatedAt
  },
  additionalProperties: false
};

module.exports = {
  thingSchema,
  locationSchema,
  roomSchema,
  categorySchema,
  personSchema,
  inventorySchema,
  containerSchema,
  movingProjectSchema,
  containerSharingSchema
};