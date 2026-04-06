const { processUploadedPhoto } = require('../services/imageProcessingService');

const BUCKET_NAME = process.env.BUCKET_NAME;

/**
 * S3 event-triggered Lambda handler.
 * Fires when a new object is created under photos/ in the PhotoBucket.
 */
exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    // Only process files under photos/ — skip anything already processed
    if (!key.startsWith('photos/')) {
      console.log(`Skipping non-photo key: ${key}`);
      continue;
    }

    // Skip if this is already a WebP (i.e. a re-processed file landing back in photos/)
    // to avoid infinite trigger loops
    if (key.endsWith('.webp')) {
      console.log(`Skipping already-processed WebP: ${key}`);
      continue;
    }

    try {
      const result = await processUploadedPhoto(bucket, key);
      results.push({ key, ...result, status: 'success' });
    } catch (err) {
      console.error(`Failed to process ${key}:`, err);
      results.push({ key, status: 'error', error: err.message });
      // Don't rethrow — process remaining records
    }
  }

  return { processed: results };
};
