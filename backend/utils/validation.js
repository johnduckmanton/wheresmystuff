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
 * Enhanced email validation with detailed error messages
 * @param {string} email - Email address to validate
 * @returns {object} { valid: boolean, error: string|null, normalizedEmail: string|null }
 */
function validateEmail(email) {
  if (!email) {
    return {
      valid: false,
      error: 'Email address is required',
      normalizedEmail: null
    };
  }

  if (typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email must be a text value',
      normalizedEmail: null
    };
  }

  const trimmedEmail = email.trim();
  
  if (trimmedEmail.length === 0) {
    return {
      valid: false,
      error: 'Email address cannot be empty',
      normalizedEmail: null
    };
  }

  if (trimmedEmail.length > 254) {
    return {
      valid: false,
      error: 'Email address is too long (maximum 254 characters)',
      normalizedEmail: null
    };
  }

  // More detailed validation first
  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Email address must contain exactly one @ symbol',
      normalizedEmail: null
    };
  }

  const [localPart, domainPart] = parts;

  // Local part validation
  if (localPart.length === 0) {
    return {
      valid: false,
      error: 'Email address must have a username before the @ symbol',
      normalizedEmail: null
    };
  }

  if (localPart.length > 64) {
    return {
      valid: false,
      error: 'Email username part is too long (maximum 64 characters)',
      normalizedEmail: null
    };
  }

  // Domain part validation
  if (domainPart.length === 0) {
    return {
      valid: false,
      error: 'Email address must have a domain after the @ symbol',
      normalizedEmail: null
    };
  }

  if (domainPart.length > 253) {
    return {
      valid: false,
      error: 'Email domain part is too long (maximum 253 characters)',
      normalizedEmail: null
    };
  }

  // Check for at least one dot in domain
  if (!domainPart.includes('.')) {
    return {
      valid: false,
      error: 'Email domain must contain at least one dot (e.g., example.com)',
      normalizedEmail: null
    };
  }

  // Check for obvious typos in common domains before general format validation
  const domainLower = domainPart.toLowerCase();
  
  // Simple typo detection for common domains
  if (domainLower.includes('gmial') || domainLower.includes('gmai.')) {
    return { valid: false, error: 'Did you mean gmail.com?', normalizedEmail: null };
  }
  if (domainLower.includes('yahooo') || domainLower.includes('yaho.')) {
    return { valid: false, error: 'Did you mean yahoo.com?', normalizedEmail: null };
  }
  if (domainLower.includes('hotmial') || domainLower.includes('hotmai.')) {
    return { valid: false, error: 'Did you mean hotmail.com?', normalizedEmail: null };
  }

  // Basic format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return {
      valid: false,
      error: 'Please enter a valid email address (e.g., user@example.com)',
      normalizedEmail: null
    };
  }

  // Check for valid domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(domainPart)) {
    return {
      valid: false,
      error: 'Email domain contains invalid characters or format',
      normalizedEmail: null
    };
  }

  // Normalize email (lowercase)
  const normalizedEmail = trimmedEmail.toLowerCase();

  return {
    valid: true,
    error: null,
    normalizedEmail
  };
}

/**
 * Validate user role with detailed error messages
 * @param {string} role - Role to validate
 * @returns {object} { valid: boolean, error: string|null, normalizedRole: string|null }
 */
function validateUserRole(role) {
  const validRoles = ['owner', 'administrator', 'member', 'read_only'];
  
  if (!role) {
    return {
      valid: false,
      error: 'User role is required',
      normalizedRole: null
    };
  }

  if (typeof role !== 'string') {
    return {
      valid: false,
      error: 'User role must be a text value',
      normalizedRole: null
    };
  }

  const normalizedRole = role.trim().toLowerCase();
  
  if (!validRoles.includes(normalizedRole)) {
    return {
      valid: false,
      error: `Invalid user role. Must be one of: ${validRoles.join(', ')}`,
      normalizedRole: null
    };
  }

  return {
    valid: true,
    error: null,
    normalizedRole
  };
}

/**
 * Validate invitation token format
 * @param {string} token - Token to validate
 * @returns {object} { valid: boolean, error: string|null }
 */
