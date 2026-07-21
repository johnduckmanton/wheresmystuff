#!/usr/bin/env node

/**
 * Migration script to decode HTML entities in existing DynamoDB records.
 * 
 * After fixing sanitizeString() to no longer HTML-entity-encode special characters,
 * existing records still contain encoded data (e.g., &amp; instead of &).
 * This script scans all records and decodes them back to literal characters.
 * 
 * Usage:
 *   node backend/scripts/migrateEncodedData.js --dry-run   # Preview changes
 *   node backend/scripts/migrateEncodedData.js             # Apply changes
 * 
 * Environment Variables:
 *   TABLE_NAME - DynamoDB table name (default: home-inventory-dev)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_WRITE_LIMIT = 25;

/** HTML entity patterns to detect and decode */
const HTML_ENTITY_REGEX = /&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;/;

/** Dangerous patterns that should NOT be present after decoding */
const DANGEROUS_PATTERNS = [
  /<script/i,
  /<iframe/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /onclick\s*=/i,
  /onmouseover\s*=/i,
  /onfocus\s*=/i,
  /onblur\s*=/i
];

/**
 * Decode HTML entities in a string
 * @param {string} str - String to decode
 * @returns {string} Decoded string
 */
function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;

  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Check if a string contains any HTML entities that need decoding
 * @param {string} str - String to check
 * @returns {boolean} True if string contains HTML entities
 */
function containsHtmlEntities(str) {
  if (typeof str !== 'string') return false;
  return HTML_ENTITY_REGEX.test(str);
}

/**
 * Check if a decoded string contains dangerous HTML content
 * @param {string} decoded - Decoded string to check
 * @returns {boolean} True if string contains dangerous content
 */
function containsDangerousContent(decoded) {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(decoded));
}

/**
 * Recursively decode HTML entities in all string fields of an object.
 * Returns the decoded object and a list of field changes made.
 * @param {any} obj - Object to decode
 * @param {string} path - Current path for logging
 * @returns {{ decoded: any, changes: Array<{path: string, before: string, after: string}>, skipped: Array<{path: string, reason: string}> }}
 */
function decodeObjectFields(obj, path = '') {
  const changes = [];
  const skipped = [];

  if (obj === null || obj === undefined) {
    return { decoded: obj, changes, skipped };
  }

  if (typeof obj === 'string') {
    if (!containsHtmlEntities(obj)) {
      return { decoded: obj, changes, skipped };
    }

    const decoded = decodeHtmlEntities(obj);

    // Safety check: don't decode if result contains dangerous HTML
    if (containsDangerousContent(decoded)) {
      skipped.push({ path: path || '(root)', reason: `Dangerous content detected after decode: "${decoded.substring(0, 100)}"` });
      return { decoded: obj, changes, skipped }; // Return original, not decoded
    }

    changes.push({ path: path || '(root)', before: obj, after: decoded });
    return { decoded, changes, skipped };
  }

  if (Array.isArray(obj)) {
    const decodedArray = [];
    for (let i = 0; i < obj.length; i++) {
      const result = decodeObjectFields(obj[i], `${path}[${i}]`);
      decodedArray.push(result.decoded);
      changes.push(...result.changes);
      skipped.push(...result.skipped);
    }
    return { decoded: decodedArray, changes, skipped };
  }

  if (typeof obj === 'object') {
    const decodedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const result = decodeObjectFields(value, fieldPath);
      decodedObj[key] = result.decoded;
      changes.push(...result.changes);
      skipped.push(...result.skipped);
    }
    return { decoded: decodedObj, changes, skipped };
  }

  // Non-string, non-object, non-array — return as-is
  return { decoded: obj, changes, skipped };
}

/**
 * Scan all records from DynamoDB with pagination
 * @returns {AsyncGenerator<Array<object>>} Pages of items
 */
async function* scanAllRecords() {
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: TABLE_NAME,
      Limit: 100
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new ScanCommand(params));
    lastEvaluatedKey = result.LastEvaluatedKey;

    if (result.Items && result.Items.length > 0) {
      yield result.Items;
    }
  } while (lastEvaluatedKey);
}

