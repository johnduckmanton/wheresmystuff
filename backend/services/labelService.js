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
        qrSize: 140,  // 50% of width for good proportion
        fontSize: 12,
        nameFontSize: 16,  // Proportional to label size
        padding: 15,
        dpi: 144
      },
      medium: {
        width: 432,  // 3 inches at 144 DPI
        height: 432,
        qrSize: 210,  // 50% of width for good proportion
        fontSize: 16,
        nameFontSize: 24,  // Proportional to label size
        padding: 20,
        dpi: 144
      },
      large: {
        width: 576,  // 4 inches at 144 DPI
        height: 576,
        qrSize: 280,  // 50% of width for good proportion
        fontSize: 20,
        nameFontSize: 32,  // Proportional to label size
        padding: 25,
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
    
    // Generate QR code as SVG and extract the path data
    const QRCode = require('qrcode');
    const qrCodeSvg = await QRCode.toString(qrCodeId, {
      type: 'svg',
      width: 100,  // Small base size, we'll scale it up
      margin: 0,
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
    const { width, height, qrSize, fontSize, nameFontSize, padding } = dimensions;
    
    // Calculate proportional layout that scales with label size
    const centerX = width / 2;
    const qrX = centerX - qrSize / 2;
    const qrY = padding;
    
    // Calculate text positions based on proportions of the label height
    const availableHeight = height - (padding * 2) - qrSize;
    const textStartY = qrY + qrSize + (availableHeight * 0.15); // 15% of remaining space
    
    const nameY = textStartY;
    const contentsY = nameY + nameFontSize + (availableHeight * 0.12);
    const typeY = contentsY + fontSize + (availableHeight * 0.1);
    const dateY = typeY + fontSize + (availableHeight * 0.08);
    const idY = dateY + fontSize + (availableHeight * 0.06);
    
    // Format creation date
    const createdDate = new Date(containerData.createdAt).toLocaleDateString();
    
    // Calculate content summary length based on label width and font size
    const maxContentsLength = Math.floor((width - padding * 2) / (fontSize * 0.6));
    let contentsSummary = containerData.contentsSummary || '';
    if (contentsSummary.length > maxContentsLength) {
      contentsSummary = contentsSummary.substring(0, maxContentsLength - 3) + '...';
    }
    
    // Escape text for SVG
    const escapeSvgText = (text) => {
      return text.replace(/&/g, '&amp;')
                 .replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;')
                 .replace(/"/g, '&quot;')
                 .replace(/'/g, '&#39;');
    };
    
    // Extract the QR code content and get the viewBox from the original SVG
    const qrCodeMatch = qrCodeSvg.match(/<svg[^>]*viewBox="([^"]*)"[^>]*>(.*?)<\/svg>/s);
    const viewBox = qrCodeMatch ? qrCodeMatch[1] : '0 0 100 100';
    const qrCodeContent = qrCodeMatch ? qrCodeMatch[2] : qrCodeSvg.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
    
    const labelSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- White background with clean border -->
  <rect width="${width}" height="${height}" fill="white" stroke="#333" stroke-width="1"/>
  
  <!-- QR Code - Scaled to fill the exact bounding box -->
  <g transform="translate(${qrX}, ${qrY})">
    <rect width="${qrSize}" height="${qrSize}" fill="white" stroke="#ddd" stroke-width="1"/>
    <svg x="2" y="2" width="${qrSize - 4}" height="${qrSize - 4}" viewBox="${viewBox}">
      ${qrCodeContent}
    </svg>
  </g>
  
  <!-- Container Name - Scaled proportionally -->
  <text x="${centerX}" y="${nameY}" 
        font-family="Arial, sans-serif" 
        font-size="${nameFontSize}" 
        font-weight="bold" 
        text-anchor="middle" 
        fill="#000">
    ${escapeSvgText(containerData.name)}
  </text>
  
  <!-- Contents Summary - Only show if it fits -->
  ${contentsSummary && contentsY + fontSize < typeY - 5 ? `
  <text x="${centerX}" y="${contentsY}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="600"
        text-anchor="middle" 
        fill="#333">
    ${escapeSvgText(contentsSummary)}
  </text>` : ''}
  
  <!-- Container Type - Scaled font -->
  <text x="${centerX}" y="${typeY}" 
        font-family="Arial, sans-serif" 
        font-size="${Math.max(8, fontSize - 2)}" 
        text-anchor="middle" 
        fill="#666">
    ${escapeSvgText(containerData.type.charAt(0).toUpperCase() + containerData.type.slice(1))}
  </text>
  
  <!-- Creation Date - Scaled font -->
  <text x="${centerX}" y="${dateY}" 
        font-family="Arial, sans-serif" 
        font-size="${Math.max(8, fontSize - 4)}" 
        text-anchor="middle" 
        fill="#888">
    ${createdDate}
  </text>
  
  <!-- Container ID - Scaled font with minimum size -->
  <text x="${centerX}" y="${idY}" 
        font-family="Arial, monospace" 
        font-size="${Math.max(6, fontSize - 6)}" 
        text-anchor="middle" 
        fill="#aaa">
    ${escapeSvgText(containerData.id)}
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