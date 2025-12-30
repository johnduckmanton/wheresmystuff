const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess } = require('./auditLogService');
const cacheService = require('./cacheService');
const dbOptimizationService = require('./databaseOptimizationService');
const paginationService = require('./paginationService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Report Service
 * Handles generation of location reports, container reports, and export functionality
 */
class ReportService {
  /**
   * Generate a comprehensive location report
   * @param {string} locationId - Location ID to generate report for
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the report
   * @param {object} options - Report options and filters
   * @returns {Promise<object>} Location report data
   */
  async generateLocationReport(locationId, inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const {
      categoryFilter,
      containerTypeFilter,
      dateRangeStart,
      dateRangeEnd,
      includeEmptyContainers = true,
      statusFilter,
      handlingFlagsFilter,
      valueRangeMin,
      valueRangeMax,
      sortBy = 'name',
      sortOrder = 'asc',
      groupBy = 'container',
      includePhotos = false,
      template = 'standard'
    } = options;

    // Check cache for report result
    const cacheFilters = {
      categoryFilter,
      containerTypeFilter,
      dateRangeStart,
      dateRangeEnd,
      includeEmptyContainers,
      statusFilter,
      handlingFlagsFilter,
      valueRangeMin,
      valueRangeMax,
      sortBy,
      sortOrder,
      groupBy,
      template
    };
    
    const cachedReport = await cacheService.getCachedReportResult('location', locationId, cacheFilters);
    if (cachedReport) {
      return { ...cachedReport, fromCache: true };
    }

    // Get all containers at this location using optimized query
    const containersResult = await dbOptimizationService.optimizedQuery({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'locationId = :locationId',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`,
        ':locationId': locationId
      }
    }, {
      maxItems: 1000,
      projectionExpression: 'pk, sk, #data, locationId, itemCount, estimatedValue',
      expressionAttributeNames: { '#data': 'data' }
    });

    const containers = containersResult.items || [];

    // Apply container filters
    let filteredContainers = this._applyContainerFilters(containers, {
      containerTypeFilter,
      dateRangeStart,
      dateRangeEnd,
      statusFilter,
      handlingFlagsFilter,
      valueRangeMin,
      valueRangeMax
    });

    // Get all items for each container
    let containerReports = [];
    let totalItems = 0;
    let totalValue = 0;
    const categorySummary = {};

    for (const containerItem of filteredContainers) {
      const containerId = containerItem.sk;
      const containerData = containerItem.data;

      // Get items in this container using optimized query
      const itemsResult = await dbOptimizationService.optimizedQuery({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'containerId = :containerId',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`,
          ':containerId': containerId
        }
      }, {
        maxItems: 500,
        projectionExpression: 'sk, #data, containerId, categoryId, categoryName, #value, quantity',
        expressionAttributeNames: { '#data': 'data', '#value': 'value' }
      });

      let containerItems = itemsResult.items ? itemsResult.items.map(item => ({
        id: item.sk,
        ...item.data
      })) : [];

      // Apply category filter to items
      if (categoryFilter) {
        containerItems = containerItems.filter(item => 
          item.categoryId === categoryFilter
        );
      }

      // Skip empty containers if not requested
      if (!includeEmptyContainers && containerItems.length === 0) {
        continue;
      }

      // Calculate container statistics
      const containerItemCount = containerItems.length;
      const containerValue = containerItems.reduce((sum, item) => 
        sum + (parseFloat(item.value) || 0), 0
      );

      // Update category summary
      containerItems.forEach(item => {
        const category = item.categoryName || 'Uncategorized';
        if (!categorySummary[category]) {
          categorySummary[category] = { count: 0, value: 0 };
        }
        categorySummary[category].count++;
        categorySummary[category].value += parseFloat(item.value) || 0;
      });

      containerReports.push({
        container: {
          id: containerId,
          name: containerData.name,
          type: containerData.type,
          status: containerData.status,
          createdAt: containerData.createdAt,
          handlingFlags: containerData.handlingFlags || []
        },
        items: containerItems,
        itemCount: containerItemCount,
        estimatedValue: containerValue
      });

      totalItems += containerItemCount;
      totalValue += containerValue;
    }

    // Apply sorting to container reports
    containerReports = this._sortContainerReports(containerReports, sortBy, sortOrder);

    // Apply grouping if requested
    let groupedContainers = containerReports;
    if (groupBy !== 'container') {
      groupedContainers = this._groupContainerReports(containerReports, groupBy);
    }

    // Get location details using optimized query
    const locationResult = await dbOptimizationService.optimizedQuery({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#LOCATIONS`,
        ':sk': locationId
      }
    }, {
      maxItems: 1,
      projectionExpression: '#data',
      expressionAttributeNames: { '#data': 'data' }
    });

    const locationData = locationResult.items?.[0]?.data || { name: 'Unknown Location' };

    // Log the report generation
    await logDataAccess(userId, 'read', 'location_report', locationId, inventoryId);

    const reportData = {
      location: {
        id: locationId,
        name: locationData.name,
        description: locationData.description
      },
      summary: {
        totalContainers: containerReports.length,
        totalItems,
        totalValue,
        categorySummary
      },
      containers: groupedContainers,
      filters: {
        categoryFilter,
        containerTypeFilter,
        dateRangeStart,
        dateRangeEnd,
        includeEmptyContainers,
        statusFilter,
        handlingFlagsFilter,
        valueRangeMin,
        valueRangeMax,
        sortBy,
        sortOrder,
        groupBy,
        template
      },
      generatedAt: new Date().toISOString(),
      generatedBy: userId
    };

    // Cache the report result
    await cacheService.cacheReportResult('location', locationId, cacheFilters, reportData);

    return reportData;
  }

  /**
   * Generate a container manifest report
   * @param {string} containerId - Container ID to generate report for
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the report
   * @returns {Promise<object>} Container manifest data
   */
  async generateContainerManifest(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get container details
    const containerResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`,
        ':sk': containerId
      }
    }));

    if (!containerResult.Items || containerResult.Items.length === 0) {
      throw new Error('Container not found');
    }

    const containerData = containerResult.Items[0].data;

    // Get all items in this container
    const itemsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'containerId = :containerId',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`,
        ':containerId': containerId
      }
    }));

    const items = itemsResult.Items ? itemsResult.Items.map(item => ({
      id: item.sk,
      ...item.data
    })) : [];

    // Calculate statistics
    const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    const categorySummary = {};

    items.forEach(item => {
      const category = item.categoryName || 'Uncategorized';
      if (!categorySummary[category]) {
        categorySummary[category] = { count: 0, value: 0 };
      }
      categorySummary[category].count++;
      categorySummary[category].value += parseFloat(item.value) || 0;
    });

    // Get location details if container has a location
    let locationData = null;
    if (containerData.locationId) {
      const locationResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#LOCATIONS`,
          ':sk': containerData.locationId
        }
      }));
      locationData = locationResult.Items?.[0]?.data || null;
    }

    // Log the manifest generation
    await logDataAccess(userId, 'read', 'container_manifest', containerId, inventoryId);

    return {
      container: {
        id: containerId,
        name: containerData.name,
        type: containerData.type,
        status: containerData.status,
        qrCode: containerData.qrCode,
        handlingFlags: containerData.handlingFlags || [],
        createdAt: containerData.createdAt,
        description: containerData.description
      },
      location: locationData ? {
        id: containerData.locationId,
        name: locationData.name,
        description: locationData.description
      } : null,
      summary: {
        itemCount: items.length,
        totalValue,
        categorySummary
      },
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.categoryName || 'Uncategorized',
        value: parseFloat(item.value) || 0,
        quantity: item.quantity || 1,
        photos: item.photos || []
      })),
      generatedAt: new Date().toISOString(),
      generatedBy: userId
    };
  }

  /**
   * Generate a project report
   * @param {string} projectId - Project ID to generate report for
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the report
   * @returns {Promise<object>} Project report data
   */
  async generateProjectReport(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get project details
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

    const projectData = projectResult.Items[0].data;

    // Get all containers assigned to this project
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

    // Generate container reports for each container in the project
    const containerReports = [];
    let totalItems = 0;
    let totalValue = 0;
    const statusSummary = {};
    const locationSummary = {};

    for (const containerItem of containers) {
      const containerId = containerItem.sk;
      const containerData = containerItem.data;

      // Get items in this container
      const itemsResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'containerId = :containerId',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`,
          ':containerId': containerId
        }
      }));

      const containerItems = itemsResult.Items ? itemsResult.Items.map(item => ({
        id: item.sk,
        ...item.data
      })) : [];

      const containerValue = containerItems.reduce((sum, item) => 
        sum + (parseFloat(item.value) || 0), 0
      );

      containerReports.push({
        container: {
          id: containerId,
          name: containerData.name,
          type: containerData.type,
          status: containerData.status,
          locationId: containerData.locationId
        },
        itemCount: containerItems.length,
        estimatedValue: containerValue
      });

      totalItems += containerItems.length;
      totalValue += containerValue;

      // Update status summary
      const status = containerData.status || 'unknown';
      statusSummary[status] = (statusSummary[status] || 0) + 1;

      // Update location summary
      if (containerData.locationId) {
        locationSummary[containerData.locationId] = (locationSummary[containerData.locationId] || 0) + 1;
      }
    }

    // Calculate completion percentage
    const packedContainers = containers.filter(c => 
      c.data.status === 'packed' || c.data.status === 'in_transit' || c.data.status === 'stored'
    ).length;
    const completionPercentage = containers.length > 0 ? 
      Math.round((packedContainers / containers.length) * 100) : 0;

    // Log the project report generation
    await logDataAccess(userId, 'read', 'project_report', projectId, inventoryId);

    return {
      project: {
        id: projectId,
        name: projectData.name,
        description: projectData.description,
        startDate: projectData.startDate,
        targetDate: projectData.targetDate,
        status: projectData.status
      },
      summary: {
        totalContainers: containers.length,
        totalItems,
        totalValue,
        completionPercentage,
        statusSummary,
        locationSummary
      },
      containers: containerReports,
      generatedAt: new Date().toISOString(),
      generatedBy: userId
    };
  }

  /**
   * Export report data to CSV format
   * @param {object} reportData - Report data to export
   * @param {string} reportType - Type of report ('location', 'container', 'project')
   * @returns {string} CSV formatted string
   */
  exportToCSV(reportData, reportType) {
    let csvContent = '';

    switch (reportType) {
      case 'location':
        csvContent = this._exportLocationReportToCSV(reportData);
        break;
      case 'container':
        csvContent = this._exportContainerManifestToCSV(reportData);
        break;
      case 'project':
        csvContent = this._exportProjectReportToCSV(reportData);
        break;
      default:
        throw new Error('Unsupported report type for CSV export');
    }

    return csvContent;
  }

  /**
   * Export location report to CSV format
   * @private
   */
  _exportLocationReportToCSV(reportData) {
    const headers = [
      'Container Name',
      'Container Type',
      'Container Status',
      'Item Count',
      'Estimated Value',
      'Item Name',
      'Item Category',
      'Item Value',
      'Item Quantity'
    ];

    let csvContent = headers.join(',') + '\n';

    reportData.containers.forEach(containerReport => {
      const container = containerReport.container;
      
      if (containerReport.items.length === 0) {
        // Empty container
        csvContent += [
          `"${container.name}"`,
          `"${container.type}"`,
          `"${container.status}"`,
          containerReport.itemCount,
          containerReport.estimatedValue.toFixed(2),
          '""', '""', '""', '""'
        ].join(',') + '\n';
      } else {
        // Container with items
        containerReport.items.forEach(item => {
          csvContent += [
            `"${container.name}"`,
            `"${container.type}"`,
            `"${container.status}"`,
            containerReport.itemCount,
            containerReport.estimatedValue.toFixed(2),
            `"${item.name || ''}"`,
            `"${item.categoryName || 'Uncategorized'}"`,
            (parseFloat(item.value) || 0).toFixed(2),
            item.quantity || 1
          ].join(',') + '\n';
        });
      }
    });

    return csvContent;
  }

  /**
   * Export container manifest to CSV format
   * @private
   */
  _exportContainerManifestToCSV(reportData) {
    const headers = [
      'Item Name',
      'Category',
      'Description',
      'Value',
      'Quantity'
    ];

    let csvContent = headers.join(',') + '\n';

    reportData.items.forEach(item => {
      csvContent += [
        `"${item.name || ''}"`,
        `"${item.category}"`,
        `"${item.description || ''}"`,
        item.value.toFixed(2),
        item.quantity
      ].join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Export project report to CSV format
   * @private
   */
  _exportProjectReportToCSV(reportData) {
    const headers = [
      'Container Name',
      'Container Type',
      'Container Status',
      'Item Count',
      'Estimated Value'
    ];

    let csvContent = headers.join(',') + '\n';

    reportData.containers.forEach(containerReport => {
      csvContent += [
        `"${containerReport.container.name}"`,
        `"${containerReport.container.type}"`,
        `"${containerReport.container.status}"`,
        containerReport.itemCount,
        containerReport.estimatedValue.toFixed(2)
      ].join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Apply filters to container list
   * @private
   */
  _applyContainerFilters(containers, filters) {
    let filteredContainers = containers;

    // Container type filter
    if (filters.containerTypeFilter) {
      filteredContainers = filteredContainers.filter(container => 
        container.data?.type === filters.containerTypeFilter
      );
    }

    // Date range filter
    if (filters.dateRangeStart || filters.dateRangeEnd) {
      filteredContainers = filteredContainers.filter(container => {
        const containerDate = new Date(container.data?.createdAt || container.data?.dateAdded);
        if (filters.dateRangeStart && containerDate < new Date(filters.dateRangeStart)) return false;
        if (filters.dateRangeEnd && containerDate > new Date(filters.dateRangeEnd)) return false;
        return true;
      });
    }

    // Status filter
    if (filters.statusFilter) {
      filteredContainers = filteredContainers.filter(container => 
        container.data?.status === filters.statusFilter
      );
    }

    // Handling flags filter
    if (filters.handlingFlagsFilter && filters.handlingFlagsFilter.length > 0) {
      filteredContainers = filteredContainers.filter(container => {
        const containerFlags = container.data?.handlingFlags || [];
        return filters.handlingFlagsFilter.some(flag => containerFlags.includes(flag));
      });
    }

    // Value range filter (applied after calculating container values)
    if (filters.valueRangeMin !== undefined || filters.valueRangeMax !== undefined) {
      filteredContainers = filteredContainers.filter(container => {
        const containerValue = container.data?.estimatedValue || 0;
        if (filters.valueRangeMin !== undefined && containerValue < filters.valueRangeMin) return false;
        if (filters.valueRangeMax !== undefined && containerValue > filters.valueRangeMax) return false;
        return true;
      });
    }

    return filteredContainers;
  }

  /**
   * Sort container reports
   * @private
   */
  _sortContainerReports(containerReports, sortBy, sortOrder) {
    return containerReports.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'name':
          aVal = a.container.name.toLowerCase();
          bVal = b.container.name.toLowerCase();
          break;
        case 'type':
          aVal = a.container.type;
          bVal = b.container.type;
          break;
        case 'status':
          aVal = a.container.status;
          bVal = b.container.status;
          break;
        case 'itemCount':
          aVal = a.itemCount;
          bVal = b.itemCount;
          break;
        case 'value':
          aVal = a.estimatedValue;
          bVal = b.estimatedValue;
          break;
        case 'createdAt':
          aVal = new Date(a.container.createdAt);
          bVal = new Date(b.container.createdAt);
          break;
        default:
          aVal = a.container.name.toLowerCase();
          bVal = b.container.name.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });
  }

  /**
   * Group container reports by specified criteria
   * @private
   */
  _groupContainerReports(containerReports, groupBy) {
    const groups = {};

    containerReports.forEach(containerReport => {
      let groupKey;

      switch (groupBy) {
        case 'type':
          groupKey = containerReport.container.type;
          break;
        case 'status':
          groupKey = containerReport.container.status;
          break;
        case 'handlingFlags':
          groupKey = containerReport.container.handlingFlags?.length > 0 
            ? containerReport.container.handlingFlags.join(', ')
            : 'No special handling';
          break;
        case 'value':
          // Group by value ranges
          const value = containerReport.estimatedValue;
          if (value === 0) groupKey = 'No value';
          else if (value < 100) groupKey = 'Under £100';
          else if (value < 500) groupKey = '£100 - £500';
          else if (value < 1000) groupKey = '£500 - £1000';
          else groupKey = 'Over £1000';
          break;
        default:
          groupKey = 'All Containers';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupName: groupKey,
          containers: [],
          summary: {
            containerCount: 0,
            totalItems: 0,
            totalValue: 0
          }
        };
      }

      groups[groupKey].containers.push(containerReport);
      groups[groupKey].summary.containerCount++;
      groups[groupKey].summary.totalItems += containerReport.itemCount;
      groups[groupKey].summary.totalValue += containerReport.estimatedValue;
    });

    return Object.values(groups);
  }

  /**
   * Generate custom report template
   * @param {object} reportData - Base report data
   * @param {string} template - Template type
   * @returns {object} Formatted report data
   */
  generateCustomTemplate(reportData, template) {
    switch (template) {
      case 'summary':
        return this._generateSummaryTemplate(reportData);
      case 'detailed':
        return this._generateDetailedTemplate(reportData);
      case 'inventory':
        return this._generateInventoryTemplate(reportData);
      case 'moving':
        return this._generateMovingTemplate(reportData);
      default:
        return reportData;
    }
  }

  /**
   * Generate summary template
   * @private
   */
  _generateSummaryTemplate(reportData) {
    return {
      ...reportData,
      containers: reportData.containers.map(container => ({
        container: {
          name: container.container.name,
          type: container.container.type,
          status: container.container.status
        },
        itemCount: container.itemCount,
        estimatedValue: container.estimatedValue
      }))
    };
  }

  /**
   * Generate detailed template
   * @private
   */
  _generateDetailedTemplate(reportData) {
    // Return full report data with all details
    return reportData;
  }

  /**
   * Generate inventory template
   * @private
   */
  _generateInventoryTemplate(reportData) {
    return {
      ...reportData,
      containers: reportData.containers.map(container => ({
        ...container,
        items: container.items.map(item => ({
          name: item.name,
          category: item.categoryName || 'Uncategorized',
          value: parseFloat(item.value) || 0,
          quantity: item.quantity || 1
        }))
      }))
    };
  }

  /**
   * Generate moving template
   * @private
   */
  _generateMovingTemplate(reportData) {
    return {
      ...reportData,
      containers: reportData.containers.map(container => ({
        container: {
          ...container.container,
          qrCode: container.container.qrCode,
          handlingFlags: container.container.handlingFlags
        },
        itemCount: container.itemCount,
        estimatedValue: container.estimatedValue,
        packingStatus: container.itemCount > 0 ? 'Packed' : 'Empty'
      }))
    };
  }
}

module.exports = new ReportService();