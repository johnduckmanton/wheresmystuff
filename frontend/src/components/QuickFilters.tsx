import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Collapse,
  Chip,
  Badge,
  Paper,
  Divider,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import type { Thing, Category } from '../types';

interface QuickFiltersProps {
  things: Thing[];
  categories: Category[];
  selectedCategoryId?: string;
  selectedTags: string[];
  onCategoryFilter: (categoryId: string | undefined) => void;
  onTagFilter: (tags: string[]) => void;
  onClearFilters: () => void;
}

export default function QuickFilters({
  things,
  categories,
  selectedCategoryId,
  selectedTags,
  onCategoryFilter,
  onTagFilter,
  onClearFilters,
}: QuickFiltersProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorizedCount = 0;

    things.forEach(thing => {
      if (thing.categoryId) {
        counts.set(thing.categoryId, (counts.get(thing.categoryId) || 0) + 1);
      } else {
        uncategorizedCount++;
      }
    });

    return { counts, uncategorizedCount };
  }, [things]);

  // Calculate tag counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    
    things.forEach(thing => {
      if (thing.tags && thing.tags.length > 0) {
        thing.tags.forEach(tag => {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        });
      }
    });

    // Sort tags by count (descending) then alphabetically
    return Array.from(counts.entries())
      .sort(([tagA, countA], [tagB, countB]) => {
        if (countA !== countB) return countB - countA;
        return tagA.localeCompare(tagB);
      });
  }, [things]);

  const handleCategoryClick = (categoryId: string | undefined) => {
    if (selectedCategoryId === categoryId) {
      // Deselect if already selected
      onCategoryFilter(undefined);
    } else {
      onCategoryFilter(categoryId);
    }
  };

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      // Remove tag if already selected
      onTagFilter(selectedTags.filter(t => t !== tag));
    } else {
      // Add tag to selection
      onTagFilter([...selectedTags, tag]);
    }
  };

  const hasActiveFilters = selectedCategoryId || selectedTags.length > 0;

  return (
    <Paper 
      sx={{ 
        width: 280, 
        height: 'fit-content',
        maxHeight: 'calc(100vh - 200px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Quick Filters
          </Typography>
          {hasActiveFilters && (
            <Chip
              label="Clear All"
              size="small"
              variant="outlined"
              deleteIcon={<ClearIcon />}
              onDelete={onClearFilters}
              onClick={onClearFilters}
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Box>
      </Box>

      <Divider />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Categories Section */}
        <List dense sx={{ py: 0 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => setCategoriesExpanded(!categoriesExpanded)}
              sx={{ py: 1 }}
            >
              <CategoryIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText 
                primary="Categories"
                slotProps={{
                  primary: { style: { fontWeight: 500, fontSize: '0.9rem' } }
                }}
              />
              {categoriesExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={categoriesExpanded} timeout="auto" unmountOnExit>
            <List dense sx={{ pl: 1 }}>
              {/* All Categories */}
              <ListItem disablePadding>
                <ListItemButton
                  selected={!selectedCategoryId}
                  onClick={() => handleCategoryClick(undefined)}
                  sx={{ 
                    py: 0.5,
                    borderRadius: 1,
                    mx: 0.5,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.50',
                      '&:hover': {
                        backgroundColor: 'primary.100',
                      },
                    },
                  }}
                >
                  <ListItemText 
                    primary="All Categories"
                    primaryTypographyProps={{ fontSize: '0.85rem' }}
                  />
                  <Badge 
                    badgeContent={things.length} 
                    color="default"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.7rem',
                        minWidth: 16,
                        height: 16,
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>

              {/* Individual Categories */}
              {categories.length === 0 ? (
                <ListItem disablePadding>
                  <ListItemText 
                    primary="No categories found"
                    primaryTypographyProps={{ 
                      fontSize: '0.85rem',
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      textAlign: 'center',
                      py: 1
                    }}
                  />
                </ListItem>
              ) : (
                categories.map(category => {
                  const count = categoryCounts.counts.get(category.id) || 0;
                  if (count === 0) return null;
                  
                  return (
                    <ListItem key={category.id} disablePadding>
                      <ListItemButton
                        selected={selectedCategoryId === category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        sx={{ 
                          py: 0.5,
                          borderRadius: 1,
                          mx: 0.5,
                          '&.Mui-selected': {
                            backgroundColor: 'primary.50',
                            '&:hover': {
                              backgroundColor: 'primary.100',
                            },
                          },
                        }}
                      >
                        {category.color && (
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: category.color,
                              mr: 1,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <ListItemText 
                          primary={category.name}
                          primaryTypographyProps={{ fontSize: '0.85rem' }}
                        />
                        <Badge 
                          badgeContent={count} 
                          color="primary"
                          sx={{
                            '& .MuiBadge-badge': {
                              fontSize: '0.7rem',
                              minWidth: 16,
                              height: 16,
                            }
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })
              )}

              {/* Uncategorized */}
              {categoryCounts.uncategorizedCount > 0 && (
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedCategoryId === 'uncategorized'}
                    onClick={() => handleCategoryClick('uncategorized')}
                    sx={{ 
                      py: 0.5,
                      borderRadius: 1,
                      mx: 0.5,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.50',
                        '&:hover': {
                          backgroundColor: 'primary.100',
                        },
                      },
                    }}
                  >
                    <ListItemText 
                      primary="Uncategorized"
                      primaryTypographyProps={{ 
                        fontSize: '0.85rem',
                        fontStyle: 'italic',
                        color: 'text.secondary'
                      }}
                    />
                    <Badge 
                      badgeContent={categoryCounts.uncategorizedCount} 
                      color="default"
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.7rem',
                          minWidth: 16,
                          height: 16,
                        }
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )}
            </List>
          </Collapse>
        </List>

        <Divider />

        {/* Tags Section */}
        <List dense sx={{ py: 0 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => setTagsExpanded(!tagsExpanded)}
              sx={{ py: 1 }}
            >
              <TagIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText 
                primary="Tags" 
                primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
              />
              {selectedTags.length > 0 && (
                <Chip
                  label={selectedTags.length}
                  size="small"
                  color="primary"
                  sx={{ 
                    fontSize: '0.7rem',
                    height: 20,
                    mr: 1,
                  }}
                />
              )}
              {tagsExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={tagsExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 1, maxHeight: 300, overflow: 'auto' }}>
              {tagCounts.length === 0 ? (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ textAlign: 'center', py: 2, fontStyle: 'italic' }}
                >
                  No tags found
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {tagCounts.map(([tag, count]) => (
                    <Chip
                      key={tag}
                      label={`${tag} (${count})`}
                      size="small"
                      variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                      color={selectedTags.includes(tag) ? 'primary' : 'default'}
                      onClick={() => handleTagClick(tag)}
                      sx={{
                        fontSize: '0.75rem',
                        height: 24,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: selectedTags.includes(tag) 
                            ? 'primary.dark' 
                            : 'action.hover',
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Collapse>
        </List>
      </Box>
    </Paper>
  );
}