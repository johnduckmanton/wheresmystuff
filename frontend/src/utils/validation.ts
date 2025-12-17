/**
 * Client-side validation utilities
 * Provides consistent validation across frontend components
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface EmailValidationResult extends ValidationResult {
  normalizedEmail?: string;
}

/**
 * Enhanced email validation with detailed error messages
 * @param email - Email address to validate
 * @returns Validation result with normalized email
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email) {
    return { valid: false, error: 'Email address is required' };
  }

  const trimmedEmail = email.trim();
  
  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'Email address cannot be empty' };
  }

  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email address is too long (maximum 254 characters)' };
  }

  // More detailed validation first
  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: 'Email address must contain exactly one @ symbol' };
  }

  const [localPart, domainPart] = parts;

  // Local part validation
  if (localPart.length === 0) {
    return { valid: false, error: 'Email address must have a username before the @ symbol' };
  }

  if (localPart.length > 64) {
    return { valid: false, error: 'Email username part is too long (maximum 64 characters)' };
  }

  // Domain part validation
  if (domainPart.length === 0) {
    return { valid: false, error: 'Email address must have a domain after the @ symbol' };
  }

  if (domainPart.length > 253) {
    return { valid: false, error: 'Email domain part is too long (maximum 253 characters)' };
  }

  if (!domainPart.includes('.')) {
    return { valid: false, error: 'Email domain must contain at least one dot (e.g., example.com)' };
  }

  // Check for obvious typos in common domains before general format validation
  const domainLower = domainPart.toLowerCase();
  
  // Simple typo detection for common domains
  if (domainLower.includes('gmial') || domainLower.includes('gmai.')) {
    return { valid: false, error: 'Did you mean gmail.com?' };
  }
  if (domainLower.includes('yahooo') || domainLower.includes('yaho.')) {
    return { valid: false, error: 'Did you mean yahoo.com?' };
  }
  if (domainLower.includes('hotmial') || domainLower.includes('hotmai.')) {
    return { valid: false, error: 'Did you mean hotmail.com?' };
  }
  if (domainLower.includes('outlok') || domainLower.includes('outloo.')) {
    return { valid: false, error: 'Did you mean outlook.com?' };
  }

  // Basic format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Please enter a valid email address (e.g., user@example.com)' };
  }

  // Check for valid domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(domainPart)) {
    return { valid: false, error: 'Email domain contains invalid characters or format' };
  }

  // Normalize email (lowercase)
  const normalizedEmail = trimmedEmail.toLowerCase();

  return { valid: true, normalizedEmail };
}

/**
 * Validate user role
 * @param role - Role to validate
 * @returns Validation result
 */
export function validateUserRole(role: string): ValidationResult {
  const validRoles = ['owner', 'administrator', 'member', 'read_only'];
  
  if (!role) {
    return { valid: false, error: 'User role is required' };
  }

  const trimmedRole = role.trim().toLowerCase();
  
  if (!validRoles.includes(trimmedRole)) {
    return { 
      valid: false, 
      error: `Invalid user role. Must be one of: ${validRoles.join(', ')}` 
    };
  }

  return { valid: true };
}

/**
 * Validate invitation token format
 * @param token - Token to validate
 * @returns Validation result
 */
export function validateInvitationToken(token: string): ValidationResult {
  if (!token) {
    return { valid: false, error: 'Invitation token is required' };
  }

  const trimmedToken = token.trim();
  
  if (trimmedToken.length === 0) {
    return { valid: false, error: 'Invitation token cannot be empty' };
  }

  // Check for base64url format (alphanumeric + - and _)
  const tokenRegex = /^[A-Za-z0-9_-]+$/;
  if (!tokenRegex.test(trimmedToken)) {
    return { valid: false, error: 'Invalid invitation token format' };
  }

  // Check reasonable length (should be 43 characters for 32 bytes base64url)
  if (trimmedToken.length < 20 || trimmedToken.length > 100) {
    return { valid: false, error: 'Invalid invitation token length' };
  }

  return { valid: true };
}

/**
 * Validate required field
 * @param value - Value to validate
 * @param fieldName - Name of the field for error message
 * @returns Validation result
 */
export function validateRequired(value: any, fieldName: string): ValidationResult {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  return { valid: true };
}

/**
 * Validate string length
 * @param value - String to validate
 * @param fieldName - Name of the field for error message
 * @param minLength - Minimum length (optional)
 * @param maxLength - Maximum length (optional)
 * @returns Validation result
 */
export function validateStringLength(
  value: string, 
  fieldName: string, 
  minLength?: number, 
  maxLength?: number
): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be text` };
  }

  const trimmedValue = value.trim();

  if (minLength !== undefined && trimmedValue.length < minLength) {
    return { 
      valid: false, 
      error: `${fieldName} must be at least ${minLength} character${minLength === 1 ? '' : 's'}` 
    };
  }

  if (maxLength !== undefined && trimmedValue.length > maxLength) {
    return { 
      valid: false, 
      error: `${fieldName} must be no more than ${maxLength} character${maxLength === 1 ? '' : 's'}` 
    };
  }

  return { valid: true };
}

/**
 * Get user-friendly error message for API errors
 * @param error - Error object
 * @param operation - Operation that failed (for context)
 * @returns User-friendly error message
 */
export function getErrorMessage(error: any, operation: string = 'operation'): string {
  if (!error) {
    return `Failed to complete ${operation}`;
  }

  const message = error.message || error.toString();
  const lowerMessage = message.toLowerCase();

  // Network and connectivity errors
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (lowerMessage.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Rate limiting
  if (lowerMessage.includes('too many requests') || lowerMessage.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Service availability
  if (lowerMessage.includes('service unavailable') || 
      lowerMessage.includes('temporarily unavailable') ||
      lowerMessage.includes('internal server error')) {
    return 'Service is temporarily unavailable. Please try again in a few minutes.';
  }

  // Authentication and authorization
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (lowerMessage.includes('access denied') || 
      lowerMessage.includes('insufficient permissions') ||
      lowerMessage.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }

  // Validation errors (return as-is since they're usually user-friendly)
  if (lowerMessage.includes('invalid') || 
      lowerMessage.includes('required') ||
      lowerMessage.includes('must be') ||
      lowerMessage.includes('cannot be') ||
      lowerMessage.includes('format')) {
    return message;
  }

  // Conflict errors
  if (lowerMessage.includes('already exists') || 
      lowerMessage.includes('duplicate') ||
      lowerMessage.includes('conflict')) {
    return message;
  }

  // Not found errors
  if (lowerMessage.includes('not found')) {
    return message;
  }

  // Default fallback
  return message || `Failed to complete ${operation}`;
}