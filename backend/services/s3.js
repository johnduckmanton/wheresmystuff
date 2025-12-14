const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const URL_EXPIRATION = 3600; // 1 hour in seconds

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

/**
 * Validate if the content type is an allowed image type
 * @param {string} contentType - MIME type to validate
 * @returns {boolean} True if valid image type
 */
function isValidImageType(contentType) {
  return ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase());
}

/**
 * Generate a presigned URL for uploading a file to S3
 * @param {string} key - S3 object key (file path)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} Presigned upload URL
 * @throws {Error} If content type is not a valid image type
 */
async function generateUploadUrl(key, contentType) {
  // Validate file type
  if (!isValidImageType(contentType)) {
    throw new Error(`Invalid file type. Only images are allowed. Received: ${contentType}`);
  }
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });
  
  const url = await getSignedUrl(client, command, {
    expiresIn: URL_EXPIRATION
  });
  
  return url;
}

/**
 * Generate a presigned URL for downloading a file from S3
 * @param {string} key - S3 object key (file path)
 * @returns {Promise<string>} Presigned download URL
 */
async function generateDownloadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });
  
  const url = await getSignedUrl(client, command, {
    expiresIn: URL_EXPIRATION
  });
  
  return url;
}

/**
 * Delete an object from S3
 * @param {string} key - S3 object key (file path)
 * @returns {Promise<void>}
 */
async function deleteObject(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });
  
  await client.send(command);
}

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
  deleteObject,
  isValidImageType,
  ALLOWED_IMAGE_TYPES
};
