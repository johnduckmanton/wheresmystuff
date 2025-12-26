const movingProjectService = require('../services/movingProjectService');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Moving Project operations
 * Handles CRUD operations for moving projects
 */
const projectsHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/projects',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      body: event.body
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    const pathParameters = event.pathParameters || {};
    
    // Route to appropriate handler based on HTTP method and path
    switch (httpMethod) {
      case 'GET':
        if (pathParameters.id) {
          return await handleGetProject(event, pathParameters.id, origin);
        } else {
          return await handleGetProjects(event, origin);
        }
      
      case 'POST':
        if (event.requestContext.http.path.includes('/containers')) {
          return await handleAssignContainers(event, pathParameters.id, origin);
        } else {
          return await handleCreateProject(event, origin);
        }
      
      case 'PUT':
        if (event.requestContext.http.path.includes('/status')) {
          return await handleUpdateProjectStatus(event, pathParameters.id, origin);
        } else {
          return await handleUpdateProject(event, pathParameters.id, origin);
        }
      
      case 'DELETE':
        if (event.requestContext.http.path.includes('/containers')) {
          return await handleRemoveContainers(event, pathParameters.id, origin);
        } else {
          return await handleDeleteProject(event, pathParameters.id, origin);
        }
      
      default:
        return error('Method not allowed', 405, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - Get all projects for an inventory
 */
async function handleGetProjects(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse optional filters
    const options = {};
    
    if (event.queryStringParameters?.status) {
      const status = sanitizeInput(event.queryStringParameters.status);
      const validStatuses = ['planning', 'active', 'paused', 'completed', 'archived'];
      if (validStatuses.includes(status)) {
        options.status = status;
      }
    }
    
    if (event.queryStringParameters?.limit) {
      const limit = parseInt(event.queryStringParameters.limit);
      if (limit > 0 && limit <= 100) {
        options.limit = limit;
      }
    }
    
    // Get projects
    const projects = await movingProjectService.getProjects(inventoryId, event.user.userId, options);
    
    return success(projects, 200, origin);
  } catch (err) {
    console.error('Error getting projects:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve projects');
  }
}

/**
 * Handle GET request - Get a specific project
 */
async function handleGetProject(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check if requesting progress data
    const includeProgress = event.queryStringParameters?.includeProgress === 'true';
    
    if (includeProgress) {
      // Get project with progress data
      const progressData = await movingProjectService.getProjectProgress(projectId, inventoryId, event.user.userId);
      return success(progressData, 200, origin);
    } else {
      // Get basic project data
      const project = await movingProjectService.getProject(projectId, inventoryId, event.user.userId);
      return success(project, 200, origin);
    }
  } catch (err) {
    console.error('Error getting project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve project');
  }
}

/**
 * Handle POST request - Create a new project
 */
async function handleCreateProject(event, origin) {
  try {
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const projectData = JSON.parse(event.body);
    
    // Validate required fields
    const requiredFields = ['name', 'inventoryId'];
    const missingFields = requiredFields.filter(field => !projectData[field]);
    
    if (missingFields.length > 0) {
      return error(`Missing required fields: ${missingFields.join(', ')}`, 400, origin);
    }
    
    // Validate inventoryId format
    if (!validateUUID(projectData.inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Sanitize input data
    const sanitizedData = {
      name: sanitizeInput(projectData.name),
      inventoryId: projectData.inventoryId,
      description: projectData.description ? sanitizeInput(projectData.description) : undefined,
      startDate: projectData.startDate || new Date().toISOString(),
      targetDate: projectData.targetDate,
      status: projectData.status || 'planning',
      sourceLocation: projectData.sourceLocation ? sanitizeInput(projectData.sourceLocation) : undefined,
      destinationLocation: projectData.destinationLocation ? sanitizeInput(projectData.destinationLocation) : undefined,
      metadata: projectData.metadata || {}
    };
    
    // Create the project
    const project = await movingProjectService.createProject(
      sanitizedData.inventoryId,
      sanitizedData,
      event.user.userId
    );
    
    return success(project, 201, origin);
  } catch (err) {
    console.error('Error creating project:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to create project');
  }
}

/**
 * Handle PUT request - Update a project
 */
async function handleUpdateProject(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const updates = JSON.parse(event.body);
    
    // Get inventoryId from body or query parameters
    const inventoryId = updates.inventoryId || event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Sanitize update data
    const sanitizedUpdates = {};
    const allowedUpdates = ['name', 'description', 'targetDate', 'sourceLocation', 'destinationLocation', 'metadata'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (typeof updates[field] === 'string') {
          sanitizedUpdates[field] = sanitizeInput(updates[field]);
        } else {
          sanitizedUpdates[field] = updates[field];
        }
      }
    });
    
    if (Object.keys(sanitizedUpdates).length === 0) {
      return error('No valid fields to update', 400, origin);
    }
    
    // Update the project
    const project = await movingProjectService.updateProject(
      projectId,
      inventoryId,
      sanitizedUpdates,
      event.user.userId
    );
    
    return success(project, 200, origin);
  } catch (err) {
    console.error('Error updating project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update project');
  }
}

/**
 * Handle PUT request - Update project status
 */
async function handleUpdateProjectStatus(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const { status, inventoryId } = JSON.parse(event.body);
    
    if (!status) {
      return error('Status is required', 400, origin);
    }
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Validate status value
    const validStatuses = ['planning', 'active', 'paused', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, origin);
    }
    
    // Update project status
    const project = await movingProjectService.updateProjectStatus(
      projectId,
      inventoryId,
      status,
      event.user.userId
    );
    
    return success(project, 200, origin);
  } catch (err) {
    console.error('Error updating project status:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Status update failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update project status');
  }
}

/**
 * Handle DELETE request - Delete a project
 */
async function handleDeleteProject(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Delete the project
    await movingProjectService.deleteProject(projectId, inventoryId, event.user.userId);
    
    return success({ message: 'Project deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Cannot delete project with assigned containers')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to delete project');
  }
}

/**
 * Handle POST request - Assign containers to project
 */
async function handleAssignContainers(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const { containerIds, inventoryId } = JSON.parse(event.body);
    
    if (!containerIds || !Array.isArray(containerIds) || containerIds.length === 0) {
      return error('containerIds array is required and must not be empty', 400, origin);
    }
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Validate all container IDs
    const invalidIds = containerIds.filter(id => !validateUUID(id));
    if (invalidIds.length > 0) {
      return error(`Invalid container IDs: ${invalidIds.join(', ')}`, 400, origin);
    }
    
    // Assign containers to project
    const result = await movingProjectService.assignContainersToProject(
      projectId,
      inventoryId,
      containerIds,
      event.user.userId
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error assigning containers to project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Container') && err.message.includes('not found')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to assign containers to project');
  }
}

/**
 * Handle DELETE request - Remove containers from project
 */
async function handleRemoveContainers(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const { containerIds, inventoryId } = JSON.parse(event.body);
    
    if (!containerIds || !Array.isArray(containerIds) || containerIds.length === 0) {
      return error('containerIds array is required and must not be empty', 400, origin);
    }
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Validate all container IDs
    const invalidIds = containerIds.filter(id => !validateUUID(id));
    if (invalidIds.length > 0) {
      return error(`Invalid container IDs: ${invalidIds.join(', ')}`, 400, origin);
    }
    
    // Remove containers from project
    const result = await movingProjectService.removeContainersFromProject(
      projectId,
      inventoryId,
      containerIds,
      event.user.userId
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error removing containers from project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to remove containers from project');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(projectsHandler));