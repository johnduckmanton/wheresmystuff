import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container as MuiContainer,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  Fab,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import InventoryIcon from '@mui/icons-material/Inventory';

import QrCodeIcon from '@mui/icons-material/QrCode';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StorageIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMobileDetection } from '../hooks/useMobileDetection';
import apiClient from '../services/api';
import type { Container, MovingProject, ContainerStatus, ProjectStatus, ThingWithContainer, Location, Room, Category, Person } from '../types';
import QRCodeScanner from '../components/QRCodeScanner';
import QRScanResults from '../components/QRScanResults';
import ContainerDetailDialog from '../components/ContainerDetailDialog';
import ContainerFormDialog from '../components/ContainerFormDialog';
import ThingFormDialog from '../components/ThingFormDialog';
import MobileNavigation from '../components/MobileNavigation';

interface DashboardStats {
  totalContainers: number;
  packedContainers: number;
  totalItems: number;
  totalValue: number;
  activeProjects: number;
  completedProjects: number;
}

/**
 * Project Overview Card Component
 * Displays project information with progress indicators
 * Validates: Requirements 8.3, 8.4
 */
interface ProjectOverviewCardProps {
  project: MovingProject;
  onClick: () => void;
}

function ProjectOverviewCard({ project, onClick }: ProjectOverviewCardProps) {
  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'planning': return 'default';
      case 'active': return 'primary';
      case 'paused': return 'warning';
      case 'completed': return 'success';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card 
      sx={{ 
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            {project.name}
          </Typography>
          <Chip 
            label={project.status.charAt(0).toUpperCase() + project.status.slice(1)} 
            color={getStatusColor(project.status)}
            size="small"
          />
        </Box>
        
        {project.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {project.description}
          </Typography>
        )}
        
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {project.completionPercentage}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={project.completionPercentage} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Containers
            </Typography>
            <Typography variant="h6">
              {project.containerCount}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Items
            </Typography>
            <Typography variant="h6">
              {project.itemCount}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Start Date
            </Typography>
            <Typography variant="body2">
              {formatDate(project.startDate)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Target Date
            </Typography>
            <Typography variant="body2">
              {formatDate(project.targetDate)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

/**
 * Container Statistics Card Component
 * Displays container summary and status information
 * Validates: Requirements 11.1, 11.2
 */
interface ContainerStatsCardProps {
  containers: Container[];
  stats: DashboardStats;
}

function ContainerStatsCard({ containers, stats }: ContainerStatsCardProps) {
  const getStatusCounts = () => {
    const counts: Record<ContainerStatus, number> = {
      empty: 0,
      packing: 0,
      packed: 0,
      in_transit: 0,
      stored: 0,
      unpacking: 0,
      unpacked: 0,
    };
    
    // Ensure containers is an array before calling forEach
    const safeContainers = Array.isArray(containers) ? containers : [];
    safeContainers.forEach((container: Container) => {
      counts[container.status] = (counts[container.status] || 0) + 1;
    });
    
    return counts;
  };

  const statusCounts = getStatusCounts();
  const packingProgress = stats.totalContainers > 0 ? (stats.packedContainers / stats.totalContainers) * 100 : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600 }}>
          Container Overview
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>
                {stats.totalContainers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Containers
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 700 }}>
                {stats.totalItems}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Items Packed
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Packing Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(packingProgress)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={packingProgress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Container Status
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(statusCounts).map(([status, count]) => (
              count > 0 && (
                <Grid key={status}>
                  <Chip 
                    label={`${status.replace('_', ' ').toUpperCase()}: ${count}`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
              )
            ))}
          </Grid>
        </Box>
        
        {stats.totalValue > 0 && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Total Estimated Value
            </Typography>
            <Typography variant="h6" color="primary">
              £${stats.totalValue.toLocaleString()}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Quick Actions Component
 * Provides buttons for common operations
 * Validates: Requirements 11.1, 11.2
 */
interface QuickActionsProps {
  onCreateContainer: () => void;
  onCreateProject: () => void;
  onScanQR: () => void;
  onViewReports: () => void;
}

function QuickActions({ onCreateContainer, onCreateProject, onScanQR, onViewReports }: QuickActionsProps) {
  const { isMobile } = useMobileDetection();

  const actions = [
    {
      label: 'New Container',
      icon: <InventoryIcon />,
      onClick: onCreateContainer,
      color: 'primary' as const,
    },
    {
      label: 'New Project',
      icon: <AssignmentIcon />,
      onClick: onCreateProject,
      color: 'secondary' as const,
    },
    {
      label: 'Scan QR Code',
      icon: <QrCodeIcon />,
      onClick: onScanQR,
      color: 'success' as const,
    },
    {
      label: 'View Reports',
      icon: <TrendingUpIcon />,
      onClick: onViewReports,
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.label}>
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
 * Moving Dashboard Page
 * Main dashboard for Moving & Storage module with project overview,
 * container statistics, and quick actions
 * Validates: Requirements 8.3, 8.4, 11.1, 11.2, 11.3, 11.4, 11.5
 */
export default function MovingDashboard() {
  const { isMobile } = useMobileDetection();
  const { currentInventory } = useInventory();
  const { showError, showSuccess } = useNotification();
  
  const [projects, setProjects] = useState<MovingProject[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalContainers: 0,
    packedContainers: 0,
    totalItems: 0,
    totalValue: 0,
    activeProjects: 0,
    completedProjects: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResultsOpen, setScanResultsOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{
    scanResult: {
      success: boolean;
      containerId: string;
      qrCodeId: string;
      generatedAt: string;
      timestamp: number;
    };
    container: Container;
    items: ThingWithContainer[];
    itemCount: number;
    inventoryId: string; // The actual inventory ID where the container was found
    scannedAt: string;
  } | null>(null);

  // New state for container and item detail dialogs
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [containerDetailOpen, setContainerDetailOpen] = useState(false);
  const [containerFormOpen, setContainerFormOpen] = useState(false);
  const [selectedThing, setSelectedThing] = useState<ThingWithContainer | null>(null);
  const [thingDetailOpen, setThingDetailOpen] = useState(false);
  
  // Data for form dialogs
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!currentInventory) return;
    
    try {
      setLoading(true);
      
      // Load projects, containers, and supporting data in parallel
      const [projectsData, containersResponse, locationsData, roomsData, categoriesData, peopleData] = await Promise.all([
        apiClient.getProjects(currentInventory.id),
        apiClient.getContainers(currentInventory.id),
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id),
        apiClient.getCategories(currentInventory.id),
        apiClient.getPeople(currentInventory.id),
      ]);
      
      // Ensure we have arrays, fallback to empty arrays if not
      const safeProjectsData = Array.isArray(projectsData) ? projectsData : [];
      
      // Handle both array response (old format) and object response (new format)
      let containersData: Container[];
      if (Array.isArray(containersResponse)) {
        containersData = containersResponse;
      } else if (containersResponse && typeof containersResponse === 'object' && 'containers' in containersResponse) {
        containersData = (containersResponse as any).containers || [];
      } else {
        containersData = [];
      }
      
      const safeContainersData = Array.isArray(containersData) ? containersData : [];
      const safeLocationsData = Array.isArray(locationsData) ? locationsData : [];
      const safeRoomsData = Array.isArray(roomsData) ? roomsData : [];
      const safeCategoriesData = Array.isArray(categoriesData) ? categoriesData : [];
      const safePeopleData = Array.isArray(peopleData) ? peopleData : [];
      
      setProjects(safeProjectsData);
      setContainers(safeContainersData);
      setLocations(safeLocationsData);
      setRooms(safeRoomsData);
      setCategories(safeCategoriesData);
      setPeople(safePeopleData);
      
      // Calculate statistics
      const totalContainers = safeContainersData.length;
      const packedContainers = safeContainersData.filter((c: Container) => 
        c.status === 'packed' || c.status === 'in_transit' || c.status === 'stored'
      ).length;
      const totalItems = safeContainersData.reduce((sum: number, c: Container) => sum + (c.itemCount || 0), 0);
      const totalValue = safeContainersData.reduce((sum: number, c: Container) => sum + (c.estimatedValue || 0), 0);
      const activeProjects = safeProjectsData.filter((p: MovingProject) => p.status === 'active' || p.status === 'planning').length;
      const completedProjects = safeProjectsData.filter((p: MovingProject) => p.status === 'completed').length;
      
      setStats({
        totalContainers,
        packedContainers,
        totalItems,
        totalValue,
        activeProjects,
        completedProjects,
      });
      
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

  // Quick action handlers
  const handleCreateContainer = () => {
    setSelectedContainer(null); // Clear any selected container for new creation
    setContainerFormOpen(true);
  };

  const handleCreateProject = () => {
    // TODO: Open project creation dialog
    showSuccess('Project creation will be implemented in a future task');
  };

  const handleScanQR = () => {
    setScannerOpen(true);
  };

  const handleScanSuccess = (result: typeof scanResult) => {
    setScanResult(result);
    setScanResultsOpen(true);
    showSuccess('QR code scanned successfully!');
  };

  const handleNavigateToContainer = (containerId: string) => {
    // If we have scan result data and the container ID matches, use that data
    if (scanResult && scanResult.scanResult.containerId === containerId) {
      setSelectedContainer(scanResult.container);
      setContainerDetailOpen(true);
      return;
    }
    
    // Find the container in our current dashboard data and open the detail dialog
    const container = containers.find(c => c.id === containerId);
    if (container) {
      setSelectedContainer(container);
      setContainerDetailOpen(true);
    } else {
      showError('Container not found');
    }
  };

  const handleNavigateToItem = async (itemId: string) => {
    // If we have scan result data, check if the item is in the scanned items
    if (scanResult && scanResult.items) {
      const scannedItem = scanResult.items.find(item => item.id === itemId);
      if (scannedItem) {
        setSelectedThing(scannedItem);
        setThingDetailOpen(true);
        return;
      }
    }
    
    // Otherwise, fetch the item details from the API
    try {
      const item = await apiClient.getThing(itemId);
      setSelectedThing(item);
      setThingDetailOpen(true);
    } catch (error) {
      console.error('Error fetching item details:', error);
      showError('Item not found or could not be loaded');
    }
  };

  const handleViewReports = () => {
    // TODO: Navigate to reports page
    showSuccess('Reports will be implemented in a future task');
  };

  const handleProjectClick = (project: MovingProject) => {
    // TODO: Navigate to project details
    showSuccess(`Project details for "${project.name}" will be implemented in a future task`);
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleContainerFormSuccess = (container: Container) => {
    // Update the containers list with the new container
    setContainers(prevContainers => [container, ...prevContainers]);
    
    // Update stats
    setStats(prevStats => ({
      ...prevStats,
      totalContainers: prevStats.totalContainers + 1,
    }));
    
    setContainerFormOpen(false);
    setSelectedContainer(null);
    showSuccess(`Container "${container.name}" created successfully!`);
  };

  const handleContainerFormClose = () => {
    setContainerFormOpen(false);
    setSelectedContainer(null);
  };

  if (!currentInventory) {
    return (
      <MuiContainer maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          Please select an inventory to view the moving dashboard.
        </Alert>
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
              Moving & Storage
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
              onCreateContainer={handleCreateContainer}
              onCreateProject={handleCreateProject}
              onScanQR={handleScanQR}
              onViewReports={handleViewReports}
            />
          </Box>

          {/* Statistics and Overview */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <ContainerStatsCard containers={containers} stats={stats} />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600 }}>
                    Project Summary
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>
                          {stats.activeProjects}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Projects
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" color="success.main" sx={{ fontWeight: 700 }}>
                          {stats.completedProjects}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Completed
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  <Button
                    variant="outlined"
                    startIcon={<AssignmentIcon />}
                    onClick={handleCreateProject}
                    fullWidth
                    sx={{ mt: 3 }}
                  >
                    Create New Project
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Active Projects */}
          {projects.length > 0 ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 600 }}>
                Active Projects
              </Typography>
              <Grid container spacing={3}>
                {Array.isArray(projects) && projects
                  .filter((p: MovingProject) => p.status === 'active' || p.status === 'planning')
                  .map((project) => (
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} key={project.id}>
                      <ProjectOverviewCard
                        project={project}
                        onClick={() => handleProjectClick(project)}
                      />
                    </Grid>
                  ))}
              </Grid>
            </Box>
          ) : (
            <Card sx={{ mb: 4 }}>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <StorageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Moving Projects Yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first moving project to start organizing containers and tracking progress.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateProject}
                >
                  Create First Project
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent Containers */}
          {containers.length > 0 && (
            <Box>
              <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 600 }}>
                Recent Containers
              </Typography>
              <Grid container spacing={2}>
                {Array.isArray(containers) && containers
                  .sort((a: Container, b: Container) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .slice(0, 6)
                  .map((container: Container) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={container.id}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                          '&:hover': { 
                            transform: 'translateY(-2px)',
                            boxShadow: 4,
                          },
                        }}
                        onClick={() => handleNavigateToContainer(container.id)}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="h6" component="h3">
                              {container.name}
                            </Typography>
                            <Chip 
                              label={container.status.replace('_', ' ').toUpperCase()} 
                              size="small"
                              color={container.status === 'packed' ? 'success' : 'default'}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {container.type.charAt(0).toUpperCase() + container.type.slice(1)}
                            {container.size && ` • ${container.size}`}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">
                              {container.itemCount || 0} items
                            </Typography>
                            {(container.estimatedValue || 0) > 0 && (
                              <Typography variant="body2" color="primary">
                                £${(container.estimatedValue || 0).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            </Box>
          )}
        </>
      )}

        {/* Floating Action Button for Mobile */}
        {isMobile && (
          <Fab
            color="primary"
            aria-label="Create container"
            onClick={handleCreateContainer}
            sx={{
              position: 'fixed',
              bottom: 72, // Above mobile navigation
              right: 16,
              width: 64,
              height: 64,
            }}
          >
            <AddIcon />
          </Fab>
        )}
      </MuiContainer>

      {/* Mobile Navigation */}
      <MobileNavigation 
        containerCount={stats.totalContainers}
        unreadNotifications={0}
      />

      {/* QR Code Scanner Dialog */}
      <QRCodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        inventoryId={currentInventory.id}
      />

      {/* QR Scan Results Dialog */}
      <QRScanResults
        open={scanResultsOpen}
        onClose={() => setScanResultsOpen(false)}
        scanResult={scanResult}
        onNavigateToContainer={handleNavigateToContainer}
        onNavigateToItem={handleNavigateToItem}
        inventoryId={scanResult?.inventoryId || currentInventory.id}
      />

      {/* Container Form Dialog */}
      <ContainerFormDialog
        open={containerFormOpen}
        container={selectedContainer}
        onClose={handleContainerFormClose}
        onSuccess={handleContainerFormSuccess}
      />

      {/* Container Detail Dialog */}
      {selectedContainer && (
        <ContainerDetailDialog
          open={containerDetailOpen}
          container={selectedContainer}
          inventoryId={currentInventory.id}
          onClose={() => {
            setContainerDetailOpen(false);
            setSelectedContainer(null);
          }}
          onEdit={() => {
            // TODO: Implement container editing
            showSuccess('Container editing will be implemented in a future update');
          }}
          onDelete={() => {
            // TODO: Implement container deletion
            showSuccess('Container deletion will be implemented in a future update');
          }}
        />
      )}

      {/* Thing Detail Dialog (View Mode) */}
      {selectedThing && (
        <ThingFormDialog
          open={thingDetailOpen}
          thing={selectedThing}
          locations={locations}
          rooms={rooms}
          categories={categories}
          people={people}
          onSubmit={() => {
            // This is view-only mode, so we close without saving
            setThingDetailOpen(false);
            setSelectedThing(null);
          }}
          onClose={() => {
            setThingDetailOpen(false);
            setSelectedThing(null);
          }}
        />
      )}
    </>
  );
}