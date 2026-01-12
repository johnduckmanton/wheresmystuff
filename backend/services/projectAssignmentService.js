const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const { ThingAssignment } = require('../models/thingAssignment');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logProjectOperation } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Project Assignment Service
 * Handles assignment of containers and things to moving projects
 * Things are assigned via separate ThingAssignment entities (not by adding a field to the thing)
 */
class ProjectAssignmentService {
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
    const projectResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`,
        ':sk': projectId
      }
    }));

    if (!projectResult.Items || projectResult.Items.length === 0) {
      throw new Error('Project not found');
    }

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

    // Log the assignment
    await logProjectOperation(userId, 'assign_containers', projectId, inventoryId, {
      containerIds: containerIds,
      containerCount: containerIds.length
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
          ':updatedAt': new Date().toISOString(),
          ':projectId': projectId
        },
        ConditionExpression: 'attribute_exists(pk) AND projectId = :projectId'
      }));
    });

    await Promise.all(updatePromises);

    // Log the removal
    await logDataAccess(userId, 'update', 'project_container_removal', projectId, inventoryId);

    return {
      projectId,
      removedContainers: containerIds.length
    };
  }

  /**
   * Get containers assigned to a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the containers
   * @returns {Promise<object[]>} List of assigned containers
   */
  async getProjectContainers(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

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

    // Log the access
    await logDataAccess(userId, 'read', 'project_containers', projectId, inventoryId);

    return containers.map(c => ({
      id: c.sk,
      name: c.name,
      type: c.type,
      status: c.status,
      itemCount: c.itemCount || 0,
      estimatedValue: c.estimatedValue || 0,
      locationId: c.locationId
    }));
  }

  /**
   * Get available containers for assignment
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the containers
   * @param {string} excludeProjectId - Optional project ID to exclude
   * @returns {Promise<object[]>} List of available containers
   */
  async getAvailableContainers(inventoryId, userId, excludeProjectId = null) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all containers for this inventory
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      }
    }));

    const containers = containersResult.Items || [];

    // Filter out containers already assigned to projects (or to the excluded project)
    const availableContainers = containers.filter(c => {
      if (!c.projectId) return true; // Not assigned to any project
      if (excludeProjectId && c.projectId === excludeProjectId) return true; // Assigned to excluded project
      return false;
    });

    // Log the access
    await logDataAccess(userId, 'read', 'available_containers', inventoryId, inventoryId);

    return availableContainers.map(c => ({
      id: c.sk,
      name: c.name,
      type: c.type,
      status: c.status,
      itemCount: c.itemCount || 0,
      estimatedValue: c.estimatedValue || 0,
      locationId: c.locationId
    }));
  }

  /**
   * Assign things to a project
   * Creates ThingAssignment entities instead of modifying the thing
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} thingIds - Thing IDs to assign
   * @param {string} userId - User ID making the assignment
   * @returns {Promise<object>} Assignment result
   */
  async assignThingsToProject(projectId, inventoryId, thingIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Validate project exists
    const projectResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`,
        ':sk': projectId
      }
    }));

    if (!projectResult.Items || projectResult.Items.length === 0) {
      throw new Error('Project not found');
    }

    // Validate things exist and belong to the inventory
    const thingPromises = thingIds.map(async (thingId) => {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`,
          ':sk': thingId
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        throw new Error(`Thing ${thingId} not found`);
      }

      return result.Items[0];
    });

    const things = await Promise.all(thingPromises);

    // Create ThingAssignment entities for each thing
    const assignmentPromises = things.map(async (thing) => {
      const assignment = new ThingAssignment({
        projectId,
        thingId: thing.sk,
        inventoryId
      });

      const validation = assignment.validate();
      if (!validation.isValid) {
        throw new Error(`Assignment validation failed: ${validation.errors.join(', ')}`);
      }

      const item = assignment.toDynamoDBItem();

      return docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk)'
      }));
    });

    await Promise.all(assignmentPromises);

    // Log the assignment
    await logProjectOperation(userId, 'assign_things', projectId, inventoryId, {
      thingIds: thingIds,
      thingCount: thingIds.length
    });

    return {
      projectId,
      assignedThings: thingIds.length,
      things: things.map(thing => ({
        id: thing.sk,
        name: thing.name,
        description: thing.description,
        make: thing.make,
        model: thing.model
      }))
    };
  }

  /**
   * Remove things from a project
   * Marks ThingAssignment as unassigned instead of deleting
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} thingIds - Thing IDs to remove
   * @param {string} userId - User ID making the change
   * @returns {Promise<object>} Removal result
   */
  async removeThingsFromProject(projectId, inventoryId, thingIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Find and update assignments for each thing
    const updatePromises = thingIds.map(async (thingId) => {
      // Find the active assignment for this thing in this project
      const assignmentResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'thingId = :thingId AND attribute_not_exists(unassignedAt)',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}#THINGS`,
          ':thingId': thingId
        }
      }));

      if (!assignmentResult.Items || assignmentResult.Items.length === 0) {
        throw new Error(`Active assignment not found for thing ${thingId}`);
      }

      const assignment = assignmentResult.Items[0];

      // Mark as unassigned
      return docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `PROJECT#${projectId}#THINGS`,
          sk: assignment.sk
        },
        UpdateExpression: 'SET unassignedAt = :unassignedAt, updatedAt = :updatedAt, isActive = :isActive',
        ExpressionAttributeValues: {
          ':unassignedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
          ':isActive': false
        },
        ConditionExpression: 'attribute_exists(pk)'
      }));
    });

    await Promise.all(updatePromises);

    // Log the removal
    await logProjectOperation(userId, 'remove_things', projectId, inventoryId, {
      thingIds: thingIds,
      thingCount: thingIds.length
    });

    return {
      projectId,
      removedThings: thingIds.length
    };
  }

  /**
   * Get things assigned to a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the things
   * @param {object} options - Query options
   * @returns {Promise<object[]>} List of assigned things
   */
  async getProjectThings(projectId, inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { includeUnassigned = false } = options;

    // Get active assignments for this project
    let assignmentResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#THINGS`
      }
    }));

    let assignments = assignmentResult.Items || [];

    // Filter to only active assignments unless includeUnassigned is true
    if (!includeUnassigned) {
      assignments = assignments.filter(a => !a.unassignedAt);
    }

    if (assignments.length === 0) {
      return [];
    }

    // Get the thing details for each assignment
    const thingIds = assignments.map(a => a.thingId);
    const thingPromises = thingIds.map(async (thingId) => {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`,
          ':sk': thingId
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return result.Items[0];
    });

    const things = await Promise.all(thingPromises);

    // Log the access
    await logDataAccess(userId, 'read', 'project_things', projectId, inventoryId);

    // Combine assignment and thing data
    return assignments
      .map((assignment, index) => {
        const thing = things[index];
        if (!thing) return null;

        const thingData = thing.data || thing; // Handle both nested and flat structures
        return {
          assignmentId: assignment.id,
          id: thing.sk,
          inventoryId: thingData.inventoryId,
          name: thingData.name,
          description: thingData.description,
          make: thingData.make,
          model: thingData.model,
          serialNumber: thingData.serialNumber,
          purchasePrice: thingData.purchasePrice,
          containerId: thingData.containerId,
          locationId: thingData.locationId,
          categoryId: thingData.categoryId,
          photos: thingData.photos || [],
          tags: thingData.tags || [],
          assignedAt: assignment.assignedAt,
          containerizedAt: assignment.containerizedAt,
          containerizedContainerId: assignment.containerizedContainerId,
          isContainerized: assignment.isContainerized,
          isActive: assignment.isActive
        };
      })
      .filter(item => item !== null);
  }

  /**
   * Get available things for assignment
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the things
   * @param {object} options - Query options (search, filter, etc.)
   * @returns {Promise<object[]>} List of available things
   */
  async getAvailableThings(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { excludeProjectId = null, search = null, categoryId = null, locationId = null } = options;

    // Get all things for this inventory
    let thingsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`
      }
    }));

    let things = thingsResult.Items || [];

    // Filter by category if provided
    if (categoryId) {
      things = things.filter(t => {
        const data = t.data || t;
        return data.categoryId === categoryId;
      });
    }

    // Filter by location if provided
    if (locationId) {
      things = things.filter(t => {
        const data = t.data || t;
        return data.locationId === locationId;
      });
    }

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      things = things.filter(t => {
        const data = t.data || t;
        return (data.name && data.name.toLowerCase().includes(searchLower)) ||
          (data.description && data.description.toLowerCase().includes(searchLower)) ||
          (data.make && data.make.toLowerCase().includes(searchLower)) ||
          (data.model && data.model.toLowerCase().includes(searchLower));
      });
    }

    // Get active assignments to exclude already-assigned things
    let assignmentResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'attribute_not_exists(unassignedAt)',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`
      }
    }));

    // This is a simplified approach - in production, you'd want to query by GSI
    // For now, we'll filter things that don't have active assignments
    const assignedThingIds = new Set();
    
    // Get all active assignments for this inventory
    const allAssignmentsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'gsi2pk-gsi2sk-index',
      KeyConditionExpression: 'gsi2pk = :gsi2pk',
      FilterExpression: 'attribute_not_exists(unassignedAt)',
      ExpressionAttributeValues: {
        ':gsi2pk': `INVENTORY#${inventoryId}`
      }
    })).catch(() => ({ Items: [] })); // Handle if GSI doesn't exist yet

    (allAssignmentsResult.Items || []).forEach(assignment => {
      if (assignment.thingId) {
        assignedThingIds.add(assignment.thingId);
      }
    });

    // Filter out already-assigned things
    const availableThings = things.filter(t => !assignedThingIds.has(t.sk));

    // Log the access
    await logDataAccess(userId, 'read', 'available_things', inventoryId, inventoryId);

    return availableThings.map(t => {
      const thingData = t.data || t; // Handle both nested and flat structures
      return {
        id: t.sk,
        inventoryId: thingData.inventoryId,
        name: thingData.name,
        description: thingData.description,
        make: thingData.make,
        model: thingData.model,
        serialNumber: thingData.serialNumber,
        purchasePrice: thingData.purchasePrice,
        containerId: thingData.containerId,
        locationId: thingData.locationId,
        categoryId: thingData.categoryId,
        photos: thingData.photos || [],
        tags: thingData.tags || [],
        isContainerized: !!thingData.containerId
      };
    });
  }

  /**
   * Mark a thing as containerized within an assignment
   * @param {string} projectId - Project ID
   * @param {string} thingId - Thing ID
   * @param {string} containerId - Container ID
   * @param {string} userId - User ID making the change
   * @returns {Promise<object>} Update result
   */
  async markThingContainerized(projectId, thingId, containerId, userId) {
    // Find the active assignment
    const assignmentResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'thingId = :thingId AND attribute_not_exists(unassignedAt)',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#THINGS`,
        ':thingId': thingId
      }
    }));

    if (!assignmentResult.Items || assignmentResult.Items.length === 0) {
      throw new Error('Active assignment not found');
    }

    const assignment = assignmentResult.Items[0];

    // Update the assignment
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#THINGS`,
        sk: assignment.sk
      },
      UpdateExpression: 'SET containerizedAt = :containerizedAt, containerizedContainerId = :containerizedContainerId, isContainerized = :isContainerized, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':containerizedAt': new Date().toISOString(),
        ':containerizedContainerId': containerId,
        ':isContainerized': true,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logDataAccess(userId, 'update', 'thing_containerized', projectId, projectId);

    return {
      projectId,
      thingId,
      containerId,
      containerizedAt: new Date().toISOString()
    };
  }

  /**
   * Mark a thing as uncontainerized within an assignment
   * @param {string} projectId - Project ID
   * @param {string} thingId - Thing ID
   * @param {string} userId - User ID making the change
   * @returns {Promise<object>} Update result
   */
  async markThingUncontainerized(projectId, thingId, userId) {
    // Find the active assignment
    const assignmentResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'thingId = :thingId AND attribute_not_exists(unassignedAt)',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#THINGS`,
        ':thingId': thingId
      }
    }));

    if (!assignmentResult.Items || assignmentResult.Items.length === 0) {
      throw new Error('Active assignment not found');
    }

    const assignment = assignmentResult.Items[0];

    // Update the assignment
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#THINGS`,
        sk: assignment.sk
      },
      UpdateExpression: 'REMOVE containerizedAt, containerizedContainerId SET isContainerized = :isContainerized, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isContainerized': false,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logDataAccess(userId, 'update', 'thing_uncontainerized', projectId, projectId);

    return {
      projectId,
      thingId,
      uncontainerizedAt: new Date().toISOString()
    };
  }
}

module.exports = new ProjectAssignmentService();
