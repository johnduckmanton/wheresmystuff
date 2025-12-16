/**
 * Validate that required fields are present in the data object
 * @param {object} data - Data object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {object} { valid: boolean, errors: Array<string> }
 */
function validateRequired(data, requiredFields) {
  const errors = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      errors.push(`${field} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate UUID format
 * @param {string} id - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
function validateUUID(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Sanitize string input to prevent XSS attacks
 * @param {string} input - String to sanitize
 * @param {number} maxLength - Maximum allowed length (optional)
 * @returns {string} Sanitized string
 */
function sanitizeString(input, maxLength = null) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Check length limit
  if (maxLength && sanitized.length > maxLength) {
    throw new Error(`String exceeds maximum length of ${maxLength} characters`);
  }
  
  // Encode HTML special characters first (this will handle < > & " ' /)
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // After encoding, remove javascript: protocol (case insensitive)
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  return sanitized;
}

/**
 * Validate data against a schema with type checking
 * @param {any} data - Data to validate
 * @param {object} schema - Schema definition
 * @returns {object} { valid: boolean, errors: Array<string>, sanitizedData: any }
 */
function validateSchema(data, schema) {
  const errors = [];
  let sanitizedData = null;
  
  try {
    sanitizedData = validateAndSanitizeRecursive(data, schema, '');
  } catch (error) {
    errors.push(error.message);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : null
  };
}

/**
 * Recursively validate and sanitize data against schema
 * @param {any} data - Data to validate
 * @param {object} schema - Schema definition
 * @param {string} path - Current path for error reporting
 * @returns {any} Sanitized data
 */
function validateAndSanitizeRecursive(data, schema, path) {
  // Handle null/undefined
  if (data === null || data === undefined) {
    if (schema.required) {
      throw new Error(`${path || 'Field'} is required`);
    }
    return data;
  }
  
  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (actualType !== schema.type) {
      throw new Error(`${path || 'Field'} must be of type ${schema.type}, got ${actualType}`);
    }
  }
  
  // String validation and sanitization
  if (schema.type === 'string') {
    if (typeof data !== 'string') {
      throw new Error(`${path || 'Field'} must be a string`);
    }
    
    // Sanitize string first
    const sanitized = sanitizeString(data, schema.maxLength);
    
    // Length validation on sanitized string
    if (schema.maxLength && sanitized.length > schema.maxLength) {
      throw new Error(`${path || 'Field'} exceeds maximum length of ${schema.maxLength} characters`);
    }
    
    if (schema.minLength && sanitized.length < schema.minLength) {
      throw new Error(`${path || 'Field'} must be at least ${schema.minLength} characters`);
    }
    
    // Check for empty string after trimming (common requirement)
    if (schema.required && sanitized.trim().length === 0) {
      throw new Error(`${path || 'Field'} cannot be empty`);
    }
    
    // Pattern validation on sanitized string
    if (schema.pattern && !schema.pattern.test(sanitized)) {
      throw new Error(`${path || 'Field'} does not match required pattern`);
    }
    
    return sanitized;
  }
  
  // Number validation
  if (schema.type === 'number') {
    if (typeof data !== 'number' || isNaN(data)) {
      throw new Error(`${path || 'Field'} must be a valid number`);
    }
    
    if (schema.min !== undefined && data < schema.min) {
      throw new Error(`${path || 'Field'} must be at least ${schema.min}`);
    }
    
    if (schema.max !== undefined && data > schema.max) {
      throw new Error(`${path || 'Field'} must be at most ${schema.max}`);
    }
    
    return data;
  }
  
  // Boolean validation
  if (schema.type === 'boolean') {
    if (typeof data !== 'boolean') {
      throw new Error(`${path || 'Field'} must be a boolean`);
    }
    return data;
  }
  
  // Array validation
  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      throw new Error(`${path || 'Field'} must be an array`);
    }
    
    if (schema.maxItems && data.length > schema.maxItems) {
      throw new Error(`${path || 'Field'} cannot have more than ${schema.maxItems} items`);
    }
    
    if (schema.minItems && data.length < schema.minItems) {
      throw new Error(`${path || 'Field'} must have at least ${schema.minItems} items`);
    }
    
    // Validate array items
    if (schema.items) {
      return data.map((item, index) => 
        validateAndSanitizeRecursive(item, schema.items, `${path}[${index}]`)
      );
    }
    
    return data;
  }
  
  // Object validation
  if (schema.type === 'object') {
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`${path || 'Field'} must be an object`);
    }
    
    const sanitized = {};
    
    // Validate required properties
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in data)) {
          throw new Error(`${path ? `${path}.` : ''}${requiredField} is required`);
        }
      }
    }
    
    // Validate properties
    if (schema.properties) {
      for (const [key, value] of Object.entries(data)) {
        const fieldPath = path ? `${path}.${key}` : key;
        
        if (schema.properties[key]) {
          // Create a field schema with required flag from the property definition
          const fieldSchema = { ...schema.properties[key] };
          sanitized[key] = validateAndSanitizeRecursive(value, fieldSchema, fieldPath);
        } else if (!schema.additionalProperties) {
          throw new Error(`${fieldPath} is not allowed`);
        } else {
          // If additionalProperties is true or a schema, validate accordingly
          if (typeof schema.additionalProperties === 'object') {
            sanitized[key] = validateAndSanitizeRecursive(value, schema.additionalProperties, fieldPath);
          } else {
            sanitized[key] = value;
          }
        }
      }
    } else {
      // No properties defined, copy all fields
      Object.assign(sanitized, data);
    }
    
    return sanitized;
  }
  
  // Default: return data as-is
  return data;
}

/**
 * Sanitize user input by trimming whitespace and removing potentially harmful characters
 * @param {object} data - Data object to sanitize
 * @returns {object} Sanitized data object
 */
function sanitizeInput(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Use enhanced string sanitization
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : 
        (item && typeof item === 'object') ? sanitizeInput(item) : item
      );
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Combined validation and sanitization function
 * @param {any} data - Data to validate and sanitize
 * @param {object} schema - Schema definition
 * @returns {object} { valid: boolean, data: any, errors: Array<string> }
 */
function validateAndSanitize(data, schema) {
  const result = validateSchema(data, schema);
  
  return {
    valid: result.valid,
    data: result.sanitizedData,
    errors: result.errors
  };
}

module.exports = {
  validateRequired,
  validateUUID,
  sanitizeInput,
  sanitizeString,
  validateSchema,
  validateAndSanitize
};
