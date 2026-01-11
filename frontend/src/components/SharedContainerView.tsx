import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  Share as ShareIcon,
  AttachMoney as MoneyIcon,
  PhotoCamera as PhotoIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import apiClient from '../services/api';

interface SharedContainerData {
  shareId: string;
  container: {
    id: string;
    name: string;
    type: string;
    description?: string;
    status: string;
    itemCount: number;
    handlingFlags: string[];
    createdAt: string;
    locationId?: string;
    estimatedValue?: number;
    storageStartDate?: string;
    storageRate?: number;
  };
  items: Array<{
    id: string;
    name: string;
    category: string;
    description?: string;
    photos?: string[];
    value?: number;
    serialNumber?: string;
    model?: string;
    brand?: string;
    purchasePrice?: number;
    datePurchased?: string;
  }>;
  itemCount: number;
  privacySettings: {
    includeItemDetails: boolean;
    includePhotos: boolean;
    includeSensitiveData: boolean;
  };
  description?: string;
  createdAt: string;
  expiresAt?: string;
  accessCount: number;
}

const handlingFlagConfig = {
  fragile: { label: 'Fragile', color: '#ff9800', icon: '🔸' },
  heavy: { label: 'Heavy', color: '#795548', icon: '⚖️' },
  valuable: { label: 'Valuable', color: '#4caf50', icon: '💎' },
  priority: { label: 'Priority', color: '#f44336', icon: '⚡' },
  keep_upright: { label: 'Keep Upright', color: '#2196f3', icon: '⬆️' },
  temperature_sensitive: { label: 'Temperature Sensitive', color: '#9c27b0', icon: '🌡️' }
};

const containerTypeIcons = {
  box: '📦',
  bag: '👜',
  crate: '📦',
  bin: '🗂️',
  suitcase: '🧳',
  trunk: '📦',
  custom: '📦'
};

const statusColors = {
  empty: '#9e9e9e',
  packing: '#ff9800',
  packed: '#4caf50',
  in_transit: '#2196f3',
  stored: '#9c27b0',
  unpacking: '#ff5722',
  unpacked: '#795548'
};

/**
 * SharedContainerView Component
 * Displays a read-only view of a shared container with privacy controls
 * Validates: Requirements 9.2, 9.4, 9.5
 */
