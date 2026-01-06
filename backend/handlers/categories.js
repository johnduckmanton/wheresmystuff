const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize, decodeHtmlEntities } = require('../utils/validation');

/**
 * Decode HTML entities in category fields for backward compatibility
 * @param {Object} category - Category object to decode
 * @returns {Object} Category with decoded fields
 */
function decodeCategoryFields(category) {
  if (!category) return category;
  
  // Decode text fields
  if (category.name) category.name = decodeHtmlEntities(category.name);
  if (category.description) category.description = decodeHtmlEntities(category.description);
  if (category.icon) category.icon = decodeHtmlEntities(category.icon);
  
  // Decode photo keys
  if (category.photos && Array.isArray(category.photos)) {
    category.photos = category.photos.map(photo => decodeHtmlEntities(photo));
  }
  
  return category;
}
const { categorySchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');

const ENTITY_TYPE = 'CATEGORIES';

/**
 * Lambda handler for Categories CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Categories
 */
const categoriesHandler = async (event) => {
  const context = {
    endpoint: '/categories',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      body: event.body ? JSON.parse(event.body) : null
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    const pathParameters = event.pathParameters || {};
    
    // Route to appropriate handler based on HTTP method
    switch (httpMethod) {
      case 'GET':
        return await handleGet(event);
      case 'POST':
        // Check if this is a CSV import request
        const body = event.body ? JSON.parse(event.body) : {};
        if (body.csvData) {
          return await handleImportCSV(event);
        }
        return await handleCreate(event);
      case 'PUT':
        return await handleUpdate(event, pathParameters.id);
      case 'DELETE':
        return await handleDelete(event, pathParameters.id);
      default:
        return error('Method not allowed', 405);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context);
  }
};

/**
 * Handle GET request - List all categories for an inventory
 */
async function handleGet(event) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    const categories = await listEntities(ENTITY_TYPE, inventoryId);
    
    // Decode HTML entities for backward compatibility
    categories.forEach(decodeCategoryFields);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'categories', 'list', inventoryId);
    
    return success(categories);
  } catch (err) {
    console.error('Error listing categories:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to retrieve categories');
  }
}

/**
 * Handle POST request - Create a new category
 */
async function handleCreate(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, categorySchema);
    if (!validation.valid) {
      const validationErrorResponse = createValidationErrorResponse(validation.errors);
      return {
        statusCode: validationErrorResponse.statusCode,
        headers: getAllHeaders(),
        body: JSON.stringify({
          success: false,
          error: validationErrorResponse.error,
          requestId: validationErrorResponse.requestId
        })
      };
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Create the category
    const category = await createEntity(ENTITY_TYPE, sanitizedData);
    
    // Decode HTML entities for backward compatibility
    decodeCategoryFields(category);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'categories', category.id, sanitizedData.inventoryId);
    
    return success(category, 201);
  } catch (err) {
    console.error('Error creating category:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to create category');
  }
}

/**
 * Handle PUT request - Update an existing category
 */
async function handleUpdate(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid category ID', 400);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, categorySchema);
    if (!validation.valid) {
      const validationErrorResponse = createValidationErrorResponse(validation.errors);
      return {
        statusCode: validationErrorResponse.statusCode,
        headers: getAllHeaders(),
        body: JSON.stringify({
          success: false,
          error: validationErrorResponse.error,
          requestId: validationErrorResponse.requestId
        })
      };
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Update the category
    const category = await updateEntity(ENTITY_TYPE, sanitizedData.inventoryId, id, sanitizedData);
    
    // Decode HTML entities for backward compatibility
    decodeCategoryFields(category);
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'categories', id, sanitizedData.inventoryId);
    
    return success(category);
  } catch (err) {
    console.error('Error updating category:', err);
    
    if (err.message === 'Entity not found') {
      return error('Category not found', 404);
    }
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to update category');
  }
}

/**
 * Handle CSV import - Import categories from CSV data
 */
async function handleImportCSV(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { csvData, inventoryId } = body;
    
    if (!csvData || !inventoryId) {
      return error('csvData and inventoryId are required', 400);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Parse CSV data
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return error('CSV must contain at least a header row and one data row', 400);
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const expectedHeaders = ['name', 'description', 'color', 'icon'];
    
    // Validate headers
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return error(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
    }
    
    // Get existing categories to check for duplicates
    const existingCategories = await listEntities(ENTITY_TYPE, inventoryId);
    const existingCategoryMap = new Map();
    existingCategories.forEach(cat => {
      existingCategoryMap.set(cat.name.toLowerCase(), cat);
    });
    
    const results = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      try {
        // Parse CSV row (simple CSV parser for quoted fields)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              // Escaped quote
              current += '"';
              j++; // Skip next quote
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim()); // Add last value
        
        // Create category object
        const categoryData = {};
        headers.forEach((header, index) => {
          if (values[index] !== undefined) {
            categoryData[header] = values[index];
          }
        });
        
        // Add required fields
        categoryData.inventoryId = inventoryId;
        
        // Validate the category data
        const validation = validateAndSanitize(categoryData, categorySchema);
        if (!validation.valid) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: ${validation.errors.map(e => e.message).join(', ')}`);
          continue;
        }
        
        // Check if category exists (case-insensitive name match)
        const existingCategory = existingCategoryMap.get(validation.data.name.toLowerCase());
        
        if (existingCategory) {
          // Update existing category
          await updateEntity(ENTITY_TYPE, inventoryId, existingCategory.id, validation.data);
          results.updated++;
        } else {
          // Create new category
          await createEntity(ENTITY_TYPE, validation.data);
          results.imported++;
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'categories', 'bulk-import', inventoryId);
    
    const totalProcessed = results.imported + results.updated;
    return success({
      message: `Import completed: ${results.imported} new, ${results.updated} updated, ${results.failed} failed`,
      imported: results.imported,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors,
      totalProcessed
    });
    
  } catch (err) {
    console.error('Error importing categories from CSV:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to import categories from CSV');
  }
}

/**
 * Handle DELETE request - Delete a category
 */
async function handleDelete(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid category ID', 400);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Check if category exists before deleting
    const category = await getEntity(ENTITY_TYPE, inventoryId, id);
    if (!category) {
      return error('Category not found', 404);
    }
    
    // Delete the category
    await deleteEntity(ENTITY_TYPE, inventoryId, id);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'categories', id, inventoryId);
    
    return success({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to delete category');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(categoriesHandler);
