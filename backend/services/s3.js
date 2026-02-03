const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const URL_EXPIRATION = 3600; // 1 hour in seconds
const SECURE_URL_EXPIRATION = 900; // 15 minutes in seconds for secure operations

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

// Allowed document MIME types (for receipts and warranties)
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
 * Validate if the content type is an allowed document type
 * @param {string} contentType - MIME type to validate
 * @returns {boolean} True if valid document type
 */
function isValidDocumentType(contentType) {
  return ALLOWED_DOCUMENT_TYPES.includes(contentType.toLowerCase());
}

/**
 * Generate a presigned URL for uploading a file to S3
 * @param {string} key - S3 object key (file path)
 * @param {string} contentType - MIME type of the file
 * @param {boolean} secure - Whether to use secure (short) expiration time
 * @param {boolean} allowDocuments - Whether to allow document types (not just images)
 * @returns {Promise<string>} Presigned upload URL
 * @throws {Error} If content type is not valid
 */
async function generateUploadUrl(key, contentType, secure = true, allowDocuments = false) {
  // Validate file type
  if (allowDocuments) {
    if (!isValidDocumentType(contentType)) {
      throw new Error(`Invalid file type. Allowed types: PDF, images, Word documents. Received: ${contentType}`);
    }
  } else {
    if (!isValidImageType(contentType)) {
      throw new Error(`Invalid file type. Only images are allowed. Received: ${contentType}`);
    }
  }
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });
  
  const expiresIn = secure ? SECURE_URL_EXPIRATION : URL_EXPIRATION;
  
  const url = await getSignedUrl(client, command, {
    expiresIn
  });
  
  return url;
}

/**
 * Generate a presigned URL for downloading a file from S3
 * @param {string} key - S3 object key (file path)
 * @param {boolean} secure - Whether to use secure (short) expiration time
 * @param {string} bucket - Optional bucket name (defaults to BUCKET_NAME)
 * @returns {Promise<string>} Presigned download URL
 */
async function generateDownloadUrl(key, secure = true, bucket = null) {
  // Determine which bucket to use
  let targetBucket = bucket || BUCKET_NAME;
  
  // If key starts with 'qr-codes/', use the QR bucket
  if (key.startsWith('qr-codes/')) {
    targetBucket = process.env.QR_REPORT_BUCKET_NAME || BUCKET_NAME;
  }
  
  const command = new GetObjectCommand({
    Bucket: targetBucket,
    Key: key
  });
  
  const expiresIn = secure ? SECURE_URL_EXPIRATION : URL_EXPIRATION;
  
  const url = await getSignedUrl(client, command, {
    expiresIn
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
  isValidDocumentType,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  SECURE_URL_EXPIRATION
};
