const QRCodeService = require('../services/qrCodeService');
const LabelService = require('../services/labelService');
const ScanHistoryService = require('../services/scanHistoryService');
const { generateDownloadUrl } = require('../services/s3');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { logSecurityEvent } = require('../utils/securityLogger');

// Import S3 client for QR code bucket operations
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({});
const QR_BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;

/**
 * Generate download URL for QR code bucket
 * @param {string} key - S3 object key
 * @param {boolean} secure - Whether to use secure expiration
 * @returns {Promise<string>} Presigned download URL
 */
async function generateQRDownloadUrl(key, secure = true) {
  const command = new GetObjectCommand({
    Bucket: QR_BUCKET_NAME,
    Key: key
  });
  
  const expiresIn = secure ? 900 : 3600; // 15 minutes or 1 hour
  
  const url = await getSignedUrl(s3Client, command, {
    expiresIn
  });
  
  return url;
}

const qrCodeService = new QRCodeService();
const labelService = new LabelService();

/**
 * Generate QR code for a container
 */
exports.generateQRCode = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const { containerId } = event.pathParameters;
    const { size = 'medium', inventoryId } = event.queryStringParameters || {};

    if (!containerId) {
      return error('Container ID is required');
    }

    if (!inventoryId) {
      return error('Inventory ID is required');
    }

    // Validate size parameter
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      return error(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
    }

    // Generate QR code
    const qrCodeData = await qrCodeService.generateContainerQRCode(containerId, size);

    // Generate download URL for the QR code image
    const downloadUrl = await generateQRDownloadUrl(qrCodeData.s3Key, false);

    // Update the container record with QR code information
    const { updateEntity } = require('../services/dynamodb');
    try {
      await updateEntity('CONTAINERS', inventoryId, containerId, {
        qrCode: qrCodeData.qrCodeId,
        qrCodeUrl: qrCodeData.s3Key,
        qrCodeGeneratedAt: qrCodeData.generatedAt,
        updatedAt: new Date().toISOString(),
        updatedBy: user.userId
      });
      console.log(`✅ Container ${containerId} updated with QR code: ${qrCodeData.qrCodeId}`);
    } catch (updateErr) {
      console.error('Error updating container with QR code:', updateErr);
      // Don't fail the request if update fails - QR code is still generated
    }

    // Log the QR code generation
    await logSecurityEvent('QR_CODE_GENERATED', {
      userId: user.userId,
      containerId,
      size,
      qrCodeId: qrCodeData.qrCodeId
    });

    return success({
      ...qrCodeData,
      downloadUrl
    });

  } catch (err) {
    console.error('Error generating QR code:', err);
    
    await logSecurityEvent('QR_CODE_GENERATION_ERROR', {
      error: err.message,
      containerId: event.pathParameters?.containerId
    });

    return error('Failed to generate QR code', 500);
  }
};

/**
 * Generate QR codes for multiple containers in batch
 */
exports.generateBatchQRCodes = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const body = JSON.parse(event.body || '{}');
    const { containerIds, size = 'medium' } = body;

    if (!containerIds || !Array.isArray(containerIds)) {
      return error('Container IDs array is required');
    }

    if (containerIds.length === 0) {
      return error('At least one container ID is required');
    }

    if (containerIds.length > 50) {
      return error('Cannot process more than 50 containers at once');
    }

    // Validate size parameter
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      return error(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
    }

    // Generate QR codes in batch
    const batchResult = await qrCodeService.generateBatchQRCodes(containerIds, size);

    // Generate download URLs for successful QR codes
    const successfulWithUrls = await Promise.all(
      batchResult.successful.map(async (qrData) => {
        const downloadUrl = await generateQRDownloadUrl(qrData.s3Key, false);
        return {
          ...qrData,
          downloadUrl
        };
      })
    );

    // Log the batch QR code generation
    await logSecurityEvent('BATCH_QR_CODE_GENERATED', {
      userId: user.userId,
      containerCount: containerIds.length,
      successCount: batchResult.successCount,
      failureCount: batchResult.failureCount,
      size
    });

    return success({
      ...batchResult,
      successful: successfulWithUrls
    });

  } catch (err) {
    console.error('Error generating batch QR codes:', err);
    
    await logSecurityEvent('BATCH_QR_CODE_GENERATION_ERROR', {
      error: err.message
    });

    return error('Failed to generate batch QR codes', 500);
  }
};

/**
 * Decode and validate QR code
 */
