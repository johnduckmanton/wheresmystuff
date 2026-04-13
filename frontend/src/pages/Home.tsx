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
  ListItem,
  ListItemText,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMobileDetection } from '../hooks/useMobileDetection';
import apiClient from '../services/api';
import type { Thing, Container } from '../types';

/**
 * Home Page — consolidated dashboard
 * Quick actions, recent things, recent containers
 */
export default function Home() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isMobile: isMobileHook } = useMobileDetection();
  const { currentInventory } = useInventory();
  const { showError } = useNotification();

  const [things, setThings] = useState<Thing[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!currentInventory) return;
      try {
        setLoading(true);
        const [thingsData, containersResponse] = await Promise.all([
          apiClient.getThings(currentInventory.id),
          apiClient.getContainers(currentInventory.id),
        ]);

        const safeThings = Array.isArray(thingsData) ? thingsData : [];
        let safeContainers: Container[];
        if (Array.isArray(containersResponse)) {
          safeContainers = containersResponse;
        } else if (containersResponse && typeof containersResponse === 'object' && 'containers' in containersResponse) {
          safeContainers = (containersResponse as any).containers || [];
        } else {
          safeContainers = [];
        }

        setThings(safeThings);
        setContainers(safeContainers);
      } catch (error) {
        console.error('Failed to load home data:', error);
        showError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentInventory]);

  // Recent things — sorted by dateAdded descending, top 5
  const recentThings = [...things]
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, 5);

  // Recent containers — sorted by createdAt descending, top 4
  const recentContainers = [...containers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  const quickActions = [
    { label: 'New Container', icon: <AllInboxIcon fontSize="small" />, onClick: () => navigate('/containers') },
    { label: 'New Project', icon: <FolderIcon fontSize="small" />, onClick: () => navigate('/projects') },
    { label: 'Scan QR', icon: <QrCodeScannerIcon fontSize="small" />, onClick: () => navigate('/scan') },
    { label: 'AI Photo', icon: <CameraAltIcon fontSize="small" />, onClick: () => navigate('/ai-photo') },
  ];

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
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ fontWeight: 600 }}>
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
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ fontWeight: 600 }}>
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

      {/* Quick Actions */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
        Quick Actions
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: isMobile ? 2 : 3,
          overflowX: isMobile ? 'auto' : 'visible',
          pb: isMobile ? 0.5 : 0,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outlined"
            size="small"
            startIcon={action.icon}
            onClick={action.onClick}
            sx={{
              whiteSpace: 'nowrap',
              flexShrink: 0,
              textTransform: 'none',
              fontSize: '0.8rem',
              py: 0.75,
              px: 1.5,
            }}
          >
            {action.label}
          </Button>
        ))}
      </Box>

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
                <List dense disablePadding>
                  {recentThings.map((thing, idx) => (
                    <ListItem
                      key={thing.id}
                      divider={idx < recentThings.length - 1}
                      sx={{ py: 0.75, px: 2 }}
                    >
                      <ListItemText
                        primary={thing.name}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            {thing.categoryId && (
                              <Typography component="span" variant="caption" color="text.secondary">
                                {thing.categoryId}
                              </Typography>
                            )}
                            <Typography component="span" variant="caption" color="text.disabled">
                              {new Date(thing.dateAdded).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                        primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                      />
                    </ListItem>
                  ))}
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
                      <CardActionArea onClick={() => navigate('/containers')} sx={{ p: 1.5 }}>
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
