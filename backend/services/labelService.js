const QRCodeService = require('./qrCodeService');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');

const s3Client = new S3Client({});
const qrCodeService = new QRCodeService();
const BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;

/**
 * Label Service for generating printable labels with QR codes
 */
class LabelService {
  /**
   * Get label dimensions based on size
   * A5 label dimensions: 148mm x 210mm (5.83" x 8.27")
   * @param {string} size - Label size (small, medium, large)
   * @returns {Object} Label dimensions and settings
   */
  getLabelDimensions(size) {
    const dimensions = {
      small: {
        width: 420,   // 2x3 inches at 144 DPI (2" = 288px, 3" = 432px)
        height: 432,
        qrSize: 180,
        fontSize: 12,
        nameFontSize: 18,
        padding: 20,
        dpi: 144
      },
      medium: {
        width: 432,   // 3x4 inches at 144 DPI (3" = 432px, 4" = 576px)
        height: 576,
        qrSize: 220,
        fontSize: 14,
        nameFontSize: 22,
        padding: 25,
        dpi: 144
      },
      large: {
        width: 576,   // 4x6 inches at 144 DPI (4" = 576px, 6" = 864px)
        height: 864,
        qrSize: 280,
        fontSize: 16,
        nameFontSize: 28,
        padding: 30,
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
   * This creates a PNG label image using Sharp's image composition
   * @param {Object} containerData - Container information
   * @param {string} containerData.id - Container ID
   * @param {string} containerData.name - Container name
   * @param {string} containerData.type - Container type
   * @param {string} containerData.createdAt - Creation date
   * @param {Array<string>} containerData.handlingFlags - Special handling flags (fragile, keep_upright, etc.)
   * @param {string} size - Label size (small, medium, large)
   * @returns {Promise<Buffer>} Label PNG buffer
   */
  async generateLabel(containerData, size = 'medium') {
    const dimensions = this.getLabelDimensions(size);
    const { width, height, qrSize, fontSize, nameFontSize, padding } = dimensions;
    
    // Generate QR code for the container
    const qrCodeId = qrCodeService.generateQRCodeId(containerData.id);
    
    // Generate QR code as PNG buffer
    const QRCode = require('qrcode');
    const qrCodeBuffer = await QRCode.toBuffer(qrCodeId, {
      type: 'png',
      width: qrSize,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Format data
    const createdDate = new Date(containerData.createdAt).toLocaleDateString();
    const containerType = containerData.type.charAt(0).toUpperCase() + containerData.type.slice(1);
    const contentsSummary = containerData.contentsSummary || '';
    const containerId = containerData.id.substring(0, 16) + '...';
    
    // Calculate layout positions
    const borderPadding = 15;
    const innerPadding = 20;
    const sectionY = borderPadding + innerPadding;
    
    // Handling icons in top right
    const iconSize = 50;
    const iconSpacing = 10;
    const handlingFlags = containerData.handlingFlags || [];
    const totalIconsWidth = handlingFlags.length > 0 ? (handlingFlags.length * iconSize) + ((handlingFlags.length - 1) * iconSpacing) : 0;
    const iconsStartX = width - borderPadding - innerPadding - totalIconsWidth;
    const iconsY = sectionY;
    
    // QR code at bottom center
    const qrX = Math.round((width - qrSize) / 2);
    const qrY = height - borderPadding - innerPadding - qrSize - 50;
    
    // Create base SVG with borders and text
    const labelSvg = `
      <svg width="${width}" height="${height}">
        <!-- Outer border -->
        <rect x="${borderPadding}" y="${borderPadding}" 
              width="${width - borderPadding * 2}" height="${height - borderPadding * 2}" 
              fill="white" stroke="black" stroke-width="3" rx="8"/>
        
        <!-- BOX DETAILS section header -->
        <text x="${borderPadding + innerPadding}" y="${sectionY + 20}" 
              font-family="Arial" font-size="${fontSize + 2}" font-weight="bold" fill="#000">BOX DETAILS</text>
        
        <!-- Horizontal line after header -->
        <line x1="${borderPadding + innerPadding}" y1="${sectionY + 30}" 
              x2="${width - borderPadding - innerPadding}" y2="${sectionY + 30}" 
              stroke="black" stroke-width="1"/>
        
        <!-- Container name (large) -->
        <text x="${borderPadding + innerPadding}" y="${sectionY + 60}" 
              font-family="Arial" font-size="${nameFontSize}" font-weight="bold" fill="#000">${this._escapeXml(containerData.name)}</text>
        
        <!-- Container type -->
        <text x="${borderPadding + innerPadding}" y="${sectionY + 90}" 
              font-family="Arial" font-size="${fontSize}" fill="#333">Type: ${this._escapeXml(containerType)}</text>
        
        <!-- Contents summary -->
        ${contentsSummary ? `<text x="${borderPadding + innerPadding}" y="${sectionY + 115}" 
              font-family="Arial" font-size="${fontSize - 2}" fill="#333">${this._escapeXml(contentsSummary.substring(0, 40))}</text>` : ''}
        
        <!-- Horizontal line before bottom section -->
        <line x1="${borderPadding + innerPadding}" y1="${qrY - 20}" 
              x2="${width - borderPadding - innerPadding}" y2="${qrY - 20}" 
              stroke="black" stroke-width="1"/>
        
        <!-- Container ID underneath QR code -->
        <text x="${width / 2}" y="${qrY + qrSize + 20}" 
              font-family="Arial" font-size="${fontSize - 2}" font-weight="bold" text-anchor="middle" fill="#000">${this._escapeXml(containerId)}</text>
        
        <!-- Creation date at bottom left -->
        <text x="${borderPadding + innerPadding}" y="${height - borderPadding - innerPadding - 10}" 
              font-family="Arial" font-size="${fontSize - 4}" fill="#666">Created: ${createdDate}</text>
      </svg>
    `;

    // Start with the base label
    const compositeOps = [
      {
        input: Buffer.from(labelSvg),
        top: 0,
        left: 0
      },
      {
        input: qrCodeBuffer,
        top: qrY,
        left: qrX
      }
    ];

    // Add handling flag icons in top right
    if (handlingFlags.length > 0) {
      let currentX = iconsStartX;

      for (const flag of handlingFlags) {
        const iconData = this._getHandlingIconData(flag, iconSize);
        if (iconData) {
          const iconSvg = `
            <svg width="${iconSize}" height="${iconSize + 25}">
              ${iconData.svg}
              <text x="${iconSize / 2}" y="${iconSize + 18}" 
                    font-family="Arial" font-size="9" font-weight="bold" 
                    text-anchor="middle" fill="${iconData.color}">${iconData.label}</text>
            </svg>
          `;
          compositeOps.push({
            input: Buffer.from(iconSvg),
            top: iconsY,
            left: currentX
          });
          currentX += iconSize + iconSpacing;
        }
      }
    }

    // Create white background and composite everything
    const pngBuffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite(compositeOps)
      .png()
      .toBuffer();
    
    return pngBuffer;
  }

  /**
   * Escape XML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  _escapeXml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Create SVG label with container information (QR code added separately)
   * Includes special handling icons for fragile, keep upright, etc.
   * @param {Object} containerData - Container information
   * @param {string} qrCodeSvg - Not used, kept for compatibility
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
    const boxDetailsY = nameY + nameFontSize + (availableHeight * 0.12);
    const typeY = boxDetailsY + fontSize + (availableHeight * 0.1);
    const contentsY = typeY + fontSize + (availableHeight * 0.08);
    const dateY = contentsY + fontSize + (availableHeight * 0.08);
    const idY = dateY + fontSize + (availableHeight * 0.06);
    
    // Special handling section at the bottom
    const handlingY = height - padding - 60;
    
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
      if (!text) return '';
      return String(text).replace(/&/g, '&amp;')
                 .replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;')
                 .replace(/"/g, '&quot;')
                 .replace(/'/g, '&#39;');
    };
    
    // Get handling flags
    const handlingFlags = containerData.handlingFlags || [];
    
    // Generate handling icons section
    const handlingIconsSection = this._generateHandlingIcons(handlingFlags, handlingY, width, fontSize);
    
    const labelSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      text {
        font-family: Arial, Helvetica, sans-serif;
      }
    </style>
  </defs>
  
  <!-- White background with clean border -->
  <rect width="${width}" height="${height}" fill="white" stroke="#333" stroke-width="2"/>
  
  <!-- QR Code placeholder (will be composited as PNG) -->
  <rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="white" stroke="#ddd" stroke-width="1"/>
  
  <!-- Container Name - Bold and prominent -->
  <text x="${centerX}" y="${nameY}" 
        font-size="${nameFontSize}" 
        font-weight="bold" 
        text-anchor="middle" 
        fill="#000">
    ${escapeSvgText(containerData.name)}
  </text>
  
  <!-- Box Details Section Header -->
  <text x="${centerX}" y="${boxDetailsY}" 
        font-size="${fontSize}" 
        font-weight="bold"
        text-anchor="middle" 
        fill="#333">
    BOX DETAILS
  </text>
  
  <!-- Container Type -->
  <text x="${centerX}" y="${typeY}" 
        font-size="${fontSize}" 
        text-anchor="middle" 
        fill="#666">
    Type: ${escapeSvgText(containerData.type.charAt(0).toUpperCase() + containerData.type.slice(1))}
  </text>
  
  <!-- Contents Summary - Only show if it fits -->
  ${contentsSummary ? `
  <text x="${centerX}" y="${contentsY}" 
        font-size="${fontSize - 2}" 
        font-weight="600"
        text-anchor="middle" 
        fill="#333">
    ${escapeSvgText(contentsSummary)}
  </text>` : ''}
  
  <!-- Creation Date -->
  <text x="${centerX}" y="${dateY}" 
        font-size="${fontSize - 2}" 
        text-anchor="middle" 
        fill="#888">
    Created: ${createdDate}
  </text>
  
  <!-- Container ID -->
  <text x="${centerX}" y="${idY}" 
        font-size="${fontSize - 4}" 
        text-anchor="middle" 
        fill="#aaa">
    ID: ${escapeSvgText(containerData.id.substring(0, 16))}...
  </text>
  
  ${handlingIconsSection}
</svg>`;

    return labelSvg;
  }

  /**
   * Generate handling icons and text for special requirements
   * @param {Array<string>} handlingFlags - Array of handling flags
   * @param {number} startY - Y position to start rendering icons
   * @param {number} width - Label width
   * @param {number} fontSize - Base font size
   * @returns {string} SVG markup for handling icons
   * @private
   */
  _generateHandlingIcons(handlingFlags, startY, width, fontSize) {
    if (!handlingFlags || handlingFlags.length === 0) {
      return '';
    }

    const iconSize = 40;
    const iconSpacing = 15;
    const totalIconsWidth = (handlingFlags.length * iconSize) + ((handlingFlags.length - 1) * iconSpacing);
    const startX = (width - totalIconsWidth) / 2;

    let iconsMarkup = '';
    let currentX = startX;

    handlingFlags.forEach((flag, index) => {
      const iconData = this._getHandlingIconData(flag, iconSize);
      if (iconData) {
        iconsMarkup += `
  <!-- ${flag} icon -->
  <g transform="translate(${currentX}, ${startY})">
    ${iconData.svg}
    <text x="${iconSize / 2}" y="${iconSize + fontSize + 4}" 
          font-size="${fontSize - 2}" 
          font-weight="bold"
          text-anchor="middle" 
          fill="${iconData.color}">
      ${iconData.label}
    </text>
  </g>`;
        currentX += iconSize + iconSpacing;
      }
    });

    return iconsMarkup;
  }

  /**
   * Get icon SVG and metadata for a handling flag
   * @param {string} flag - Handling flag
   * @param {number} size - Icon size
   * @returns {Object} Icon data with SVG, label, and color
   * @private
   */
  _getHandlingIconData(flag, size) {
    const icons = {
      fragile: {
        label: 'FRAGILE',
        color: '#DC2626',
        svg: `<rect width="${size}" height="${size}" fill="none" stroke="#DC2626" stroke-width="2" rx="4"/>
    <path d="M${size/2} ${size*0.2} L${size*0.7} ${size*0.5} L${size*0.6} ${size*0.5} L${size*0.6} ${size*0.8} L${size*0.4} ${size*0.8} L${size*0.4} ${size*0.5} L${size*0.3} ${size*0.5} Z" 
          fill="#DC2626" stroke="#DC2626" stroke-width="1"/>
    <circle cx="${size/2}" cy="${size*0.35}" r="${size*0.08}" fill="#DC2626"/>`
      },
      keep_upright: {
        label: 'THIS WAY UP',
        color: '#2563EB',
        svg: `<rect width="${size}" height="${size}" fill="none" stroke="#2563EB" stroke-width="2" rx="4"/>
    <path d="M${size/2} ${size*0.25} L${size*0.7} ${size*0.5} L${size*0.55} ${size*0.5} L${size*0.55} ${size*0.75} L${size*0.45} ${size*0.75} L${size*0.45} ${size*0.5} L${size*0.3} ${size*0.5} Z" 
          fill="#2563EB" stroke="#2563EB" stroke-width="1"/>`
      },
      heavy: {
        label: 'HEAVY',
        color: '#7C3AED',
        svg: `<rect width="${size}" height="${size}" fill="none" stroke="#7C3AED" stroke-width="2" rx="4"/>
    <text x="${size/2}" y="${size*0.65}" font-family="Arial, sans-serif" font-size="${size*0.4}" font-weight="bold" text-anchor="middle" fill="#7C3AED">H</text>`
      },
      valuable: {
        label: 'VALUABLE',
        color: '#CA8A04',
        svg: `<rect width="${size}" height="${size}" fill="none" stroke="#CA8A04" stroke-width="2" rx="4"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.25}" fill="none" stroke="#CA8A04" stroke-width="2"/>
    <text x="${size/2}" y="${size*0.62}" font-family="Arial, sans-serif" font-size="${size*0.35}" font-weight="bold" text-anchor="middle" fill="#CA8A04">$</text>`
      },
      priority: {
        label: 'PRIORITY',
        color: '#DC2626',
        svg: `<rect width="${size}" height="${size}" fill="none" stroke="#DC2626" stroke-width="2" rx="4"/>
    <text x="${size/2}" y="${size*0.65}" font-family="Arial, sans-serif" font-size="${size*0.35}" font-weight="bold" text-anchor="middle" fill="#DC2626">!</text>`
      },
      temperature_sensitive: {
        label: 'TEMP SENSITIVE',
        color: '#0891B2',
        svg: `<rect width="${size}" height="${size}" fill="none" stroke="#0891B2" stroke-width="2" rx="4"/>
    <circle cx="${size/2}" cy="${size*0.35}" r="${size*0.12}" fill="none" stroke="#0891B2" stroke-width="2"/>
    <rect x="${size*0.43}" y="${size*0.45}" width="${size*0.14}" height="${size*0.3}" fill="none" stroke="#0891B2" stroke-width="2"/>`
      }
    };

    return icons[flag] || null;
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
   * @param {Buffer} labelBuffer - Label PNG buffer
   * @param {string} size - Size identifier
   * @returns {Promise<string>} S3 key for the stored image
   */
  async storeLabelImage(containerId, labelBuffer, size) {
    const timestamp = Date.now();
    const key = `labels/${containerId}/${size}_${timestamp}.png`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: labelBuffer,
      ContentType: 'image/png',
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
   * Generate presigned download URL for a label
   * @param {string} s3Key - S3 key for the label
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Presigned download URL
   */
  async generatePresignedUrl(s3Key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    });

    try {
      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Generate complete label with storage and download URL
   * @param {Object} containerData - Container information
   * @param {string} size - Label size (small, medium, large)
   * @returns {Promise<Object>} Label data with s3Key, downloadUrl, size, generatedAt
   */
  async generateLabelWithUrl(containerData, size = 'medium') {
    // Generate label image
    const labelBuffer = await this.generateLabel(containerData, size);
    
    // Store in S3
    const s3Key = await this.storeLabelImage(containerData.id, labelBuffer, size);
    
    // Generate presigned download URL
    const downloadUrl = await this.generatePresignedUrl(s3Key);
    
    return {
      containerId: containerData.id,
      s3Key,
      downloadUrl,
      size,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate a multi-container label sheet as PNG
   * @param {Array<Object>} containersData - Array of container data
   * @param {string} size - Label size
   * @param {Object} sheetOptions - Sheet layout options
   * @returns {Promise<Buffer>} Label sheet PNG buffer
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

      // Generate individual label SVG (we need the SVG version for compositing)
      const qrCodeId = qrCodeService.generateQRCodeId(containersData[i].id);
      const QRCode = require('qrcode');
      const qrCodeSvg = await QRCode.toString(qrCodeId, {
        type: 'svg',
        width: 100,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      const labelSvgString = this.createLabelSVG(containersData[i], qrCodeSvg, dimensions);
      
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

    // Convert SVG to PNG
    const pngBuffer = await sharp(Buffer.from(sheetSvg, 'utf8'))
      .png()
      .toBuffer();

    return pngBuffer;
  }
}

module.exports = LabelService;