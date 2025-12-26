const reportService = require('../services/reportService');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Report operations
 * Handles GET requests for generating various types of reports
 */
const reportsHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/reports',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const pathParameters = event.pathParameters || {};
    
    // Only support GET requests for reports
    if (httpMethod !== 'GET') {
      return error('Method not allowed', 405, origin);
    }
    
    // Route to appropriate report handler based on path
    if (path.includes('/location/')) {
      const locationId = pathParameters.locationId;
      return await handleLocationReport(event, locationId, origin);
    } else if (path.includes('/container/') && path.includes('/manifest')) {
      const containerId = pathParameters.containerId;
      return await handleContainerManifest(event, containerId, origin);
    } else if (path.includes('/project/')) {
      const projectId = pathParameters.projectId;
      return await handleProjectReport(event, projectId, origin);
    } else {
      return error('Report type not found', 404, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - Generate location report
 */
async function handleLocationReport(event, locationId, origin) {
  try {
    // Validate location ID parameter
    if (!locationId || !validateUUID(locationId)) {
      return error('Invalid location ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse report options from query parameters
    const options = {};
    
    if (event.queryStringParameters?.categoryFilter) {
      const categoryFilter = sanitizeInput(event.queryStringParameters.categoryFilter);
      if (validateUUID(categoryFilter)) {
        options.categoryFilter = categoryFilter;
      }
    }
    
    if (event.queryStringParameters?.containerTypeFilter) {
      options.containerTypeFilter = sanitizeInput(event.queryStringParameters.containerTypeFilter);
    }
    
    if (event.queryStringParameters?.statusFilter) {
      options.statusFilter = sanitizeInput(event.queryStringParameters.statusFilter);
    }
    
    if (event.queryStringParameters?.handlingFlagsFilter) {
      const flags = sanitizeInput(event.queryStringParameters.handlingFlagsFilter);
      options.handlingFlagsFilter = flags.split(',').map(flag => flag.trim());
    }
    
    if (event.queryStringParameters?.dateRangeStart) {
      const dateStart = sanitizeInput(event.queryStringParameters.dateRangeStart);
      // Basic date validation
      if (new Date(dateStart).toString() !== 'Invalid Date') {
        options.dateRangeStart = dateStart;
      }
    }
    
    if (event.queryStringParameters?.dateRangeEnd) {
      const dateEnd = sanitizeInput(event.queryStringParameters.dateRangeEnd);
      // Basic date validation
      if (new Date(dateEnd).toString() !== 'Invalid Date') {
        options.dateRangeEnd = dateEnd;
      }
    }
    
    if (event.queryStringParameters?.valueRangeMin) {
      const minValue = parseFloat(event.queryStringParameters.valueRangeMin);
      if (!isNaN(minValue) && minValue >= 0) {
        options.valueRangeMin = minValue;
      }
    }
    
    if (event.queryStringParameters?.valueRangeMax) {
      const maxValue = parseFloat(event.queryStringParameters.valueRangeMax);
      if (!isNaN(maxValue) && maxValue >= 0) {
        options.valueRangeMax = maxValue;
      }
    }
    
    if (event.queryStringParameters?.includeEmptyContainers) {
      options.includeEmptyContainers = event.queryStringParameters.includeEmptyContainers === 'true';
    }
    
    if (event.queryStringParameters?.sortBy) {
      const sortBy = sanitizeInput(event.queryStringParameters.sortBy);
      const validSortFields = ['name', 'type', 'status', 'itemCount', 'value', 'createdAt'];
      if (validSortFields.includes(sortBy)) {
        options.sortBy = sortBy;
      }
    }
    
    if (event.queryStringParameters?.sortOrder) {
      const sortOrder = sanitizeInput(event.queryStringParameters.sortOrder);
      if (sortOrder === 'asc' || sortOrder === 'desc') {
        options.sortOrder = sortOrder;
      }
    }
    
    if (event.queryStringParameters?.groupBy) {
      const groupBy = sanitizeInput(event.queryStringParameters.groupBy);
      const validGroupFields = ['container', 'type', 'status', 'handlingFlags', 'value'];
      if (validGroupFields.includes(groupBy)) {
        options.groupBy = groupBy;
      }
    }
    
    if (event.queryStringParameters?.template) {
      const template = sanitizeInput(event.queryStringParameters.template);
      const validTemplates = ['standard', 'summary', 'detailed', 'inventory', 'moving'];
      if (validTemplates.includes(template)) {
        options.template = template;
      }
    }
    
    if (event.queryStringParameters?.includePhotos) {
      options.includePhotos = event.queryStringParameters.includePhotos === 'true';
    }
    
    // Check if export format is requested
    const exportFormat = event.queryStringParameters?.format;
    
    // Generate the location report
    let reportData = await reportService.generateLocationReport(
      locationId, 
      inventoryId, 
      event.user.userId, 
      options
    );
    
    // Apply custom template if specified
    if (options.template && options.template !== 'standard') {
      reportData = reportService.generateCustomTemplate(reportData, options.template);
    }
    
    // Handle export formats
    if (exportFormat === 'csv') {
      const csvContent = reportService.exportToCSV(reportData, 'location');
      
      return {
        statusCode: 200,
        headers: {
          ...getAllHeaders(origin),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="location-report-${locationId}-${new Date().toISOString().split('T')[0]}.csv"`
        },
        body: csvContent
      };
    } else if (exportFormat === 'pdf') {
      // PDF export would require additional libraries like puppeteer or jsPDF
      // For now, return an error indicating it's not implemented
      return error('PDF export not yet implemented', 501, origin);
    }
    
    // Return JSON report data
    return success(reportData, 200, origin);
  } catch (err) {
    console.error('Error generating location report:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to generate location report');
  }
}

/**
 * Handle GET request - Generate container manifest
 */
async function handleContainerManifest(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check if export format is requested
    const exportFormat = event.queryStringParameters?.format;
    
    // Generate the container manifest
    const reportData = await reportService.generateContainerManifest(
      containerId, 
      inventoryId, 
      event.user.userId
    );
    
    // Handle export formats
    if (exportFormat === 'csv') {
      const csvContent = reportService.exportToCSV(reportData, 'container');
      
      return {
        statusCode: 200,
        headers: {
          ...getAllHeaders(origin),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="container-manifest-${containerId}-${new Date().toISOString().split('T')[0]}.csv"`
        },
        body: csvContent
      };
    } else if (exportFormat === 'pdf') {
      // PDF export would require additional libraries
      return error('PDF export not yet implemented', 501, origin);
    }
    
    // Return JSON report data
    return success(reportData, 200, origin);
  } catch (err) {
    console.error('Error generating container manifest:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to generate container manifest');
  }
}

/**
 * Handle GET request - Generate project report
 */
async function handleProjectReport(event, projectId, origin) {
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
    
    // Check if export format is requested
    const exportFormat = event.queryStringParameters?.format;
    
    // Generate the project report
    const reportData = await reportService.generateProjectReport(
      projectId, 
      inventoryId, 
      event.user.userId
    );
    
    // Handle export formats
    if (exportFormat === 'csv') {
      const csvContent = reportService.exportToCSV(reportData, 'project');
      
      return {
        statusCode: 200,
        headers: {
          ...getAllHeaders(origin),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="project-report-${projectId}-${new Date().toISOString().split('T')[0]}.csv"`
        },
        body: csvContent
      };
    } else if (exportFormat === 'pdf') {
      // PDF export would require additional libraries
      return error('PDF export not yet implemented', 501, origin);
    }
    
    // Return JSON report data
    return success(reportData, 200, origin);
  } catch (err) {
    console.error('Error generating project report:', err);
    
    if (err.message === 'Project not found') {
      return error('Project not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to generate project report');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(reportsHandler));