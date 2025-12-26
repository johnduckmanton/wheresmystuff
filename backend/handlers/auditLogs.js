const { queryAuditLogs } = require('../services/auditLogService');
const dataValidationService = require('../services/dataValidationService');
const { hasInventoryAccess } = require('../services/dynamodb');
const { success, error } = require('../utils/response');

/**
 * Simple request validation function
 * @param {string} body - Request body JSON string
 * @param {object} schema - Validation schema
 * @returns {object} Validation result
 */
function validateRequest(body, schema) {
  try {
    const data = JSON.parse(body || '{}');
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && (!data[field] || (Array.isArray(data[field]) && data[field].length === 0))) {
        errors.push(`${field} is required`);
        continue;
      }
      
      if (data[field] && rules.type === 'array') {
        if (!Array.isArray(data[field])) {
          errors.push(`${field} must be an array`);
        } else {
          if (rules.minItems && data[field].length < rules.minItems) {
            errors.push(`${field} must have at least ${rules.minItems} items`);
          }
          if (rules.maxItems && data[field].length > rules.maxItems) {
            errors.push(`${field} must have at most ${rules.maxItems} items`);
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data
    };
  } catch (err) {
    return {
      isValid: false,
      errors: ['Invalid JSON in request body'],
      data: null
    };
  }
}

/**
 * Get audit logs for an inventory with filtering options
 */
exports.getAuditLogs = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      return error('Access denied to inventory', 403);
    }
    
    // Parse query parameters
    const {
      eventType,
      action,
      startDate,
      endDate,
      limit = '50',
      userId: filterUserId
    } = event.queryStringParameters || {};
    
    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return error('Limit must be between 1 and 100', 400);
    }
    
    // Validate date format if provided
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return error('Start date must be in YYYY-MM-DD format', 400);
    }
    
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return error('End date must be in YYYY-MM-DD format', 400);
    }
    
    // Query audit logs
    const logs = await queryAuditLogs(inventoryId, {
      eventType,
      userId: filterUserId,
      action,
      startDate,
      endDate,
      limit: limitNum
    });
    
    return success({
      logs,
      count: logs.length,
      filters: {
        inventoryId,
        eventType,
        action,
        startDate,
        endDate,
        limit: limitNum,
        userId: filterUserId
      }
    });
    
  } catch (err) {
    console.error('Error getting audit logs:', err);
    return error('Failed to retrieve audit logs', 500);
  }
};

/**
 * Validate data consistency for an inventory
 */
exports.validateDataConsistency = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      return error('Access denied to inventory', 403);
    }
    
    // Perform validation
    const validationResult = await dataValidationService.validateContainerItemConsistency(
      inventoryId,
      userId
    );
    
    return success(validationResult);
    
  } catch (err) {
    console.error('Error validating data consistency:', err);
    return error('Failed to validate data consistency', 500);
  }
};

/**
 * Correct orphaned items
 */
exports.correctOrphanedItems = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      return error('Access denied to inventory', 403);
    }
    
    // Validate request body
    const validation = validateRequest(event.body, {
      itemIds: { type: 'array', required: true, minItems: 1, maxItems: 100 }
    });
    
    if (!validation.isValid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const { itemIds } = validation.data;
    
    // Perform correction
    const correctionResult = await dataValidationService.correctOrphanedItems(
      inventoryId,
      itemIds,
      userId
    );
    
    return success(correctionResult);
    
  } catch (err) {
    console.error('Error correcting orphaned items:', err);
    return error('Failed to correct orphaned items', 500);
  }
};

/**
 * Correct container count mismatches
 */
exports.correctContainerCounts = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      return error('Access denied to inventory', 403);
    }
    
    // Validate request body
    const validation = validateRequest(event.body, {
      containerIds: { type: 'array', required: true, minItems: 1, maxItems: 50 }
    });
    
    if (!validation.isValid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const { containerIds } = validation.data;
    
    // Perform correction
    const correctionResult = await dataValidationService.correctContainerCounts(
      inventoryId,
      containerIds,
      userId
    );
    
    return success(correctionResult);
    
  } catch (err) {
    console.error('Error correcting container counts:', err);
    return error('Failed to correct container counts', 500);
  }
};

/**
 * Correct location inconsistencies
 */
exports.correctLocationInconsistencies = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      return error('Access denied to inventory', 403);
    }
    
    // Validate request body
    const validation = validateRequest(event.body, {
      containerIds: { type: 'array', required: true, minItems: 1, maxItems: 50 }
    });
    
    if (!validation.isValid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const { containerIds } = validation.data;
    
    // Perform correction
    const correctionResult = await dataValidationService.correctLocationInconsistencies(
      inventoryId,
      containerIds,
      userId
    );
    
    return success(correctionResult);
    
  } catch (err) {
    console.error('Error correcting location inconsistencies:', err);
    return error('Failed to correct location inconsistencies', 500);
  }
};