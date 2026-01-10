import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Box,
  TextField,
  Chip,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Popper,
  ClickAwayListener,
  InputAdornment,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  LocalOffer as TagIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';
import tagCacheService from '../services/tagCacheService';
import { useInventory } from '../contexts/InventoryContext';

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  enableApiSuggestions?: boolean; // Enable API-based suggestions
  inventoryId?: string; // Required when enableApiSuggestions is true
  onError?: (error: string) => void; // Callback for error handling
  showRetryButton?: boolean; // Show retry button on errors
}

/**
 * TagInput component for managing tags with chip-based display and autocomplete
 * Enhanced with comprehensive error handling, retry logic, and user feedback
 * Supports both static suggestions and API-based autocomplete
 * Validates: Requirements 2.5, 2.6, 2.7, 4.1, 4.3, 4.4, 4.5, 2.2, 8.6
 */
export default function TagInput({
  tags = [],
  onTagsChange,
  suggestions = [],
  placeholder = 'Add tags...',
  maxTags,
  disabled = false,
  error = false,
  helperText,
  label,
  size = 'small',
  fullWidth = true,
  enableApiSuggestions = false,
  inventoryId,
  onError,
  showRetryButton = true,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  const [anchorWidth, setAnchorWidth] = useState<number | undefined>(undefined);
  const [anchorElement, setAnchorElement] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const { currentInventory } = useInventory();

  // Determine which suggestions to use
  const effectiveInventoryId = inventoryId || currentInventory?.id;
  const activeSuggestions = enableApiSuggestions ? apiSuggestions : suggestions;

  // Filter suggestions based on input and exclude already applied tags
  const filteredSuggestions = activeSuggestions
    .filter(suggestion => 
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion.toLowerCase())
    )
    .slice(0, 10); // Limit to 10 suggestions as per requirements

  // Enhanced error handling for API suggestions
  const handleApiError = useCallback((error: any, operation: string) => {
    console.error(`Tag ${operation} error:`, error);
    
    let errorMessage = 'An error occurred';
    let shouldRetry = false;
    
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Request timed out. Please try again.';
        shouldRetry = true;
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network error. Please check your connection.';
        shouldRetry = true;
      } else if (error.message.includes('temporarily unavailable') || error.message.includes('service unavailable')) {
        errorMessage = 'Service temporarily unavailable. Please try again.';
        shouldRetry = true;
      } else if (error.message.includes('Invalid') || error.message.includes('validation')) {
        errorMessage = error.message;
        shouldRetry = false;
      } else {
        errorMessage = `Failed to ${operation}. Please try again.`;
        shouldRetry = true;
      }
    }
    
    setSuggestionError(errorMessage);
    setLastErrorMessage(errorMessage);
    
    // Show error snackbar for user feedback
    if (shouldRetry && showRetryButton) {
      setShowErrorSnackbar(true);
    }
    
    // Call error callback if provided
    if (onError) {
      onError(errorMessage);
    }
    
    return { shouldRetry, errorMessage };
  }, [onError, showRetryButton]);

  // Retry mechanism for failed operations
  const retryOperation = useCallback(async (operation: () => Promise<void>, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await operation();
        // Success - reset error states
        setSuggestionError(null);
        setValidationError(null);
        setRetryCount(0);
        return;
      } catch (error) {
        console.warn(`Retry attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt === maxRetries) {
          // Final attempt failed
          handleApiError(error, 'load suggestions');
          setRetryCount(attempt);
        } else {
          // Wait before next retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }, [handleApiError]);

  // Debounced API call for suggestions with enhanced error handling and retry logic
  const fetchApiSuggestions = useCallback(
    async (query: string, currentTags: string[]) => {
      if (!enableApiSuggestions || !effectiveInventoryId || query.length === 0) {
        setApiSuggestions([]);
        setSuggestionError(null);
        return;
      }

      // Check cache first
      const cachedSuggestions = tagCacheService.getCachedSuggestions(
        effectiveInventoryId, 
        query, 
        currentTags
      );
      
      if (cachedSuggestions) {
        console.log(`Frontend cache hit for tag suggestions: ${query}`);
        setApiSuggestions(cachedSuggestions);
        setSuggestionError(null);
        return;
      }

      setLoadingSuggestions(true);
      setSuggestionError(null);

      await retryOperation(async () => {
        const response = await apiClient.getTags(effectiveInventoryId, {
          q: query,
          exclude: currentTags,
          limit: 10,
        });
        
        setApiSuggestions(response.tags);
        
        // Cache the results
        tagCacheService.cacheSuggestions(
          effectiveInventoryId, 
          query, 
          currentTags, 
          response.tags
        );
        console.log(`Cached ${response.tags.length} tag suggestions for: ${query}`);
      });

      setLoadingSuggestions(false);
    },
    [enableApiSuggestions, effectiveInventoryId, retryOperation]
  );

  // Debounce API calls
  useEffect(() => {
    if (!enableApiSuggestions || inputValue.length === 0) {
      setApiSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchApiSuggestions(inputValue, tags);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [inputValue, fetchApiSuggestions, enableApiSuggestions, tags]);

  // Reset suggestion selection when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(-1);
  }, [filteredSuggestions.length]);

  // Initialize anchor width on mount
  useEffect(() => {
    if (anchorRef.current) {
      setAnchorWidth(anchorRef.current.offsetWidth);
      setAnchorElement(anchorRef.current);
    }
  }, []);

  // Enhanced tag validation with detailed error messages
  const validateTag = useCallback((tagName: string): { valid: boolean; error?: string } => {
    if (!tagName || typeof tagName !== 'string') {
      return { valid: false, error: 'Tag must be a non-empty string' };
    }

    const trimmedTag = tagName.trim();
    
    if (trimmedTag.length === 0) {
      return { valid: false, error: 'Tag cannot be empty or contain only whitespace' };
    }

    if (trimmedTag.length > 50) {
      return { valid: false, error: `Tag is too long (${trimmedTag.length} characters). Maximum is 50 characters.` };
    }

    // Check for invalid characters (only allow alphanumeric, hyphens, underscores)
    const validCharPattern = /^[a-zA-Z0-9\-_]+$/;
    if (!validCharPattern.test(trimmedTag)) {
      const invalidChars = trimmedTag.match(/[^a-zA-Z0-9\-_]/g);
      const uniqueInvalidChars = invalidChars ? [...new Set(invalidChars)] : [];
      return { 
        valid: false, 
        error: `Tag contains invalid characters: ${uniqueInvalidChars.join(', ')}. Only letters, numbers, hyphens (-), and underscores (_) are allowed.`
      };
    }

    return { valid: true };
  }, []);

  // Normalize tag name according to requirements
  const normalizeTag = (tagName: string): string => {
    return tagName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-_]/g, '') // Only allow alphanumeric, hyphens, underscores
      .substring(0, 50); // Max 50 characters
  };

  // Enhanced tag validation (pure function - no side effects)
  const isValidTagPure = (tagName: string): boolean => {
    const validation = validateTag(tagName);
    if (!validation.valid) {
      return false;
    }

    const normalizedTag = normalizeTag(tagName);
    
    if (tags.includes(normalizedTag)) {
      return false;
    }

    if (maxTags && tags.length >= maxTags) {
      return false;
    }

    return true;
  };

  // Enhanced tag validation with side effects (for use in event handlers)
  const isValidTag = (tagName: string): boolean => {
    const validation = validateTag(tagName);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid tag');
      return false;
    }

    const normalizedTag = normalizeTag(tagName);
    
    if (tags.includes(normalizedTag)) {
      setValidationError('This tag is already applied');
      return false;
    }

    if (maxTags && tags.length >= maxTags) {
      setValidationError(`Maximum ${maxTags} tags allowed`);
      return false;
    }

    setValidationError(null);
    return true;
  };

  // Add a new tag with enhanced validation and error handling
  const addTag = (tagName: string) => {
    if (!tagName.trim() || disabled) return;

    // Clear previous validation errors
    setValidationError(null);

    if (!isValidTag(tagName)) {
      // Error message is set by isValidTag
      return;
    }

    const normalizedTag = normalizeTag(tagName);
    const newTags = [...tags, normalizedTag];
    onTagsChange(newTags);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Clear any error states on successful addition
    setSuggestionError(null);
    setValidationError(null);
  };

  // Remove a tag
  const removeTag = (tagToRemove: string) => {
    if (disabled) return;
    const newTags = tags.filter(tag => tag !== tagToRemove);
    onTagsChange(newTags);
  };

  // Handle input change with validation feedback
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }
    
    // Show suggestions if there's input and we have suggestions available
    const shouldShowSuggestions = value.length > 0 && (
      (enableApiSuggestions && !!effectiveInventoryId) || 
      (!enableApiSuggestions && filteredSuggestions.length > 0)
    );
    
    setShowSuggestions(shouldShowSuggestions);
    setSelectedSuggestionIndex(-1);
  };

  // Handle key press events
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
          addTag(filteredSuggestions[selectedSuggestionIndex]);
        } else if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;

      case ',':
        event.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;

      case 'Backspace':
        if (inputValue === '' && tags.length > 0) {
          // Remove last tag when backspace is pressed on empty input
          removeTag(tags[tags.length - 1]);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (showSuggestions && filteredSuggestions.length > 0) {
          setSelectedSuggestionIndex(prev => 
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (showSuggestions && filteredSuggestions.length > 0) {
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
  };

  // Handle click away from suggestions
  const handleClickAway = () => {
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Handle input focus
  const handleInputFocus = () => {
    const shouldShowSuggestions = inputValue.length > 0 && (
      (enableApiSuggestions && !!effectiveInventoryId) || 
      (!enableApiSuggestions && filteredSuggestions.length > 0)
    );
    
    if (shouldShowSuggestions) {
      setShowSuggestions(true);
    }
  };

  // Clear all tags with confirmation for large numbers
  const clearAllTags = () => {
    if (disabled) return;
    
    // For large numbers of tags, we might want to add confirmation
    if (tags.length > 10) {
      if (!window.confirm(`Are you sure you want to remove all ${tags.length} tags?`)) {
        return;
      }
    }
    
    onTagsChange([]);
    setValidationError(null);
    setSuggestionError(null);
  };

  // Retry failed suggestion loading
  const retrySuggestions = useCallback(() => {
    if (inputValue.length > 0) {
      setRetryCount(0);
      setSuggestionError(null);
      setShowErrorSnackbar(false);
      fetchApiSuggestions(inputValue, tags);
    }
  }, [inputValue, fetchApiSuggestions, tags]);

  // Get effective error message and helper text
  const getEffectiveHelperText = () => {
    if (validationError) {
      return validationError;
    }
    if (suggestionError && !loadingSuggestions) {
      return suggestionError;
    }
    return helperText;
  };

  const hasError = error || !!validationError || (!!suggestionError && !loadingSuggestions);

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
        <TextField
          ref={anchorRef}
          fullWidth={fullWidth}
          size={size}
          label={label}
          placeholder={tags.length === 0 ? placeholder : ''}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          disabled={disabled}
          error={hasError}
          helperText={getEffectiveHelperText()}
          inputRef={inputRef}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <TagIcon sx={{ 
                  color: hasError ? 'error.main' : 'text.secondary', 
                  fontSize: '1.2rem' 
                }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  {loadingSuggestions && (
                    <CircularProgress size={16} sx={{ color: 'text.secondary' }} />
                  )}
                  {suggestionError && showRetryButton && (
                    <Tooltip title="Retry loading suggestions">
                      <IconButton
                        size="small"
                        onClick={retrySuggestions}
                        disabled={disabled || loadingSuggestions}
                        color="warning"
                        aria-label="Retry suggestions"
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {validationError && (
                    <Tooltip title={validationError}>
                      <WarningIcon 
                        fontSize="small" 
                        sx={{ color: 'error.main' }}
                      />
                    </Tooltip>
                  )}
                  {inputValue && (
                    <Tooltip title="Add tag">
                      <IconButton
                        size="small"
                        onClick={() => addTag(inputValue)}
                        disabled={disabled || !isValidTagPure(inputValue)}
                        aria-label="Add tag"
                        color={validationError ? 'error' : 'primary'}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {tags.length > 0 && (
                    <Tooltip title="Clear all tags">
                      <IconButton
                        size="small"
                        onClick={clearAllTags}
                        disabled={disabled}
                        aria-label="Clear all tags"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </InputAdornment>
            ),
          }}
          slotProps={{
            input: {
              'aria-label': label || 'Tag input',
              'aria-describedby': helperText ? `${label}-helper-text` : undefined,
            },
          }}
        />

        {/* Render tags below the input field */}
        {tags.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 0.5,
            mt: 1,
            px: 0,
          }}>
            {tags.map((tag, index) => (
              <Chip
                key={`${tag}-${index}`}
                label={tag}
                size="small"
                onDelete={() => removeTag(tag)}
                disabled={disabled}
                variant="filled"
                sx={{
                  height: size === 'small' ? 24 : 28,
                  fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
                }}
              />
            ))}
          </Box>
        )}

        {/* Tag count and limit display with error states */}
        {(maxTags || tags.length > 0) && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mt: 0.5,
            px: 1,
          }}>
            <Typography variant="caption" color="text.secondary">
              {tags.length} tag{tags.length !== 1 ? 's' : ''}
              {maxTags && ` (max ${maxTags})`}
            </Typography>
            {maxTags && tags.length >= maxTags && (
              <Typography variant="caption" color="warning.main">
                Maximum tags reached
              </Typography>
            )}
            {retryCount > 0 && (
              <Typography variant="caption" color="error.main">
                Failed after {retryCount} attempts
              </Typography>
            )}
          </Box>
        )}

        {/* Suggestions dropdown with enhanced error handling */}
        <Popper
          open={showSuggestions && (filteredSuggestions.length > 0 || loadingSuggestions || !!suggestionError)}
          anchorEl={anchorElement}
          placement="bottom-start"
          style={{ zIndex: 1300, width: anchorWidth }}
        >
          <Paper 
            elevation={4}
            sx={{ 
              maxHeight: 200, 
              overflow: 'auto',
              border: 1,
              borderColor: suggestionError ? 'error.main' : 'divider',
            }}
          >
            {loadingSuggestions ? (
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Loading suggestions...
                </Typography>
              </Box>
            ) : suggestionError ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  {suggestionError}
                </Typography>
                {showRetryButton && (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <IconButton
                      size="small"
                      onClick={retrySuggestions}
                      disabled={disabled}
                      color="primary"
                      aria-label="Retry loading suggestions"
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            ) : filteredSuggestions.length > 0 ? (
              <List dense>
                {filteredSuggestions.map((suggestion, index) => (
                  <ListItem
                    key={suggestion}
                    component="li"
                    onClick={() => handleSuggestionClick(suggestion)}
                    sx={{
                      py: 0.5,
                      px: 1.5,
                      cursor: 'pointer',
                      ...(index === selectedSuggestionIndex && {
                        backgroundColor: 'primary.light',
                        color: 'primary.contrastText',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                        },
                      }),
                    }}
                  >
                    <ListItemText 
                      primary={suggestion}
                      primaryTypographyProps={{
                        variant: 'body2',
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : inputValue.length > 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No suggestions found
                </Typography>
              </Box>
            ) : null}
          </Paper>
        </Popper>

        {/* Error notification snackbar */}
        <Snackbar
          open={showErrorSnackbar}
          autoHideDuration={6000}
          onClose={() => setShowErrorSnackbar(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setShowErrorSnackbar(false)} 
            severity="warning" 
            sx={{ width: '100%' }}
            action={
              showRetryButton ? (
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowErrorSnackbar(false);
                    retrySuggestions();
                  }}
                  color="inherit"
                  aria-label="Retry"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              ) : undefined
            }
          >
            {lastErrorMessage}
          </Alert>
        </Snackbar>
      </Box>
    </ClickAwayListener>
  );
}