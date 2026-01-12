const movingProjectService = require('../services/movingProjectService');
const projectAssignmentService = require('../services/projectAssignmentService');
const milestoneService = require('../services/milestoneService');
const budgetService = require('../services/budgetService');
const taskService = require('../services/taskService');
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
          if (event.requestContext.http.path.includes('/things')) {
            return await handleGetProjectThings(event, pathParameters.id, origin);
          } else if (event.requestContext.http.path.includes('/containers')) {
            return await handleGetProjectContainers(event, pathParameters.id, origin);
          } else if (event.requestContext.http.path.includes('/milestones')) {
            return await handleGetProjectMilestones(event, pathParameters.id, origin);
          } else if (event.requestContext.http.path.includes('/tasks')) {
            return await handleGetProjectTasks(event, pathParameters.id, origin);
          } else if (event.requestContext.http.path.includes('/budget')) {
            return await handleGetBudgetItems(event, pathParameters.id, origin);
          } else {
            return await handleGetProject(event, pathParameters.id, origin);
          }
        } else {
          if (event.requestContext.http.path.includes('/things/available')) {
            return await handleGetAvailableThings(event, origin);
          } else if (event.requestContext.http.path.includes('/containers/available')) {
            return await handleGetAvailableContainers(event, origin);
          } else if (event.requestContext.http.path.includes('/milestones/overdue')) {
            return await handleGetOverdueMilestones(event, origin);
          } else if (event.requestContext.http.path.includes('/milestones/upcoming')) {
            return await handleGetUpcomingMilestones(event, origin);
          } else if (event.requestContext.http.path.includes('/tasks/overdue')) {
            return await handleGetOverdueTasks(event, origin);
          } else if (event.requestContext.http.path.includes('/budget/stats')) {
            return await handleGetBudgetStats(event, origin);
          } else {
            return await handleGetProjects(event, origin);
          }
        }
      
      case 'POST':
        if (event.requestContext.http.path.includes('/containers')) {
          return await handleAssignContainers(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/things')) {
          return await handleAssignThings(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/milestones')) {
          return await handleCreateMilestone(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/tasks')) {
          return await handleCreateTask(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/budget')) {
          return await handleCreateBudgetItem(event, pathParameters.id, origin);
        } else {
          return await handleCreateProject(event, origin);
        }
      
      case 'PUT':
        if (event.requestContext.http.path.includes('/status')) {
          return await handleUpdateProjectStatus(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/milestones')) {
          return await handleUpdateMilestone(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/complete')) {
          return await handleCompleteMilestone(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/tasks')) {
          return await handleUpdateTask(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/budget')) {
          return await handleUpdateBudgetItem(event, pathParameters.id, origin);
        } else {
          return await handleUpdateProject(event, pathParameters.id, origin);
        }
      
      case 'DELETE':
        if (event.requestContext.http.path.includes('/containers')) {
          return await handleRemoveContainers(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/things')) {
          return await handleRemoveThings(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/milestones')) {
          return await handleDeleteMilestone(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/tasks')) {
          return await handleDeleteTask(event, pathParameters.id, origin);
        } else if (event.requestContext.http.path.includes('/budget')) {
          return await handleDeleteBudgetItem(event, pathParameters.id, origin);
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

/**
 * Handle POST request - Assign things to project
 * Uses ProjectAssignmentService to create ThingAssignment entities
 */
async function handleAssignThings(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const { thingIds, inventoryId } = JSON.parse(event.body);
    
    if (!thingIds || !Array.isArray(thingIds) || thingIds.length === 0) {
      return error('thingIds array is required and must not be empty', 400, origin);
    }
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Validate all thing IDs
    const invalidIds = thingIds.filter(id => !validateUUID(id));
    if (invalidIds.length > 0) {
      return error(`Invalid thing IDs: ${invalidIds.join(', ')}`, 400, origin);
    }
    
    // Assign things to project using ProjectAssignmentService
    const result = await projectAssignmentService.assignThingsToProject(
      projectId,
      inventoryId,
      thingIds,
      event.user.userId
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error assigning things to project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Thing') && err.message.includes('not found')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to assign things to project');
  }
}

/**
 * Handle GET request - Get containers assigned to a project
 */
async function handleGetProjectContainers(event, projectId, origin) {
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
    
    // Get containers assigned to project
    const containers = await projectAssignmentService.getProjectContainers(
      projectId,
      inventoryId,
      event.user.userId
    );
    
    return success(containers, 200, origin);
  } catch (err) {
    console.error('Error getting project containers:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve project containers');
  }
}

/**
 * Handle GET request - Get things assigned to a project
 */
async function handleGetProjectThings(event, projectId, origin) {
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
    
    // Parse optional filters
    const options = {};
    
    if (event.queryStringParameters?.includeUnassigned === 'true') {
      options.includeUnassigned = true;
    }
    
    // Get things assigned to project
    const things = await projectAssignmentService.getProjectThings(
      projectId,
      inventoryId,
      event.user.userId,
      options
    );
    
    return success(things, 200, origin);
  } catch (err) {
    console.error('Error getting project things:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve project things');
  }
}

/**
 * Handle GET request - Get available things for assignment
 */
async function handleGetAvailableThings(event, origin) {
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
    
    if (event.queryStringParameters?.excludeProjectId) {
      options.excludeProjectId = event.queryStringParameters.excludeProjectId;
    }
    
    if (event.queryStringParameters?.search) {
      options.search = sanitizeInput(event.queryStringParameters.search);
    }
    
    if (event.queryStringParameters?.categoryId) {
      options.categoryId = event.queryStringParameters.categoryId;
    }
    
    if (event.queryStringParameters?.locationId) {
      options.locationId = event.queryStringParameters.locationId;
    }
    
    // Get available things
    const things = await projectAssignmentService.getAvailableThings(
      inventoryId,
      event.user.userId,
      options
    );
    
    return success(things, 200, origin);
  } catch (err) {
    console.error('Error getting available things:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve available things');
  }
}

/**
 * Handle GET request - Get available containers for assignment
 */
async function handleGetAvailableContainers(event, origin) {
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
    const excludeProjectId = event.queryStringParameters?.excludeProjectId || null;
    
    // Get available containers
    const containers = await projectAssignmentService.getAvailableContainers(
      inventoryId,
      event.user.userId,
      excludeProjectId
    );
    
    return success(containers, 200, origin);
  } catch (err) {
    console.error('Error getting available containers:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve available containers');
  }
}

/**
 * Handle DELETE request - Remove things from project
 * Uses ProjectAssignmentService to mark ThingAssignment as unassigned
 */
async function handleRemoveThings(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const { thingIds, inventoryId } = JSON.parse(event.body);
    
    if (!thingIds || !Array.isArray(thingIds) || thingIds.length === 0) {
      return error('thingIds array is required and must not be empty', 400, origin);
    }
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Validate all thing IDs
    const invalidIds = thingIds.filter(id => !validateUUID(id));
    if (invalidIds.length > 0) {
      return error(`Invalid thing IDs: ${invalidIds.join(', ')}`, 400, origin);
    }
    
    // Remove things from project using ProjectAssignmentService
    const result = await projectAssignmentService.removeThingsFromProject(
      projectId,
      inventoryId,
      thingIds,
      event.user.userId
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error removing things from project:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to remove things from project');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(projectsHandler));

/**
 * Handle POST request - Create a new task for a project
 */
async function handleCreateTask(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }

    if (!event.body) {
      return error('Request body is required', 400, origin);
    }

    const { title, category, priority, dueDate, description, inventoryId } = JSON.parse(event.body);

    if (!title) {
      return error('Task title is required', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Create task
    const task = await taskService.createTask(
      projectId,
      inventoryId,
      {
        title: sanitizeInput(title),
        category: category || 'general',
        priority: priority || 'medium',
        dueDate,
        description: description ? sanitizeInput(description) : undefined
      },
      event.user.userId
    );

    return success(task, 201, origin);
  } catch (err) {
    console.error('Error creating task:', err);

    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }

    throw new Error('Failed to create task');
  }
}

/**
 * Handle GET request - Get tasks for a project
 */
async function handleGetProjectTasks(event, projectId, origin) {
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

    // Parse optional filters
    const options = {};

    if (event.queryStringParameters?.includeCompleted === 'false') {
      options.includeCompleted = false;
    }

    if (event.queryStringParameters?.category) {
      options.category = sanitizeInput(event.queryStringParameters.category);
    }

    if (event.queryStringParameters?.status) {
      options.status = sanitizeInput(event.queryStringParameters.status);
    }

    if (event.queryStringParameters?.sortBy) {
      options.sortBy = event.queryStringParameters.sortBy;
    }

    // Get tasks
    const tasks = await taskService.getTasks(
      projectId,
      inventoryId,
      event.user.userId,
      options
    );

    return success(tasks, 200, origin);
  } catch (err) {
    console.error('Error getting project tasks:', err);

    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to retrieve project tasks');
  }
}

/**
 * Handle PUT request - Update a task
 */
async function handleUpdateTask(event, taskId, origin) {
  try {
    // Validate task ID parameter
    if (!taskId || !validateUUID(taskId)) {
      return error('Invalid task ID', 400, origin);
    }

    if (!event.body) {
      return error('Request body is required', 400, origin);
    }

    const { projectId, inventoryId, ...updates } = JSON.parse(event.body);

    if (!projectId) {
      return error('projectId is required', 400, origin);
    }

    if (!validateUUID(projectId)) {
      return error('Invalid projectId format', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Sanitize update data
    const sanitizedUpdates = {};
    const allowedUpdates = ['title', 'description', 'category', 'priority', 'status', 'dueDate', 'assignedTo', 'estimatedHours', 'actualHours', 'notes', 'tags', 'dependencies'];

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

    // Update task
    const task = await taskService.updateTask(
      taskId,
      projectId,
      inventoryId,
      sanitizedUpdates,
      event.user.userId
    );

    return success(task, 200, origin);
  } catch (err) {
    console.error('Error updating task:', err);

    if (err.message === 'Task not found') {
      return error('Task not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }

    throw new Error('Failed to update task');
  }
}

/**
 * Handle DELETE request - Delete a task
 */
async function handleDeleteTask(event, taskId, origin) {
  try {
    // Validate task ID parameter
    if (!taskId || !validateUUID(taskId)) {
      return error('Invalid task ID', 400, origin);
    }

    // Get projectId and inventoryId from query parameters
    const projectId = event.queryStringParameters?.projectId;
    const inventoryId = event.queryStringParameters?.inventoryId;

    if (!projectId) {
      return error('projectId query parameter is required', 400, origin);
    }

    if (!validateUUID(projectId)) {
      return error('Invalid projectId format', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Delete task
    await taskService.deleteTask(
      taskId,
      projectId,
      inventoryId,
      event.user.userId
    );

    return success({ message: 'Task deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting task:', err);

    if (err.message === 'Task not found') {
      return error('Task not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to delete task');
  }
}

/**
 * Handle GET request - Get overdue tasks for inventory
 */
async function handleGetOverdueTasks(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;

    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Get overdue tasks
    const tasks = await taskService.getOverdueTasks(
      inventoryId,
      event.user.userId
    );

    return success(tasks, 200, origin);
  } catch (err) {
    console.error('Error getting overdue tasks:', err);

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to retrieve overdue tasks');
  }
}

/**
 * Handle POST request - Create a milestone for a project
 */
async function handleCreateMilestone(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }

    if (!event.body) {
      return error('Request body is required', 400, origin);
    }

    const { name, type, date, description, inventoryId } = JSON.parse(event.body);

    if (!name) {
      return error('Milestone name is required', 400, origin);
    }

    if (!date) {
      return error('Milestone date is required', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Create milestone
    const milestone = await milestoneService.createMilestone(
      projectId,
      inventoryId,
      {
        name: sanitizeInput(name),
        type: type || 'custom',
        date,
        description: description ? sanitizeInput(description) : undefined
      },
      event.user.userId
    );

    return success(milestone, 201, origin);
  } catch (err) {
    console.error('Error creating milestone:', err);

    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }

    throw new Error('Failed to create milestone');
  }
}

/**
 * Handle GET request - Get milestones for a project
 */
async function handleGetProjectMilestones(event, projectId, origin) {
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

    // Parse optional filters
    const options = {};

    if (event.queryStringParameters?.includeCompleted === 'false') {
      options.includeCompleted = false;
    }

    if (event.queryStringParameters?.sortByDate === 'false') {
      options.sortByDate = false;
    }

    // Get milestones
    const milestones = await milestoneService.getMilestones(
      projectId,
      inventoryId,
      event.user.userId,
      options
    );

    return success(milestones, 200, origin);
  } catch (err) {
    console.error('Error getting project milestones:', err);

    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to retrieve project milestones');
  }
}

/**
 * Handle PUT request - Update a milestone
 */
async function handleUpdateMilestone(event, milestoneId, origin) {
  try {
    // Validate milestone ID parameter
    if (!milestoneId || !validateUUID(milestoneId)) {
      return error('Invalid milestone ID', 400, origin);
    }

    if (!event.body) {
      return error('Request body is required', 400, origin);
    }

    const { projectId, inventoryId, ...updates } = JSON.parse(event.body);

    if (!projectId) {
      return error('projectId is required', 400, origin);
    }

    if (!validateUUID(projectId)) {
      return error('Invalid projectId format', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Sanitize update data
    const sanitizedUpdates = {};
    const allowedUpdates = ['name', 'type', 'date', 'description'];

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

    // Update milestone
    const milestone = await milestoneService.updateMilestone(
      milestoneId,
      projectId,
      inventoryId,
      sanitizedUpdates,
      event.user.userId
    );

    return success(milestone, 200, origin);
  } catch (err) {
    console.error('Error updating milestone:', err);

    if (err.message === 'Milestone not found') {
      return error('Milestone not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }

    throw new Error('Failed to update milestone');
  }
}

/**
 * Handle PUT request - Mark milestone as completed
 */
async function handleCompleteMilestone(event, milestoneId, origin) {
  try {
    // Validate milestone ID parameter
    if (!milestoneId || !validateUUID(milestoneId)) {
      return error('Invalid milestone ID', 400, origin);
    }

    if (!event.body) {
      return error('Request body is required', 400, origin);
    }

    const { projectId, inventoryId } = JSON.parse(event.body);

    if (!projectId) {
      return error('projectId is required', 400, origin);
    }

    if (!validateUUID(projectId)) {
      return error('Invalid projectId format', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Mark milestone as completed
    const milestone = await milestoneService.markMilestoneCompleted(
      milestoneId,
      projectId,
      inventoryId,
      event.user.userId
    );

    return success(milestone, 200, origin);
  } catch (err) {
    console.error('Error completing milestone:', err);

    if (err.message === 'Milestone not found') {
      return error('Milestone not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    if (err.message.includes('Mark completed failed')) {
      return error(err.message, 400, origin);
    }

    throw new Error('Failed to complete milestone');
  }
}

/**
 * Handle DELETE request - Delete a milestone
 */
async function handleDeleteMilestone(event, milestoneId, origin) {
  try {
    // Validate milestone ID parameter
    if (!milestoneId || !validateUUID(milestoneId)) {
      return error('Invalid milestone ID', 400, origin);
    }

    // Get projectId and inventoryId from query parameters
    const projectId = event.queryStringParameters?.projectId;
    const inventoryId = event.queryStringParameters?.inventoryId;

    if (!projectId) {
      return error('projectId query parameter is required', 400, origin);
    }

    if (!validateUUID(projectId)) {
      return error('Invalid projectId format', 400, origin);
    }

    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Delete milestone
    await milestoneService.deleteMilestone(
      milestoneId,
      projectId,
      inventoryId,
      event.user.userId
    );

    return success({ message: 'Milestone deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting milestone:', err);

    if (err.message === 'Milestone not found') {
      return error('Milestone not found', 404, origin);
    }

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to delete milestone');
  }
}

/**
 * Handle GET request - Get overdue milestones for inventory
 */
async function handleGetOverdueMilestones(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;

    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Get overdue milestones
    const milestones = await milestoneService.getOverdueMilestones(
      inventoryId,
      event.user.userId
    );

    return success(milestones, 200, origin);
  } catch (err) {
    console.error('Error getting overdue milestones:', err);

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to retrieve overdue milestones');
  }
}

/**
 * Handle GET request - Get upcoming milestones for inventory
 */
async function handleGetUpcomingMilestones(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;

    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Get upcoming milestones
    const milestones = await milestoneService.getUpcomingMilestones(
      inventoryId,
      event.user.userId
    );

    return success(milestones, 200, origin);
  } catch (err) {
    console.error('Error getting upcoming milestones:', err);

    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }

    throw new Error('Failed to retrieve upcoming milestones');
  }
}


/**
 * Handle POST request - Create a new budget item
 */
async function handleCreateBudgetItem(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const itemData = JSON.parse(event.body);
    
    // Validate required fields
    const requiredFields = ['description', 'category', 'estimatedCost'];
    const missingFields = requiredFields.filter(field => !itemData[field]);
    
    if (missingFields.length > 0) {
      return error(`Missing required fields: ${missingFields.join(', ')}`, 400, origin);
    }
    
    // Get inventoryId from body or query parameters
    const inventoryId = itemData.inventoryId || event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Sanitize input data
    const sanitizedData = {
      description: sanitizeInput(itemData.description),
      category: itemData.category,
      estimatedCost: parseFloat(itemData.estimatedCost),
      actualCost: itemData.actualCost ? parseFloat(itemData.actualCost) : 0,
      currency: itemData.currency || 'USD',
      dueDate: itemData.dueDate,
      vendor: itemData.vendor ? sanitizeInput(itemData.vendor) : '',
      notes: itemData.notes ? sanitizeInput(itemData.notes) : '',
      tags: Array.isArray(itemData.tags) ? itemData.tags : []
    };
    
    // Create the budget item
    const budgetItem = await budgetService.createBudgetItem(
      projectId,
      inventoryId,
      sanitizedData,
      event.user.userId
    );
    
    return success(budgetItem, 201, origin);
  } catch (err) {
    console.error('Error creating budget item:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to create budget item');
  }
}

/**
 * Handle GET request - Get budget items for a project
 */
async function handleGetBudgetItems(event, projectId, origin) {
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
    
    // Get query options
    const options = {
      category: event.queryStringParameters?.category,
      paymentStatus: event.queryStringParameters?.paymentStatus,
      sortBy: event.queryStringParameters?.sortBy || 'dueDate'
    };
    
    // Get budget items
    const items = await budgetService.getBudgetItems(
      projectId,
      inventoryId,
      event.user.userId,
      options
    );
    
    return success(items, 200, origin);
  } catch (err) {
    console.error('Error getting budget items:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve budget items');
  }
}

/**
 * Handle PUT request - Update a budget item
 */
async function handleUpdateBudgetItem(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    if (!event.body) {
      return error('Request body is required', 400, origin);
    }
    
    const updates = JSON.parse(event.body);
    
    // Get inventoryId and itemId from body or query parameters
    const inventoryId = updates.inventoryId || event.queryStringParameters?.inventoryId;
    const itemId = updates.itemId || event.queryStringParameters?.itemId;
    
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    if (!itemId) {
      return error('itemId is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId) || !validateUUID(itemId)) {
      return error('Invalid inventoryId or itemId format', 400, origin);
    }
    
    // Sanitize update data
    const sanitizedUpdates = {};
    const allowedUpdates = ['description', 'category', 'estimatedCost', 'actualCost', 'currency', 'dueDate', 'vendor', 'notes', 'tags'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (typeof updates[field] === 'string') {
          sanitizedUpdates[field] = sanitizeInput(updates[field]);
        } else {
          sanitizedUpdates[field] = updates[field];
        }
      }
    });
    
    // Update the budget item
    const budgetItem = await budgetService.updateBudgetItem(
      itemId,
      projectId,
      inventoryId,
      sanitizedUpdates,
      event.user.userId
    );
    
    return success(budgetItem, 200, origin);
  } catch (err) {
    console.error('Error updating budget item:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update budget item');
  }
}

/**
 * Handle DELETE request - Delete a budget item
 */
async function handleDeleteBudgetItem(event, projectId, origin) {
  try {
    // Validate project ID parameter
    if (!projectId || !validateUUID(projectId)) {
      return error('Invalid project ID', 400, origin);
    }
    
    // Get inventoryId and itemId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    const itemId = event.queryStringParameters?.itemId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!itemId) {
      return error('itemId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId) || !validateUUID(itemId)) {
      return error('Invalid inventoryId or itemId format', 400, origin);
    }
    
    // Delete budget item
    await budgetService.deleteBudgetItem(
      itemId,
      projectId,
      inventoryId,
      event.user.userId
    );
    
    return success({ message: 'Budget item deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting budget item:', err);
    
    if (err.message === 'Budget item not found') {
      return error('Budget item not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to delete budget item');
  }
}

/**
 * Handle GET request - Get budget statistics for a project
 */
async function handleGetBudgetStats(event, origin) {
  try {
    // Get projectId and inventoryId from query parameters
    const projectId = event.queryStringParameters?.projectId;
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!projectId) {
      return error('projectId query parameter is required', 400, origin);
    }
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(projectId) || !validateUUID(inventoryId)) {
      return error('Invalid projectId or inventoryId format', 400, origin);
    }
    
    // Get budget statistics
    const stats = await budgetService.getBudgetStats(
      projectId,
      inventoryId,
      event.user.userId
    );
    
    return success(stats, 200, origin);
  } catch (err) {
    console.error('Error getting budget statistics:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve budget statistics');
  }
}

module.exports = { projectsHandler, handler: projectsHandler };
