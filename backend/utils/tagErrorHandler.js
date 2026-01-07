const { ERROR_TYPES, createSecureErrorResponse, logDetailedError } = require('./errorHandler');

/**
 * Tag-specific error types and messages
 */
const TAG_ERROR_TYPES = {
  INVALID_TAG_FORMAT: 'invalid_tag_format',
  TAG_TOO_LONG: 'tag_too_long',
  DUPLICATE_TAG: 'duplicate_tag',
  MAX_TAGS_EXCEEDED: 'max_tags_exceeded',
  SEARCH_TIMEOUT: 'search_timeout',
  SUGGESTION_FAILED: 'suggestion_failed',
  BULK_OPERATION_FAILED: 'bulk_operation_failed',
  CACHE_ERROR: 'cache_error'
};

/**
 * Tag-specific error messages for client responses
 */
const TAG_ERROR_MESSAGES = {
  [TAG_ERROR_TYPES.INVALID_TAG_FORMAT]: 'Tag contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed.',
  [TAG_ERROR_TYPES.TAG_TOO_LONG]: 'Tag is too long. Maximum length is 50 characters.',
  [TAG_ERROR_TYPES.DUPLICATE_TAG]: 'This tag is already applied to the item.',
  [TAG_ERROR_TYPES.MAX_TAGS_EXCEEDED]: 'Maximum number of tags reached for this item.',
  [TAG_ERROR_TYPES.SEARCH_TIMEOUT]: 'Search request timed out. Please try again with fewer tags or a simpler query.',
  [TAG_ERROR_TYPES.SUGGESTION_FAILED]: 'Unable to load tag suggestions. Please try typing your tag manually.',
  [TAG_ERROR_TYPES.BULK_OPERATION_FAILED]: 'Some items could not be updated. Please check the results and retry failed items.',
  [TAG_ERROR_TYPES.CACHE_ERROR]: 'Tag cache temporarily unavailable. Functionality may be slower than usual.'
};

/**
 * Create a tag validation error response
 * @param {string} tagErrorType - Type of tag error from TAG_ERROR_TYPES
 * @param {string} [customMessage] - Custom error message (optional)
 * @param {object} [validationDetails] - Additional validation details
 * @param {string} [requestId] - Request ID for correlation
 * @returns {object} Secure error response object
 */
function createTagValidationError(tagErrorType, customMessage = null, validationDetails = null, requestId = null) {
  const clientMessage = customMessage || TAG_ERROR_MESSAGES[tagErrorType] || 'Tag validation failed';
  
  const errorResponse = createSecureErrorResponse(
    ERROR_TYPES.VALIDATION,
    clientMessage,
    400,
    requestId
  );

  // Add tag-specific error details if provided
  if (validationDetails) {
    errorResponse.tagError = {
      type: tagErrorType,
      details: validationDetails
    };
  }

  return errorResponse;
}

/**
 * Handle tag search timeout errors
 * @param {Error} error - The timeout error
 * @param {object} context - Request context
 * @param {object} searchParams - Search parameters that caused timeout
 * @returns {object} Secure error response
 */
function handleTagSearchTimeout(error, context, searchParams = {}) {
  const requestId = context.requestId || require('uuid').v4();
  
  // Log detailed error with search parameters
  logDetailedError(error, {
    ...context,
    requestId,
    searchParams: {
      tags: searchParams.tags?.length || 0,
      mode: searchParams.mode,
      partialMatch: searchParams.partialMatch,
      inventoryId: searchParams.inventoryId
    }
  }, ERROR_TYPES.SERVER);

  return createSecureErrorResponse(
    ERROR_TYPES.SERVER,
    TAG_ERROR_MESSAGES[TAG_ERROR_TYPES.SEARCH_TIMEOUT],
    408, // Request Timeout
    requestId
  );
}

/**
 * Handle tag suggestion loading errors
 * @param {Error} error - The suggestion error
 * @param {object} context - Request context
 * @param {object} suggestionParams - Suggestion parameters
 * @returns {object} Secure error response
 */
function handleTagSuggestionError(error, context, suggestionParams = {}) {
  const requestId = context.requestId || require('uuid').v4();
  
  // Log detailed error with suggestion parameters
  logDetailedError(error, {
    ...context,
    requestId,
    suggestionParams: {
      query: suggestionParams.query,
      inventoryId: suggestionParams.inventoryId,
      limit: suggestionParams.limit
    }
  }, ERROR_TYPES.EXTERNAL_SERVICE);

  return createSecureErrorResponse(
    ERROR_TYPES.EXTERNAL_SERVICE,
    TAG_ERROR_MESSAGES[TAG_ERROR_TYPES.SUGGESTION_FAILED],
    503, // Service Unavailable
    requestId
  );
}

/**
 * Handle bulk tag operation errors
 * @param {Error} error - The bulk operation error
 * @param {object} context - Request context
 * @param {object} operationParams - Bulk operation parameters
 * @param {object} partialResults - Partial results if some operations succeeded
 * @returns {object} Secure error response with partial results
 */
