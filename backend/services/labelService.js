const QRCodeService = require('./qrCodeService');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({});
const qrCodeService = new QRCodeService();
const BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;

/**
 * Label Service for generating printable labels with QR codes
 */
class LabelService {
  /**
   * Get label dimensions based on size
   * @param {string} size - Label size (small, medium, large)
   * @returns {Object} Label dimensions and settings
   */
  getLabelDimensions(size) {
    const dimensions = {
      small: {
        width: 288,  // 2 inches at 144 DPI
        height: 288,
        qrSize: 120,
        fontSize: 12,
        padding: 20,
        dpi: 144
      },
      medium: {
        width: 432,  // 3 inches at 144 DPI
        height: 432,
        qrSize: 180,
        fontSize: 16,
        padding: 30,
        dpi: 144
      },
      large: {
        width: 576,  // 4 inches at 144 DPI
        height: 576,
        qrSize: 240,
        fontSize: 20,
        padding: 40,
        dpi: 144
      }
    };

    if (!dimensions[size]) {
      throw new Error(`Invalid label size: ${size}. Must be small, medium, or large`);
    }

    return dimensions[size];
  }

  /**
   * Generate a printable label with QR code and container information
   * This creates an SVG-based label that can be converted to other formats
   * @param {Object} containerData - Container information
   * @param {string} containerData.id - Container ID
   * @param {string} containerData.name - Container name
   * @param {string} containerData.type - Container type
   * @param {string} containerData.createdAt - Creation date
   * @param {string} size - Label size (small, medium, large)
   * @returns {Promise<Buffer>} Label SVG buffer
   */
  async generateLabel(containerData, size = 'medium') {
    const dimensions = this.getLabelDimensions(size);
    
    // Generate QR code for the container
    const qrCodeId = qrCodeService.generateQRCodeId(containerData.id);
    
    // Generate QR code as SVG (the qrcode library supports SVG output)
    const QRCode = require('qrcode');
    const qrCodeSvg = await QRCode.toString(qrCodeId, {
      type: 'svg',
      width: dimensions.qrSize,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Create SVG label
    const labelSvg = this.createLabelSVG(containerData, qrCodeSvg, dimensions);
    
    return Buffer.from(labelSvg, 'utf8');
  }

  /**
   * Create SVG label with QR code and container information
   * @param {Object} containerData - Container information
   * @param {string} qrCodeSvg - QR code SVG string
   * @param {Object} dimensions - Label dimensions
   * @returns {string} Complete label SVG
   */
  createLabelSVG(containerData, qrCodeSvg, dimensions) {
    const { width, height, qrSize, fontSize, padding } = dimensions;
    
    // Calculate positions
    const centerX = width / 2;
    const qrX = centerX - qrSize / 2;
    const qrY = padding;
    
    // Text positions
    const nameY = qrY + qrSize + 30;
    const typeY = nameY + fontSize + 20;
    const dateY = typeY + fontSize + 15;
    const idY = dateY + fontSize + 15;
    
    // Format creation date
    const createdDate = new Date(containerData.createdAt).toLocaleDateString();
    
    // Escape text for SVG
    const escapeSvgText = (text) => {
      return text.replace(/&/g, '&amp;')
                 .replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;')
                 .replace(/"/g, '&quot;')
                 .replace(/'/g, '&#39;');
    };
    
    // Extract the QR code content and scale it properly
    const qrCodeContent = qrCodeSvg.replace(/<\?xml[^>]*\?>/, '')
                                   .replace(/<svg[^>]*>/, '')
                                   .replace(/<\/svg>/, '');
    
    const labelSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- White background -->
  <rect width="${width}" height="${height}" fill="white" stroke="black" stroke-width="2"/>
  
  <!-- QR Code -->
  <g transform="translate(${qrX}, ${qrY})">
    <rect width="${qrSize}" height="${qrSize}" fill="white"/>
    <g transform="scale(${qrSize/100})">
      ${qrCodeContent}
    </g>
  </g>
  
  <!-- Container Name -->
  <text x="${centerX}" y="${nameY}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize + 4}" 
        font-weight="bold" 
        text-anchor="middle" 
        fill="black">
    ${escapeSvgText(containerData.name)}
  </text>
  
  <!-- Container Type -->
  <text x="${centerX}" y="${typeY}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        text-anchor="middle" 
        fill="black">
    Type: ${escapeSvgText(containerData.type)}
  </text>
  
  <!-- Creation Date -->
  <text x="${centerX}" y="${dateY}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        text-anchor="middle" 
        fill="black">
    Created: ${createdDate}
  </text>
  
  <!-- Container ID -->
  <text x="${centerX}" y="${idY}" 
        font-family="Arial, sans-serif" 
        font-size="${Math.max(8, fontSize - 4)}" 
        text-anchor="middle" 
        fill="black">
    ID: ${escapeSvgText(containerData.id)}
  </text>
</svg>`;

    return labelSvg;
  }

  /**
   * Generate batch labels for multiple containers
   * @param {Array<Object>} containersData - Array of container data
   * @param {string} size - Label size
   * @returns {Promise<Object>} Batch generation results
   */
  async generateBatchLabels(containersData, size = 'medium') {
    if (!Array.isArray(containersData) || containersData.length === 0) {
      throw new Error('Containers data must be a non-empty array');
    }

    if (containersData.length > 50) {
      throw new Error('Batch size cannot exceed 50 containers');
    }

    const results = [];
    const errors = [];

    // Process containers in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < containersData.length; i += concurrencyLimit) {
      const batch = containersData.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (containerData) => {
        try {
          const labelBuffer = await this.generateLabel(containerData, size);
          const s3Key = await this.storeLabelImage(containerData.id, labelBuffer, size);
          
          return {
            success: true,
            containerId: containerData.id,
            data: {
              containerId: containerData.id,
              s3Key,
              size,
              generatedAt: new Date().toISOString()
            }
          };
        } catch (error) {
          return {
            success: false,
            containerId: containerData.id,
            error: error.message
          };
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
      totalProcessed: containersData.length,
      successCount: results.length,
      failureCount: errors.length
    };
  }

  /**
   * Store label image in S3
   * @param {string} containerId - Container ID
   * @param {Buffer} labelBuffer - Label SVG buffer
   * @param {string} size - Size identifier
   * @returns {Promise<string>} S3 key for the stored image
   */
  async storeLabelImage(containerId, labelBuffer, size) {
    const timestamp = Date.now();
    const key = `labels/${containerId}/${size}_label_${timestamp}.svg`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: labelBuffer,
      ContentType: 'image/svg+xml',
      Metadata: {
        containerId: containerId,
        size: size,
        type: 'label',
        generatedAt: timestamp.toString()
      }
    });

    try {
      await s3Client.send(command);
      return key;
    } catch (error) {
      throw new Error(`Failed to store label image: ${error.message}`);
    }
  }

  /**
   * Generate a multi-container label sheet as SVG
   * @param {Array<Object>} containersData - Array of container data
   * @param {string} size - Label size
   * @param {Object} sheetOptions - Sheet layout options
   * @returns {Promise<Buffer>} Label sheet SVG buffer
   */
  async generateLabelSheet(containersData, size = 'medium', sheetOptions = {}) {
    const dimensions = this.getLabelDimensions(size);
    const {
      labelsPerRow = 2,
      labelsPerColumn = 3,
      sheetPadding = 20,
      labelSpacing = 10
    } = sheetOptions;

    const maxLabelsPerSheet = labelsPerRow * labelsPerColumn;
    const labelCount = Math.min(containersData.length, maxLabelsPerSheet);

    // Calculate sheet dimensions
    const sheetWidth = (dimensions.width * labelsPerRow) + (labelSpacing * (labelsPerRow - 1)) + (sheetPadding * 2);
    const sheetHeight = (dimensions.height * labelsPerColumn) + (labelSpacing * (labelsPerColumn - 1)) + (sheetPadding * 2);

    // Start building the SVG sheet
    let sheetSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${sheetWidth}" height="${sheetHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- White background -->
  <rect width="${sheetWidth}" height="${sheetHeight}" fill="white"/>
`;

    // Generate individual labels and place them on the sheet
    for (let i = 0; i < labelCount; i++) {
      const row = Math.floor(i / labelsPerRow);
      const col = i % labelsPerRow;

      const x = sheetPadding + (col * (dimensions.width + labelSpacing));
      const y = sheetPadding + (row * (dimensions.height + labelSpacing));

      // Generate individual label SVG
      const labelBuffer = await this.generateLabel(containersData[i], size);
      const labelSvgString = labelBuffer.toString('utf8');
      
      // Extract the content inside the SVG tags (without the XML declaration and outer SVG)
      const contentMatch = labelSvgString.match(/<svg[^>]*>(.*)<\/svg>/s);
      const labelContent = contentMatch ? contentMatch[1] : '';

      // Add the label content to the sheet with proper positioning
      sheetSvg += `
  <!-- Label ${i + 1}: ${containersData[i].name} -->
  <g transform="translate(${x}, ${y})">
    ${labelContent}
  </g>
`;
    }

    sheetSvg += '</svg>';

    return Buffer.from(sheetSvg, 'utf8');
  }
}

module.exports = LabelService;