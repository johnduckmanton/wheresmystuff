import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItemButton,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CategoryIcon from '@mui/icons-material/Category';

import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import PhotoThumbnail from '../components/PhotoThumbnail';
import apiClient from '../services/api';
import type { Thing, Container, Category, Location } from '../types';

/**
 * Home Page — consolidated dashboard
 * Module cards, recent things, recent containers
 */
export default function Home() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentInventory } = useInventory();
  const { showError } = useNotification();

  const [things, setThings] = useState<Thing[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!currentInventory) return;
      try {
        setLoading(true);
        const [thingsData, containersResponse, categoriesData, locationsData] = await Promise.all([
          apiClient.getThings(currentInventory.id),
          apiClient.getContainers(currentInventory.id),
          apiClient.getCategories(currentInventory.id),
          apiClient.getLocations(currentInventory.id),
        ]);

        const safeThings = Array.isArray(thingsData) ? thingsData : [];

        setThings(safeThings);
        setContainers(containersResponse.containers);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setLocations(Array.isArray(locationsData) ? locationsData : []);
      } catch (error) {
        console.error('Failed to load home data:', error);
        showError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentInventory]);

  // Recent things — sorted by dateAdded descending, top 3
  const recentThings = [...things]
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, 3);

  // Recent containers — sorted by createdAt descending, top 3
  const recentContainers = [...containers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return '';
    return categories.find(c => c.id === categoryId)?.name || '';
  };

  const getLocationName = (locationId?: string) => {
    if (!locationId) return '';
    return locations.find(l => l.id === locationId)?.name || '';
  };

  if (!currentInventory) {
    return (
      <Box sx={{ p: isMobile ? 1 : 2 }}>
        <Alert severity="warning">Please select an inventory to view the dashboard.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 2, pb: isMobile ? 8 : 2 }}>
      {/* Module Cards */}
      <Grid container spacing={isMobile ? 1 : 2} sx={{ mb: isMobile ? 2 : 3 }}>
        <Grid size={{ xs: 6, sm: 6 }}>
          <Card
            elevation={2}
            sx={{
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
            }}
          >
            <CardActionArea
              onClick={() => navigate('/things')}
              sx={{ p: isMobile ? 2 : 3, textAlign: 'center' }}
              aria-label="Navigate to Inventory Management"
            >
              <Box sx={{ color: 'primary.main', mb: 1 }}>
                <InventoryIcon sx={{ fontSize: isMobile ? 36 : 48 }} />
              </Box>
              <Typography
                variant={isMobile ? 'subtitle1' : 'h6'}
                sx={{
                  fontWeight: 600,
                  ...(isMobile && {
                    whiteSpace: 'nowrap',
                    fontSize: '0.85rem',
                  }),
                }}
              >
                Inventory
              </Typography>
              {!isMobile && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Manage items, categories, and locations
                </Typography>
              )}
            </CardActionArea>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 6 }}>
          <Card
            elevation={2}
            sx={{
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
            }}
          >
            <CardActionArea
              onClick={() => navigate('/containers')}
              sx={{ p: isMobile ? 2 : 3, textAlign: 'center' }}
              aria-label="Navigate to Moving and Storage"
            >
              <Box sx={{ color: 'primary.main', mb: 1 }}>
                <LocalShippingIcon sx={{ fontSize: isMobile ? 36 : 48 }} />
              </Box>
              <Typography
                variant={isMobile ? 'subtitle1' : 'h6'}
                sx={{
                  fontWeight: 600,
                  ...(isMobile && {
                    whiteSpace: 'nowrap',
                    fontSize: '0.85rem',
                  }),
                }}
              >
                Moving & Storage
              </Typography>
              {!isMobile && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Containers, QR codes, and moves
                </Typography>
              )}
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Recently Added Things */}
          <Box sx={{ mb: isMobile ? 2 : 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Recently Added Things
              </Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/things')} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                View All
              </Button>
            </Box>
            {recentThings.length > 0 ? (
              <Card variant="outlined">
                <List disablePadding>
                  {recentThings.map((thing, idx) => {
                    const photoKey = thing.photos && thing.photos.length > 0 ? thing.photos[0] : undefined;
                    const categoryName = getCategoryName(thing.categoryId);
                    const locationName = getLocationName(thing.locationId);
                    return (
                      <ListItemButton
                        key={thing.id}
                        onClick={() => navigate('/things', { state: { openThingId: thing.id } })}
                        divider={idx < recentThings.length - 1}
                        sx={{ py: 1.5, px: 2, alignItems: 'flex-start', gap: 1.5 }}
                      >
                        <PhotoThumbnail
                          photoKey={photoKey}
                          altText={thing.name}
                          size={48}
                          showPopup={false}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {thing.name}
                          </Typography>
                          {thing.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {thing.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {locationName && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <LocationOnIcon sx={{ fontSize: 12, color: 'error.main' }} />
                                <Typography variant="caption" color="text.secondary">{locationName}</Typography>
                              </Box>
                            )}
                            {categoryName && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <CategoryIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.secondary">{categoryName}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </ListItemButton>
                    );
                  })}
                </List>
              </Card>
            ) : (
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No items yet. Add your first thing to get started.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/things')}
                    sx={{ mt: 1, textTransform: 'none' }}
                  >
                    Add Thing
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Recent Containers */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Recent Containers
              </Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/containers')} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                View All
              </Button>
            </Box>
            {recentContainers.length > 0 ? (
              <Grid container spacing={1}>
                {recentContainers.map((container) => (
                  <Grid size={{ xs: 6, sm: 6, md: 3 }} key={container.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s',
                        '&:hover': { boxShadow: 3 },
                      }}
                    >
                      <CardActionArea onClick={() => navigate('/containers')} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {container.photos && container.photos.length > 0 ? (
                          <PhotoThumbnail
                            photoKey={container.photos[0]}
                            altText={container.name}
                            size={40}
                            showPopup={false}
                          />
                        ) : null}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }} noWrap>
                            {container.name}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip
                              label={container.status.replace('_', ' ')}
                              size="small"
                              color={container.status === 'packed' ? 'success' : 'default'}
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {container.itemCount || 0} items
                            </Typography>
                          </Box>
                        </Box>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No containers yet.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/containers')}
                    sx={{ mt: 1, textTransform: 'none' }}
                  >
                    New Container
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
