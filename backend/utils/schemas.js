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
    required: true,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  },
  name: {
    type: 'string',
    required: true,
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
    purchaseDate: {
      type: 'string'
    },
    warrantyExpiration: {
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
        maxLength: 500
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
        maxLength: 500
      }
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
    inventoryId: commonFields.inventoryId,
    name: commonFields.name,
    description: commonFields.description,
    locationId: {
      type: 'string',
      required: true,
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
        maxLength: 500
      }
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
    email: {
      type: 'string',
      maxLength: 255,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
        maxLength: 500
      }
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

module.exports = {
  thingSchema,
  locationSchema,
  roomSchema,
  categorySchema,
  personSchema,
  inventorySchema
};