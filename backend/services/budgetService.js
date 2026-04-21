const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { BudgetItem, BudgetCategory, PaymentStatus } = require('../models/budgetItem');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logProjectOperation } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Budget Service
 * Handles CRUD operations and business logic for project budgets
 */
class BudgetService {
  /**
   * Create a new budget item
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} itemData - Budget item data
   * @param {string} userId - User ID creating the item
   * @returns {Promise<BudgetItem>} Created budget item
   */
  async createBudgetItem(projectId, inventoryId, itemData, userId) {
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

    // Create budget item instance with validation
    const item = new BudgetItem({
      ...itemData,
      projectId
    });

    const validation = item.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to database
    const dbItem = item.toDynamoDBItem();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: dbItem,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the creation
    await logProjectOperation(userId, 'create_budget_item', projectId, inventoryId, {
      itemDescription: item.description,
      itemCategory: item.category,
      estimatedCost: item.estimatedCost
    });

    return item;
  }

  /**
   * Get a budget item by ID
   * @param {string} itemId - Budget item ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the item
   * @returns {Promise<BudgetItem>} Budget item data
   */
  async getBudgetItem(itemId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#BUDGET`,
        ':sk': itemId
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Budget item not found');
    }

    // Log the access
    await logDataAccess(userId, 'read', 'budget_item', itemId, inventoryId);

