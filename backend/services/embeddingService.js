'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const EMBEDDINGS_TABLE_NAME = process.env.EMBEDDINGS_TABLE_NAME;
if (!EMBEDDINGS_TABLE_NAME) {
  throw new Error('EMBEDDINGS_TABLE_NAME environment variable is required');
}

const INVENTORY_TABLE_NAME = process.env.TABLE_NAME;
if (!INVENTORY_TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Store an embedding vector for a Thing's photo.
 * Serializes the embedding array as a JSON string for DynamoDB storage.
 *
 * @param {string} inventoryId - Inventory UUID (partition key)
 * @param {string} thingId - Thing UUID (sort key)
 * @param {number[]} embedding - Normalized embedding vector
 * @param {string} photoKey - S3 key of the source photo
 * @param {string} modelVersion - Embedding model version identifier
 * @returns {Promise<void>}
 */
async function storeEmbedding(inventoryId, thingId, embedding, photoKey, modelVersion) {
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: EMBEDDINGS_TABLE_NAME,
    Item: {
      inventoryId,
      thingId,
      embedding: JSON.stringify(embedding),
      photoKey,
      modelVersion,
      dimensions: embedding.length,
      createdAt: now,
      updatedAt: now
    }
  }));
}

/**
 * Get the stored embedding for a specific Thing.
 *
 * @param {string} inventoryId - Inventory UUID
 * @param {string} thingId - Thing UUID
 * @returns {Promise<{embedding: number[], photoKey: string, modelVersion: string} | null>}
 */
async function getEmbedding(inventoryId, thingId) {
  const result = await docClient.send(new GetCommand({
    TableName: EMBEDDINGS_TABLE_NAME,
    Key: { inventoryId, thingId }
  }));

  if (!result.Item) {
    return null;
  }

  return {
    embedding: JSON.parse(result.Item.embedding),
    photoKey: result.Item.photoKey,
    modelVersion: result.Item.modelVersion
  };
}

/**
 * Get all embeddings for an inventory (used for photo search).
 * Deserializes each embedding JSON string back to a number array.
 *
 * @param {string} inventoryId - Inventory UUID
 * @returns {Promise<Array<{thingId: string, embedding: number[], photoKey: string}>>}
 */
async function getInventoryEmbeddings(inventoryId) {
  const result = await docClient.send(new QueryCommand({
    TableName: EMBEDDINGS_TABLE_NAME,
    KeyConditionExpression: 'inventoryId = :inventoryId',
    ExpressionAttributeValues: {
      ':inventoryId': inventoryId
    }
  }));

  return (result.Items || []).map(item => ({
    thingId: item.thingId,
    embedding: JSON.parse(item.embedding),
    photoKey: item.photoKey
  }));
}

/**
 * Delete the embedding for a Thing (called when a Thing is deleted).
 *
 * @param {string} inventoryId - Inventory UUID
 * @param {string} thingId - Thing UUID
 * @returns {Promise<void>}
 */
async function deleteEmbedding(inventoryId, thingId) {
  await docClient.send(new DeleteCommand({
    TableName: EMBEDDINGS_TABLE_NAME,
    Key: { inventoryId, thingId }
  }));
}

/**
 * Find Things that have photos but no stored embeddings (for backfill).
 * Queries the main inventory table for Things with photos, then cross-references
 * the EmbeddingsTable to identify which ones are missing embeddings.
 *
 * @param {string} inventoryId - Inventory UUID
 * @returns {Promise<Array<{thingId: string, photoKey: string}>>}
 */
async function getThingsWithoutEmbeddings(inventoryId) {
  // Query all Things for this inventory from the main table
  const thingsResult = await docClient.send(new QueryCommand({
    TableName: INVENTORY_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `INVENTORY#${inventoryId}#THINGS`
    }
  }));

  const allThings = thingsResult.Items || [];

  // Filter to only Things that have at least one photo
  const thingsWithPhotos = allThings
    .filter(item => item.data && Array.isArray(item.data.photos) && item.data.photos.length > 0)
    .map(item => ({
      thingId: item.sk,
      photoKey: item.data.photos[0] // Use the primary (first) photo
    }));

  if (thingsWithPhotos.length === 0) {
    return [];
  }

  // Query all existing embeddings for this inventory
  const embeddingsResult = await docClient.send(new QueryCommand({
    TableName: EMBEDDINGS_TABLE_NAME,
    KeyConditionExpression: 'inventoryId = :inventoryId',
    ExpressionAttributeValues: {
      ':inventoryId': inventoryId
    },
    ProjectionExpression: 'thingId'
  }));

  const embeddedThingIds = new Set(
    (embeddingsResult.Items || []).map(item => item.thingId)
  );

  // Return only Things that don't have an embedding yet
  return thingsWithPhotos.filter(thing => !embeddedThingIds.has(thing.thingId));
}

/**
 * Normalize a vector to unit length (L2 normalization).
 * Each element is divided by the Euclidean magnitude of the vector.
 *
 * @param {number[]} vector - Input vector
 * @returns {number[]} Unit vector with magnitude ≈ 1.0
 * @throws {Error} If the vector has zero magnitude
 */
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (magnitude === 0) {
    throw new Error('Cannot normalize a zero vector');
  }

  return vector.map(val => val / magnitude);
}

/**
 * Compute cosine similarity between two unit vectors.
 * Both vectors must already be normalized to unit length.
 * Returns the dot product, which equals cosine similarity for unit vectors.
 *
 * @param {number[]} a - First unit vector
 * @param {number[]} b - Second unit vector
 * @returns {number} Similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

module.exports = {
  storeEmbedding,
  getEmbedding,
  getInventoryEmbeddings,
  deleteEmbedding,
  getThingsWithoutEmbeddings,
  normalizeVector,
  cosineSimilarity
};