exports.decodeQRCode = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const body = JSON.parse(event.body || '{}');
    const { qrCodeId } = body;

    if (!qrCodeId) {
      return error('QR code ID is required');
    }

    // Validate QR code format
    if (!qrCodeService.validateQRCode(qrCodeId)) {
      await logSecurityEvent('INVALID_QR_CODE_SCAN', {
        userId: user.userId,
        qrCodeId
      });
      
      return error('Invalid or expired QR code');
    }

    // Decode QR code
    const decodedData = qrCodeService.decodeQRCodeId(qrCodeId);

    // Log the QR code scan
    await logSecurityEvent('QR_CODE_SCANNED', {
      userId: user.userId,
      qrCodeId,
      containerId: decodedData.containerId
    });

    return success(decodedData);

  } catch (err) {
    console.error('Error decoding QR code:', err);
    
    await logSecurityEvent('QR_CODE_DECODE_ERROR', {
      error: err.message
    });

    return error('Failed to decode QR code', 500);
  }
};

/**
 * Scan QR code and return container contents
 */
exports.scanQRCode = async (event) => {
  try {
    console.log('🔍 QR Code scan started');
    
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    console.log('✅ User authenticated:', user.userId);
    
    const body = JSON.parse(event.body || '{}');
    const { qrCodeData, inventoryId } = body;
    console.log('📋 Scan request:', { qrCodeData, inventoryId });

    if (!qrCodeData) {
      return error('QR code data is required');
    }

    // Note: inventoryId is optional for QR scanning - we'll find the container across all user inventories

    // Scan and validate QR code
    const scanResult = qrCodeService.scanQRCode(qrCodeData);
    console.log('🔍 QR code validation result:', scanResult);
    
    if (!scanResult.success) {
      console.log('❌ QR code validation failed:', scanResult.error);
      // Record failed scan in history (use provided inventoryId if available)
      if (inventoryId) {
        await ScanHistoryService.recordScan(user.userId, inventoryId, {
          type: 'qr_scan',
          success: false,
          qrCodeId: qrCodeData,
          method: 'camera',
          error: scanResult.error
        });
      }

      await logSecurityEvent('QR_CODE_SCAN_FAILED', {
        userId: user.userId,
        error: scanResult.error,
        inventoryId
      });

      return error(scanResult.message);
    }

    console.log('✅ QR code validated, container ID:', scanResult.containerId);

    // Get container service to lookup container across all user inventories
    const ContainerService = require('../services/containerService');
    
    try {
      // Find the container across all inventories the user has access to
      console.log('🔍 Searching for container across inventories...');
      const containerResult = await ContainerService.findContainerAcrossInventories(
        scanResult.containerId, 
        user.userId
      );

      if (!containerResult) {
        console.log('❌ Container not found in any accessible inventory');
        // Container not found in any accessible inventory
        if (inventoryId) {
          await ScanHistoryService.recordScan(user.userId, inventoryId, {
            type: 'qr_scan',
            success: false,
            containerId: scanResult.containerId,
            qrCodeId: qrCodeData,
            method: 'camera',
            error: 'Container not found or access denied'
          });
        }

        await logSecurityEvent('QR_CODE_CONTAINER_NOT_FOUND', {
          userId: user.userId,
          containerId: scanResult.containerId,
          inventoryId
        });

        return error('Container not found or you do not have access to it', 404);
      }

      console.log('✅ Container found in inventory:', containerResult.inventoryId);
      const { container, inventoryId: actualInventoryId } = containerResult;

      // Get container contents using the actual inventory ID
      console.log('📋 Getting container contents...');
      const containerContents = await ContainerService.getContainerContents(
        scanResult.containerId, 
        actualInventoryId, 
        user.userId
      );

      console.log('✅ Container contents retrieved, item count:', containerContents.itemCount);

      // Record successful scan in history
      await ScanHistoryService.recordScan(user.userId, actualInventoryId, {
        type: 'qr_scan',
        success: true,
        containerId: scanResult.containerId,
        containerName: containerContents.container.name,
        qrCodeId: qrCodeData,
        method: 'camera',
        itemCount: containerContents.itemCount
      });

      // Log successful scan
      await logSecurityEvent('QR_CODE_SCAN_SUCCESS', {
        userId: user.userId,
        containerId: scanResult.containerId,
        inventoryId: actualInventoryId,
        itemCount: containerContents.itemCount
      });

      return success({
        scanResult,
        container: containerContents.container,
        items: containerContents.items,
        itemCount: containerContents.itemCount,
        inventoryId: actualInventoryId, // Include the actual inventory ID
        scannedAt: new Date().toISOString()
      });

    } catch (containerError) {
      console.error('❌ Container access error:', containerError);
      // Record failed container access in history
      if (inventoryId) {
        await ScanHistoryService.recordScan(user.userId, inventoryId, {
          type: 'qr_scan',
          success: false,
          containerId: scanResult.containerId,
          qrCodeId: qrCodeData,
          method: 'camera',
          error: containerError.message
        });
      }

      // Handle container not found or access denied
      await logSecurityEvent('QR_CODE_CONTAINER_ACCESS_ERROR', {
        userId: user.userId,
        containerId: scanResult.containerId,
        inventoryId,
        error: containerError.message
      });

      if (containerError.message.includes('not found')) {
        return error('Container not found or has been deleted', 404);
      } else if (containerError.message.includes('Access denied')) {
        return error('Access denied to container inventory', 403);
      } else {
        throw containerError;
      }
    }

  } catch (err) {
    console.error('❌ Error scanning QR code:', err);
    
    await logSecurityEvent('QR_CODE_SCAN_ERROR', {
      error: err.message
    });

    return error('Failed to scan QR code', 500);
  }
};

