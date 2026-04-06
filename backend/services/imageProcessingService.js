const sharp = require('sharp');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({});

// Max dimensions for display images (longest edge)
const DISPLAY_MAX_PX = 1920;
const DISPLAY_QUALITY = 85;

// Thumbnail dimensions (cover crop)
const THUMB_SIZE = 300;
const THUMB_QUALITY = 70;

/**
 * Stream an S3 object into a Buffer
 */
async function getS3ObjectBuffer(bucket, key) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a buffer to S3
 */
async function putS3Object(bucket, key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
}

/**
 * Derive the processed and thumbnail keys from an original upload key.
 * Original:   photos/{userId}/{inventoryId}/{entityId}/{filename}
 * Processed:  photos/{userId}/{inventoryId}/{entityId}/{basename}.webp
 * Thumbnail:  thumbnails/{userId}/{inventoryId}/{entityId}/{basename}.webp
 */
function deriveKeys(originalKey) {
  const parts = originalKey.split('/');
  // Replace filename with webp basename
  const filename = parts[parts.length - 1];
  const basename = filename.replace(/\.[^.]+$/, '');
  const webpFilename = `${basename}.webp`;

  parts[parts.length - 1] = webpFilename;
  const processedKey = parts.join('/');

  // thumbnails/ prefix instead of photos/
  const thumbParts = [...parts];
  thumbParts[0] = 'thumbnails';
  const thumbnailKey = thumbParts.join('/');

  return { processedKey, thumbnailKey };
}

/**
 * Process an uploaded photo:
 *  - Copy original to originals/ prefix
 *  - Resize to max display size, convert to WebP, store under photos/
 *  - Generate thumbnail, store under thumbnails/
 *
 * @param {string} bucket
 * @param {string} key - the S3 key of the newly uploaded file
 * @returns {{ processedKey: string, thumbnailKey: string, originalKey: string }}
 */
async function processUploadedPhoto(bucket, key) {
  // Read the uploaded image
  const inputBuffer = await getS3ObjectBuffer(bucket, key);

  const { processedKey, thumbnailKey } = deriveKeys(key);

  // Store original under originals/ prefix
  const originalKey = key.replace(/^photos\//, 'originals/');
  await putS3Object(bucket, originalKey, inputBuffer, 'image/webp');

  // Resize for display (max 1920px on longest edge, keep aspect ratio)
  const displayBuffer = await sharp(inputBuffer)
    .rotate() // auto-orient from EXIF
    .resize(DISPLAY_MAX_PX, DISPLAY_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: DISPLAY_QUALITY })
    .toBuffer();

  await putS3Object(bucket, processedKey, displayBuffer, 'image/webp');

  // Generate thumbnail (300x300 cover crop)
  const thumbBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();

  await putS3Object(bucket, thumbnailKey, thumbBuffer, 'image/webp');

  console.log(`Processed: ${key} → display: ${processedKey}, thumb: ${thumbnailKey}, original: ${originalKey}`);

  return { processedKey, thumbnailKey, originalKey };
}

module.exports = { processUploadedPhoto, deriveKeys };
