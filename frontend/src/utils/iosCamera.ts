/**
 * iOS Camera Utilities
 * Handles iOS-specific camera access patterns and permission flows
 * Validates: Requirements 7.4
 */

export interface CameraCapabilities {
  hasCamera: boolean;
  isIOS: boolean;
  isIOSSafari: boolean;
  isIOSWebView: boolean;
  supportsGetUserMedia: boolean;
  supportsFileInput: boolean;
}

/**
 * Detect iOS device and context
 */
export function detectIOSContext(): CameraCapabilities {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isIOSSafari = isIOS && /safari/.test(userAgent) && !/crios|fxios/.test(userAgent);
  const isIOSWebView = isIOS && !isIOSSafari && !/crios|fxios/.test(userAgent);
  
  const hasMediaDevices = 'mediaDevices' in navigator && navigator.mediaDevices !== null && navigator.mediaDevices !== undefined;
  const supportsGetUserMedia = hasMediaDevices && 'getUserMedia' in navigator.mediaDevices;
  
  return {
    hasCamera: supportsGetUserMedia,
    isIOS,
    isIOSSafari,
    isIOSWebView,
    supportsGetUserMedia,
    supportsFileInput: true, // All iOS browsers support file input
  };
}

/**
 * Get optimal camera constraints for iOS
 */
export function getIOSCameraConstraints(preferredDeviceId?: string): MediaStreamConstraints {
  const capabilities = detectIOSContext();
  
  // iOS Safari has specific requirements
  if (capabilities.isIOSSafari || capabilities.isIOSWebView) {
    return {
      video: {
        deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
        facingMode: preferredDeviceId ? undefined : { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        // iOS performs better with these settings
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    };
  }
  
  // Standard constraints for non-iOS
  return {
    video: {
      deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
      facingMode: preferredDeviceId ? undefined : { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };
}

/**
 * Request camera permission with iOS-specific handling
 */
export async function requestIOSCameraPermission(
  preferredDeviceId?: string
): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
  const capabilities = detectIOSContext();
  
  if (!capabilities.supportsGetUserMedia) {
    return {
      success: false,
      error: 'Camera access not supported in this browser',
    };
  }
  
  try {
    const constraints = getIOSCameraConstraints(preferredDeviceId);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    return {
      success: true,
      stream,
    };
  } catch (error: any) {
    console.error('iOS camera permission error:', error);
    
    // iOS-specific error handling
    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        error: capabilities.isIOSSafari
          ? 'Camera access denied. Go to Settings → Safari → Camera and select "Allow"'
          : 'Camera access denied. Please allow camera access in your browser settings',
      };
    }
    
    if (error.name === 'NotFoundError') {
      return {
        success: false,
        error: 'No camera found on this device',
      };
    }
    
    if (error.name === 'NotReadableError') {
      return {
        success: false,
        error: 'Camera is being used by another app. Please close other apps and try again',
      };
    }
    
    if (error.name === 'OverconstrainedError') {
      // iOS may reject specific constraints, try with simpler constraints
      try {
        const simpleConstraints: MediaStreamConstraints = {
          video: { facingMode: 'environment' },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
        return {
          success: true,
          stream,
        };
      } catch (retryError) {
        return {
          success: false,
          error: 'Camera constraints not supported on this device',
        };
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to access camera',
    };
  }
}

/**
 * Check if camera permission is already granted
 * Note: This is limited on iOS Safari due to privacy restrictions
 */
export async function checkCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!('permissions' in navigator)) {
    return 'unsupported';
  }
  
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch (error) {
    // iOS Safari doesn't support permissions API for camera
    return 'unsupported';
  }
}

/**
 * Get available camera devices with iOS-specific handling
 */
export async function getIOSCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    // On iOS, device labels may be empty until permission is granted
    return videoDevices;
  } catch (error) {
    console.error('Error enumerating devices:', error);
    return [];
  }
}

/**
 * Prefer back camera on iOS devices
 */
export function selectPreferredIOSCamera(devices: MediaDeviceInfo[]): string | undefined {
  if (devices.length === 0) return undefined;
  
  // Look for back/rear/environment camera
  const backCamera = devices.find(device => {
    const label = device.label.toLowerCase();
    return label.includes('back') || 
           label.includes('rear') || 
           label.includes('environment');
  });
  
  return backCamera?.deviceId || devices[0]?.deviceId;
}

/**
 * Stop camera stream properly on iOS
 */
export function stopIOSCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  
  // Stop all tracks
  stream.getTracks().forEach(track => {
    track.stop();
  });
  
  // iOS-specific: ensure tracks are fully released
  stream.getTracks().forEach(track => {
    track.enabled = false;
  });
}

/**
 * Check if running in iOS WebView (e.g., native app)
 */
export function isIOSWebView(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent);
  const isChrome = /crios/.test(userAgent);
  const isFirefox = /fxios/.test(userAgent);
  
  // If it's iOS but not Safari, Chrome, or Firefox, it's likely a WebView
  return isIOS && !isSafari && !isChrome && !isFirefox;
}

/**
 * Get user-friendly error message for iOS camera issues
 */
export function getIOSCameraErrorMessage(error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const capabilities = detectIOSContext();
  
  if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission denied')) {
    if (capabilities.isIOSSafari) {
      return 'Camera access denied. To enable:\n1. Open Settings app\n2. Scroll to Safari\n3. Tap Camera\n4. Select "Allow"';
    } else if (capabilities.isIOSWebView) {
      return 'Camera access denied. Please allow camera access in the app settings';
    } else {
      return 'Camera access denied. Please check your browser settings';
    }
  }
  
  if (errorMessage.includes('NotFoundError')) {
    return 'No camera found on this device';
  }
  
  if (errorMessage.includes('NotReadableError')) {
    return 'Camera is being used by another app. Please close other apps and try again';
  }
  
  return errorMessage;
}
