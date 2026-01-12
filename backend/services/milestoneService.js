const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { Milestone, MilestoneType } = require('../models/milestone');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logProjectOperation } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Milestone Service
 * Handles CRUD operations and business logic for project milestones
 */
class MilestoneService {
  /**
   * Create a new milestone
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} milestoneData - Milestone data
   * @param {string} userId - User ID creating the milestone
   * @returns {Promise<Milestone>} Created milestone
   */
  async createMilestone(projectId, inventoryId, milestoneData, userId) {
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

    // Create milestone instance with validation
    const milestone = new Milestone({
      ...milestoneData,
      projectId
    });

    const validation = milestone.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to database
    const item = milestone.toDynamoDBItem();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the creation
    await logProjectOperation(userId, 'create_milestone', projectId, inventoryId, {
      milestoneName: milestone.name,
      milestoneDate: milestone.date,
      milestoneType: milestone.type
    });

    return milestone;
  }

  /**
   * Get a milestone by ID
   * @param {string} milestoneId - Milestone ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the milestone
   * @returns {Promise<Milestone>} Milestone data
   */
  async getMilestone(milestoneId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#MILESTONES`,
        ':sk': milestoneId
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Milestone not found');
    }

    // Log the access
    await logDataAccess(userId, 'read', 'milestone', milestoneId, inventoryId);

    return Milestone.fromDynamoDBItem(result.Items[0]);
  }

  /**
   * Get all milestones for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the milestones
   * @param {object} options - Query options
   * @returns {Promise<Milestone[]>} List of milestones
   */
  async getMilestones(projectId, inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { includeCompleted = true, sortByDate = true } = options;

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#MILESTONES`
      }
    };

    // Add filter for completed status if needed
    if (!includeCompleted) {
      queryParams.FilterExpression = 'completed = :completed';
      queryParams.ExpressionAttributeValues[':completed'] = false;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    let milestones = (result.Items || []).map(item => Milestone.fromDynamoDBItem(item));

    // Sort by date if requested
    if (sortByDate) {
      milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // Log the access
    await logDataAccess(userId, 'read', 'milestones', projectId, inventoryId);

    return milestones;
  }

  /**
   * Update a milestone
   * @param {string} milestoneId - Milestone ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID making the update
   * @returns {Promise<Milestone>} Updated milestone
   */
  async updateMilestone(milestoneId, projectId, inventoryId, updates, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing milestone
    const existingMilestone = await this.getMilestone(milestoneId, projectId, inventoryId, userId);

    // Update the milestone
    existingMilestone.update(updates);

    // Validate the updated milestone
    const validation = existingMilestone.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Prepare update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedUpdates = ['name', 'type', 'date', 'description'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = existingMilestone[field];
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = existingMilestone.updatedAt;

    if (updateExpressions.length === 1) { // Only updatedAt
      throw new Error('No valid fields to update');
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#MILESTONES`,
        sk: milestoneId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'update_milestone', projectId, inventoryId, {
      milestoneId,
      updatedFields: Object.keys(updates),
      milestoneName: existingMilestone.name
    });

    return existingMilestone;
  }

  /**
   * Mark milestone as completed
   * @param {string} milestoneId - Milestone ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the update
   * @returns {Promise<Milestone>} Updated milestone
   */
  async markMilestoneCompleted(milestoneId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing milestone
    const existingMilestone = await this.getMilestone(milestoneId, projectId, inventoryId, userId);

    // Mark as completed
    const result = existingMilestone.markCompleted();
    if (!result.success) {
      throw new Error(`Mark completed failed: ${result.errors.join(', ')}`);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#MILESTONES`,
        sk: milestoneId
      },
      UpdateExpression: 'SET completed = :completed, completedAt = :completedAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':completed': true,
        ':completedAt': existingMilestone.completedAt,
        ':updatedAt': existingMilestone.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'complete_milestone', projectId, inventoryId, {
      milestoneId,
      milestoneName: existingMilestone.name,
      completedAt: existingMilestone.completedAt
    });

    return existingMilestone;
  }

  /**
   * Mark milestone as incomplete
   * @param {string} milestoneId - Milestone ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the update
   * @returns {Promise<Milestone>} Updated milestone
   */
  async markMilestoneIncomplete(milestoneId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing milestone
    const existingMilestone = await this.getMilestone(milestoneId, projectId, inventoryId, userId);

    // Mark as incomplete
    const result = existingMilestone.markIncomplete();
    if (!result.success) {
      throw new Error(`Mark incomplete failed: ${result.errors.join(', ')}`);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#MILESTONES`,
        sk: milestoneId
      },
      UpdateExpression: 'SET completed = :completed, completedAt = :completedAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':completed': false,
        ':completedAt': null,
        ':updatedAt': existingMilestone.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'incomplete_milestone', projectId, inventoryId, {
      milestoneId,
      milestoneName: existingMilestone.name
    });

    return existingMilestone;
  }

  /**
   * Delete a milestone
   * @param {string} milestoneId - Milestone ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID deleting the milestone
   * @returns {Promise<void>}
   */
  async deleteMilestone(milestoneId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check if milestone exists
    const existingMilestone = await this.getMilestone(milestoneId, projectId, inventoryId, userId);

    // Delete the milestone
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#MILESTONES`,
        sk: milestoneId
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the deletion
    await logProjectOperation(userId, 'delete_milestone', projectId, inventoryId, {
      milestoneId,
      milestoneName: existingMilestone.name,
      milestoneDate: existingMilestone.date
    });
  }

  /**
   * Get overdue milestones for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the milestones
   * @returns {Promise<object[]>} List of overdue milestones with project info
   */
  async getOverdueMilestones(inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all projects for this inventory
    const projectsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`
      }
    }));

    const projects = projectsResult.Items || [];

    // Get overdue milestones for each project
    const overdueMilestones = [];

    for (const project of projects) {
      const milestonesResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${project.sk}#MILESTONES`
        }
      }));

      const milestones = (milestonesResult.Items || []).map(item => Milestone.fromDynamoDBItem(item));

      // Filter for overdue milestones
      const overdue = milestones.filter(m => m.isOverdue());

      overdueMilestones.push(...overdue.map(m => ({
        ...m,
        projectId: project.sk,
        projectName: project.name
      })));
    }

    // Sort by date
    overdueMilestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Log the access
    await logDataAccess(userId, 'read', 'overdue_milestones', inventoryId, inventoryId);

    return overdueMilestones;
  }

  /**
   * Get upcoming milestones for an inventory (within 7 days)
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the milestones
   * @returns {Promise<object[]>} List of upcoming milestones with project info
   */
  async getUpcomingMilestones(inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all projects for this inventory
    const projectsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`
      }
    }));

    const projects = projectsResult.Items || [];

    // Get upcoming milestones for each project
    const upcomingMilestones = [];

    for (const project of projects) {
      const milestonesResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${project.sk}#MILESTONES`
        }
      }));

      const milestones = (milestonesResult.Items || []).map(item => Milestone.fromDynamoDBItem(item));

      // Filter for upcoming milestones
      const upcoming = milestones.filter(m => m.isUpcoming());

      upcomingMilestones.push(...upcoming.map(m => ({
        ...m,
        projectId: project.sk,
        projectName: project.name
      })));
    }

    // Sort by date
    upcomingMilestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Log the access
    await logDataAccess(userId, 'read', 'upcoming_milestones', inventoryId, inventoryId);

    return upcomingMilestones;
  }

  /**
   * Get milestone statistics for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the statistics
   * @returns {Promise<object>} Milestone statistics
   */
  async getMilestoneStats(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all milestones for this project
    const milestones = await this.getMilestones(projectId, inventoryId, userId, { includeCompleted: true });

    // Calculate statistics
    const total = milestones.length;
    const completed = milestones.filter(m => m.completed).length;
    const pending = total - completed;
    const overdue = milestones.filter(m => m.isOverdue()).length;
    const upcoming = milestones.filter(m => m.isUpcoming()).length;

    // Group by type
    const byType = {};
    Object.values(MilestoneType).forEach(type => {
      byType[type] = milestones.filter(m => m.type === type).length;
    });

    // Log the access
    await logDataAccess(userId, 'read', 'milestone_stats', projectId, inventoryId);

    return {
      total,
      completed,
      pending,
      overdue,
      upcoming,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      byType
    };
  }
}

module.exports = new MilestoneService();
