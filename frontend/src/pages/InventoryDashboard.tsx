import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container as MuiContainer,
  Card,
  CardContent,
  Button,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Fab,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Analytics as AnalyticsIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMobileDetection } from '../hooks/useMobileDetection';
import apiClient from '../services/api';
import TagAnalytics from '../components/TagAnalytics';
import MobileNavigation from '../components/MobileNavigation';
import type { Thing, Category } from '../types';

interface InventoryStats {
  totalThings: number;
  totalCategories: number;
  taggedThings: number;
  totalTags: number;
  uniqueTags: number;
  averageTagsPerItem: number;
}

interface CategoryStatistic {
  category: Category;
  count: number;
  percentage: number;
}

/**
 * Category Statistics Card Component
 * Displays category distribution and statistics
 * Validates: Requirements 5.1, 5.2
 */
interface CategoryStatsCardProps {
  categories: Category[];
  categoryStats: CategoryStatistic[];
}

function CategoryStatsCard({ categories, categoryStats }: CategoryStatsCardProps) {
  const topCategories = categoryStats.slice(0, 5);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600 }}>
          <CategoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Category Distribution
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>
                {categories.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Categories
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 700 }}>
                {categoryStats.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Categories in Use
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        {topCategories.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Top Categories by Item Count
            </Typography>
            {topCategories.map((stat, index) => (
              <Box key={stat.category.id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      #{index + 1} {stat.category.name}
                    </Typography>
                    {stat.category.color && (
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: stat.category.color,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {stat.count} items ({stat.percentage}%)
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        
        {categoryStats.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CategoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No items categorized yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start adding items to see category statistics
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inventory Overview Card Component
 * Displays high-level inventory statistics
 * Validates: Requirements 5.1, 5.2
 */
interface InventoryOverviewCardProps {
  stats: InventoryStats;
}

function InventoryOverviewCard({ stats }: InventoryOverviewCardProps) {
  const taggingProgress = stats.totalThings > 0 ? (stats.taggedThings / stats.totalThings) * 100 : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600 }}>
          <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Inventory Overview
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>
                {stats.totalThings}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Items
              </Typography>
            </Box>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 700 }}>
                {stats.totalCategories}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Categories
              </Typography>
            </Box>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="info.main" sx={{ fontWeight: 700 }}>
                {stats.taggedThings}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tagged Items
              </Typography>
            </Box>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="warning.main" sx={{ fontWeight: 700 }}>
                {stats.uniqueTags}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unique Tags
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Tagging Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(taggingProgress)}%
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'grey.300',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor: 'success.main',
                    width: `${taggingProgress}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {stats.taggedThings} of {stats.totalThings} items tagged
            </Typography>
          </Box>
          
          {stats.averageTagsPerItem > 0 && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Average tags per item: <strong>{stats.averageTagsPerItem.toFixed(1)}</strong>
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

/**
 * Quick Actions Component
 * Provides buttons for common inventory operations
 * Validates: Requirements 5.1, 5.2
 */
interface QuickActionsProps {
  onViewThings: () => void;
  onViewCategories: () => void;
  onViewTagAnalytics: () => void;
}

function QuickActions({ onViewThings, onViewCategories, onViewTagAnalytics }: QuickActionsProps) {
  const { isMobile } = useMobileDetection();

  const actions = [
    {
      label: 'View All Items',
      icon: <InventoryIcon />,
      onClick: onViewThings,
      color: 'primary' as const,
    },
    {
      label: 'Manage Categories',
      icon: <CategoryIcon />,
      onClick: onViewCategories,
      color: 'secondary' as const,
    },
    {
      label: 'Tag Analytics',
      icon: <AnalyticsIcon />,
      onClick: onViewTagAnalytics,
      color: 'info' as const,
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600 }}>
          Quick Actions
        </Typography>
        
        <Grid container spacing={2}>
          {actions.map((action) => (
            <Grid size={{ xs: 12, sm: 4 }} key={action.label}>
              <Button
                variant="outlined"
                color={action.color}
                startIcon={action.icon}
                onClick={action.onClick}
                fullWidth
                sx={{
                  py: 2,
                  flexDirection: isMobile ? 'row' : 'column',
                  gap: 1,
                  '& .MuiButton-startIcon': {
                    margin: isMobile ? '0 8px 0 0' : '0 0 8px 0',
                  },
                }}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

/**
 * Inventory Dashboard Page
 * Main dashboard for inventory management with statistics,
 * category distribution, and tag analytics
 * Validates: Requirements 5.1, 5.2
 */
export default function InventoryDashboard() {
  const { isMobile } = useMobileDetection();
  const { currentInventory } = useInventory();
  const { showError } = useNotification();
  
  const [, setThings] = useState<Thing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<InventoryStats>({
    totalThings: 0,
    totalCategories: 0,
    taggedThings: 0,
    totalTags: 0,
    uniqueTags: 0,
    averageTagsPerItem: 0,
  });
  const [categoryStats, setCategoryStats] = useState<CategoryStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTagAnalytics, setShowTagAnalytics] = useState(false);

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!currentInventory) return;
    
    try {
      setLoading(true);
      
      // Load things and categories in parallel
      const [thingsData, categoriesData] = await Promise.all([
        apiClient.getThings(currentInventory.id),
        apiClient.getCategories(currentInventory.id),
      ]);
      
      // Ensure we have arrays, fallback to empty arrays if not
      const safeThingsData = Array.isArray(thingsData) ? thingsData : [];
      const safeCategoriesData = Array.isArray(categoriesData) ? categoriesData : [];
      
      setThings(safeThingsData);
      setCategories(safeCategoriesData);
      
      // Calculate statistics
      const totalThings = safeThingsData.length;
      const totalCategories = safeCategoriesData.length;
      
      // Calculate tag statistics
      const taggedThings = safeThingsData.filter((thing: Thing) => 
        thing.tags && Array.isArray(thing.tags) && thing.tags.length > 0
      ).length;
      
      const allTags = safeThingsData.reduce((acc: string[], thing: Thing) => {
        if (thing.tags && Array.isArray(thing.tags)) {
          return [...acc, ...thing.tags];
        }
        return acc;
      }, []);
      
      const totalTags = allTags.length;
      const uniqueTags = new Set(allTags).size;
      const averageTagsPerItem = taggedThings > 0 ? totalTags / taggedThings : 0;
      
      setStats({
        totalThings,
        totalCategories,
        taggedThings,
        totalTags,
        uniqueTags,
        averageTagsPerItem,
      });
      
      // Calculate category statistics
      const categoryCountMap = new Map<string, number>();
      safeThingsData.forEach((thing: Thing) => {
        if (thing.categoryId) {
          const count = categoryCountMap.get(thing.categoryId) || 0;
          categoryCountMap.set(thing.categoryId, count + 1);
        }
      });
      
      const categoryStatsData: CategoryStatistic[] = Array.from(categoryCountMap.entries())
        .map(([categoryId, count]) => {
          const category = safeCategoriesData.find((cat: Category) => cat.id === categoryId);
          if (!category) return null;
          
          return {
            category,
            count,
            percentage: totalThings > 0 ? Math.round((count / totalThings) * 100) : 0,
          };
        })
        .filter((stat): stat is CategoryStatistic => stat !== null)
        .sort((a, b) => b.count - a.count);
      
      setCategoryStats(categoryStatsData);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentInventory]);

  // Navigation handlers
  const handleViewThings = () => {
    window.location.href = '/things';
  };

  const handleViewCategories = () => {
    window.location.href = '/categories';
  };

  const handleViewTagAnalytics = () => {
    setShowTagAnalytics(true);
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  if (!currentInventory) {
    return (
      <MuiContainer maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          Please select an inventory to view the dashboard.
        </Alert>
      </MuiContainer>
    );
  }

  if (showTagAnalytics) {
    return (
      <MuiContainer 
        maxWidth="lg" 
        sx={{ 
          py: isMobile ? 2 : 4,
          px: isMobile ? 1 : 3,
          pb: isMobile ? 8 : 4, // Extra padding for mobile navigation
        }}
      >
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowTagAnalytics(false)}
          >
            ← Back to Dashboard
          </Button>
        </Box>
        
        <TagAnalytics inventoryId={currentInventory.id} />
        
        {/* Mobile Navigation */}
        <MobileNavigation 
          containerCount={0}
          unreadNotifications={0}
        />
      </MuiContainer>
    );
  }

  return (
    <>
      <MuiContainer 
        maxWidth="lg" 
        sx={{ 
          py: isMobile ? 2 : 4,
          px: isMobile ? 1 : 3,
          pb: isMobile ? 8 : 4, // Extra padding for mobile navigation
        }}
        className={isMobile ? 'mobile-container' : ''}
      >
        {/* Header */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: isMobile ? 2 : 4,
            position: isMobile ? 'sticky' : 'static',
            top: 0,
            backgroundColor: 'background.default',
            zIndex: 100,
            py: isMobile ? 1 : 0,
          }}
          className={isMobile ? 'mobile-dashboard-header' : ''}
        >
          <Box>
            <Typography 
              variant={isMobile ? 'h5' : 'h4'} 
              component="h1" 
              gutterBottom
              className={isMobile ? 'mobile-title' : ''}
            >
              <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Inventory Dashboard
            </Typography>
            <Typography 
              variant={isMobile ? 'body2' : 'subtitle1'} 
              color="text.secondary"
              className={isMobile ? 'mobile-subtitle' : ''}
            >
              {currentInventory.name}
            </Typography>
          </Box>
          {!isMobile && (
            <IconButton 
              onClick={handleRefresh} 
              disabled={loading}
              aria-label="Refresh dashboard data"
              className="mobile-touch-icon-button"
            >
              <RefreshIcon />
            </IconButton>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Quick Actions */}
            <Box sx={{ mb: 4 }}>
              <QuickActions
                onViewThings={handleViewThings}
                onViewCategories={handleViewCategories}
                onViewTagAnalytics={handleViewTagAnalytics}
              />
            </Box>

            {/* Statistics Overview */}
            <Box sx={{ mb: 4 }}>
              <InventoryOverviewCard stats={stats} />
            </Box>

            {/* Category Statistics */}
            <Box sx={{ mb: 4 }}>
              <CategoryStatsCard 
                categories={categories}
                categoryStats={categoryStats}
              />
            </Box>

            {/* Tag Analytics Preview */}
            {stats.uniqueTags > 0 && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                      <TagIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Tag Analytics Preview
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AnalyticsIcon />}
                      onClick={handleViewTagAnalytics}
                    >
                      View Detailed Analytics
                    </Button>
                  </Box>
                  
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                          {stats.totalTags}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Tags Applied
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                          {stats.uniqueTags}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Unique Tag Names
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                          {stats.averageTagsPerItem.toFixed(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Avg Tags per Item
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((stats.taggedThings / stats.totalThings) * 100)}% of your items are tagged
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Empty State for Tags */}
            {stats.uniqueTags === 0 && (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <TagIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No Tags Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Start adding tags to your items to see analytics and improve organization.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleViewThings}
                  >
                    Add Tags to Items
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Floating Action Button for Mobile */}
        {isMobile && (
          <Fab
            color="primary"
            aria-label="View tag analytics"
            onClick={handleViewTagAnalytics}
            sx={{
              position: 'fixed',
              bottom: 72, // Above mobile navigation
              right: 16,
              width: 64,
              height: 64,
            }}
          >
            <AnalyticsIcon />
          </Fab>
        )}
      </MuiContainer>

      {/* Mobile Navigation */}
      <MobileNavigation 
        containerCount={0}
        unreadNotifications={0}
      />
    </>
  );
}