/**
 * Write updated records to DynamoDB in batches of 25
 * @param {Array<object>} items - Items to write
 */
async function batchWriteItems(items) {
  for (let i = 0; i < items.length; i += BATCH_WRITE_LIMIT) {
    const batch = items.slice(i, i + BATCH_WRITE_LIMIT);

    const writeRequests = batch.map(item => ({
      PutRequest: {
        Item: item
      }
    }));

    const params = {
      RequestItems: {
        [TABLE_NAME]: writeRequests
      }
    };

    let unprocessed = params;
    let retries = 0;
    const maxRetries = 3;

    while (unprocessed && retries < maxRetries) {
      const result = await docClient.send(new BatchWriteCommand(unprocessed));

      if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
        unprocessed = { RequestItems: result.UnprocessedItems };
        retries++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      } else {
        unprocessed = null;
      }
    }

    if (unprocessed) {
      const failedCount = unprocessed.RequestItems[TABLE_NAME]?.length || 0;
      console.error(`  WARNING: ${failedCount} items failed to write after ${maxRetries} retries`);
    }
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('=== HTML Entity Decode Migration ===');
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be written)' : 'LIVE'}`);
  console.log('');

  let totalScanned = 0;
  let totalNeedDecoding = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const itemsToWrite = [];

  for await (const page of scanAllRecords()) {
    for (const item of page) {
      totalScanned++;

      // Decode all string fields in the item
      const { decoded, changes, skipped } = decodeObjectFields(item);

      if (skipped.length > 0) {
        totalSkipped += skipped.length;
        for (const skip of skipped) {
          console.warn(`  SKIPPED [${item.pk}/${item.sk}] ${skip.path}: ${skip.reason}`);
        }
      }

      if (changes.length > 0) {
        totalNeedDecoding++;

        if (DRY_RUN) {
          console.log(`  WOULD DECODE [${item.pk}/${item.sk}]:`);
          for (const change of changes) {
            console.log(`    ${change.path}: "${change.before}" -> "${change.after}"`);
          }
        } else {
          itemsToWrite.push(decoded);
        }
      }

      // Flush batch when we hit the limit
      if (!DRY_RUN && itemsToWrite.length >= BATCH_WRITE_LIMIT) {
        await batchWriteItems(itemsToWrite);
        totalUpdated += itemsToWrite.length;
        itemsToWrite.length = 0;
      }

      // Progress indicator every 500 records
      if (totalScanned % 500 === 0) {
        console.log(`  ... scanned ${totalScanned} records so far (${totalNeedDecoding} need decoding)`);
      }
    }
  }

  // Flush remaining items
  if (!DRY_RUN && itemsToWrite.length > 0) {
    await batchWriteItems(itemsToWrite);
    totalUpdated += itemsToWrite.length;
    itemsToWrite.length = 0;
  }

  // Summary
  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`Records scanned:       ${totalScanned}`);
  console.log(`Records needing decode: ${totalNeedDecoding}`);
  console.log(`Records updated:       ${DRY_RUN ? '0 (dry run)' : totalUpdated}`);
  console.log(`Fields skipped (safety): ${totalSkipped}`);
  console.log('');

  if (DRY_RUN) {
    console.log('This was a dry run. Run without --dry-run to apply changes.');
  } else if (totalUpdated > 0) {
    console.log('Migration completed successfully.');
  } else {
    console.log('No records needed decoding. Database is already clean.');
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node backend/scripts/migrateEncodedData.js [options]

Decodes HTML entities in existing DynamoDB records that were encoded by the
old sanitizeString() implementation. Converts &amp; -> &, &#x27; -> ', etc.

Options:
  --dry-run     Preview changes without writing to DynamoDB
  --help, -h    Show this help message

Environment Variables:
  TABLE_NAME    DynamoDB table name (default: home-inventory-dev)

Examples:
  # Preview what would be changed
  node backend/scripts/migrateEncodedData.js --dry-run

  # Apply the migration
  node backend/scripts/migrateEncodedData.js
`);
    process.exit(0);
  }

  runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = {
  decodeHtmlEntities,
  containsHtmlEntities,
  containsDangerousContent,
  decodeObjectFields,
  runMigration
};
