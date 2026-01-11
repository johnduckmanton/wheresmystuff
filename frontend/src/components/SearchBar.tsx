import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  InputAdornment,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  LocalOffer as TagIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import EnhancedTagInput from './EnhancedTagInput';

export interface SearchQuery {
  text?: string;
  tags?: string[];
  tagMode: 'and' | 'or';
  categoryId?: string;
  locationId?: string;
}

export interface SearchBarProps {
  onSearch: (query: SearchQuery) => void;
  inventoryId: string;
  placeholder?: string;
  showTagSearch?: boolean;
  initialQuery?: Partial<SearchQuery>;
  disabled?: boolean;
  onError?: (error: string) => void; // Callback for error handling
  showErrorAlert?: boolean; // Show inline error alerts
}

/**
 * Enhanced SearchBar component with tag search functionality and comprehensive error handling
 * Supports both text search and tag-based filtering with AND/OR operations
 * Includes timeout handling, retry logic, and user feedback for failed operations
 * Validates: Requirements 3.2, 3.6, 8.4, 2.2, 8.6
 */
export default function SearchBar({
  onSearch,
  inventoryId,
  placeholder = 'Search things...',
  showTagSearch = true,
  initialQuery = {},
  disabled = false,
  onError,
  showErrorAlert = true,
}: SearchBarProps) {
  const [textQuery, setTextQuery] = useState(initialQuery.text || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialQuery.tags || []);
  const [tagMode, setTagMode] = useState<'and' | 'or'>(initialQuery.tagMode || 'and');
  const [showTagInput, setShowTagInput] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchFailed, setLastSearchFailed] = useState(false);

  // Enhanced search execution with error handling and timeout protection
  const executeSearch = useCallback(async () => {
    const query: SearchQuery = {
      text: textQuery.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      tagMode,
      categoryId: initialQuery.categoryId,
      locationId: initialQuery.locationId,
    };
    
    // Clear previous errors
    setSearchError(null);
    setLastSearchFailed(false);
    setIsSearching(true);
    
    try {
      // Add timeout protection for search operations
      const searchPromise = new Promise<void>((resolve, reject) => {
        try {
          onSearch(query);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Search request timed out. Please try with fewer tags or a simpler query.'));
        }, 30000); // 30 second timeout
      });
      
      await Promise.race([searchPromise, timeoutPromise]);
      
      // Search completed successfully
      setLastSearchFailed(false);
    } catch (error: any) {
      console.error('Search error:', error);
      
      let errorMessage = 'Search failed. Please try again.';
      
      if (error.message) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Search timed out. Please try with fewer tags or a simpler query.';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('temporarily unavailable')) {
          errorMessage = 'Search service temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('Invalid') || error.message.includes('validation')) {
          errorMessage = error.message;
        }
      }
      
      setSearchError(errorMessage);
      setLastSearchFailed(true);
      
      // Call error callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSearching(false);
    }
  }, [textQuery, selectedTags, tagMode, initialQuery.categoryId, initialQuery.locationId, onSearch, onError]);

  // Debounce search execution
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      executeSearch();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [executeSearch]);

  // Handle text input change
  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTextQuery(event.target.value);
  };

  // Handle tag changes
  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  // Handle tag mode change
  const handleTagModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'and' | 'or' | null,
  ) => {
    if (newMode !== null) {
      setTagMode(newMode);
    }
  };

  // Handle tag input errors
  const handleTagError = useCallback((error: string) => {
    setSearchError(`Tag error: ${error}`);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  // Retry failed search
  const retrySearch = useCallback(() => {
    setSearchError(null);
    setLastSearchFailed(false);
    executeSearch();
  }, [executeSearch]);

  // Clear all search filters and errors
  const clearAllFilters = () => {
    setTextQuery('');
    setSelectedTags([]);
    setTagMode('and');
    setShowTagInput(false);
    setSearchError(null);
    setLastSearchFailed(false);
  };

  // Check if any filters are active
  const hasActiveFilters = textQuery.trim() || selectedTags.length > 0;
  const hasErrors = !!searchError;

  // Handle key press for text input
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      executeSearch();
    }
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2,
        border: 1,
        borderColor: hasErrors ? 'error.main' : 'divider',
      }}
    >
      {/* Error alert */}
      {showErrorAlert && searchError && (
        <Collapse in={!!searchError}>
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <IconButton
                size="small"
                onClick={retrySearch}
                disabled={disabled || isSearching}
                color="inherit"
                aria-label="Retry search"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            }
            onClose={() => setSearchError(null)}
          >
            {searchError}
          </Alert>
        </Collapse>
      )}

      {/* Main search row */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: showTagInput ? 2 : 0 }}>
        {/* Text search input */}
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={textQuery}
          onChange={handleTextChange}
          onKeyPress={handleKeyPress}
          disabled={disabled || isSearching}
          error={hasErrors}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ 
                  color: hasErrors ? 'error.main' : 'text.secondary' 
                }} />
              </InputAdornment>
            ),
            endAdornment: textQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setTextQuery('')}
                  disabled={disabled || isSearching}
                  aria-label="Clear text search"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper',
            },
          }}
        />

        {/* Tag search toggle */}
        {showTagSearch && (
          <Tooltip title={showTagInput ? 'Hide tag search' : 'Show tag search'}>
            <IconButton
              onClick={() => setShowTagInput(!showTagInput)}
              disabled={disabled || isSearching}
              color={showTagInput || selectedTags.length > 0 ? 'primary' : 'default'}
              sx={{
                border: 1,
                borderColor: showTagInput || selectedTags.length > 0 ? 'primary.main' : 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                },
              }}
              aria-label="Toggle tag search"
            >
              <TagIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Error indicator */}
        {lastSearchFailed && (
          <Tooltip title="Last search failed - click to retry">
            <IconButton
              onClick={retrySearch}
              disabled={disabled || isSearching}
              color="error"
              sx={{
                border: 1,
                borderColor: 'error.main',
                '&:hover': {
                  backgroundColor: 'error.main',
                  color: 'error.contrastText',
                },
              }}
              aria-label="Retry failed search"
            >
              <WarningIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Clear all filters */}
        {hasActiveFilters && (
          <Tooltip title="Clear all filters">
            <IconButton
              onClick={clearAllFilters}
              disabled={disabled || isSearching}
              color="error"
              sx={{
                border: 1,
                borderColor: 'error.main',
                '&:hover': {
                  backgroundColor: 'error.main',
                  color: 'error.contrastText',
                },
              }}
              aria-label="Clear all filters"
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Tag search section */}
      {showTagSearch && showTagInput && (
        <>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* Tag input with error handling */}
            <Box sx={{ flex: 1 }}>
              <EnhancedTagInput
                tags={selectedTags}
                onTagsChange={handleTagsChange}
                placeholder="Add tags to search..."
                disabled={disabled || isSearching}
                enableApiSuggestions={true}
                inventoryId={inventoryId}
                size="small"
                label="Search by tags"
                onError={handleTagError}
                showRetryButton={true}
              />
            </Box>

            {/* AND/OR toggle */}
            {selectedTags.length > 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Match
                </Typography>
                <ToggleButtonGroup
                  value={tagMode}
                  exclusive
                  onChange={handleTagModeChange}
                  size="small"
                  disabled={disabled || isSearching}
                  aria-label="Tag search mode"
                >
                  <ToggleButton value="and" aria-label="Match all tags">
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                      ALL
                    </Typography>
                  </ToggleButton>
                  <ToggleButton value="or" aria-label="Match any tag">
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                      ANY
                    </Typography>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
          </Box>

          {/* Search mode explanation */}
          {selectedTags.length > 1 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {tagMode === 'and' 
                  ? `Show items that have ALL of these tags: ${selectedTags.join(', ')}`
                  : `Show items that have ANY of these tags: ${selectedTags.join(', ')}`
                }
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Active filters summary */}
      {hasActiveFilters && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <FilterIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Active filters:
            </Typography>
            
            {textQuery.trim() && (
              <Chip
                label={`Text: "${textQuery}"`}
                size="small"
                variant="outlined"
                onDelete={() => setTextQuery('')}
                disabled={disabled}
              />
            )}
            
            {selectedTags.length > 0 && (
              <Chip
                label={`Tags (${tagMode.toUpperCase()}): ${selectedTags.join(', ')}`}
                size="small"
                variant="outlined"
                onDelete={() => setSelectedTags([])}
                disabled={disabled}
              />
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}