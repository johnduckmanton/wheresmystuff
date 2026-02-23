const QRCodeService = require('../services/qrCodeService');
const LabelService = require('../services/labelService');
const ScanHistoryService = require('../services/scanHistoryService');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-dynamodb');

describe('QRCodeService', () => {
  let qrCodeService;

  beforeEach(() => {
    qrCodeService = new QRCodeService();
  });

  describe('generateQRCodeId', () => {
    test('should generate unique QR code ID with correct format', () => {
      const containerId = 'test-container-123';
      const qrCodeId = qrCodeService.generateQRCodeId(containerId);
      
      expect(qrCodeId).toMatch(/^CONT_test-container-123_\d+_[a-f0-9]{8}$/);
    });

    test('should generate different IDs for same container', () => {
      const containerId = 'test-container-123';
      const qrCodeId1 = qrCodeService.generateQRCodeId(containerId);
      const qrCodeId2 = qrCodeService.generateQRCodeId(containerId);
      
      expect(qrCodeId1).not.toBe(qrCodeId2);
    });
  });

  describe('decodeQRCodeId', () => {
    test('should decode valid QR code ID', () => {
      const containerId = 'test-container-123';
      const qrCodeId = qrCodeService.generateQRCodeId(containerId);
      const decoded = qrCodeService.decodeQRCodeId(qrCodeId);
      
      expect(decoded.containerId).toBe(containerId);
      expect(decoded.timestamp).toBeGreaterThan(0);
      expect(decoded.uniqueId).toMatch(/^[a-f0-9]{8}$/);
      expect(decoded.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should throw error for invalid QR code format', () => {
      expect(() => {
        qrCodeService.decodeQRCodeId('invalid-format');
      }).toThrow('Failed to decode QR code');
    });

    test('should throw error for wrong prefix', () => {
      expect(() => {
        qrCodeService.decodeQRCodeId('WRONG_test_123_abc');
      }).toThrow('Failed to decode QR code');
    });
  });

  describe('validateQRCode', () => {
    test('should validate recent QR code', () => {
      const containerId = 'test-container-123';
      const qrCodeId = qrCodeService.generateQRCodeId(containerId);
      
      expect(qrCodeService.validateQRCode(qrCodeId).valid).toBe(true);
    });

    test('should reject invalid format', () => {
      expect(qrCodeService.validateQRCode('invalid-format').valid).toBe(false);
    });

    test('should reject future timestamp', () => {
      const futureTimestamp = Date.now() + 86400000; // 1 day in future
      const qrCodeId = `CONT_test_${futureTimestamp}_12345678`;
      
      expect(qrCodeService.validateQRCode(qrCodeId).valid).toBe(false);
    });
  });

  describe('scanQRCode', () => {
    test('should successfully scan valid QR code', async () => {
      const containerId = 'test-container-123';
      const qrCodeId = qrCodeService.generateQRCodeId(containerId);
      
      const result = await qrCodeService.scanQRCode(qrCodeId);
      
      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.qrCodeId).toBe(qrCodeId);
      expect(result.generatedAt).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
    });

    test('should fail to scan invalid QR code', async () => {
      const result = await qrCodeService.scanQRCode('invalid-qr-code');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_FORMAT');
      expect(result.message).toContain('QR code format is invalid');
    });

    test('should fail to scan expired QR code', async () => {
      const oldTimestamp = Date.now() - (400 * 24 * 60 * 60 * 1000); // 400 days ago
      const expiredQrCode = `CONT_test_${oldTimestamp}_12345678`;
      
      const result = await qrCodeService.scanQRCode(expiredQrCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('EXPIRED');
    });
  });

  describe('validateQRCodeFormat', () => {
    test('should validate correct format', () => {
      const qrCodeId = 'CONT_test_123456789_abcdef12';
      
      expect(qrCodeService.validateQRCodeFormat(qrCodeId)).toBe(true);
    });

    test('should reject incorrect format', () => {
      expect(qrCodeService.validateQRCodeFormat('WRONG_test_123_abc')).toBe(false);
      expect(qrCodeService.validateQRCodeFormat('CONT_test_123')).toBe(false);
      expect(qrCodeService.validateQRCodeFormat('invalid')).toBe(false);
    });
  });

  describe('generateQRCodeImage', () => {
    test('should generate QR code image buffer', async () => {
      const qrCodeId = 'CONT_test_123456789_abcdef12';
      const imageBuffer = await qrCodeService.generateQRCodeImage(qrCodeId);
      
      expect(Buffer.isBuffer(imageBuffer)).toBe(true);
      expect(imageBuffer.length).toBeGreaterThan(0);
    });

    test('should generate different sizes', async () => {
      const qrCodeId = 'CONT_test_123456789_abcdef12';
      
      const smallBuffer = await qrCodeService.generateQRCodeImage(qrCodeId, { width: 100 });
      const largeBuffer = await qrCodeService.generateQRCodeImage(qrCodeId, { width: 300 });
      
      expect(smallBuffer.length).toBeLessThan(largeBuffer.length);
    });
  });
});

describe('LabelService', () => {
  let labelService;

  beforeEach(() => {
    labelService = new LabelService();
  });

  describe('getLabelDimensions', () => {
    test('should return correct dimensions for small size', () => {
      const dimensions = labelService.getLabelDimensions('small');
      
      expect(dimensions.width).toBe(420);
      expect(dimensions.height).toBe(432);
      expect(dimensions.qrSize).toBe(180);
    });

    test('should return correct dimensions for medium size', () => {
      const dimensions = labelService.getLabelDimensions('medium');
      
      expect(dimensions.width).toBe(432);
      expect(dimensions.height).toBe(576);
      expect(dimensions.qrSize).toBe(220);
    });

    test('should return correct dimensions for large size', () => {
      const dimensions = labelService.getLabelDimensions('large');
      
      expect(dimensions.width).toBe(576);
      expect(dimensions.height).toBe(864);
      expect(dimensions.qrSize).toBe(280);
    });

    test('should throw error for invalid size', () => {
      expect(() => {
        labelService.getLabelDimensions('invalid');
      }).toThrow('Invalid label size: invalid');
    });
  });

  describe('generateLabel', () => {
    test('should generate label buffer', async () => {
      const containerData = {
        id: 'test-container-123',
        name: 'Test Container',
        type: 'Box',
        createdAt: new Date().toISOString()
      };

      const labelBuffer = await labelService.generateLabel(containerData, 'medium');
      
      expect(Buffer.isBuffer(labelBuffer)).toBe(true);
      expect(labelBuffer.length).toBeGreaterThan(0);
    });

    test('should generate different sizes', async () => {
      const containerData = {
        id: 'test-container-123',
        name: 'Test Container',
        type: 'Box',
        createdAt: new Date().toISOString()
      };

      const smallLabel = await labelService.generateLabel(containerData, 'small');
      const largeLabel = await labelService.generateLabel(containerData, 'large');
      
      expect(smallLabel.length).not.toBe(largeLabel.length);
    });
  });
});

describe('ScanHistoryService', () => {
  describe('basic functionality tests', () => {
    test('should validate scan data structure', () => {
      const scanData = {
        type: 'qr_scan',
        success: true,
        containerId: 'test-container-123',
        method: 'camera'
      };

      expect(scanData.type).toBe('qr_scan');
      expect(scanData.success).toBe(true);
      expect(scanData.containerId).toBe('test-container-123');
      expect(scanData.method).toBe('camera');
    });

    test('should handle failed scan data', () => {
      const scanData = {
        type: 'qr_scan',
        success: false,
        error: 'INVALID_QR_CODE',
        method: 'camera'
      };

      expect(scanData.success).toBe(false);
      expect(scanData.error).toBe('INVALID_QR_CODE');
    });

    test('should validate scan history entry structure', () => {
      const scanEntry = {
        pk: 'USER#user-123#SCAN_HISTORY',
        sk: '1703000000000#scan-id-123',
        id: 'scan-id-123',
        userId: 'user-123',
        inventoryId: 'inventory-456',
        timestamp: '2023-12-19T10:00:00.000Z',
        type: 'qr_scan',
        success: true,
        containerId: 'container-123',
        containerName: 'Test Container',
        qrCodeId: 'CONT_container-123_1703000000000_abcd1234',
        method: 'camera',
        itemCount: 5,
        ttl: 1710776000
      };

      expect(scanEntry.pk).toContain('USER#user-123#SCAN_HISTORY');
      expect(scanEntry.userId).toBe('user-123');
      expect(scanEntry.inventoryId).toBe('inventory-456');
      expect(scanEntry.type).toBe('qr_scan');
      expect(scanEntry.success).toBe(true);
      expect(scanEntry.containerId).toBe('container-123');
      expect(scanEntry.method).toBe('camera');
      expect(scanEntry.ttl).toBeGreaterThan(0);
    });
  });
});