/**
 * Lookup container by manual entry (fallback when scanning fails)
 */
exports.lookupContainer = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const body = JSON.parse(event.body || '{}');
    const { containerId, containerName, inventoryId } = body;

    if (!inventoryId) {
      return error('Inventory ID is required');
    }

    if (!containerId && !containerName) {
      return error('Either container ID or container name is required');
    }

    const ContainerService = require('../services/containerService');

    let containerContents;

    if (containerId) {
      // Direct lookup by container ID
      try {
        containerContents = await ContainerService.getContainerContents(
          containerId, 
          inventoryId, 
          user.userId
        );
      } catch (err) {
        // Record failed lookup in history
        await ScanHistoryService.recordScan(user.userId, inventoryId, {
          type: 'manual_lookup',
          success: false,
          containerId: containerId,
          method: 'id_lookup',
          error: err.message
        });

        if (err.message.includes('not found')) {
          return error('Container not found', 404);
        } else if (err.message.includes('Access denied')) {
          return error('Access denied to container inventory', 403);
        } else {
          throw err;
        }
      }
    } else {
      // Search by container name
      const containersList = await ContainerService.listContainers(inventoryId, user.userId, {
        search: containerName,
        limit: 10
      });

      if (containersList.containers.length === 0) {
        return error('No containers found matching the name', 404);
      }

      // If exact match found, use it; otherwise return search results
      const exactMatch = containersList.containers.find(c => 
        c.name.toLowerCase() === containerName.toLowerCase()
      );

      if (exactMatch) {
        containerContents = await ContainerService.getContainerContents(
          exactMatch.id, 
          inventoryId, 
          user.userId
        );

        // Record successful lookup in history
        await ScanHistoryService.recordScan(user.userId, inventoryId, {
          type: 'manual_lookup',
          success: true,
          containerId: exactMatch.id,
          containerName: exactMatch.name,
          method: 'name_search',
          itemCount: containerContents.itemCount
        });
      } else {
        // Record search attempt in history
        await ScanHistoryService.recordScan(user.userId, inventoryId, {
          type: 'container_search',
          success: false,
          containerName: containerName,
          method: 'name_search',
          error: 'Multiple matches found'
        });

        // Return multiple matches for user to choose from
        await logSecurityEvent('CONTAINER_MANUAL_SEARCH', {
          userId: user.userId,
          searchTerm: containerName,
          inventoryId,
          resultsCount: containersList.containers.length
        });

        return success({
          type: 'multiple_matches',
          containers: containersList.containers.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            itemCount: c.itemCount,
            locationId: c.locationId
          })),
          message: 'Multiple containers found. Please select one.'
        });
      }
    }

    // Record successful lookup in history
    if (containerId) {
      // Record successful ID lookup in history
      await ScanHistoryService.recordScan(user.userId, inventoryId, {
        type: 'manual_lookup',
        success: true,
        containerId: containerContents.container.id,
        containerName: containerContents.container.name,
        method: 'id_lookup',
        itemCount: containerContents.itemCount
      });
    }

    // Log successful manual lookup
    await logSecurityEvent('CONTAINER_MANUAL_LOOKUP_SUCCESS', {
      userId: user.userId,
      containerId: containerContents.container.id,
      inventoryId,
      itemCount: containerContents.itemCount,
      lookupMethod: containerId ? 'id' : 'name'
    });

    return success({
      type: 'single_match',
      container: containerContents.container,
      items: containerContents.items,
      itemCount: containerContents.itemCount,
      lookedUpAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error looking up container:', err);
    
    await logSecurityEvent('CONTAINER_MANUAL_LOOKUP_ERROR', {
      error: err.message
    });

    return error('Failed to lookup container', 500);
  }
};

