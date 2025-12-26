const QRCode = require('qrcode');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const cacheService = require('./cacheService');

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;

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
   * Generate QR code for a container with specified size
   * @param {string} containerId - Container ID
   * @param {string} size - Size: 'small', 'medium', or 'large'
   * @returns {Promise<Object>} QR code data including ID, S3 key, and URL
   */
  async generateContainerQRCode(containerId, size = 'medium') {
    // Check cache first
    const cachedQRCode = await cacheService.getCachedQRCodeImage(containerId, size);
    if (cachedQRCode) {
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

    const qrCodeData = {
      qrCodeId,
      s3Key,
      size,
      containerId,
      generatedAt: new Date().toISOString(),
      imageUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`
    };

    // Cache the QR code data
    await cacheService.cacheQRCodeImage(containerId, size, qrCodeData);

    return qrCodeData;
  }

  /**
   * Generate multiple QR codes for containers in batch
   * @param {Array<string>} containerIds - Array of container IDs
   * @param {string} size - Size: 'small', 'medium', or 'large'
   * @returns {Promise<Array<Object>>} Array of QR code data
   */
  async generateBatchQRCodes(containerIds, size = 'medium') {
    if (!Array.isArray(containerIds) || containerIds.length === 0) {
      throw new Error('Container IDs must be a non-empty array');
    }

    if (containerIds.length > 50) {
      throw new Error('Batch size cannot exceed 50 containers');
    }

    const results = [];
    const errors = [];

    // Process containers in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < containerIds.length; i += concurrencyLimit) {
      const batch = containerIds.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (containerId) => {
        try {
          const qrCodeData = await this.generateContainerQRCode(containerId, size);
          return { success: true, containerId, data: qrCodeData };
        } catch (error) {
          return { success: false, containerId, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({ containerId: result.containerId, error: result.error });
        }
      });
    }

    return {
      successful: results,
      failed: errors,
      totalProcessed: containerIds.length,
      successCount: results.length,
      failureCount: errors.length
    };
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
   * Validate QR code format and authenticity
   * @param {string} qrCodeId - QR code identifier
   * @returns {boolean} True if valid
   */
  validateQRCode(qrCodeId) {
    try {
      const decoded = this.decodeQRCodeId(qrCodeId);
      
      // Check if timestamp is reasonable (not too old, not in future)
      const now = Date.now();
      const qrTimestamp = decoded.timestamp;
      const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      
      if (qrTimestamp > now || (now - qrTimestamp) > maxAge) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Scan and validate QR code, returning container information
   * @param {string} qrCodeData - Raw QR code data from scanner
   * @returns {Object} Scan result with container ID and validation status
   */
  scanQRCode(qrCodeData) {
    try {
      // Validate QR code format and authenticity
      if (!this.validateQRCode(qrCodeData)) {
        return {
          success: false,
          error: 'INVALID_QR_CODE',
          message: 'Invalid or expired QR code'
        };
      }

      // Decode QR code to get container information
      const decoded = this.decodeQRCodeId(qrCodeData);

      return {
        success: true,
        containerId: decoded.containerId,
        qrCodeId: qrCodeData,
        generatedAt: decoded.generatedAt,
        timestamp: decoded.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: 'QR_DECODE_ERROR',
        message: `Failed to decode QR code: ${error.message}`
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