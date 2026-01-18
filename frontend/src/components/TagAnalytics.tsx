import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Stack,
  Grid,
  Tooltip,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Tag as TagIcon,
  TrendingUp,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Assessment,
  LocalOffer,
  Analytics,
  Refresh,
  Search as SearchIcon,
  Sort as SortIcon,
} from '@mui/icons-material';

import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';

interface TagStatistic {
  tag: string;
  count: number;
  percentage: number;
  firstUsed: string;
  lastUsed: string;
}

interface CategoryStatistic {
  categoryId: string;
  categoryName: string;
  count: number;
  percentage: number;
  color?: string;
}

interface TagAnalyticsData {
  inventoryId: string;
  totalTags: number;
  uniqueTags: number;
  totalThings: number;
  taggedThings: number;
  tagStatistics: TagStatistic[];
  pagination?: {
    limit: number;
    offset: number;
    totalResults: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
    hasPrevious: boolean;
    sortBy: string;
    sortOrder: string;
    filter: string | null;
  };
  lastUpdated: string;
}

interface TagAnalyticsProps {
  inventoryId: string;
}

/**
 * Tag Analytics Component
 * Displays tag usage statistics, frequency charts, and tag management functionality with pagination
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 6.5
 */
const TagAnalytics: React.FC<TagAnalyticsProps> = ({ inventoryId }) => {
  const [analyticsData, setAnalyticsData] = useState<TagAnalyticsData | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagStatistic | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<'count' | 'tag' | 'percentage'>('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = useState('');
  const [searchText, setSearchText] = useState('');

  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadAnalyticsData();
  }, [inventoryId, currentPage, pageSize, sortBy, sortOrder, filterText]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const offset = (currentPage - 1) * pageSize;
      
      // Load tag analytics and category/thing data in parallel
      const [tagData, categories, things] = await Promise.all([
        apiClient.getTagAnalytics(inventoryId, {
          limit: pageSize,
          offset,
          sortBy,
          sortOrder,
          filter: filterText || undefined
        }),
        apiClient.getCategories(inventoryId),
        apiClient.getThings(inventoryId)
      ]);
      
      setAnalyticsData(tagData);
      
      // Calculate category statistics
      const totalThings = things.length;
      const categoryMap = new Map<string, { name: string; count: number; color?: string }>();
      let uncategorizedCount = 0;
      
      things.forEach(thing => {
        if (thing.categoryId) {
          const existing = categoryMap.get(thing.categoryId);
          if (existing) {
            existing.count++;
          } else {
            const category = categories.find(c => c.id === thing.categoryId);
            if (category) {
              categoryMap.set(thing.categoryId, {
                name: category.name,
                count: 1,
                color: category.color
              });
            }
          }
        } else {
          uncategorizedCount++;
        }
      });
      
      // Convert to array and calculate percentages
      const stats: CategoryStatistic[] = Array.from(categoryMap.entries()).map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        count: data.count,
        percentage: totalThings > 0 ? Math.round((data.count / totalThings) * 100) : 0,
        color: data.color
      }));
      
      // Add uncategorized if there are any
      if (uncategorizedCount > 0) {
        stats.push({
          categoryId: 'uncategorized',
          categoryName: 'Uncategorized',
          count: uncategorizedCount,
          percentage: totalThings > 0 ? Math.round((uncategorizedCount / totalThings) * 100) : 0
        });
      }
      
      // Sort by count descending
      stats.sort((a, b) => b.count - a.count);
      
      setCategoryStats(stats);
    } catch (err) {
      console.error('Error loading tag analytics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tag analytics';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event: any) => {
    setPageSize(event.target.value);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleSortChange = (newSortBy: 'count' | 'tag' | 'percentage') => {
    if (newSortBy === sortBy) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field with default order
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'tag' ? 'asc' : 'desc');
    }
    setCurrentPage(1); // Reset to first page when changing sort
  };

  const handleSearch = () => {
    setFilterText(searchText);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleClearSearch = () => {
    setSearchText('');
    setFilterText('');
    setCurrentPage(1);
  };

  const handleEditTag = (tag: TagStatistic) => {
    setSelectedTag(tag);
    setNewTagName(tag.tag);
    setEditDialogOpen(true);
  };

  const handleDeleteTag = (tag: TagStatistic) => {
    setSelectedTag(tag);
    setDeleteDialogOpen(true);
  };

  const handleRenameTag = async () => {
    if (!selectedTag || !newTagName.trim()) return;

    try {
      setRenameLoading(true);
      
      // Note: This would require a backend endpoint for renaming tags
      // For now, we'll show a success message and reload data
      // In a real implementation, you'd call something like:
      // await apiClient.renameTag(inventoryId, selectedTag.tag, newTagName.trim());
      
      showSuccess(`Tag "${selectedTag.tag}" would be renamed to "${newTagName.trim()}"`);
      setEditDialogOpen(false);
      setSelectedTag(null);
      setNewTagName('');
      
      // Reload analytics data
      await loadAnalyticsData();
    } catch (err) {
      console.error('Error renaming tag:', err);
      showError(err instanceof Error ? err.message : 'Failed to rename tag');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteUnusedTag = async () => {
    if (!selectedTag) return;

    try {
      setDeleteLoading(true);
      
      // Note: This would require a backend endpoint for deleting unused tags
      // For now, we'll show a success message and reload data
      // In a real implementation, you'd call something like:
      // await apiClient.deleteUnusedTag(inventoryId, selectedTag.tag);
      
      showSuccess(`Unused tag "${selectedTag.tag}" would be deleted`);
      setDeleteDialogOpen(false);
      setSelectedTag(null);
      
      // Reload analytics data
      await loadAnalyticsData();
    } catch (err) {
      console.error('Error deleting tag:', err);
      showError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 50) return 'success';
    if (percentage >= 25) return 'warning';
    return 'error';
  };

  const getUsageIntensity = (count: number, maxCount: number) => {
    const intensity = maxCount > 0 ? (count / maxCount) : 0;
    if (intensity >= 0.8) return 'Very High';
    if (intensity >= 0.6) return 'High';
    if (intensity >= 0.4) return 'Medium';
    if (intensity >= 0.2) return 'Low';
    return 'Very Low';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading tag analytics...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={loadAnalyticsData} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!analyticsData) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        No tag analytics data available
      </Alert>
    );
  }

  const maxCount = analyticsData.tagStatistics.length > 0 
    ? Math.max(...analyticsData.tagStatistics.map(stat => stat.count))
    : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            <Analytics sx={{ mr: 1, verticalAlign: 'middle' }} />
            Tag Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Analyze tag usage patterns and manage your tag vocabulary
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadAnalyticsData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <LocalOffer color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Total Tags
                </Typography>
              </Box>
              <Typography variant="h3" color="primary">
                {analyticsData.totalTags}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across all items
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TagIcon color="success" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Unique Tags
                </Typography>
              </Box>
              <Typography variant="h3" color="success.main">
                {analyticsData.uniqueTags}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Different tag names
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Assessment color="info" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Tagged Items
                </Typography>
              </Box>
              <Typography variant="h3" color="info.main">
                {analyticsData.taggedThings}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Of {analyticsData.totalThings} total items
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp color="warning" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Avg Tags/Item
                </Typography>
              </Box>
              <Typography variant="h3" color="warning.main">
                {analyticsData.taggedThings > 0 
                  ? (analyticsData.totalTags / analyticsData.taggedThings).toFixed(1)
                  : '0'
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tags per tagged item
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                placeholder="Search tags..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
                fullWidth
              >
                Search
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                variant="outlined"
                onClick={handleClearSearch}
                disabled={loading || (!searchText && !filterText)}
                fullWidth
              >
                Clear
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => handleSortChange(e.target.value as 'count' | 'tag' | 'percentage')}
                  disabled={loading}
                >
                  <MenuItem value="count">Usage Count</MenuItem>
                  <MenuItem value="tag">Tag Name</MenuItem>
                  <MenuItem value="percentage">Percentage</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Per Page</InputLabel>
                <Select
                  value={pageSize}
                  label="Per Page"
                  onChange={handlePageSizeChange}
                  disabled={loading}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={200}>200</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {analyticsData?.pagination && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Showing {analyticsData.pagination.offset + 1}-{Math.min(
                  analyticsData.pagination.offset + analyticsData.pagination.limit,
                  analyticsData.pagination.totalResults
                )} of {analyticsData.pagination.totalResults} tags
                {analyticsData.pagination.filter && (
                  <> (filtered by "{analyticsData.pagination.filter}")</>
                )}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <SortIcon fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  {sortBy} ({sortOrder})
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tag Usage Statistics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tag Usage Frequency
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Tags sorted by usage frequency with management options
          </Typography>

          {analyticsData.tagStatistics.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <TagIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No tags found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start adding tags to your items to see analytics here
              </Typography>
            </Box>
          ) : (
            <List>
              {analyticsData.tagStatistics.map((stat, index) => (
                <React.Fragment key={stat.tag}>
                  <ListItem>
                    <ListItemIcon>
                      <Chip
                        label={stat.tag}
                        color={getUsageColor(stat.percentage) as any}
                        variant="outlined"
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography variant="body1" fontWeight="bold">
                            {stat.tag}
                          </Typography>
                          <Chip
                            label={getUsageIntensity(stat.count, maxCount)}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Used {stat.count} times ({stat.percentage}% of tagged items)
                          </Typography>
                          <Box sx={{ mt: 1, mb: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={maxCount > 0 ? (stat.count / maxCount) * 100 : 0}
                              sx={{ height: 6, borderRadius: 3 }}
                              color={getUsageColor(stat.percentage) as any}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            First used: {new Date(stat.firstUsed).toLocaleDateString()} • 
                            Last used: {new Date(stat.lastUsed).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Rename tag">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleEditTag(stat)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        {stat.count === 0 && (
                          <Tooltip title="Delete unused tag">
                            <IconButton
                              edge="end"
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTag(stat)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < analyticsData.tagStatistics.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}

          {/* Pagination Controls */}
          {analyticsData?.pagination && analyticsData.pagination.totalPages > 1 && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={analyticsData.pagination.totalPages}
                page={analyticsData.pagination.currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
                disabled={loading}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tag Distribution Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tag Distribution
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Visual representation of tag usage patterns
          </Typography>

          {analyticsData.tagStatistics.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              {/* Top 10 tags visualization */}
              <Typography variant="subtitle2" gutterBottom>
                Top 10 Most Used Tags
              </Typography>
              {analyticsData.tagStatistics.slice(0, 10).map((stat, index) => (
                <Box key={stat.tag} sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2">
                      #{index + 1} {stat.tag}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stat.count} uses ({stat.percentage}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={maxCount > 0 ? (stat.count / maxCount) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4 }}
                    color={getUsageColor(stat.percentage) as any}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Assessment sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No tag distribution data available
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Category Distribution Chart */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Category Distribution
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Items organized by category
          </Typography>

          {categoryStats.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              {categoryStats.map((stat, index) => (
                <Box key={stat.categoryId} sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {stat.color && (
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: stat.color,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Typography variant="body2">
                        #{index + 1} {stat.categoryName}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {stat.count} items ({stat.percentage}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={stat.percentage}
                    sx={{ height: 8, borderRadius: 4 }}
                    color={stat.categoryId === 'uncategorized' ? 'inherit' : 'primary'}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Assessment sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No category distribution data available
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Tag Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rename Tag</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Renaming a tag will update it across all items that use it.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="New Tag Name"
            fullWidth
            variant="outlined"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            helperText="Tag names are automatically normalized (lowercase, trimmed)"
          />
          {selectedTag && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This will rename "{selectedTag.tag}" across {selectedTag.count} items
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenameTag}
            variant="contained"
            disabled={!newTagName.trim() || newTagName.trim() === selectedTag?.tag || renameLoading}
          >
            {renameLoading ? <CircularProgress size={20} /> : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Tag Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Unused Tag</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete the tag "{selectedTag?.tag}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone. The tag will be removed from your tag vocabulary.
          </Typography>
          {selectedTag && selectedTag.count > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This tag is currently used by {selectedTag.count} items and cannot be deleted.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteUnusedTag}
            variant="contained"
            color="error"
            disabled={!selectedTag || selectedTag.count > 0 || deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagAnalytics;