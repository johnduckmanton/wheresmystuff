const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ProjectTask, TaskPriority, TaskStatus, TaskCategory } = require('../models/projectTask');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logProjectOperation } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Default task templates for new projects
 */
const DEFAULT_TASK_TEMPLATES = [
  {
    title: 'Create moving checklist',
    category: TaskCategory.PLANNING,
    priority: TaskPriority.HIGH,
    estimatedHours: 2
  },
  {
    title: 'Notify utilities of move',
    category: TaskCategory.ADMIN,
    priority: TaskPriority.HIGH,
    estimatedHours: 1
  },
  {
    title: 'Update address with postal service',
    category: TaskCategory.ADMIN,
    priority: TaskPriority.MEDIUM,
    estimatedHours: 0.5
  },
  {
    title: 'Arrange moving truck/company',
    category: TaskCategory.LOGISTICS,
    priority: TaskPriority.HIGH,
    estimatedHours: 1
  },
  {
    title: 'Start packing non-essential items',
    category: TaskCategory.PACKING,
    priority: TaskPriority.MEDIUM,
    estimatedHours: 8
  },
  {
    title: 'Pack essential items',
    category: TaskCategory.PACKING,
    priority: TaskPriority.HIGH,
    estimatedHours: 4
  },
  {
    title: 'Perform final walkthrough',
    category: TaskCategory.MOVING_DAY,
    priority: TaskPriority.HIGH,
    estimatedHours: 1
  },
  {
    title: 'Unpack boxes',
    category: TaskCategory.UNPACKING,
    priority: TaskPriority.MEDIUM,
    estimatedHours: 8
  },
  {
    title: 'Set up utilities at new location',
    category: TaskCategory.SETUP,
    priority: TaskPriority.HIGH,
    estimatedHours: 2
  },
  {
    title: 'Update address with important contacts',
    category: TaskCategory.ADMIN,
    priority: TaskPriority.MEDIUM,
    estimatedHours: 1
  }
];

/**
 * Task Service
 * Handles CRUD operations and business logic for project tasks
 */
class TaskService {
  /**
   * Create a new task
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} taskData - Task data
   * @param {string} userId - User ID creating the task
   * @returns {Promise<ProjectTask>} Created task
   */
  async createTask(projectId, inventoryId, taskData, userId) {
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

    // Create task instance with validation
    const task = new ProjectTask({
      ...taskData,
      projectId
    });

    const validation = task.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to database
    const item = task.toDynamoDBItem();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the creation
    await logProjectOperation(userId, 'create_task', projectId, inventoryId, {
      taskTitle: task.title,
      taskCategory: task.category,
      taskPriority: task.priority
    });

    return task;
  }

  /**
   * Get a task by ID
   * @param {string} taskId - Task ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the task
   * @returns {Promise<ProjectTask>} Task data
   */
  async getTask(taskId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#TASKS`,
        ':sk': taskId
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Task not found');
    }

    // Log the access
    await logDataAccess(userId, 'read', 'task', taskId, inventoryId);

    return ProjectTask.fromDynamoDBItem(result.Items[0]);
  }

  /**
   * Get all tasks for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the tasks
   * @param {object} options - Query options
   * @returns {Promise<ProjectTask[]>} List of tasks
   */
  async getTasks(projectId, inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { includeCompleted = true, category = null, status = null, sortBy = 'dueDate' } = options;

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#TASKS`
      }
    };

    // Add filters
    const filterExpressions = [];

    if (!includeCompleted) {
      filterExpressions.push('completed = :completed');
      queryParams.ExpressionAttributeValues[':completed'] = false;
    }

    if (category) {
      filterExpressions.push('category = :category');
      queryParams.ExpressionAttributeValues[':category'] = category;
    }

    if (status) {
      filterExpressions.push('#status = :status');
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
      queryParams.ExpressionAttributeValues[':status'] = status;
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    let tasks = (result.Items || []).map(item => ProjectTask.fromDynamoDBItem(item));

    // Sort tasks
    if (sortBy === 'dueDate') {
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === 'priority') {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'status') {
      const statusOrder = { in_progress: 0, not_started: 1, blocked: 2, completed: 3, cancelled: 4 };
      tasks.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    }

    // Log the access
    await logDataAccess(userId, 'read', 'tasks', projectId, inventoryId);

    return tasks;
  }

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID making the update
   * @returns {Promise<ProjectTask>} Updated task
   */
  async updateTask(taskId, projectId, inventoryId, updates, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing task
    const existingTask = await this.getTask(taskId, projectId, inventoryId, userId);

    // Update the task
    existingTask.update(updates);

    // Validate the updated task
    const validation = existingTask.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Prepare update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedUpdates = ['title', 'description', 'category', 'priority', 'status', 'dueDate', 'assignedTo', 'estimatedHours', 'actualHours', 'notes', 'tags', 'dependencies'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = existingTask[field];
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = existingTask.updatedAt;

    if (updateExpressions.length === 1) { // Only updatedAt
      throw new Error('No valid fields to update');
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#TASKS`,
        sk: taskId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'update_task', projectId, inventoryId, {
      taskId,
      updatedFields: Object.keys(updates),
      taskTitle: existingTask.title
    });

    return existingTask;
  }

  /**
   * Mark task as completed
   * @param {string} taskId - Task ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the update
   * @returns {Promise<ProjectTask>} Updated task
   */
  async markTaskCompleted(taskId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing task
    const existingTask = await this.getTask(taskId, projectId, inventoryId, userId);

    // Mark as completed
    const result = existingTask.markCompleted();
    if (!result.success) {
      throw new Error(`Mark completed failed: ${result.errors.join(', ')}`);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#TASKS`,
        sk: taskId
      },
      UpdateExpression: 'SET completed = :completed, completedAt = :completedAt, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':completed': true,
        ':completedAt': existingTask.completedAt,
        ':status': existingTask.status,
        ':updatedAt': existingTask.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'complete_task', projectId, inventoryId, {
      taskId,
      taskTitle: existingTask.title,
      completedAt: existingTask.completedAt
    });

    return existingTask;
  }

  /**
   * Mark task as incomplete
   * @param {string} taskId - Task ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the update
   * @returns {Promise<ProjectTask>} Updated task
   */
  async markTaskIncomplete(taskId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing task
    const existingTask = await this.getTask(taskId, projectId, inventoryId, userId);

    // Mark as incomplete
    const result = existingTask.markIncomplete();
    if (!result.success) {
      throw new Error(`Mark incomplete failed: ${result.errors.join(', ')}`);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#TASKS`,
        sk: taskId
      },
      UpdateExpression: 'SET completed = :completed, completedAt = :completedAt, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':completed': false,
        ':completedAt': null,
        ':status': existingTask.status,
        ':updatedAt': existingTask.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'incomplete_task', projectId, inventoryId, {
      taskId,
      taskTitle: existingTask.title
    });

    return existingTask;
  }

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID deleting the task
   * @returns {Promise<void>}
   */
  async deleteTask(taskId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check if task exists
    const existingTask = await this.getTask(taskId, projectId, inventoryId, userId);

    // Delete the task
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#TASKS`,
        sk: taskId
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the deletion
    await logProjectOperation(userId, 'delete_task', projectId, inventoryId, {
      taskId,
      taskTitle: existingTask.title
    });
  }

  /**
   * Create default tasks for a new project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID creating the tasks
   * @returns {Promise<ProjectTask[]>} Created tasks
   */
  async createDefaultTasks(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const createdTasks = [];

    for (const template of DEFAULT_TASK_TEMPLATES) {
      const task = await this.createTask(projectId, inventoryId, template, userId);
      createdTasks.push(task);
    }

    // Log the bulk creation
    await logProjectOperation(userId, 'create_default_tasks', projectId, inventoryId, {
      taskCount: createdTasks.length
    });

    return createdTasks;
  }

  /**
   * Get task statistics for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the statistics
   * @returns {Promise<object>} Task statistics
   */
  async getTaskStats(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all tasks for this project
    const tasks = await this.getTasks(projectId, inventoryId, userId, { includeCompleted: true });

    // Calculate statistics
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => t.isOverdue()).length;
    const dueSoon = tasks.filter(t => t.isDueSoon()).length;

    // Group by category
    const byCategory = {};
    Object.values(TaskCategory).forEach(category => {
      byCategory[category] = tasks.filter(t => t.category === category).length;
    });

    // Group by priority
    const byPriority = {};
    Object.values(TaskPriority).forEach(priority => {
      byPriority[priority] = tasks.filter(t => t.priority === priority).length;
    });

    // Calculate hours
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const totalActualHours = tasks.reduce((sum, t) => sum + t.actualHours, 0);

    // Log the access
    await logDataAccess(userId, 'read', 'task_stats', projectId, inventoryId);

    return {
      total,
      completed,
      pending,
      overdue,
      dueSoon,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      byCategory,
      byPriority,
      totalEstimatedHours,
      totalActualHours,
      averageEstimatedHours: total > 0 ? Math.round(totalEstimatedHours / total * 10) / 10 : 0,
      averageActualHours: total > 0 ? Math.round(totalActualHours / total * 10) / 10 : 0
    };
  }

  /**
   * Get overdue tasks for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the tasks
   * @returns {Promise<object[]>} List of overdue tasks with project info
   */
  async getOverdueTasks(inventoryId, userId) {
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

    // Get overdue tasks for each project
    const overdueTasks = [];

    for (const project of projects) {
      const tasksResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${project.sk}#TASKS`
        }
      }));

      const tasks = (tasksResult.Items || []).map(item => ProjectTask.fromDynamoDBItem(item));

      // Filter for overdue tasks
      const overdue = tasks.filter(t => t.isOverdue());

      overdueTasks.push(...overdue.map(t => ({
        ...t,
        projectId: project.sk,
        projectName: project.name
      })));
    }

    // Sort by due date
    overdueTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Log the access
    await logDataAccess(userId, 'read', 'overdue_tasks', inventoryId, inventoryId);

    return overdueTasks;
  }
}

module.exports = new TaskService();
