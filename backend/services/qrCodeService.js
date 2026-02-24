const QRCode = require('qrcode');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const cacheService = require('./cacheService');

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;

console.log('🪣 QR Code Service initialized with bucket:', BUCKET_NAME);

/**
 * QR Code Service for generating and managing QR codes for containers
 */
class QRCodeService {
  /**
   * Generate a unique QR code identifier for a container
   * @param {string} containerId - Container ID
   * @returns {string} Unique QR code identifier
   */
  generateQRCodeId(containerId) {
    // Create a unique QR code ID that includes container ID and timestamp
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    return `CONT_${containerId}_${timestamp}_${uniqueId}`;
  }

  /**
   * Generate QR code image data
   * @param {string} qrCodeId - QR code identifier
   * @param {Object} options - QR code generation options
   * @param {number} options.width - QR code width in pixels
   * @param {number} options.margin - QR code margin
   * @param {string} options.color.dark - Dark color (default: black)
   * @param {string} options.color.light - Light color (default: white)
   * @returns {Promise<Buffer>} QR code image buffer
   */
  async generateQRCodeImage(qrCodeId, options = {}) {
    const defaultOptions = {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    try {
      const qrCodeBuffer = await QRCode.toBuffer(qrCodeId, qrOptions);
      return qrCodeBuffer;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Store QR code image in S3
   * @param {string} containerId - Container ID
   * @param {Buffer} imageBuffer - QR code image buffer
   * @param {string} size - Size identifier (small, medium, large)
   * @returns {Promise<string>} S3 key for the stored image
   */
  async storeQRCodeImage(containerId, imageBuffer, size = 'medium') {
    const timestamp = Date.now();
    const key = `qr-codes/${containerId}/${size}_${timestamp}.png`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
      Metadata: {
        containerId: containerId,
        size: size,
        generatedAt: timestamp.toString()
      }
    });

    try {
      await s3Client.send(command);
      return key;
    } catch (error) {
      throw new Error(`Failed to store QR code image: ${error.message}`);
    }
  }

  /**
   * Generate presigned download URL for QR code image
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} Presigned download URL
   */
  async generateDownloadUrl(s3Key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    });