function validateInvitationToken(token) {
  if (!token) {
    return {
      valid: false,
      error: 'Invitation token is required'
    };
  }

  if (typeof token !== 'string') {
    return {
      valid: false,
      error: 'Invitation token must be a text value'
    };
  }

  const trimmedToken = token.trim();
  
  if (trimmedToken.length === 0) {
    return {
      valid: false,
      error: 'Invitation token cannot be empty'
    };
  }

  // Check for base64url format (alphanumeric + - and _)
  const tokenRegex = /^[A-Za-z0-9_-]+$/;
  if (!tokenRegex.test(trimmedToken)) {
    return {
      valid: false,
      error: 'Invalid invitation token format'
    };
  }

  // Check reasonable length (should be 43 characters for 32 bytes base64url)
  if (trimmedToken.length < 20 || trimmedToken.length > 100) {
    return {
      valid: false,
      error: 'Invalid invitation token length'
    };
  }

  return {
    valid: true,
    error: null
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
 * Strip dangerous HTML tags and their contents from a string.
 * Handles script, iframe, object, embed, link, meta, style tags.
 * @param {string} str - String to strip tags from
 * @returns {string} String with dangerous tags removed
 */
function stripDangerousTags(str) {
  const dangerousTagsWithContent = ['script', 'iframe', 'object', 'style'];
  const dangerousSelfClosingTags = ['embed', 'link', 'meta'];

  // Remove tags that can have content (strip tag + contents)
  for (const tag of dangerousTagsWithContent) {
    // Match opening tag with any attributes, content, and closing tag
    const contentRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    str = str.replace(contentRegex, '');
    // Remove any remaining self-closing or unclosed variants
    const selfCloseRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    str = str.replace(selfCloseRegex, '');
  }

  // Remove self-closing/void tags (embed, link, meta)
  for (const tag of dangerousSelfClosingTags) {
    const tagRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    str = str.replace(tagRegex, '');
  }

  return str;
}

/**
 * Remove event handler attributes (on*=...) from any remaining HTML-like content.
 * Handles both quoted and unquoted attribute values.
 * @param {string} str - String to remove event handlers from
 * @returns {string} String with event handler attributes removed
 */
function removeEventHandlers(str) {
  // Remove on*="..." or on*='...' (quoted values)
  str = str.replace(/\s+on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  // Remove on*=value (unquoted values)
  str = str.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  return str;
}

/**
 * Sanitize string input to prevent XSS attacks.
 * Uses tag-stripping approach instead of HTML entity encoding to preserve
 * literal characters like &, ', /, ", <, > in stored data.
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

  // Strip dangerous HTML tags and their contents
  sanitized = stripDangerousTags(sanitized);

  // Remove event handler attributes (on*)
  sanitized = removeEventHandlers(sanitized);

  // Remove javascript: protocol (case insensitive)
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Check length on the actual character count (after sanitization)
  if (maxLength && sanitized.length > maxLength) {
    throw new Error(`String exceeds maximum length of ${maxLength} characters`);
  }

  return sanitized;
}

/**
 * Decode HTML entities in a string
 * @deprecated No longer needed for new writes since sanitizeString() no longer encodes entities.
 * Kept for backward compatibility during migration of existing encoded data.
 * @param {string} str - String to decode
 * @returns {string} Decoded string
 */
function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
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
    
    // Skip sanitization if noSanitize flag is set (e.g., for S3 keys)
    // sanitizeString() enforces maxLength internally and throws if exceeded
    const sanitized = schema.noSanitize ? data : sanitizeString(data, schema.maxLength);
    
    // Length validation for noSanitize fields (sanitizeString handles this internally for sanitized fields)
    if (schema.noSanitize && schema.maxLength && sanitized.length > schema.maxLength) {
      throw new Error(`${path || 'Field'} exceeds maximum length of ${schema.maxLength} characters`);
    }
    
    if (schema.minLength && sanitized.length < schema.minLength) {
      throw new Error(`${path || 'Field'} must be at least ${schema.minLength} characters`);
    }
    
    // Check for empty string after trimming (common requirement)
    if (schema.required && sanitized.trim().length === 0) {
      throw new Error(`${path || 'Field'} cannot be empty`);
    }
    
    // Pattern validation on sanitized string (skip for empty strings unless required)
    if (schema.pattern && sanitized.length > 0 && !schema.pattern.test(sanitized)) {
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

/**
 * Normalize and validate a tag name according to requirements
 * @param {string} tag - Tag name to normalize
 * @returns {object} { valid: boolean, normalizedTag: string|null, error: string|null }
 */
function normalizeAndValidateTag(tag) {
  if (!tag) {
    return {
      valid: false,
      normalizedTag: null,
      error: 'Tag cannot be empty'
    };
  }

  if (typeof tag !== 'string') {
    return {
      valid: false,
      normalizedTag: null,
      error: 'Tag must be a text value'
    };
  }

  // Trim whitespace
  const trimmed = tag.trim();
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      normalizedTag: null,
      error: 'Tag cannot be empty'
    };
  }

  // Check length limit (Requirement 2.3)
  if (trimmed.length > 50) {
    return {
      valid: false,
      normalizedTag: null,
      error: 'Tag cannot exceed 50 characters'
    };
  }

  // Check allowed characters (Requirement 2.1)
  const allowedCharsRegex = /^[a-zA-Z0-9_-]+$/;
  if (!allowedCharsRegex.test(trimmed)) {
    return {
      valid: false,
      normalizedTag: null,
      error: 'Tag can only contain letters, numbers, hyphens, and underscores'
    };
  }

  // Normalize to lowercase (Requirement 2.4)
  const normalized = trimmed.toLowerCase();

  return {
    valid: true,
    normalizedTag: normalized,
    error: null
  };
}

/**
 * Validate and normalize an array of tags
 * @param {Array<string>} tags - Array of tag names
 * @returns {object} { valid: boolean, normalizedTags: Array<string>|null, errors: Array<string> }
 */
function validateAndNormalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return {
      valid: false,
      normalizedTags: null,
      errors: ['Tags must be an array']
    };
  }

  const normalizedTags = [];
  const errors = [];
  const seenTags = new Set();

  for (let i = 0; i < tags.length; i++) {
    const tagResult = normalizeAndValidateTag(tags[i]);
    
    if (!tagResult.valid) {
      errors.push(`Tag ${i + 1}: ${tagResult.error}`);
      continue;
    }

    // Check for duplicates (Requirement 7.1)
    if (seenTags.has(tagResult.normalizedTag)) {
      errors.push(`Tag ${i + 1}: Duplicate tag "${tagResult.normalizedTag}"`);
      continue;
    }

    seenTags.add(tagResult.normalizedTag);
    normalizedTags.push(tagResult.normalizedTag);
  }

  return {
    valid: errors.length === 0,
    normalizedTags: errors.length === 0 ? normalizedTags : null,
    errors
  };
}

module.exports = {
  validateRequired,
  validateUUID,
  sanitizeInput,
  sanitizeString,
  validateSchema,
  validateAndSanitize,
  decodeHtmlEntities,
  validateEmail,
  validateUserRole,
  validateInvitationToken,
  normalizeAndValidateTag,
  validateAndNormalizeTags
};