/**
 * Get scan history for a user
 */
exports.getScanHistory = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const queryParams = event.queryStringParameters || {};
    const { 
      limit = '20', 
      lastEvaluatedKey, 
      inventoryId,
      successOnly = 'false'
    } = queryParams;

    const options = {
      limit: parseInt(limit),
      successOnly: successOnly === 'true'
    };

    if (lastEvaluatedKey) {
      try {
        options.lastEvaluatedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
      } catch (err) {
        return error('Invalid lastEvaluatedKey format');
      }
    }

    if (inventoryId) {
      options.inventoryId = inventoryId;
    }

    const history = await ScanHistoryService.getScanHistory(user.userId, options);

    // Log the history access
    await logSecurityEvent('SCAN_HISTORY_ACCESSED', {
      userId: user.userId,
      inventoryId,
      limit: options.limit,
      successOnly: options.successOnly
    });

    return success({
      ...history,
      lastEvaluatedKey: history.lastEvaluatedKey ? 
        encodeURIComponent(JSON.stringify(history.lastEvaluatedKey)) : null
    });

  } catch (err) {
    console.error('Error getting scan history:', err);
    
    await logSecurityEvent('SCAN_HISTORY_ERROR', {
      error: err.message
    });

    return error('Failed to get scan history', 500);
  }
};

/**
 * Get recent successful scans for quick access
 */
exports.getRecentScans = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const queryParams = event.queryStringParameters || {};
    const { inventoryId, limit = '10' } = queryParams;

    if (!inventoryId) {
      return error('Inventory ID is required');
    }

    const recentScans = await ScanHistoryService.getRecentSuccessfulScans(
      user.userId, 
      inventoryId, 
      parseInt(limit)
    );

    return success({
      recentScans,
      count: recentScans.length
    });

  } catch (err) {
    console.error('Error getting recent scans:', err);
    return error('Failed to get recent scans', 500);
  }
};

/**
 * Get QR code information for a container
 */
exports.getContainerQRCode = async (event) => {
  try {
    // Validate JWT token
    await authenticate(event);
    const user = event.user;
    
    const { containerId } = event.pathParameters;
    const { inventoryId } = event.queryStringParameters || {};

    if (!containerId) {
      return error('Container ID is required');
    }

    if (!inventoryId) {
      return error('Inventory ID is required');
    }

    // Get container service to fetch container data
    const ContainerService = require('../services/containerService');
    
    try {
      // Fetch the container to check if it has a QR code
      const container = await ContainerService.getContainer(containerId, inventoryId, user.userId);
      
      if (!container.qrCodeUrl) {
        // Container doesn't have a QR code yet
        return success({
          containerId,
          hasQRCode: false,
          message: 'QR code not generated yet'
        });
      }

      // Generate presigned download URL for the QR code
      const downloadUrl = await generateQRDownloadUrl(container.qrCodeUrl, false);

      // Log the QR code access
      await logSecurityEvent('QR_CODE_ACCESSED', {
        userId: user.userId,
        containerId,
        inventoryId
      });

      return success({
        containerId,
        hasQRCode: true,
        downloadUrl,
        qrCodeId: container.qrCode,
        generatedAt: container.qrCodeGeneratedAt
      });

    } catch (containerError) {
      console.error('Container access error:', containerError);
      
      if (containerError.message.includes('not found')) {
        return error('Container not found', 404);
      } else if (containerError.message.includes('Access denied')) {
        return error('Access denied to container', 403);
      } else {
        throw containerError;
      }
    }

  } catch (err) {
    console.error('Error getting container QR code:', err);
    return error('Failed to get container QR code', 500);
  }
};

/**
 * Generate printable label for a container
 * Updated to fetch actual container data from database
 */