    try {
      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error(`Failed to generate presigned URL for ${s3Key}:`, error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Generate QR code for a container with specified size
   * @param {string} containerId - Container ID
   * @param {string} size - Size: 'small', 'medium', or 'large'
   * @returns {Promise<Object>} QR code data including ID, S3 key, and URL
   */
  async generateContainerQRCode(containerId, size = 'medium') {
    console.log('🎯 generateContainerQRCode called:', { containerId, size, bucketName: BUCKET_NAME });
    
    // Check if bucket name is configured
    if (!BUCKET_NAME) {
      const error = new Error('QR_REPORT_BUCKET_NAME environment variable is not set');
      console.error('❌ Bucket name not configured:', error.message);
      throw error;
    }
    
    // Check cache first
    const cachedQRCode = await cacheService.getCachedQRCodeImage(containerId, size);
    if (cachedQRCode) {
      console.log('✅ Returning cached QR code for container:', containerId);
      return {
        ...cachedQRCode,
        fromCache: true
      };
    }

    // Size configurations
    const sizeConfigs = {
      small: { width: 150, margin: 1 },
      medium: { width: 200, margin: 2 },
      large: { width: 300, margin: 3 }
    };

    if (!sizeConfigs[size]) {
      throw new Error(`Invalid size: ${size}. Must be small, medium, or large`);
    }

    // Generate unique QR code ID
    const qrCodeId = this.generateQRCodeId(containerId);

    // Generate QR code image
    const imageBuffer = await this.generateQRCodeImage(qrCodeId, sizeConfigs[size]);

    // Store in S3
    const s3Key = await this.storeQRCodeImage(containerId, imageBuffer, size);

    // Generate presigned download URL
    const downloadUrl = await this.generateDownloadUrl(s3Key);

    const qrCodeData = {
      qrCodeId,
      s3Key,
      size,
      containerId,
      generatedAt: new Date().toISOString(),
      imageUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`,
      downloadUrl
    };

    // Cache the QR code data
    await cacheService.cacheQRCodeImage(containerId, size, qrCodeData);

    return qrCodeData;
  }

  /**
   * Decode QR code ID to extract container information
   * @param {string} qrCodeId - QR code identifier
   * @returns {Object} Decoded container information
   */
  decodeQRCodeId(qrCodeId) {
    try {
      // Expected format: CONT_{containerId}_{timestamp}_{uniqueId}
      const parts = qrCodeId.split('_');
      
      if (parts.length !== 4 || parts[0] !== 'CONT') {
        throw new Error('Invalid QR code format');
      }

      return {
        containerId: parts[1],
        timestamp: parseInt(parts[2]),
        uniqueId: parts[3],
        generatedAt: new Date(parseInt(parts[2])).toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to decode QR code: ${error.message}`);
    }
  }

  /**
   * Validate QR code format and authenticity with detailed error reporting
   * @param {string} qrCodeId - QR code identifier
   * @returns {Object} Validation result with success status and error details
   */
  validateQRCode(qrCodeId) {
    try {
      // Check format first
      if (!this.validateQRCodeFormat(qrCodeId)) {
        return {
          valid: false,
          error: 'INVALID_FORMAT',
          message: 'QR code format is invalid. Expected format: CONT_{containerId}_{timestamp}_{uniqueId}'
        };
      }

      const decoded = this.decodeQRCodeId(qrCodeId);
      
      // Check if timestamp is reasonable (not too old, not in future)
      const now = Date.now();
      const qrTimestamp = decoded.timestamp;
      const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      
      if (qrTimestamp > now) {
        return {
          valid: false,
          error: 'FUTURE_TIMESTAMP',
          message: 'QR code has a future timestamp and may be invalid'
        };
      }
      
      if ((now - qrTimestamp) > maxAge) {
        const ageInDays = Math.floor((now - qrTimestamp) / (24 * 60 * 60 * 1000));
        return {
          valid: false,
          error: 'EXPIRED',
          message: `QR code is expired (${ageInDays} days old, maximum age is 365 days)`
        };
      }

      return {
        valid: true,
        decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: 'DECODE_ERROR',
        message: `Failed to decode QR code: ${error.message}`
      };
    }
  }

  /**
   * Scan and validate QR code, returning container information
   * Logs security events for invalid QR codes
   * @param {string} qrCodeData - Raw QR code data from scanner
   * @param {string} userId - User ID for security logging (optional)
   * @returns {Object} Scan result with container ID and validation status
   */
  async scanQRCode(qrCodeData, userId = 'anonymous') {
    try {
      // Validate QR code format and authenticity
      const validation = this.validateQRCode(qrCodeData);
      
      if (!validation.valid) {
        // Log security event for invalid QR code
        console.error('Invalid QR code scan attempt:', {
          userId,
          qrCodeData: qrCodeData.substring(0, 20) + '...', // Log partial data for security
          error: validation.error,
          message: validation.message,
          timestamp: new Date().toISOString()
        });

        // Import audit log service for security logging
        const auditLogService = require('./auditLogService');
        await auditLogService.logSecurityEvent(userId, 'invalid_qr_scan', 'qr_code', {
          qrCodePrefix: qrCodeData.substring(0, 20),
          validationError: validation.error,
          errorMessage: validation.message
        });

        return {
          success: false,
          error: validation.error,
          message: validation.message
        };
      }

      // Decode QR code to get container information
      const decoded = validation.decoded;

      return {
        success: true,
        containerId: decoded.containerId,
        qrCodeId: qrCodeData,
        generatedAt: decoded.generatedAt,
        timestamp: decoded.timestamp
      };
    } catch (error) {
      // Log security event for unexpected errors
      console.error('QR code scan error:', {
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      const auditLogService = require('./auditLogService');
      await auditLogService.logSecurityEvent(userId, 'qr_scan_error', 'qr_code', {
        errorMessage: error.message,
        errorStack: error.stack
      });

      return {
        success: false,
        error: 'QR_SCAN_ERROR',
        message: `Failed to scan QR code: ${error.message}`
      };
    }
  }

  /**
   * Validate QR code format without checking timestamp constraints
   * Used for manual entry validation
   * @param {string} qrCodeId - QR code identifier
   * @returns {boolean} True if format is valid
   */
  validateQRCodeFormat(qrCodeId) {
    try {
      const parts = qrCodeId.split('_');
      return parts.length === 4 && parts[0] === 'CONT';
    } catch (error) {
      return false;
    }
  }
}

module.exports = QRCodeService;