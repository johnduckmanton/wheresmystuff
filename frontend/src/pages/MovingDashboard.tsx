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
import type { Container, MovingProject, ContainerStatus, ThingWithContainer, Location, Room, Category, Person } from '../types';
import QRCodeScanner from '../components/QRCodeScanner';
import QRScanResults from '../components/QRScanResults';
import ContainerDetailDialog from '../components/ContainerDetailDialog';
import ContainerFormDialog from '../components/ContainerFormDialog';
import PackingDialog from '../components/PackingDialog';
import ThingFormDialog from '../components/ThingFormDialog';
import ProjectFormDialog from '../components/ProjectFormDialog';
import ProjectDetailDialog from '../components/ProjectDetailDialog';

interface DashboardStats {
  totalContainers: number;
  packedContainers: number;
  totalItems: number;
  totalValue: number;
  activeProjects: number;
  completedProjects: number;
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
              £{stats.totalValue.toLocaleString()}
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
  const [packingDialogOpen, setPackingDialogOpen] = useState(false);
  const [selectedThing, setSelectedThing] = useState<ThingWithContainer | null>(null);
  const [thingDetailOpen, setThingDetailOpen] = useState(false);
  
  // New state for project form dialog
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<MovingProject | null>(null);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);
  
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
    setSelectedProject(null); // Clear any selected project for new creation
    setProjectFormOpen(true);
  };

  const handleScanQR = () => {
    setScannerOpen(true);
  };

  const handleScanSuccess = (result: typeof scanResult) => {
    setScanResult(result);
    // Navigate directly to container details instead of showing scan results dialog
    if (result && result.container) {
      setSelectedContainer(result.container);
      setContainerDetailOpen(true);
      showSuccess('QR code scanned successfully!');
    } else {
      // Fallback: show scan results dialog if container data is missing
      setScanResultsOpen(true);
      showSuccess('QR code scanned successfully!');
    }
  };

  const handleNavigateToContainer = (container?: Container) => {
    // If a container is passed directly (e.g., from recent containers), use it
    if (container) {
      setSelectedContainer(container);
      setContainerDetailOpen(true);
      return;
    }
    
    // Otherwise, use the scan result data when navigating from a QR scan
    if (scanResult && scanResult.container) {
      setSelectedContainer(scanResult.container);
      setContainerDetailOpen(true);
      setScanResultsOpen(false);
    } else {
      showError('Container data not available');
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
    // Open project detail view
    setSelectedProject(project);
    setProjectDetailOpen(true);
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleContainerFormSuccess = (container: Container) => {
    // Check if we're editing an existing container or creating a new one
    const isEditing = selectedContainer && selectedContainer.id === container.id;
    
    if (isEditing) {
      // Update existing container in the list
      setContainers(prevContainers => 
        prevContainers.map(c => c.id === container.id ? container : c)
      );
      
      // Update the selected container so the detail dialog shows updated data
      setSelectedContainer(container);
      
      showSuccess(`Container "${container.name}" updated successfully!`);
      
      // Reopen the detail dialog with updated data
      setContainerFormOpen(false);
      setContainerDetailOpen(true);
    } else {
      // Add new container to the list
      setContainers(prevContainers => [container, ...prevContainers]);
      
      // Update stats
      setStats(prevStats => ({
        ...prevStats,
        totalContainers: prevStats.totalContainers + 1,
      }));
      
      setContainerFormOpen(false);
      setSelectedContainer(null);
      showSuccess(`Container "${container.name}" created successfully!`);
    }
  };

  const handleContainerFormClose = () => {
    setContainerFormOpen(false);
    setSelectedContainer(null);
  };

  const handleProjectFormSuccess = (project: MovingProject) => {
    if (selectedProject) {
      // Update existing project in the list
      setProjects(prevProjects => 
        prevProjects.map(p => p.id === project.id ? project : p)
      );
      showSuccess(`Project "${project.name}" updated successfully!`);
    } else {
      // Add new project to the list
      setProjects(prevProjects => [project, ...prevProjects]);
      
      // Update stats
      setStats(prevStats => ({
        ...prevStats,
        activeProjects: prevStats.activeProjects + (project.status === 'active' || project.status === 'planning' ? 1 : 0),
        completedProjects: prevStats.completedProjects + (project.status === 'completed' ? 1 : 0),
      }));
      
      showSuccess(`Project "${project.name}" created successfully!`);
    }
    
    setProjectFormOpen(false);
    setSelectedProject(null);
  };

  const handleProjectFormClose = () => {
    setProjectFormOpen(false);
    setSelectedProject(null);
  };

  const handleProjectDetailClose = () => {
    setProjectDetailOpen(false);
    setSelectedProject(null);
  };

  const handleProjectEdit = (_project: MovingProject) => {
    // Close detail dialog and open form dialog for editing
    setProjectDetailOpen(false);
    setProjectFormOpen(true);
    // selectedProject is already set
  };

  const handleProjectDelete = async (projectId: string) => {
    try {
      await apiClient.deleteProject(projectId);
      
      // Remove project from the list
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      
      // Update stats
      const deletedProject = projects.find(p => p.id === projectId);
      if (deletedProject) {
        setStats(prevStats => ({
          ...prevStats,
          activeProjects: prevStats.activeProjects - (deletedProject.status === 'active' || deletedProject.status === 'planning' ? 1 : 0),
          completedProjects: prevStats.completedProjects - (deletedProject.status === 'completed' ? 1 : 0),
        }));
      }
      
      setProjectDetailOpen(false);
      setSelectedProject(null);
      showSuccess('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      showError('Failed to delete project');
    }
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
          }}
        >
          {!isMobile && (
            <Box>
              <Typography 
                variant="h4" 
                component="h1" 
                gutterBottom
              >
                Moving & Storage
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary"
              >
                {currentInventory.name}
              </Typography>
            </Box>
          )}
          {!isMobile && (
            <IconButton 
              onClick={handleRefresh} 
              disabled={loading}
              aria-label="Refresh dashboard data"
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
            <Grid size={{ xs: 12, md: 6 }}>
              <ContainerStatsCard containers={containers} stats={stats} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              {/* Active Projects */}
              {projects.length > 0 ? (
                <Card>
                  <CardContent>
                    <Typography variant="h6" component="h3" sx={{ mb: 3, fontWeight: 600 }}>
                      Active Projects
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {Array.isArray(projects) && projects
                        .filter((p: MovingProject) => p.status === 'active' || p.status === 'planning')
                        .map((project) => (
                          <Box
                            key={project.id}
                            sx={{
                              cursor: 'pointer',
                              p: 2,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                borderColor: 'primary.main',
                                backgroundColor: 'action.hover',
                              },
                            }}
                            onClick={() => handleProjectClick(project)}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {project.name}
                              </Typography>
                              <Chip 
                                label={project.status.charAt(0).toUpperCase() + project.status.slice(1)} 
                                color={project.status === 'active' ? 'primary' : 'default'}
                                size="small"
                              />
                            </Box>
                            
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
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                            </Box>
                            
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Containers
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {project.containerCount}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Items
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {project.itemCount}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Start Date
                                </Typography>
                                <Typography variant="body2">
                                  {new Date(project.startDate).toLocaleDateString()}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Target Date
                                </Typography>
                                <Typography variant="body2">
                                  {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'Not set'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                        ))}
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <Card>
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
            </Grid>
          </Grid>

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
                        onClick={() => handleNavigateToContainer(container)}
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
                                £{(container.estimatedValue || 0).toLocaleString()}
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

      </MuiContainer>

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
        key={selectedContainer?.id || 'new'}
        open={containerFormOpen}
        container={selectedContainer}
        onClose={handleContainerFormClose}
        onSuccess={handleContainerFormSuccess}
      />

      {/* Project Form Dialog */}
      <ProjectFormDialog
        open={projectFormOpen}
        project={selectedProject}
        inventoryId={currentInventory.id}
        locations={locations}
        onClose={handleProjectFormClose}
        onSave={handleProjectFormSuccess}
      />

      {/* Project Detail Dialog */}
      {selectedProject && (
        <ProjectDetailDialog
          open={projectDetailOpen}
          project={selectedProject}
          inventoryId={currentInventory.id}
          onClose={handleProjectDetailClose}
          onEdit={handleProjectEdit}
          onDelete={handleProjectDelete}
        />
      )}

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
            setContainerDetailOpen(false);
            setContainerFormOpen(true);
          }}
          onDelete={async () => {
            if (!selectedContainer) return;
            
            // Show confirmation dialog
            const itemCount = selectedContainer.itemCount || 0;
            const message = itemCount > 0 
              ? `Are you sure you want to delete "${selectedContainer.name}"? This container contains ${itemCount} items. The items will be removed from the container.`
              : `Are you sure you want to delete "${selectedContainer.name}"?`;
            
            if (!window.confirm(message)) {
              return;
            }
            
            setContainerDetailOpen(false);
            try {
              await apiClient.deleteContainer(selectedContainer.id, currentInventory.id, true);
              setContainers(prev => prev.filter(c => c.id !== selectedContainer.id));
              setSelectedContainer(null);
              showSuccess(`Container "${selectedContainer.name}" deleted successfully`);
            } catch (err) {
              console.error('Error deleting container:', err);
              showError('Failed to delete container');
            }
          }}
          onPack={() => {
            setContainerDetailOpen(false);
            setPackingDialogOpen(true);
          }}
        />
      )}

      {/* Packing Dialog */}
      {selectedContainer && (
        <PackingDialog
          open={packingDialogOpen}
          container={selectedContainer}
          onClose={() => {
            setPackingDialogOpen(false);
            setSelectedContainer(null);
          }}
          onItemsAdded={async () => {
            // Refresh container data
            try {
              const refreshedContainer = await apiClient.getContainer(selectedContainer.id, currentInventory.id);
              setContainers(prev => prev.map(c => c.id === selectedContainer.id ? refreshedContainer : c));
              setSelectedContainer(refreshedContainer);
            } catch (err) {
              console.error('Error refreshing container:', err);
            }
          }}
          onContainerUpdated={(updatedContainer) => {
            setContainers(prev => prev.map(c => c.id === updatedContainer.id ? updatedContainer : c));
            setSelectedContainer(updatedContainer);
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
          projects={projects}
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