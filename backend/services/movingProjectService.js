const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { MovingProject, ProjectStatus } = require('../models/movingProject');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logProjectOperation } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Moving Project Service
 * Handles CRUD operations and business logic for moving projects
 */
class MovingProjectService {
  /**
   * Create a new moving project
   * @param {string} inventoryId - Inventory ID
   * @param {object} projectData - Project data
   * @param {string} userId - User ID creating the project
   * @returns {Promise<MovingProject>} Created project
   */
  async createProject(inventoryId, projectData, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Create project instance with validation
    const project = new MovingProject({
      ...projectData,
      inventoryId,
      createdBy: userId
    });

    const validation = project.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to database
    const item = project.toDynamoDBItem();
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the creation
    await logProjectOperation(userId, 'create', project.id, inventoryId, {
      projectName: project.name,
      startDate: project.startDate,
      targetDate: project.targetDate
    });

    return project;
  }

  /**
   * Get a moving project by ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the project
   * @returns {Promise<MovingProject>} Project data
   */
  async getProject(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`,
        ':sk': projectId
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Project not found');
    }

    // Log the access
    await logDataAccess(userId, 'read', 'moving_project', projectId, inventoryId);

    return MovingProject.fromDynamoDBItem(result.Items[0]);
  }

  /**
   * Get all projects for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the projects
   * @param {object} options - Query options
   * @returns {Promise<MovingProject[]>} List of projects
   */
  async getProjects(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { status, limit = 50 } = options;

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
    };

    // Add status filter if provided
    if (status) {
      queryParams.FilterExpression = '#status = :status';
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
      queryParams.ExpressionAttributeValues[':status'] = status;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Log the access
    await logDataAccess(userId, 'read', 'moving_projects', inventoryId, inventoryId);

    return (result.Items || []).map(item => MovingProject.fromDynamoDBItem(item));
  }

  /**
   * Update a moving project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID making the update
   * @returns {Promise<MovingProject>} Updated project
   */
  async updateProject(projectId, inventoryId, updates, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing project
    const existingProject = await this.getProject(projectId, inventoryId, userId);

    // Update the project
    existingProject.update(updates, userId);

    // Validate the updated project
    const validation = existingProject.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Prepare update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedUpdates = ['name', 'description', 'targetDate', 'sourceLocation', 'destinationLocation', 'metadata'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = existingProject[field];
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = existingProject.updatedAt;

    if (updateExpressions.length === 1) { // Only updatedAt
      throw new Error('No valid fields to update');
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#PROJECTS`,
        sk: projectId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'update', projectId, inventoryId, {
      updatedFields: Object.keys(updates),
      projectName: existingProject.name
    });