const SharedContainerView: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [data, setData] = useState<SharedContainerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const loadSharedContainer = async () => {
      if (!shareId || !token) {
        setError('Invalid sharing link');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const sharedData = await apiClient.getSharedContainer(shareId, token);
        setData(sharedData);
        setError(null);
      } catch (err) {
        console.error('Error loading shared container:', err);
        if (err instanceof Error) {
          if (err.message.includes('not found')) {
            setError('This shared container could not be found. The link may be invalid or expired.');
          } else if (err.message.includes('expired') || err.message.includes('no longer available')) {
            setError('This sharing link has expired or is no longer available.');
          } else if (err.message.includes('Invalid or expired')) {
            setError('This sharing link is invalid or has expired.');
          } else {
            setError('Unable to load the shared container. Please try again later.');
          }
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadSharedContainer();
  }, [shareId, token]);

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="60vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Loading shared container...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box maxWidth="md" mx="auto" p={3}>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          icon={<WarningIcon />}
        >
          <Typography variant="h6" gutterBottom>
            Unable to Access Shared Container
          </Typography>
          {error}
        </Alert>
        
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            If you believe this is an error, please contact the person who shared this link with you.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Shared links may expire or have access limits that have been reached.
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box maxWidth="md" mx="auto" p={3}>
        <Alert severity="warning">
          No container data available.
        </Alert>
      </Box>
    );
  }

  const { container, items, privacySettings } = data;

  return (
    <Box maxWidth="lg" mx="auto" p={isMobile ? 2 : 3}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', fontSize: '1.5rem' }}>
            {containerTypeIcons[container.type as keyof typeof containerTypeIcons] || '📦'}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h4" component="h1" gutterBottom>
              {container.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip 
                label={container.type.charAt(0).toUpperCase() + container.type.slice(1)}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label={container.status.replace('_', ' ').toUpperCase()}
                size="small"
                sx={{ 
                  bgcolor: statusColors[container.status as keyof typeof statusColors] || '#9e9e9e',
                  color: 'white'
                }}
              />
              <Chip 
                icon={<InventoryIcon />}
                label={`${container.itemCount} items`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Stack>
          </Box>
          <Tooltip title="Shared Container">
            <ShareIcon sx={{ fontSize: 32, opacity: 0.8 }} />
          </Tooltip>
        </Stack>

        {/* Handling Flags */}
        {container.handlingFlags && container.handlingFlags.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
            {container.handlingFlags.map((flag) => {
              const config = handlingFlagConfig[flag as keyof typeof handlingFlagConfig];
              return config ? (
                <Chip
                  key={flag}
                  label={`${config.icon} ${config.label}`}
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              ) : null;
            })}
          </Stack>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
        {/* Container Details */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Container Details
              </Typography>
              
              <Stack spacing={2}>
                {container.description && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body2">
                      {container.description}
                    </Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {format(new Date(container.createdAt), 'PPP')}
                  </Typography>
                </Box>

                {privacySettings.includeSensitiveData && container.estimatedValue && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      <MoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Estimated Value
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      £{container.estimatedValue.toLocaleString()}
                    </Typography>
                  </Box>
                )}

                {privacySettings.includeSensitiveData && container.storageStartDate && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      <StorageIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Storage Since
                    </Typography>
                    <Typography variant="body2">
                      {format(new Date(container.storageStartDate), 'PPP')}
                    </Typography>
                    {container.storageRate && (
                      <Typography variant="body2" color="text.secondary">
                        ${container.storageRate}/month
                      </Typography>
                    )}
                  </Box>
                )}

                {data.expiresAt && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Link Expires
                    </Typography>
                    <Typography variant="body2" color="warning.main">
                      {format(new Date(data.expiresAt), 'PPP p')}
                    </Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    <VisibilityIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    Views
                  </Typography>
                  <Typography variant="body2">
                    {data.accessCount} time{data.accessCount !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Privacy Notice */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Privacy Settings
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box 
                    width={8} 
                    height={8} 
                    borderRadius="50%" 
                    bgcolor={privacySettings.includeItemDetails ? 'success.main' : 'error.main'} 
                  />
                  <Typography variant="body2">
                    Item details {privacySettings.includeItemDetails ? 'included' : 'hidden'}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box 
                    width={8} 
                    height={8} 
                    borderRadius="50%" 
                    bgcolor={privacySettings.includePhotos ? 'success.main' : 'error.main'} 
                  />
                  <Typography variant="body2">
                    Photos {privacySettings.includePhotos ? 'included' : 'hidden'}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box 
                    width={8} 
                    height={8} 
                    borderRadius="50%" 
                    bgcolor={privacySettings.includeSensitiveData ? 'success.main' : 'error.main'} 
                  />
                  <Typography variant="body2">
                    Sensitive data {privacySettings.includeSensitiveData ? 'included' : 'hidden'}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Container Contents */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Container Contents ({items.length} items)
              </Typography>

              {!privacySettings.includeItemDetails ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Item details are not included in this shared view for privacy reasons.
                  Only the item count is visible.
                </Alert>
              ) : items.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This container is currently empty.
                </Alert>
              ) : (
                <List>
                  {items.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {privacySettings.includePhotos && item.photos && item.photos.length > 0 ? (
                              <PhotoIcon />
                            ) : (
                              <CategoryIcon />
                            )}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" fontWeight="medium">
                              {item.name}
                            </Typography>
                          }
                          secondary={
                            <Stack spacing={1} mt={1}>
                              <Typography variant="body2" color="text.secondary">
                                Category: {item.category}
                              </Typography>
                              
                              {item.description && (
                                <Typography variant="body2" color="text.secondary">
                                  {item.description}
                                </Typography>
                              )}

                              {privacySettings.includeSensitiveData && (
                                <Stack direction="row" spacing={2} flexWrap="wrap">
                                  {item.value && (
                                    <Typography variant="body2" color="success.main" fontWeight="medium">
                                      Value: £{item.value.toLocaleString()}
                                    </Typography>
                                  )}
                                  {item.brand && (
                                    <Typography variant="body2" color="text.secondary">
                                      Brand: {item.brand}
                                    </Typography>
                                  )}
                                  {item.model && (
                                    <Typography variant="body2" color="text.secondary">
                                      Model: {item.model}
                                    </Typography>
                                  )}
                                  {item.serialNumber && (
                                    <Typography variant="body2" color="text.secondary">
                                      S/N: {item.serialNumber}
                                    </Typography>
                                  )}
                                </Stack>
                              )}

                              {privacySettings.includePhotos && item.photos && item.photos.length > 0 && (
                                <Stack direction="row" spacing={1} mt={1}>
                                  {item.photos.slice(0, 3).map((photo, photoIndex) => (
                                    <Box
                                      key={photoIndex}
                                      component="img"
                                      src={photo}
                                      alt={`${item.name} photo ${photoIndex + 1}`}
                                      sx={{
                                        width: 60,
                                        height: 60,
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider'
                                      }}
                                    />
                                  ))}
                                  {item.photos.length > 3 && (
                                    <Box
                                      sx={{
                                        width: 60,
                                        height: 60,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: 'grey.100',
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider'
                                      }}
                                    >
                                      <Typography variant="caption" color="text.secondary">
                                        +{item.photos.length - 3}
                                      </Typography>
                                    </Box>
                                  )}
                                </Stack>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                      {index < items.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Footer */}
      <Paper sx={{ p: 2, mt: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary">
          This is a shared view of a container. Some information may be hidden for privacy.
        </Typography>
        {data.description && (
          <Typography variant="body2" color="text.secondary" mt={1}>
            Share description: {data.description}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default SharedContainerView;