function handleBulkTagOperationError(error, context, operationParams = {}, partialResults = null) {
  const requestId = context.requestId || require('uuid').v4();
  
  // Log detailed error with operation parameters
  logDetailedError(error, {
    ...context,
    requestId,
    operationParams: {
      operation: operationParams.operation,
      thingCount: operationParams.thingIds?.length || 0,
      tagCount: operationParams.tags?.length || 0,
      inventoryId: operationParams.inventoryId
    },
    partialResults: partialResults ? {
      successful: partialResults.successful,
      failed: partialResults.failed,
      totalRequested: partialResults.totalRequested
    } : null
  }, ERROR_TYPES.SERVER);

  const errorResponse = createSecureErrorResponse(
    ERROR_TYPES.SERVER,
    TAG_ERROR_MESSAGES[TAG_ERROR_TYPES.BULK_OPERATION_FAILED],
    207, // Multi-Status (partial success)
    requestId
  );

  // Include partial results if available
  if (partialResults) {
    errorResponse.partialResults = partialResults;
  }

  return errorResponse;
}

/**
 * Handle tag cache errors gracefully
 * @param {Error} error - The cache error
 * @param {object} context - Request context
 * @returns {object} Warning response (not a failure)
 */
function handleTagCacheError(error, context) {
  const requestId = context.requestId || require('uuid').v4();
  
  // Log cache error but don't fail the request
  logDetailedError(error, {
    ...context,
    requestId,
    cacheOperation: context.cacheOperation || 'unknown'
  }, ERROR_TYPES.EXTERNAL_SERVICE);

  // Return a warning response that can be handled gracefully
  return {
    warning: TAG_ERROR_MESSAGES[TAG_ERROR_TYPES.CACHE_ERROR],
    requestId,
    fallbackMode: true
  };
}

/**
 * Validate tag format and create appropriate error response
 * @param {string} tag - Tag to validate
 * @param {string} [requestId] - Request ID for correlation
 * @returns {object|null} Error response if invalid, null if valid
 */
function validateTagFormat(tag, requestId = null) {
  if (!tag || typeof tag !== 'string') {
    return createTagValidationError(
      TAG_ERROR_TYPES.INVALID_TAG_FORMAT,
      'Tag must be a non-empty string',
      { providedValue: typeof tag },
      requestId
    );
  }

  const trimmedTag = tag.trim();
  
  if (trimmedTag.length === 0) {
    return createTagValidationError(
      TAG_ERROR_TYPES.INVALID_TAG_FORMAT,
      'Tag cannot be empty or contain only whitespace',
      { providedValue: tag },
      requestId
    );
  }

  if (trimmedTag.length > 50) {
    return createTagValidationError(
      TAG_ERROR_TYPES.TAG_TOO_LONG,
      `Tag is ${trimmedTag.length} characters long. Maximum is 50 characters.`,
      { length: trimmedTag.length, maxLength: 50 },
      requestId
    );
  }

  // Check for invalid characters (only allow alphanumeric, hyphens, underscores)
  const validCharPattern = /^[a-zA-Z0-9\-_]+$/;
  if (!validCharPattern.test(trimmedTag)) {
    const invalidChars = trimmedTag.match(/[^a-zA-Z0-9\-_]/g);
    return createTagValidationError(
      TAG_ERROR_TYPES.INVALID_TAG_FORMAT,
      'Tag contains invalid characters. Only letters, numbers, hyphens (-), and underscores (_) are allowed.',
      { 
        invalidCharacters: invalidChars ? [...new Set(invalidChars)] : [],
        allowedPattern: 'letters, numbers, hyphens (-), underscores (_)'
      },
      requestId
    );
  }

  return null; // Valid tag
}

/**
 * Validate an array of tags and return detailed validation results
 * @param {Array<string>} tags - Array of tags to validate
 * @param {number} [maxTags] - Maximum number of tags allowed
 * @param {string} [requestId] - Request ID for correlation
 * @returns {object} Validation result with errors and valid tags
 */
function validateTagArray(tags, maxTags = null, requestId = null) {
  const result = {
    valid: true,
    validTags: [],
    errors: [],
    warnings: []
  };

  if (!Array.isArray(tags)) {
    result.valid = false;
    result.errors.push(createTagValidationError(
      TAG_ERROR_TYPES.INVALID_TAG_FORMAT,
      'Tags must be provided as an array',
      { providedType: typeof tags },
      requestId
    ));
    return result;
  }

  if (maxTags && tags.length > maxTags) {
    result.valid = false;
    result.errors.push(createTagValidationError(
      TAG_ERROR_TYPES.MAX_TAGS_EXCEEDED,
      `Cannot add ${tags.length} tags. Maximum is ${maxTags} tags per item.`,
      { providedCount: tags.length, maxCount: maxTags },
      requestId
    ));
    return result;
  }

  const seenTags = new Set();
  
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    
    // Validate individual tag format
    const formatError = validateTagFormat(tag, requestId);
    if (formatError) {
      result.valid = false;
      result.errors.push({
        ...formatError,
        tagIndex: i,
        tagValue: tag
      });
      continue;
    }

    const normalizedTag = tag.trim().toLowerCase();
    
    // Check for duplicates within the array
    if (seenTags.has(normalizedTag)) {
      result.warnings.push({
        type: TAG_ERROR_TYPES.DUPLICATE_TAG,
        message: `Duplicate tag "${normalizedTag}" will be ignored`,
        tagIndex: i,
        tagValue: tag
      });
      continue;
    }

    seenTags.add(normalizedTag);
    result.validTags.push(normalizedTag);
  }

  return result;
}

module.exports = {
  TAG_ERROR_TYPES,
  TAG_ERROR_MESSAGES,
  createTagValidationError,
  handleTagSearchTimeout,
  handleTagSuggestionError,
  handleBulkTagOperationError,
  handleTagCacheError,
  validateTagFormat,
  validateTagArray
};