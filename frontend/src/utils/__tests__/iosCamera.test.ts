/**
 * iOS Camera Utilities Tests
 * Tests iOS-specific camera access patterns and permission flows
 * Validates: Requirements 7.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectIOSContext,
  getIOSCameraConstraints,
  requestIOSCameraPermission,
  checkCameraPermission,
  getIOSCameraDevices,
  selectPreferredIOSCamera,
  stopIOSCameraStream,
  isIOSWebView,
  getIOSCameraErrorMessage,
} from '../iosCamera';

describe('iOS Camera Utilities', () => {
  // Save original navigator
  const originalNavigator = global.navigator;
  
  beforeEach(() => {
    // Reset navigator before each test
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('detectIOSContext', () => {
    it('should detect iOS Safari', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true,
      });

      const capabilities = detectIOSContext();
      expect(capabilities.isIOS).toBe(true);
      expect(capabilities.isIOSSafari).toBe(true);
      expect(capabilities.isIOSWebView).toBe(false);
    });

    it('should detect iOS WebView', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        writable: true,
        configurable: true,
      });

      const capabilities = detectIOSContext();
      expect(capabilities.isIOS).toBe(true);
      expect(capabilities.isIOSSafari).toBe(false);
      expect(capabilities.isIOSWebView).toBe(true);
    });

    it('should detect non-iOS device', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true,
        configurable: true,
      });

      const capabilities = detectIOSContext();
      expect(capabilities.isIOS).toBe(false);
      expect(capabilities.isIOSSafari).toBe(false);
      expect(capabilities.isIOSWebView).toBe(false);
    });

    it('should detect camera support', () => {
      const capabilities = detectIOSContext();
      // In test environment, mediaDevices may not be available
      expect(typeof capabilities.hasCamera).toBe('boolean');
      expect(typeof capabilities.supportsGetUserMedia).toBe('boolean');
      expect(capabilities.supportsFileInput).toBe(true);
    });
  });

  describe('getIOSCameraConstraints', () => {
    it('should return iOS-optimized constraints for iOS Safari', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true,
      });

      const constraints = getIOSCameraConstraints();
      expect(constraints.video).toBeDefined();
      expect(constraints.audio).toBe(false);
      
      const videoConstraints = constraints.video as MediaTrackConstraints;
      expect(videoConstraints.facingMode).toEqual({ ideal: 'environment' });
      expect(videoConstraints.frameRate).toEqual({ ideal: 30, max: 30 });
    });

    it('should use device ID when provided', () => {
      const deviceId = 'test-device-id';
      const constraints = getIOSCameraConstraints(deviceId);
      
      const videoConstraints = constraints.video as MediaTrackConstraints;
      expect(videoConstraints.deviceId).toEqual({ exact: deviceId });
      expect(videoConstraints.facingMode).toBeUndefined();
    });

    it('should return standard constraints for non-iOS', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
        configurable: true,
      });

      const constraints = getIOSCameraConstraints();
      const videoConstraints = constraints.video as MediaTrackConstraints;
      
      // Non-iOS should not have frameRate constraint
      expect(videoConstraints.frameRate).toBeUndefined();
    });
  });

  describe('requestIOSCameraPermission', () => {
    it('should return error if getUserMedia not supported', async () => {
      // Mock navigator without mediaDevices
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await requestIOSCameraPermission();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should handle NotAllowedError on iOS Safari', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true,
      });

      const mockGetUserMedia = vi.fn().mockRejectedValue(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );

      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      const result = await requestIOSCameraPermission();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Settings → Safari → Camera');
    });

    it('should handle NotFoundError', async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(
        Object.assign(new Error('No camera'), { name: 'NotFoundError' })
      );

      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      const result = await requestIOSCameraPermission();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No camera found');
    });

    it('should handle NotReadableError', async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(
        Object.assign(new Error('Camera in use'), { name: 'NotReadableError' })
      );

      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      const result = await requestIOSCameraPermission();
      expect(result.success).toBe(false);
      expect(result.error).toContain('being used by another app');
    });

    it('should retry with simpler constraints on OverconstrainedError', async () => {
      const mockStream = { getTracks: () => [] } as unknown as MediaStream;
      const mockGetUserMedia = vi.fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('Overconstrained'), { name: 'OverconstrainedError' })
        )
        .mockResolvedValueOnce(mockStream);

      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      const result = await requestIOSCameraPermission();
      expect(result.success).toBe(true);
      expect(result.stream).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkCameraPermission', () => {
    it('should return unsupported if permissions API not available', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await checkCameraPermission();
      expect(result).toBe('unsupported');
    });

    it('should return permission state when available', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ state: 'granted' });
      Object.defineProperty(global.navigator, 'permissions', {
        value: { query: mockQuery },
        writable: true,
        configurable: true,
      });

      const result = await checkCameraPermission();
      expect(result).toBe('granted');
    });

    it('should return unsupported on query error (iOS Safari)', async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error('Not supported'));
      Object.defineProperty(global.navigator, 'permissions', {
        value: { query: mockQuery },
        writable: true,
        configurable: true,
      });

      const result = await checkCameraPermission();
      expect(result).toBe('unsupported');
    });
  });

  describe('getIOSCameraDevices', () => {
    it('should return video input devices', async () => {
      const mockDevices: MediaDeviceInfo[] = [
        { kind: 'videoinput', deviceId: '1', label: 'Front Camera', groupId: '', toJSON: () => ({}) },
        { kind: 'videoinput', deviceId: '2', label: 'Back Camera', groupId: '', toJSON: () => ({}) },
        { kind: 'audioinput', deviceId: '3', label: 'Microphone', groupId: '', toJSON: () => ({}) },
      ];

      const mockEnumerateDevices = vi.fn().mockResolvedValue(mockDevices);
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { enumerateDevices: mockEnumerateDevices },
        writable: true,
        configurable: true,
      });

      const devices = await getIOSCameraDevices();
      expect(devices).toHaveLength(2);
      expect(devices.every(d => d.kind === 'videoinput')).toBe(true);
    });

    it('should return empty array on error', async () => {
      const mockEnumerateDevices = vi.fn().mockRejectedValue(new Error('Failed'));
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: { enumerateDevices: mockEnumerateDevices },
        writable: true,
        configurable: true,
      });

      const devices = await getIOSCameraDevices();
      expect(devices).toEqual([]);
    });
  });

  describe('selectPreferredIOSCamera', () => {
    it('should prefer back camera', () => {
      const devices: MediaDeviceInfo[] = [
        { kind: 'videoinput', deviceId: '1', label: 'Front Camera', groupId: '', toJSON: () => ({}) },
        { kind: 'videoinput', deviceId: '2', label: 'Back Camera', groupId: '', toJSON: () => ({}) },
      ];

      const deviceId = selectPreferredIOSCamera(devices);
      expect(deviceId).toBe('2');
    });

    it('should prefer rear camera', () => {
      const devices: MediaDeviceInfo[] = [
        { kind: 'videoinput', deviceId: '1', label: 'Front', groupId: '', toJSON: () => ({}) },
        { kind: 'videoinput', deviceId: '2', label: 'Rear', groupId: '', toJSON: () => ({}) },
      ];

      const deviceId = selectPreferredIOSCamera(devices);
      expect(deviceId).toBe('2');
    });

    it('should prefer environment camera', () => {
      const devices: MediaDeviceInfo[] = [
        { kind: 'videoinput', deviceId: '1', label: 'User', groupId: '', toJSON: () => ({}) },
        { kind: 'videoinput', deviceId: '2', label: 'Environment', groupId: '', toJSON: () => ({}) },
      ];

      const deviceId = selectPreferredIOSCamera(devices);
      expect(deviceId).toBe('2');
    });

    it('should return first device if no back camera found', () => {
      const devices: MediaDeviceInfo[] = [
        { kind: 'videoinput', deviceId: '1', label: 'Camera 1', groupId: '', toJSON: () => ({}) },
        { kind: 'videoinput', deviceId: '2', label: 'Camera 2', groupId: '', toJSON: () => ({}) },
      ];

      const deviceId = selectPreferredIOSCamera(devices);
      expect(deviceId).toBe('1');
    });

    it('should return undefined for empty array', () => {
      const deviceId = selectPreferredIOSCamera([]);
      expect(deviceId).toBeUndefined();
    });
  });

  describe('stopIOSCameraStream', () => {
    it('should stop all tracks', () => {
      const mockTrack1 = { stop: vi.fn(), enabled: true };
      const mockTrack2 = { stop: vi.fn(), enabled: true };
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack1, mockTrack2]),
      } as unknown as MediaStream;

      stopIOSCameraStream(mockStream);

      expect(mockTrack1.stop).toHaveBeenCalled();
      expect(mockTrack2.stop).toHaveBeenCalled();
      expect(mockTrack1.enabled).toBe(false);
      expect(mockTrack2.enabled).toBe(false);
    });

    it('should handle null stream', () => {
      expect(() => stopIOSCameraStream(null)).not.toThrow();
    });
  });

  describe('isIOSWebView', () => {
    it('should detect iOS WebView', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        writable: true,
        configurable: true,
      });

      expect(isIOSWebView()).toBe(true);
    });

    it('should not detect iOS Safari as WebView', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true,
      });

      expect(isIOSWebView()).toBe(false);
    });

    it('should not detect non-iOS as WebView', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
        configurable: true,
      });

      expect(isIOSWebView()).toBe(false);
    });
  });

  describe('getIOSCameraErrorMessage', () => {
    it('should return iOS Safari specific message for permission denied', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true,
      });

      const message = getIOSCameraErrorMessage(new Error('NotAllowedError'));
      expect(message).toContain('Settings');
      expect(message).toContain('Safari');
      expect(message).toContain('Camera');
    });

    it('should return WebView specific message for permission denied', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        writable: true,
        configurable: true,
      });

      const message = getIOSCameraErrorMessage(new Error('NotAllowedError'));
      expect(message).toContain('app settings');
    });

    it('should handle NotFoundError', () => {
      const message = getIOSCameraErrorMessage(new Error('NotFoundError'));
      expect(message).toContain('No camera found');
    });

    it('should handle NotReadableError', () => {
      const message = getIOSCameraErrorMessage(new Error('NotReadableError'));
      expect(message).toContain('being used by another app');
    });

    it('should return original message for unknown errors', () => {
      const message = getIOSCameraErrorMessage(new Error('Unknown error'));
      expect(message).toBe('Unknown error');
    });

    it('should handle string errors', () => {
      const message = getIOSCameraErrorMessage('String error');
      expect(message).toBe('String error');
    });
  });
});
