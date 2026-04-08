#!/usr/bin/env node

/**
 * One-off script to generate thumbnails for all existing photos in S3.
 * 
 * Usage:
 *   BUCKET_NAME=home-inv-photos-982081071280-dev AWS_REGION=eu-west-1 node scripts/generate-thumbnails.js
 * 
 * Options:
 *   --dry-run    List photos that would be processed without actually generating thumbnails
 *   --prefix     Only process photos under a specific prefix (e.g., "photos/user-id/")
 */

const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { processUploadedPhoto } = require('../services/imageProcessingService');

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.AWS_REGION || 'eu-west-1';
const DRY_RUN = process.argv.includes('--dry-run');
const PREFIX_ARG = process.argv.find(a => a.startsWith('--prefix='));
const PREFIX = PREFIX_ARG ? PREFIX_ARG.split('=')[1] : 'photos/';

if (!BUCKET) {
  console.error('Error: BUCKET_NAME environment variable is required');
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });

async function thumbnailExists(bucket, thumbnailKey) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: thumbnailKey }));
    return true;
  } catch {
    return false;
  }
}

function deriveThumbKey(photoKey) {
  const parts = photoKey.split('/');
  const filename = parts[parts.length - 1];
  const basename = filename.replace(/\.[^.]+$/, '');
  parts[parts.length - 1] = `${basename}.webp`;
  parts[0] = 'thumbnails';
  return parts.join('/');
}

async function listAllPhotos() {
  const photos = [];
  let continuationToken;

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX,
      ContinuationToken: continuationToken,
    }));

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key.startsWith('photos/') && obj.Size > 0) {
          photos.push(obj.Key);
        }
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return photos;
}

async function main() {
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Region: ${REGION}`);
  console.log(`Prefix: ${PREFIX}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  console.log('Listing photos...');
  const photos = await listAllPhotos();
  console.log(`Found ${photos.length} photo(s)\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of photos) {
    const thumbKey = deriveThumbKey(key);
    const exists = await thumbnailExists(BUCKET, thumbKey);

    if (exists) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would process: ${key} → ${thumbKey}`);
      processed++;
      continue;
    }

    try {
      console.log(`Processing: ${key}`);
      await processUploadedPhoto(BUCKET, key);
      processed++;
      console.log(`  ✓ Thumbnail created: ${thumbKey}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  console.log(`\nDone. Processed: ${processed}, Skipped (already exists): ${skipped}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