    return BudgetItem.fromDynamoDBItem(result.Items[0]);
  }

  /**
   * Get all budget items for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the items
   * @param {object} options - Query options
   * @returns {Promise<BudgetItem[]>} List of budget items
   */
  async getBudgetItems(projectId, inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { category = null, paymentStatus = null, sortBy = 'dueDate' } = options;

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#BUDGET`
      }
    };

    // Add filters
    const filterExpressions = [];

    if (category) {
      filterExpressions.push('category = :category');
      queryParams.ExpressionAttributeValues[':category'] = category;
    }

    if (paymentStatus) {
      filterExpressions.push('paymentStatus = :paymentStatus');
      queryParams.ExpressionAttributeValues[':paymentStatus'] = paymentStatus;
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    let items = (result.Items || []).map(item => BudgetItem.fromDynamoDBItem(item));

    // Sort items
    if (sortBy === 'dueDate') {
      items.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === 'category') {
      items.sort((a, b) => a.category.localeCompare(b.category));
    } else if (sortBy === 'amount') {
      items.sort((a, b) => b.actualCost - a.actualCost);
    }

    // Log the access
    await logDataAccess(userId, 'read', 'budget_items', projectId, inventoryId);

    return items;
  }

  /**
   * Update a budget item
   * @param {string} itemId - Budget item ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID making the update
   * @returns {Promise<BudgetItem>} Updated budget item
   */
  async updateBudgetItem(itemId, projectId, inventoryId, updates, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing item
    const existingItem = await this.getBudgetItem(itemId, projectId, inventoryId, userId);

    // Update the item
    existingItem.update(updates);

    // Validate the updated item
    const validation = existingItem.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Prepare update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedUpdates = ['description', 'category', 'estimatedCost', 'actualCost', 'currency', 'dueDate', 'vendor', 'notes', 'receipt', 'tags'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = existingItem[field];
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = existingItem.updatedAt;

    if (updateExpressions.length === 1) { // Only updatedAt
      throw new Error('No valid fields to update');
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#BUDGET`,
        sk: itemId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'update_budget_item', projectId, inventoryId, {
      itemId,
      updatedFields: Object.keys(updates),
      itemDescription: existingItem.description
    });

    return existingItem;
  }

  /**
   * Mark budget item as paid
   * @param {string} itemId - Budget item ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {number} amount - Amount paid
   * @param {string} userId - User ID making the update
   * @returns {Promise<BudgetItem>} Updated budget item
   */
  async markItemAsPaid(itemId, projectId, inventoryId, amount, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing item
    const existingItem = await this.getBudgetItem(itemId, projectId, inventoryId, userId);

    // Mark as paid
    const result = existingItem.markAsPaid(amount);
    if (!result.success) {
      throw new Error(`Mark as paid failed: ${result.errors.join(', ')}`);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#BUDGET`,
        sk: itemId
      },
      UpdateExpression: 'SET amountPaid = :amountPaid, paidDate = :paidDate, paymentStatus = :paymentStatus, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':amountPaid': existingItem.amountPaid,
        ':paidDate': existingItem.paidDate,
        ':paymentStatus': existingItem.paymentStatus,
        ':updatedAt': existingItem.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'mark_budget_item_paid', projectId, inventoryId, {
      itemId,
      itemDescription: existingItem.description,
      amountPaid: amount,
      paymentStatus: existingItem.paymentStatus
    });

    return existingItem;
  }

  /**
   * Mark budget item as unpaid
   * @param {string} itemId - Budget item ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the update
   * @returns {Promise<BudgetItem>} Updated budget item
   */
  async markItemAsUnpaid(itemId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing item
    const existingItem = await this.getBudgetItem(itemId, projectId, inventoryId, userId);

    // Mark as unpaid
    const result = existingItem.markAsUnpaid();
    if (!result.success) {
      throw new Error(`Mark as unpaid failed: ${result.errors.join(', ')}`);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#BUDGET`,
        sk: itemId
      },
      UpdateExpression: 'SET amountPaid = :amountPaid, paidDate = :paidDate, paymentStatus = :paymentStatus, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':amountPaid': 0,
        ':paidDate': null,
        ':paymentStatus': PaymentStatus.PENDING,
        ':updatedAt': existingItem.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'mark_budget_item_unpaid', projectId, inventoryId, {
      itemId,
      itemDescription: existingItem.description
    });

    return existingItem;
  }

  /**
   * Delete a budget item
   * @param {string} itemId - Budget item ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID deleting the item
   * @returns {Promise<void>}
   */
  async deleteBudgetItem(itemId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check if item exists
    const existingItem = await this.getBudgetItem(itemId, projectId, inventoryId, userId);

    // Delete the item
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#BUDGET`,
        sk: itemId
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the deletion
    await logProjectOperation(userId, 'delete_budget_item', projectId, inventoryId, {
      itemId,
      itemDescription: existingItem.description
    });
  }

  /**
   * Get budget statistics for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the statistics
   * @returns {Promise<object>} Budget statistics
   */
  async getBudgetStats(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all budget items for this project
    const items = await this.getBudgetItems(projectId, inventoryId, userId);

    // Calculate statistics
    const total = items.length;
    const totalEstimated = items.reduce((sum, item) => sum + item.estimatedCost, 0);
    const totalActual = items.reduce((sum, item) => sum + item.actualCost, 0);
    const totalPaid = items.reduce((sum, item) => sum + item.amountPaid, 0);
    const totalRemaining = items.reduce((sum, item) => sum + item.getRemainingBalance(), 0);

    // Payment status breakdown
    const byPaymentStatus = {};
    Object.values(PaymentStatus).forEach(status => {
      byPaymentStatus[status] = items.filter(item => item.paymentStatus === status).length;
    });

    // Category breakdown
    const byCategory = {};
    Object.values(BudgetCategory).forEach(category => {
      const categoryItems = items.filter(item => item.category === category);
      byCategory[category] = {
        count: categoryItems.length,
        estimated: categoryItems.reduce((sum, item) => sum + item.estimatedCost, 0),
        actual: categoryItems.reduce((sum, item) => sum + item.actualCost, 0),
        paid: categoryItems.reduce((sum, item) => sum + item.amountPaid, 0)
      };
    });

    // Overdue items
    const overdueItems = items.filter(item => item.isOverdue());
    const overdueAmount = overdueItems.reduce((sum, item) => sum + item.getRemainingBalance(), 0);

    // Variance analysis
    const totalVariance = totalActual - totalEstimated;
    const variancePercentage = totalEstimated > 0 ? Math.round((totalVariance / totalEstimated) * 100) : 0;

    // Log the access
    await logDataAccess(userId, 'read', 'budget_stats', projectId, inventoryId);

    return {
      total,
      totalEstimated,
      totalActual,
      totalPaid,
      totalRemaining,
      paymentPercentage: totalActual > 0 ? Math.round((totalPaid / totalActual) * 100) : 0,
      byPaymentStatus,
      byCategory,
      overdue: {
        count: overdueItems.length,
        amount: overdueAmount
      },
      variance: {
        amount: totalVariance,
        percentage: variancePercentage,
        status: totalVariance > 0 ? 'over_budget' : totalVariance < 0 ? 'under_budget' : 'on_budget'
      }
    };
  }

  /**
   * Get overdue budget items for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the items
   * @returns {Promise<BudgetItem[]>} List of overdue items
   */
  async getOverdueItems(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all budget items
    const items = await this.getBudgetItems(projectId, inventoryId, userId);

    // Filter for overdue items
    const overdueItems = items.filter(item => item.isOverdue());

    // Sort by due date
    overdueItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Log the access
    await logDataAccess(userId, 'read', 'overdue_budget_items', projectId, inventoryId);

    return overdueItems;
  }

  /**
   * Get budget items by category
   * @param {string} projectId - Project ID
   * @param {string} category - Budget category
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the items
   * @returns {Promise<BudgetItem[]>} List of items in category
   */
  async getByCategory(projectId, category, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Validate category
    if (!Object.values(BudgetCategory).includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    // Get items for this category
    const items = await this.getBudgetItems(projectId, inventoryId, userId, { category });

    // Log the access
    await logDataAccess(userId, 'read', 'budget_items_by_category', projectId, inventoryId);

    return items;
  }

  /**
   * Get payment summary for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the summary
   * @returns {Promise<object>} Payment summary
   */
  async getPaymentSummary(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all budget items
    const items = await this.getBudgetItems(projectId, inventoryId, userId);

    // Group by payment status
    const summary = {};
    Object.values(PaymentStatus).forEach(status => {
      const statusItems = items.filter(item => item.paymentStatus === status);
      summary[status] = {
        count: statusItems.length,
        totalAmount: statusItems.reduce((sum, item) => sum + item.actualCost, 0),
        totalPaid: statusItems.reduce((sum, item) => sum + item.amountPaid, 0),
        totalRemaining: statusItems.reduce((sum, item) => sum + item.getRemainingBalance(), 0)
      };
    });

    // Log the access
    await logDataAccess(userId, 'read', 'payment_summary', projectId, inventoryId);

    return summary;
  }

  /**
   * Check budget limits and return warnings
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {number} budgetLimit - Budget limit in dollars
   * @param {string} userId - User ID requesting the check
   * @returns {Promise<object>} Budget limit warnings
   */
  async checkBudgetLimits(projectId, inventoryId, budgetLimit, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get budget stats
    const stats = await this.getBudgetStats(projectId, inventoryId, userId);

    const warnings = [];
    const alerts = [];

    // Check if over budget
    if (stats.totalActual > budgetLimit) {
      alerts.push({
        type: 'over_budget',
        message: `Project is over budget by $${(stats.totalActual - budgetLimit).toFixed(2)}`,
        amount: stats.totalActual - budgetLimit
      });
    }

    // Check if approaching budget limit (80%)
    if (stats.totalActual > budgetLimit * 0.8 && stats.totalActual <= budgetLimit) {
      warnings.push({
        type: 'approaching_limit',
        message: `Project is at ${Math.round((stats.totalActual / budgetLimit) * 100)}% of budget limit`,
        percentage: Math.round((stats.totalActual / budgetLimit) * 100)
      });
    }

    // Check for overdue items
    if (stats.overdue.count > 0) {
      alerts.push({
        type: 'overdue_items',
        message: `${stats.overdue.count} overdue budget item(s) totaling $${stats.overdue.amount.toFixed(2)}`,
        count: stats.overdue.count,
        amount: stats.overdue.amount
      });
    }

    // Check for significant variance
    if (Math.abs(stats.variance.percentage) > 20) {
      warnings.push({
        type: 'significant_variance',
        message: `Budget variance of ${stats.variance.percentage > 0 ? '+' : ''}${stats.variance.percentage}% ($${stats.variance.amount.toFixed(2)})`,
        percentage: stats.variance.percentage,
        amount: stats.variance.amount
      });
    }

    // Log the access
    await logDataAccess(userId, 'read', 'budget_limits_check', projectId, inventoryId);

    return {
      budgetLimit,
      currentSpent: stats.totalActual,
      remaining: budgetLimit - stats.totalActual,
      percentageUsed: Math.round((stats.totalActual / budgetLimit) * 100),
      warnings,
      alerts,
      hasWarnings: warnings.length > 0,
      hasAlerts: alerts.length > 0
    };
  }
}

module.exports = new BudgetService();
