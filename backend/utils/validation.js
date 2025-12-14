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
      // Trim whitespace
      sanitized[key] = value.trim();
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? item.trim() : item
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

module.exports = {
  validateRequired,
  validateUUID,
  sanitizeInput
};
