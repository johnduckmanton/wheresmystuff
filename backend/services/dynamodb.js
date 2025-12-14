const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Create a new entity in DynamoDB
 * @param {string} entityType - Entity type (THINGS, LOCATIONS, ROOMS, CATEGORIES, PEOPLE)
 * @param {object} data - Entity data
 * @returns {Promise<object>} Created entity with id and dateAdded
 */
async function createEntity(entityType, data) {
  const id = uuidv4();
  const dateAdded = new Date().toISOString();
  
  const item = {
    pk: entityType,
    sk: id,
    data: {
      ...data,
      dateAdded
    }
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));
  
  return {
    id,
    ...data,
    dateAdded
  };
}

/**
 * Get a single entity by type and id
 * @param {string} entityType - Entity type
 * @param {string} id - Entity UUID
 * @returns {Promise<object|null>} Entity data or null if not found
 */
async function getEntity(entityType, id) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: entityType,
      sk: id
    }
  }));
  
  if (!result.Item) {
    return null;
  }
  
  return {
    id: result.Item.sk,
    ...result.Item.data
  };
}

/**
 * List all entities of a given type
 * @param {string} entityType - Entity type
 * @returns {Promise<Array>} Array of entities
 */
async function listEntities(entityType) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': entityType
    }
  }));
  
  return result.Items.map(item => ({
    id: item.sk,
    ...item.data
  }));
}

/**
 * Update an existing entity
 * @param {string} entityType - Entity type
 * @param {string} id - Entity UUID
 * @param {object} data - Updated entity data
 * @returns {Promise<object>} Updated entity
 */
async function updateEntity(entityType, id, data) {
  // First check if entity exists
  const existing = await getEntity(entityType, id);
  if (!existing) {
    throw new Error('Entity not found');
  }
  
  const updatedData = {
    ...existing,
    ...data,
    dateAdded: existing.dateAdded // Preserve original dateAdded
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: entityType,
      sk: id,
      data: updatedData
    }
  }));
  
  return {
    id,
    ...updatedData
  };
}

/**
 * Delete an entity
 * @param {string} entityType - Entity type
 * @param {string} id - Entity UUID
 * @returns {Promise<void>}
 */
async function deleteEntity(entityType, id) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: entityType,
      sk: id
    }
  }));
}

module.exports = {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  deleteEntity
};