exports.generateLabel = async (event) => {
  try {
    // Handle both API Gateway JWT authorizer and manual JWT validation
    let user;
    
    // Check if API Gateway already validated the JWT (claims available in requestContext)
    if (event.requestContext?.authorizer?.jwt?.claims) {
      const claims = event.requestContext.authorizer.jwt.claims;
      user = {
        userId: claims.sub,
        email: claims.email,
        username: claims['cognito:username'] || claims.username || claims.email
      };
      event.user = user;
    } else {
      // Fallback to manual JWT validation
      await authenticate(event);
      user = event.user;
    }
    
    if (!user || !user.userId) {
      console.error('Authentication failed: No user found');
      return error('Authentication failed', 401);
    }
    
    const { containerId } = event.pathParameters;
    const { size = 'medium', inventoryId } = event.queryStringParameters || {};

    if (!containerId) {
      return error('Container ID is required');
    }

    if (!inventoryId) {
      return error('Inventory ID is required');
    }

    // Validate size parameter
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      return error(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
    }

    // Get container service to fetch actual container data
    const ContainerService = require('../services/containerService');
    
    let containerData;
    try {
      // Get the actual container data from the database
      const container = await ContainerService.getContainer(containerId, inventoryId, user.userId);
      
      containerData = {
        id: container.id,
        name: container.name,
        type: container.type,
        contentsSummary: container.contentsSummary,
        createdAt: container.createdAt
      };
    } catch (containerError) {
      // Enhanced error logging for debugging access issues
      console.error('Container access error details:', {
        error: containerError.message,
        containerId,
        inventoryId,
        userId: user.userId,
        timestamp: new Date().toISOString()
      });
      
      if (containerError.message.includes('not found')) {
        return error('Container not found', 404);
      } else if (containerError.message.includes('Access denied')) {
        return error('Access denied to container', 403);
      } else {
        throw containerError;
      }
    }

    // Generate label
    const labelBuffer = await labelService.generateLabel(containerData, size);
    
    // Store label in S3
    const s3Key = await labelService.storeLabelImage(containerId, labelBuffer, size);

    // Generate download URL
    const downloadUrl = await generateQRDownloadUrl(s3Key, false);

    // Log the label generation
    await logSecurityEvent('LABEL_GENERATED', {
      userId: user.userId,
      containerId,
      containerName: containerData.name,
      size
    });

    return success({
      containerId,
      containerName: containerData.name,
      s3Key,
      size,
      downloadUrl,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error generating label:', err);
    
    await logSecurityEvent('LABEL_GENERATION_ERROR', {
      error: err.message,
      containerId: event.pathParameters?.containerId
    });

    return error('Failed to generate label', 500);
  }
};

/**
 * Generate printable labels for multiple containers in batch
 */
exports.generateBatchLabels = async (event) => {
  try {
    // Handle both API Gateway JWT authorizer and manual JWT validation
    let user;
    
    // Check if API Gateway already validated the JWT (claims available in requestContext)
    if (event.requestContext?.authorizer?.jwt?.claims) {
      const claims = event.requestContext.authorizer.jwt.claims;
      user = {
        userId: claims.sub,
        email: claims.email,
        username: claims['cognito:username'] || claims.username || claims.email
      };
      event.user = user;
    } else {
      // Fallback to manual JWT validation
      await authenticate(event);
      user = event.user;
    }
    
    if (!user || !user.userId) {
      console.error('Authentication failed: No user found');
      return error('Authentication failed', 401);
    }
    
    const body = JSON.parse(event.body || '{}');
    const { containerIds, inventoryId, size = 'medium', sheetFormat = false } = body;

    if (!containerIds || !Array.isArray(containerIds)) {
      return error('Container IDs array is required');
    }

    if (containerIds.length === 0) {
      return error('At least one container ID is required');
    }

    if (containerIds.length > 50) {
      return error('Cannot process more than 50 containers at once');
    }

    if (!inventoryId) {
      return error('Inventory ID is required');
    }

    // Validate size parameter
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      return error(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
    }

    // Get container service to fetch actual container data
    const ContainerService = require('../services/containerService');
    
    // Fetch all container data
    const containers = [];
    const errors = [];
    
    for (const containerId of containerIds) {
      try {
        const container = await ContainerService.getContainer(containerId, inventoryId, user.userId);
        containers.push({
          id: container.id,
          name: container.name,
          type: container.type,
          contentsSummary: container.contentsSummary,
          createdAt: container.createdAt
        });
      } catch (containerError) {
        errors.push({
          containerId,
          error: containerError.message
        });
      }
    }

    if (containers.length === 0) {
      return error('No valid containers found', 404);
    }

    let result;

    if (sheetFormat) {
      // Generate a single sheet with multiple labels
      const sheetBuffer = await labelService.generateLabelSheet(containers, size);
      
      // Store sheet in S3 and get the actual key
      const s3Key = await labelService.storeLabelImage('batch', sheetBuffer, `sheet_${size}`);
      const downloadUrl = await generateQRDownloadUrl(s3Key, false);

      result = {
        type: 'sheet',
        s3Key,
        downloadUrl,
        containerCount: containers.length,
        size,
        generatedAt: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined
      };
    } else {
      // Generate individual labels
      const batchResult = await labelService.generateBatchLabels(containers, size);

      // Generate download URLs for successful labels
      const successfulWithUrls = await Promise.all(
        batchResult.successful.map(async (labelData) => {
          const downloadUrl = await generateQRDownloadUrl(labelData.s3Key, false);
          return {
            ...labelData,
            downloadUrl
          };
        })
      );

      result = {
        type: 'individual',
        ...batchResult,
        successful: successfulWithUrls,
        containerErrors: errors.length > 0 ? errors : undefined
      };
    }

    // Log the batch label generation
    await logSecurityEvent('BATCH_LABEL_GENERATED', {
      userId: user.userId,
      containerCount: containers.length,
      errorCount: errors.length,
      size,
      sheetFormat
    });

    return success(result);

  } catch (err) {
    console.error('Error generating batch labels:', err);
    
    await logSecurityEvent('BATCH_LABEL_GENERATION_ERROR', {
      error: err.message
    });

    return error('Failed to generate batch labels', 500);
  }
};

/**
 * Main handler function for API Gateway
 * Updated: 2025-01-29 - Fixed label generation with real container data
 */
exports.handler = async (event) => {
  // Debug: Log the entire event to understand the structure
  console.log('🔍 QR Code Handler Debug - Full Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, resource } = event;
  const path = event.rawPath || event.path;
  
  // API Gateway v2 (HTTP API) uses different event structure
  const method = httpMethod || event.requestContext?.http?.method;
  
  console.log('🔍 QR Code Handler Debug - Routing Info:');
  console.log('- httpMethod:', httpMethod);
  console.log('- requestContext.http.method:', event.requestContext?.http?.method);
  console.log('- resolved method:', method);
  console.log('- path:', path);
  console.log('- resource:', resource);

  try {
    // Route to appropriate handler based on path and method
    // Check more specific paths first to avoid conflicts
    if (path.includes('/qr-codes/scan') && method === 'POST') {
      console.log('✅ Routing to scanQRCode');
      return await exports.scanQRCode(event);
    } else if (path.includes('/qr-codes/decode') && method === 'POST') {
      console.log('✅ Routing to decodeQRCode');
      return await exports.decodeQRCode(event);
    } else if (path.includes('/qr-codes/batch') && method === 'POST') {
      console.log('✅ Routing to generateBatchQRCodes');
      return await exports.generateBatchQRCodes(event);
    } else if (path.includes('/qr-codes/history') && method === 'GET') {
      console.log('✅ Routing to getScanHistory');
      return await exports.getScanHistory(event);
    } else if (path.includes('/qr-codes/recent') && method === 'GET') {
      console.log('✅ Routing to getRecentScans');
      return await exports.getRecentScans(event);
    } else if (path.includes('/qr-code') && method === 'POST') {
      console.log('✅ Routing to generateQRCode');
      return await exports.generateQRCode(event);
    } else if (path.includes('/qr-code') && method === 'GET') {
      console.log('✅ Routing to getContainerQRCode');
      return await exports.getContainerQRCode(event);
    } else if (path.includes('/containers/lookup') && method === 'POST') {
      console.log('✅ Routing to lookupContainer');
      return await exports.lookupContainer(event);
    } else if (path.includes('/labels/batch') && method === 'POST') {
      console.log('✅ Routing to generateBatchLabels');
      return await exports.generateBatchLabels(event);
    } else if (path.includes('/label') && method === 'POST') {
      console.log('✅ Routing to generateLabel');
      return await exports.generateLabel(event);
    } else {
      console.log('❌ No matching route found');
      console.log('- Available routes: /qr-code (POST/GET), /qr-codes/batch (POST), etc.');
      return error('Not Found', 404);
    }
  } catch (err) {
    console.error('Handler error:', err);
    return error('Internal Server Error', 500);
  }
};
