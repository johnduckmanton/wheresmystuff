'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const aiAnalysisService = require('./aiAnalysisService');
const embeddingService = require('./embeddingService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

/** Maximum number of search results to return */
const MAX_RESULTS = 20;

/** Minimum similarity score threshold for results */
const MIN_SCORE = 0.5;

/** Delay in milliseconds between backfill embedding generations (rate limiting) */
const BACKFILL_DELAY_MS = 1000;

/**
 * Pause execution for a given number of milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch-fetch Thing records from the main DynamoDB table.
 * Handles the DynamoDB BatchGetCommand limit of 100 items per request by
 * splitting large sets into multiple requests.
 *
 * @param {string} inventoryId - Inventory UUID
 * @param {string[]} thingIds - Array of Thing UUIDs to fetch
 * @returns {Promise<Object.<string, object>>} Map of thingId → Thing data object
 */
async function batchFetchThings(inventoryId, thingIds) {
  if (!TABLE_NAME) {
    throw new Error('TABLE_NAME environment variable is required');
  }

  if (!thingIds || thingIds.length === 0) {
    return {};
  }

  const thingMap = {};

  // DynamoDB BatchGetCommand supports at most 100 keys per request
  const BATCH_SIZE = 100;

  for (let i = 0; i < thingIds.length; i += BATCH_SIZE) {
    const batch = thingIds.slice(i, i + BATCH_SIZE);

    const keys = batch.map(thingId => ({
      pk: `INVENTORY#${inventoryId}#THINGS`,
      sk: thingId
    }));

    const result = await docClient.send(new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: { Keys: keys }
      }
    }));

    const items = (result.Responses && result.Responses[TABLE_NAME]) || [];
    for (const item of items) {
      const thingId = item.sk;
      thingMap[thingId] = {
        id: item.sk,
        ...item.data
      };
    }
  }

  return thingMap;
}

/**
 * Search for visually similar Things in an inventory by providing a query photo.
 *
 * Steps:
 * 1. Generate an embedding for the query photo via the AI analysis service.
 * 2. Normalize the query embedding to unit length.
 * 3. Retrieve all stored embeddings for the inventory.
 * 4. Compute cosine similarity between the query and each stored embedding.
 * 5. Filter to scores > 0.5, sort descending, limit to 20.
 * 6. Batch-fetch Thing details for the matched thingIds.
 * 7. Return results with Thing details, scores, and the query photo key.
 *
 * @param {string} photoKey - S3 key of the query photo
 * @param {string} inventoryId - Inventory UUID to search within
 * @param {string} userId - Requesting user's UUID (for logging/audit)
 * @returns {Promise<{results: Array<{thing: object, score: number, photoKey: string}>, queryPhotoKey: string}>}
 */
async function searchByPhoto(photoKey, inventoryId, userId) {
  // Step 1: Generate embedding for the query photo
  const { embedding: rawEmbedding } = await aiAnalysisService.generateEmbedding(photoKey);

  // Step 2: Normalize query embedding to unit length
  const queryEmbedding = embeddingService.normalizeVector(rawEmbedding);

  // Step 3: Retrieve all stored embeddings for this inventory
  const storedEmbeddings = await embeddingService.getInventoryEmbeddings(inventoryId);

  if (storedEmbeddings.length === 0) {
    return { results: [], queryPhotoKey: photoKey };
  }

  // Step 4: Compute cosine similarity for each stored embedding
  const scored = [];
  for (const stored of storedEmbeddings) {
    let storedVector;
    try {
      storedVector = embeddingService.normalizeVector(stored.embedding);
    } catch (err) {
      // Skip embeddings that cannot be normalized (e.g. zero vector from corruption)
      console.error(JSON.stringify({
        message: 'Failed to normalize stored embedding — skipping',
        thingId: stored.thingId,
        inventoryId,
        error: err.message
      }));
      continue;
    }

    const score = embeddingService.cosineSimilarity(queryEmbedding, storedVector);
    scored.push({ thingId: stored.thingId, score, photoKey: stored.photoKey });
  }

  // Step 5: Filter, sort descending, limit to MAX_RESULTS
  const filtered = scored
    .filter(item => item.score > MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  if (filtered.length === 0) {
    return { results: [], queryPhotoKey: photoKey };
  }

  // Step 6: Batch-fetch Thing details for matched thingIds
  const thingIds = filtered.map(item => item.thingId);
  const thingMap = await batchFetchThings(inventoryId, thingIds);

  // Step 7: Build results array, preserving sort order
  const results = filtered
    .filter(item => thingMap[item.thingId]) // exclude Things that no longer exist
    .map(item => ({
      thing: thingMap[item.thingId],
      score: item.score,
      photoKey: item.photoKey
    }));

  return { results, queryPhotoKey: photoKey };
}

/**
 * Trigger embedding backfill for Things in an inventory that have photos but
 * no stored embeddings. Processes items sequentially with a small delay between
 * each to avoid overwhelming the AI API.
 *
 * @param {string} inventoryId - Inventory UUID
 * @param {string} userId - Requesting user's UUID (for logging/audit)
 * @returns {Promise<{queued: number, skipped: number, errors: number}>}
 */
async function triggerBackfill(inventoryId, userId) {
  // Get Things that have photos but no embeddings
  const thingsToProcess = await embeddingService.getThingsWithoutEmbeddings(inventoryId);

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const thing of thingsToProcess) {
    if (!thing.photoKey) {
      skipped++;
      continue;
    }

    try {
      // Generate embedding for this Thing's primary photo
      const { embedding: rawEmbedding, model } = await aiAnalysisService.generateEmbedding(thing.photoKey);

      // Normalize to unit length before storage
      const normalizedEmbedding = embeddingService.normalizeVector(rawEmbedding);

      // Store the embedding
      await embeddingService.storeEmbedding(
        inventoryId,
        thing.thingId,
        normalizedEmbedding,
        thing.photoKey,
        model
      );

      queued++;
    } catch (err) {
      errors++;
      console.error(JSON.stringify({
        message: 'Backfill embedding generation failed',
        thingId: thing.thingId,
        inventoryId,
        photoKey: thing.photoKey,
        error: err.message
      }));
    }

    // Rate-limit: pause between each item to avoid API overload (Requirement 9.3)
    await sleep(BACKFILL_DELAY_MS);
  }

  return { queued, skipped, errors };
}

module.exports = {
  searchByPhoto,
  triggerBackfill
};
