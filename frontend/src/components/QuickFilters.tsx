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
  LocationOn as LocationIcon,
  Person as PersonIcon,
  MeetingRoom as RoomIcon,
} from '@mui/icons-material';
import type { Thing, Category, Location, Person, Room } from '../types';

interface QuickFiltersProps {
  things: Thing[];
  categories: Category[];
  locations: Location[];
  rooms: Room[];
  people: Person[];
  selectedCategoryId?: string;
  selectedLocationId?: string;
  selectedRoomId?: string;
  selectedOwnerId?: string;
  selectedTags: string[];
  onCategoryFilter: (categoryId: string | undefined) => void;
  onLocationFilter: (locationId: string | undefined) => void;
  onRoomFilter: (roomId: string | undefined) => void;
  onOwnerFilter: (ownerId: string | undefined) => void;
  onTagFilter: (tags: string[]) => void;
  onClearFilters: () => void;
}

export default function QuickFilters({
  things,
  categories,
  locations,
  rooms,
  people,
  selectedCategoryId,
  selectedLocationId,
  selectedRoomId,
  selectedOwnerId,
  selectedTags,
  onCategoryFilter,
  onLocationFilter,
  onRoomFilter,
  onOwnerFilter,
  onTagFilter,
  onClearFilters,
}: QuickFiltersProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [locationsExpanded, setLocationsExpanded] = useState(true);
  const [expandedLocationIds, setExpandedLocationIds] = useState<Set<string>>(new Set());
  const [ownersExpanded, setOwnersExpanded] = useState(true);
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

  // Calculate location counts
  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let unlocatedCount = 0;

    things.forEach(thing => {
      if (thing.locationId) {
        counts.set(thing.locationId, (counts.get(thing.locationId) || 0) + 1);
      } else {
        unlocatedCount++;
      }
    });

    return { counts, unlocatedCount };
  }, [things]);

  // Calculate room counts
  const roomCounts = useMemo(() => {
    const counts = new Map<string, number>();

    things.forEach(thing => {
      if (thing.roomId) {
        counts.set(thing.roomId, (counts.get(thing.roomId) || 0) + 1);
      }
    });

    return counts;
  }, [things]);

  // Calculate owner counts
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let unownedCount = 0;

    things.forEach(thing => {
      if (thing.ownerId) {
        counts.set(thing.ownerId, (counts.get(thing.ownerId) || 0) + 1);
      } else {
        unownedCount++;
      }
    });

    return { counts, unownedCount };
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

  const handleLocationClick = (locationId: string | undefined) => {
    if (selectedLocationId === locationId) {
      // Deselect if already selected
      onLocationFilter(undefined);
      onRoomFilter(undefined); // Clear room filter when location is deselected
    } else {
      onLocationFilter(locationId);
      onRoomFilter(undefined); // Clear room filter when changing location
    }
  };

  const handleRoomClick = (roomId: string | undefined) => {
    if (selectedRoomId === roomId) {
      // Deselect if already selected
      onRoomFilter(undefined);
    } else {
      onRoomFilter(roomId);
    }
  };

  const toggleLocationExpanded = (locationId: string) => {
    const newExpanded = new Set(expandedLocationIds);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocationIds(newExpanded);
  };

  const handleOwnerClick = (ownerId: string | undefined) => {
    if (selectedOwnerId === ownerId) {
      // Deselect if already selected
      onOwnerFilter(undefined);
    } else {
      onOwnerFilter(ownerId);
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

  const hasActiveFilters = selectedCategoryId || selectedLocationId || selectedRoomId || selectedOwnerId || selectedTags.length > 0;

  return (
    <Paper 
      sx={{ 
        width: 280, 
        height: '100%',
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

        {/* Locations Section */}
        <List dense sx={{ py: 0 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => setLocationsExpanded(!locationsExpanded)}
              sx={{ py: 1 }}
            >
              <LocationIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText 
                primary="Locations"
                slotProps={{
                  primary: { style: { fontWeight: 500, fontSize: '0.9rem' } }
                }}
              />
              {locationsExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={locationsExpanded} timeout="auto" unmountOnExit>
            <List dense sx={{ pl: 1 }}>
              {/* All Locations */}
              <ListItem disablePadding>
                <ListItemButton
                  selected={!selectedLocationId}
                  onClick={() => handleLocationClick(undefined)}
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
                    primary="All Locations"
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

              {/* Individual Locations */}
              {locations.length === 0 ? (
                <ListItem disablePadding>
                  <ListItemText 
                    primary="No locations found"
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
                locations.map(location => {
                  const count = locationCounts.counts.get(location.id) || 0;
                  if (count === 0) return null;
                  
                  const locationRooms = rooms.filter(r => r.locationId === location.id);
                  const roomsWithItems = locationRooms.filter(r => (roomCounts.get(r.id) || 0) > 0);
                  const hasRooms = roomsWithItems.length > 0;
                  const isLocationExpanded = expandedLocationIds.has(location.id);
                  
                  return (
                    <Box key={location.id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          selected={selectedLocationId === location.id && !selectedRoomId}
                          onClick={() => handleLocationClick(location.id)}
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
                          {hasRooms && (
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLocationExpanded(location.id);
                              }}
                              sx={{ 
                                mr: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                p: 0.25,
                                borderRadius: 0.5,
                                '&:hover': {
                                  backgroundColor: 'action.hover',
                                }
                              }}
                            >
                              {isLocationExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                            </Box>
                          )}
                          <ListItemText 
                            primary={location.name}
                            primaryTypographyProps={{ fontSize: '0.85rem' }}
                            sx={{ ml: hasRooms ? 0 : 3 }}
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
                      
                      {/* Rooms under this location */}
                      {hasRooms && (
                        <Collapse in={isLocationExpanded} timeout="auto" unmountOnExit>
                          <List dense sx={{ pl: 4 }}>
                            {roomsWithItems.map(room => {
                              const roomCount = roomCounts.get(room.id) || 0;
                              
                              return (
                                <ListItem key={room.id} disablePadding>
                                  <ListItemButton
                                    selected={selectedRoomId === room.id}
                                    onClick={() => {
                                      // Auto-select parent location when selecting room
                                      if (selectedLocationId !== location.id) {
                                        onLocationFilter(location.id);
                                      }
                                      handleRoomClick(room.id);
                                    }}
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
                                    <RoomIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                                    <ListItemText 
                                      primary={room.name}
                                      primaryTypographyProps={{ fontSize: '0.8rem' }}
                                    />
                                    <Badge 
                                      badgeContent={roomCount} 
                                      color="primary"
                                      sx={{
                                        '& .MuiBadge-badge': {
                                          fontSize: '0.65rem',
                                          minWidth: 14,
                                          height: 14,
                                        }
                                      }}
                                    />
                                  </ListItemButton>
                                </ListItem>
                              );
                            })}
                          </List>
                        </Collapse>
                      )}
                    </Box>
                  );
                })
              )}

              {/* Unlocated */}
              {locationCounts.unlocatedCount > 0 && (
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedLocationId === 'unlocated'}
                    onClick={() => handleLocationClick('unlocated')}
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
                      primary="No Location"
                      primaryTypographyProps={{ 
                        fontSize: '0.85rem',
                        fontStyle: 'italic',
                        color: 'text.secondary'
                      }}
                    />
                    <Badge 
                      badgeContent={locationCounts.unlocatedCount} 
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

        {/* Owners Section */}
        <List dense sx={{ py: 0 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => setOwnersExpanded(!ownersExpanded)}
              sx={{ py: 1 }}
            >
              <PersonIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText 
                primary="Owners"
                slotProps={{
                  primary: { style: { fontWeight: 500, fontSize: '0.9rem' } }
                }}
              />
              {ownersExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={ownersExpanded} timeout="auto" unmountOnExit>
            <List dense sx={{ pl: 1 }}>
              {/* All Owners */}
              <ListItem disablePadding>
                <ListItemButton
                  selected={!selectedOwnerId}
                  onClick={() => handleOwnerClick(undefined)}
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
                    primary="All Owners"
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

              {/* Individual Owners */}
              {people.length === 0 ? (
                <ListItem disablePadding>
                  <ListItemText 
                    primary="No owners found"
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
                people.map(person => {
                  const count = ownerCounts.counts.get(person.id) || 0;
                  if (count === 0) return null;
                  
                  return (
                    <ListItem key={person.id} disablePadding>
                      <ListItemButton
                        selected={selectedOwnerId === person.id}
                        onClick={() => handleOwnerClick(person.id)}
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
                          primary={person.name}
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

              {/* Unowned */}
              {ownerCounts.unownedCount > 0 && (
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedOwnerId === 'unowned'}
                    onClick={() => handleOwnerClick('unowned')}
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
                      primary="No Owner"
                      primaryTypographyProps={{ 
                        fontSize: '0.85rem',
                        fontStyle: 'italic',
                        color: 'text.secondary'
                      }}
                    />
                    <Badge 
                      badgeContent={ownerCounts.unownedCount} 
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