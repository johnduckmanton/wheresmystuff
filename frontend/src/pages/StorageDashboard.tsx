import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Container
} from '@mui/material';
import {
  Storage as StorageIcon,
  Warning as WarningIcon,
  List as ListIcon
} from '@mui/icons-material';
import { useInventory } from '../contexts/InventoryContext';
import StorageListView from '../components/StorageListView';
import StorageAlertsPanel from '../components/StorageAlertsPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`storage-tabpanel-${index}`}
      aria-labelledby={`storage-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `storage-tab-${index}`,
    'aria-controls': `storage-tabpanel-${index}`,
  };
}

const StorageDashboard: React.FC = () => {
  const { currentInventory } = useInventory();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAlertAction = (action: string, containerId?: string) => {
    // Handle alert actions - could navigate to specific containers or trigger actions
    console.log('Alert action:', action, 'Container:', containerId);
    
    // Example actions:
    switch (action) {
      case 'review_necessity':
      case 'review_contents':
      case 'plan_retrieval':
        // Switch to storage list tab and potentially filter by container
        setTabValue(1);
        break;
      case 'cost_optimization':
      case 'cost_monitoring':
        // Could open cost analysis or rate update dialog
        break;
      case 'value_assessment':
        // Could open container details for value review
        break;
      default:
        console.log('Unhandled action:', action);
    }
  };

  if (!currentInventory) {
    return (
      <Container maxWidth="lg">
        <Box py={4}>
          <Typography variant="h4" gutterBottom>
            Storage Management
          </Typography>
          <Typography color="text.secondary">
            Please select an inventory to view storage information.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
          <StorageIcon />
          Storage Management
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Monitor storage costs, track duration, and manage storage alerts for {currentInventory.name}
        </Typography>

        <Paper sx={{ mt: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="storage dashboard tabs">
              <Tab 
                icon={<WarningIcon />} 
                label="Alerts & Recommendations" 
                {...a11yProps(0)} 
              />
              <Tab 
                icon={<ListIcon />} 
                label="Storage Containers" 
                {...a11yProps(1)} 
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <StorageAlertsPanel
              inventoryId={currentInventory.id}
              onAlertAction={handleAlertAction}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <StorageListView
              inventoryId={currentInventory.id}
            />
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default StorageDashboard;