import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  MoveToInbox as PackIcon,
  QrCode as QrCodeIcon,
  QrCode2 as BatchQrCodeIcon,

  Storage as StorageIcon,
} from '@mui/icons-material';
import EntityTable from './EntityTable';
import type { EntityTableColumn } from './EntityTable';
import ContainerFormDialog from './ContainerFormDialog';
import ContainerDetailDialog from './ContainerDetailDialog';
import PackingDialog from './PackingDialog';
import QRCodeGenerator from './QRCodeGenerator';
import BatchQRCodeGenerator from './BatchQRCodeGenerator';
import MobileContainerCard from './MobileContainerCard';
import HandlingFlagChip from './HandlingFlagChip';
import StorageManagementDialog from './StorageManagementDialog';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMobileDetection } from '../hooks/useMobileDetection';

import { useContainerVoiceCommands } from '../hooks/useVoiceCommands';
import { useAccessibility } from '../contexts/AccessibilityContext';

import apiClient from '../services/api';
import type { Container, Location, ContainerStatus, HandlingFlag, MovingProject } from '../types/entities';

interface ContainerListProps {
  onContainerSelect?: (container: Container) => void;
}

export default function ContainerList({ onContainerSelect }: ContainerListProps) {
  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();
  const { isMobile } = useMobileDetection();
  const [containers, setContainers] = useState<Container[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<MovingProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packingDialogOpen, setPackingDialogOpen] = useState(false);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [batchQrCodeDialogOpen, setBatchQrCodeDialogOpen] = useState(false);
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  
  // Accessibility features
  const { announceToScreenReader } = useAccessibility();
  
  // Voice commands for container management
  useContainerVoiceCommands((action, data) => {
    switch (action) {
      case 'create':
        setFormDialogOpen(true);
        announceToScreenReader('Opening container creation form', 'polite');
        break;
      case 'search':
        // Implement search functionality
        announceToScreenReader(`Searching for: ${data?.query}`, 'polite');
        break;
      case 'clearSearch':
        // Implement clear search
        announceToScreenReader('Search cleared', 'polite');
        break;
      case 'showAll':
        // Implement show all
        announceToScreenReader('Showing all containers', 'polite');
        break;
      case 'generateQR':
        setBatchQrCodeDialogOpen(true);
        announceToScreenReader('Opening QR code generator', 'polite');
        break;
      case 'scanQR':
        // Implement QR scanning
        announceToScreenReader('Opening QR code scanner', 'polite');
        break;
    }
  });

  // Load data when component mounts or inventory changes
  useEffect(() => {
    if (currentInventory) {
      loadContainers();
      loadLocations();
      loadProjects();
    }
  }, [currentInventory]);

  const loadContainers = async () => {
    if (!currentInventory) return;

    console.log('🔍 Loading containers for inventory:', currentInventory.id);
    setLoading(true);
    try {
      const response = await apiClient.getContainers(currentInventory.id);
      console.log('📡 API Response:', response);
      
      // Handle both array response (old format) and object response (new format)
      let containerData: Container[];
      if (Array.isArray(response)) {
        console.log('📦 Response is array format, length:', response.length);
        containerData = response;
      } else if (response && typeof response === 'object' && 'containers' in response) {
        console.log('📦 Response is object format, containers length:', (response as any).containers?.length || 0);
        containerData = (response as any).containers || [];
      } else {
        console.log('⚠️ Unexpected response format:', typeof response);
        containerData = [];
      }
      
      // Ensure we have an array, fallback to empty array if not
      const safeData = Array.isArray(containerData) ? containerData : [];
      console.log('✅ Setting containers, final count:', safeData.length);
      setContainers(safeData);
    } catch (error) {
      console.error('❌ Error loading containers:', error);
      showError('Failed to load containers');
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    if (!currentInventory) return;

    try {
      const data = await apiClient.getLocations(currentInventory.id);
      // Ensure we have an array, fallback to empty array if not
      const safeData = Array.isArray(data) ? data : [];
      setLocations(safeData);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadProjects = async () => {
    if (!currentInventory) return;

    try {
      const data = await apiClient.getProjects(currentInventory.id);
      // Ensure we have an array, fallback to empty array if not
      const safeData = Array.isArray(data) ? data : [];
      setProjects(safeData);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Create location lookup map
  const locationMap = useMemo(() => {
    const map = new Map<string, Location>();
    // Ensure locations is an array before calling forEach
    const safeLocations = Array.isArray(locations) ? locations : [];
    safeLocations.forEach(location => {
      map.set(location.id, location);
    });
    return map;
  }, [locations]);

  // Create project lookup map
  const projectMap = useMemo(() => {
    const map = new Map<string, MovingProject>();
    // Ensure projects is an array before calling forEach
    const safeProjects = Array.isArray(projects) ? projects : [];
    safeProjects.forEach(project => {
      map.set(project.id, project);
    });
    return map;
  }, [projects]);

  // Filter options for dropdowns
  const filterOptions = useMemo(() => {
    // Ensure containers is an array before calling map
    const safeContainers = Array.isArray(containers) ? containers : [];
    
    const typeOptions = Array.from(new Set(safeContainers.map(c => c.type)))
      .map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }));
    
    const statusOptions = Array.from(new Set(safeContainers.map(c => c.status)))
      .map(status => ({ value: status, label: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }));
    
    const locationOptions = Array.from(new Set(safeContainers.map(c => c.locationId).filter(Boolean)))
      .map(locationId => {
        const location = locationMap.get(locationId!);
        return { value: locationId!, label: location?.name || 'Unknown Location' };
      });

    const projectOptions = Array.from(new Set(safeContainers.map(c => c.projectId).filter(Boolean)))
      .map(projectId => {
        const project = projectMap.get(projectId!);
        return { value: projectId!, label: project?.name || 'Unknown Project' };
      });

    // Add "No Project" option for containers without projects
    const hasUnassignedContainers = safeContainers.some(c => !c.projectId);
    if (hasUnassignedContainers) {
      projectOptions.unshift({ value: 'none', label: 'No Project' });
    }

    // Handling flags options - get all unique flags from containers
    const allHandlingFlags = Array.from(new Set(
      safeContainers.flatMap(c => c.handlingFlags || [])
    ));
    const handlingFlagOptions = allHandlingFlags.map(flag => ({
      value: flag,
      label: flag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));

    return {
      type: typeOptions,
      status: statusOptions,
      locationId: locationOptions,
      projectId: projectOptions,
      handlingFlags: handlingFlagOptions,
    };
  }, [containers, locationMap, projectMap]);

  // Table columns configuration
  const columns: EntityTableColumn[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Color indicator and photo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {params.row.photos && params.row.photos.length > 0 ? (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: params.row.color ? `2px solid ${params.row.color}` : '1px solid #ddd',
                }}
              >
                <img
                  src={`${process.env.REACT_APP_API_URL}/photos/${params.row.photos[0]}`}
                  alt="Container"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            ) : params.row.color ? (
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: params.row.color,
                  border: '1px solid #ddd',
                }}
              />
            ) : null}
            <Typography variant="body2" fontWeight="medium">
              {params.value}
            </Typography>
          </Box>
          {params.row.handlingFlags?.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {params.row.handlingFlags.slice(0, 3).map((flag: HandlingFlag) => (
                <HandlingFlagChip
                  key={flag}
                  flag={flag}
                  size="small"
                  showIcon={true}
                  showLabel={false}
                />
              ))}
              {params.row.handlingFlags.length > 3 && (
                <Chip
                  label={`+${params.row.handlingFlags.length - 3}`}
                  size="small"
                  color="default"
                  sx={{ minWidth: 24, height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          )}
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const getStatusColor = (status: ContainerStatus) => {
          switch (status) {
            case 'empty': return 'default';
            case 'packing': return 'info';
            case 'packed': return 'success';
            case 'in_transit': return 'warning';
            case 'stored': return 'secondary';
            case 'unpacking': return 'info';
            case 'unpacked': return 'success';
            default: return 'default';
          }
        };

        return (
          <Chip
            label={params.value.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            size="small"
            color={getStatusColor(params.value)}
          />
        );
      },
    },
    {
      field: 'itemCount',
      headerName: 'Items',
      width: 80,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <InventoryIcon fontSize="small" color="action" />
          <Typography variant="body2">{params.value || 0}</Typography>
        </Box>
      ),
    },
    {
      field: 'locationId',
      headerName: 'Location',
      width: 150,
      renderCell: (params) => {
        if (!params.value) return <Typography variant="body2" color="text.secondary">-</Typography>;
        const location = locationMap.get(params.value);
        return (
          <Typography variant="body2">
            {location?.name || 'Unknown'}
          </Typography>
        );
      },
    },
    {
      field: 'projectId',
      headerName: 'Project',
      width: 150,
      renderCell: (params) => {
        if (!params.value) return <Typography variant="body2" color="text.secondary">No Project</Typography>;
        const project = projectMap.get(params.value);
        return (
          <Chip
            label={project?.name || 'Unknown Project'}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'estimatedValue',
      headerName: 'Value',
      width: 100,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value ? `$${params.value.toFixed(2)}` : '-'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Generate QR Code">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateQRCode(params.row);
              }}
            >
              <QrCodeIcon fontSize="small" color="secondary" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Pack Items">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handlePackItems(params.row);
              }}
            >
              <PackIcon fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Storage Management">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleStorageManagement(params.row);
              }}
            >
              <StorageIcon fontSize="small" color="secondary" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(params.row);
              }}
            >
              <InventoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Container">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(params.row);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Container">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(params.row);
              }}
            >
              <DeleteIcon fontSize="small" color="error" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const handleCreate = () => {
    setSelectedContainer(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (container: Container) => {
    setSelectedContainer(container);
    setFormDialogOpen(true);
  };

  const handleViewDetails = (container: Container) => {
    setSelectedContainer(container);
    setDetailDialogOpen(true);
    if (onContainerSelect) {
      onContainerSelect(container);
    }
  };

  const handleDelete = (container: Container) => {
    setSelectedContainer(container);
    setDeleteDialogOpen(true);
  };

  const handlePackItems = (container: Container) => {
    setSelectedContainer(container);
    setPackingDialogOpen(true);
  };

  const handleGenerateQRCode = (container: Container) => {
    setSelectedContainer(container);
    setQrCodeDialogOpen(true);
  };

  const handleBatchQRCode = () => {
    setBatchQrCodeDialogOpen(true);
  };

  const handleStorageManagement = (container: Container) => {
    setSelectedContainer(container);
    setStorageDialogOpen(true);
  };

  const handleFormSuccess = (container: Container) => {
    console.log('🎉 Container form success, using returned container:', container);
    
    // Update the containers list with the new/updated container
    setContainers(prevContainers => {
      const existingIndex = prevContainers.findIndex(c => c.id === container.id);
      if (existingIndex >= 0) {
        // Update existing container
        const updatedContainers = [...prevContainers];
        updatedContainers[existingIndex] = container;
        return updatedContainers;
      } else {
        // Add new container to the beginning of the list
        return [container, ...prevContainers];
      }
    });
    
    setFormDialogOpen(false);
    setSelectedContainer(null);
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setSelectedContainer(null);
  };

  const handleDetailClose = () => {
    setDetailDialogOpen(false);
    setSelectedContainer(null);
  };

  const handlePackingClose = () => {
    setPackingDialogOpen(false);
    setSelectedContainer(null);
  };

  const handleQRCodeClose = () => {
    setQrCodeDialogOpen(false);
    setSelectedContainer(null);
  };

  const handleBatchQRCodeClose = () => {
    setBatchQrCodeDialogOpen(false);
  };

  const handleQRCodeGenerated = () => {
    showSuccess(`QR code generated for ${selectedContainer?.name}`);
    // Optionally refresh containers to update QR code info
    loadContainers();
  };

  const handleBatchQRCodeGenerated = (results: any) => {
    showSuccess(`Generated ${results.successCount} QR codes successfully`);
    if (results.failureCount > 0) {
      showError(`${results.failureCount} QR codes failed to generate`);
    }
  };

  const handleItemsAdded = (itemIds: string[]) => {
    // Refresh containers to update item counts
    loadContainers();
    showSuccess(`Successfully packed ${itemIds.length} items`);
  };

  const confirmDelete = async () => {
    if (!selectedContainer || !currentInventory) return;

    try {
      await apiClient.deleteContainer(selectedContainer.id, currentInventory.id);
      showSuccess('Container deleted successfully');
      loadContainers();
    } catch (error) {
      console.error('Error deleting container:', error);
      showError(
        error instanceof Error ? error.message : 'Failed to delete container'
      );
    } finally {
      setDeleteDialogOpen(false);
      setSelectedContainer(null);
    }
  };

  const handleRowClick = (containerRow: Container) => {
    handleViewDetails(containerRow);
  };

  if (!currentInventory) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please select an inventory to view containers
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3, pb: isMobile ? 8 : 3 }}>
      {/* Header */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: isMobile ? 2 : 3,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 2 : 0,
        }}
      >
        <Typography 
          variant={isMobile ? 'h5' : 'h4'} 
          component="h1"
          sx={{ alignSelf: isMobile ? 'flex-start' : 'auto' }}
        >
          Containers
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          width: isMobile ? '100%' : 'auto',
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          <Button
            variant="outlined"
            startIcon={<BatchQrCodeIcon />}
            onClick={handleBatchQRCode}
            disabled={containers.length === 0}
            fullWidth={isMobile}
            className={isMobile ? 'mobile-touch-button' : ''}
          >
            Batch QR Codes
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            fullWidth={isMobile}
            className={isMobile ? 'mobile-touch-button' : ''}
          >
            Create Container
          </Button>
        </Box>
      </Box>

      {/* Container Display - Mobile Cards or Desktop Table */}
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading containers...</Typography>
            </Box>
          ) : containers.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No containers found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create your first container to get started
              </Typography>
            </Box>
          ) : (
            Array.isArray(containers) && containers.map((container) => (
              <MobileContainerCard
                key={container.id}
                container={container}
                locationName={locationMap.get(container.locationId || '')?.name}
                onView={handleViewDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPack={handlePackItems}
                onGenerateQR={handleGenerateQRCode}
              />
            ))
          )}
        </Box>
      ) : (
        <EntityTable
          columns={columns}
          data={containers}
          loading={loading}
          onRowClick={handleRowClick}
          dropdownFilters={filterOptions}
        />
      )}

      {/* Form Dialog */}
      <ContainerFormDialog
        open={formDialogOpen}
        container={selectedContainer}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      {/* Detail Dialog */}
      {selectedContainer && (
        <ContainerDetailDialog
          open={detailDialogOpen}
          container={selectedContainer}
          inventoryId={currentInventory?.id || ''}
          onClose={handleDetailClose}
          onEdit={() => {
            setDetailDialogOpen(false);
            setFormDialogOpen(true);
          }}
          onDelete={() => {
            setDetailDialogOpen(false);
            handleDelete(selectedContainer);
          }}
        />
      )}

      {/* Packing Dialog */}
      <PackingDialog
        open={packingDialogOpen}
        container={selectedContainer}
        onClose={handlePackingClose}
        onItemsAdded={handleItemsAdded}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Container</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the container "{selectedContainer?.name}"?
            {selectedContainer?.itemCount !== undefined && selectedContainer.itemCount > 0 && (
              <>
                <br />
                <strong>Warning:</strong> This container contains {selectedContainer.itemCount} items.
                Deleting it will remove the container assignment from these items.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Generator Dialog */}
      {selectedContainer && (
        <QRCodeGenerator
          open={qrCodeDialogOpen}
          onClose={handleQRCodeClose}
          container={selectedContainer}
          onQRCodeGenerated={handleQRCodeGenerated}
        />
      )}

      {/* Batch QR Code Generator Dialog */}
      <BatchQRCodeGenerator
        open={batchQrCodeDialogOpen}
        onClose={handleBatchQRCodeClose}
        containers={containers}
        onBatchGenerated={handleBatchQRCodeGenerated}
      />

      {/* Storage Management Dialog */}
      <StorageManagementDialog
        open={storageDialogOpen}
        onClose={() => setStorageDialogOpen(false)}
        container={selectedContainer}
        inventoryId={currentInventory?.id || ''}
        onStorageUpdated={loadContainers}
      />
    </Box>
  );
}