    return existingProject;
  }

  /**
   * Update project status
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} newStatus - New status
   * @param {string} userId - User ID making the update
   * @returns {Promise<MovingProject>} Updated project
   */
  async updateProjectStatus(projectId, inventoryId, newStatus, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing project
    const existingProject = await this.getProject(projectId, inventoryId, userId);

    // Update status with validation
    const statusUpdate = existingProject.updateStatus(newStatus, userId);
    if (!statusUpdate.success) {
      throw new Error(`Status update failed: ${statusUpdate.errors.join(', ')}`);
    }

    // Prepare update expression
    const updateExpressions = ['#status = :status', '#updatedAt = :updatedAt'];
    const expressionAttributeNames = {
      '#status': 'status',
      '#updatedAt': 'updatedAt'
    };
    const expressionAttributeValues = {
      ':status': existingProject.status,
      ':updatedAt': existingProject.updatedAt
    };

    // Add completion date if status is completed
    if (newStatus === ProjectStatus.COMPLETED && existingProject.completionDate) {
      updateExpressions.push('#completionDate = :completionDate');
      updateExpressions.push('#completionPercentage = :completionPercentage');
      expressionAttributeNames['#completionDate'] = 'completionDate';
      expressionAttributeNames['#completionPercentage'] = 'completionPercentage';
      expressionAttributeValues[':completionDate'] = existingProject.completionDate;
      expressionAttributeValues[':completionPercentage'] = existingProject.completionPercentage;
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#PROJECTS`,
        sk: projectId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the status update
    await logDataAccess(userId, 'update', 'moving_project_status', projectId, inventoryId);

    return existingProject;
  }

  /**
   * Delete a moving project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID deleting the project
   * @returns {Promise<void>}
   */
  async deleteProject(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check if project exists
    await this.getProject(projectId, inventoryId, userId);

    // Check if project has containers assigned
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`,
        ':projectId': projectId
      },
      Limit: 1
    }));

    if (containersResult.Items && containersResult.Items.length > 0) {
      throw new Error('Cannot delete project with assigned containers. Remove containers from project first.');
    }

    // Delete the project
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#PROJECTS`,
        sk: projectId
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the deletion
    await logProjectOperation(userId, 'delete', projectId, inventoryId, {
      projectName: existingProject.name,
      containerCount: existingProject.containerCount
    });
  }

  /**
   * Assign containers to a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} containerIds - Container IDs to assign
   * @param {string} userId - User ID making the assignment
   * @returns {Promise<object>} Assignment result
   */
  async assignContainersToProject(projectId, inventoryId, containerIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Validate project exists
    await this.getProject(projectId, inventoryId, userId);

    // Validate containers exist and belong to the inventory
    const containerPromises = containerIds.map(async (containerId) => {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#CONTAINERS`,
          ':sk': containerId
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        throw new Error(`Container ${containerId} not found`);
      }

      return result.Items[0];
    });

    const containers = await Promise.all(containerPromises);

    // Update containers with project assignment
    const updatePromises = containers.map(async (container) => {
      return docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `INVENTORY#${inventoryId}#CONTAINERS`,
          sk: container.sk
        },
        UpdateExpression: 'SET projectId = :projectId, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':projectId': projectId,
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(pk)'
      }));
    });

    await Promise.all(updatePromises);

    // Update project statistics
    await this.updateProjectProgress(projectId, inventoryId, userId);

    // Log the assignment
    await logProjectOperation(userId, 'assign_containers', projectId, inventoryId, {
      containerIds: validContainerIds,
      containerCount: validContainerIds.length,
      projectName: project.name
    });

    return {
      projectId,
      assignedContainers: containerIds.length,
      containers: containers.map(c => ({
        id: c.sk,
        name: c.name,
        type: c.type,
        itemCount: c.itemCount || 0
      }))
    };
  }

  /**
   * Remove containers from a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} containerIds - Container IDs to remove
   * @param {string} userId - User ID making the change
   * @returns {Promise<object>} Removal result
   */
  async removeContainersFromProject(projectId, inventoryId, containerIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Validate project exists
    await this.getProject(projectId, inventoryId, userId);

    // Update containers to remove project assignment
    const updatePromises = containerIds.map(async (containerId) => {
      return docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `INVENTORY#${inventoryId}#CONTAINERS`,
          sk: containerId
        },
        UpdateExpression: 'REMOVE projectId SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(pk) AND projectId = :projectId',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString(),
          ':projectId': projectId
        }
      }));
    });

    await Promise.all(updatePromises);

    // Update project statistics
    await this.updateProjectProgress(projectId, inventoryId, userId);

    // Log the removal
    await logDataAccess(userId, 'update', 'project_container_removal', projectId, inventoryId);

    return {
      projectId,
      removedContainers: containerIds.length
    };
  }

  /**
   * Get project progress and statistics
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting progress
   * @returns {Promise<object>} Project progress data
   */
  async getProjectProgress(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get project
    const project = await this.getProject(projectId, inventoryId, userId);

    // Get containers assigned to this project
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`,
        ':projectId': projectId
      }
    }));

    const containers = containersResult.Items || [];

    // Calculate statistics
    const totalContainers = containers.length;
    const totalItems = containers.reduce((sum, c) => sum + (c.itemCount || 0), 0);
    const totalValue = containers.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

    // Calculate containers by status
    const containersByStatus = containers.reduce((acc, container) => {
      const status = container.status || 'empty';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calculate packed containers (containers with items)
    const packedContainers = containers.filter(c => (c.itemCount || 0) > 0).length;
    const emptyContainers = totalContainers - packedContainers;

    // Calculate completion percentage
    const completionPercentage = totalContainers > 0 ? 
      Math.round((packedContainers / totalContainers) * 100) : 0;

    // Log the access
    await logDataAccess(userId, 'read', 'project_progress', projectId, inventoryId);

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        targetDate: project.targetDate,
        completionDate: project.completionDate,
        completionPercentage: project.completionPercentage
      },
      statistics: {
        totalContainers,
        packedContainers,
        emptyContainers,
        totalItems,
        totalValue: Math.round(totalValue * 100) / 100,
        completionPercentage,
        containersByStatus
      },
      containers: containers.map(c => ({
        id: c.sk,
        name: c.name,
        type: c.type,
        status: c.status,
        itemCount: c.itemCount || 0,
        estimatedValue: c.estimatedValue || 0,
        locationId: c.locationId
      }))
    };
  }

  /**
   * Update project progress based on current container statistics
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the update
   * @returns {Promise<MovingProject>} Updated project
   */
  async updateProjectProgress(projectId, inventoryId, userId) {
    // Get current progress data
    const progressData = await this.getProjectProgress(projectId, inventoryId, userId);
    
    // Update project with new statistics
    const project = await this.getProject(projectId, inventoryId, userId);
    
    project.updateProgress({
      containerCount: progressData.statistics.totalContainers,
      itemCount: progressData.statistics.totalItems,
      packedContainers: progressData.statistics.packedContainers,
      packedItems: progressData.statistics.totalItems // All items in containers are considered packed
    }, userId);

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#PROJECTS`,
        sk: projectId
      },
      UpdateExpression: 'SET containerCount = :containerCount, itemCount = :itemCount, completionPercentage = :completionPercentage, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':containerCount': project.containerCount,
        ':itemCount': project.itemCount,
        ':completionPercentage': project.completionPercentage,
        ':updatedAt': project.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the progress update
    await logDataAccess(userId, 'update', 'project_progress', projectId, inventoryId);

    return project;
  }
}

module.exports = new MovingProjectService();