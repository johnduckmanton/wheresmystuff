import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Grid,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  onClick: () => void;
}

/**
 * Module Selection Card Component
 * Displays a clickable card for each module with icon, title, and description
 * Validates: Requirements 1.1, 1.5
 */
function ModuleCard({ title, description, icon, onClick }: ModuleCardProps) {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
      elevation={2}
    >
      <CardActionArea 
        onClick={onClick}
        sx={{ 
          height: '100%',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: { xs: 200, sm: 250 },
        }}
        aria-label={`Navigate to ${title}`}
      >
        <CardContent sx={{ textAlign: 'center', p: 0 }}>
          <Box
            sx={{
              mb: 2,
              color: theme.palette.primary.main,
              '& > svg': {
                fontSize: { xs: '3rem', sm: '4rem' },
              },
            }}
            aria-hidden="true"
          >
            {icon}
          </Box>
          <Typography 
            variant="h5" 
            component="h2" 
            gutterBottom
            sx={{
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
              fontWeight: 600,
              mb: 2,
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary"
            sx={{
              fontSize: { xs: '0.875rem', sm: '1rem' },
              lineHeight: 1.5,
            }}
          >
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/**
 * Home Page Component
 * Provides module selection between Inventory Management and Moving & Storage
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
export default function Home() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleInventoryClick = () => {
    navigate('/things');
  };

  const handleMovingClick = () => {
    navigate('/moving');
  };

  const modules = [
    {
      title: 'Inventory Management',
      description: 'Manage your household items, organize by categories, locations, and track everything you own.',
      icon: <InventoryIcon />,
      path: '/things',
      onClick: handleInventoryClick,
    },
    {
      title: 'Moving & Storage',
      description: 'Pack items into containers, generate QR codes, track moves, and manage storage efficiently.',
      icon: <LocalShippingIcon />,
      path: '/moving',
      onClick: handleMovingClick,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, sm: 6 } }}>
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom
          sx={{
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
            fontWeight: 700,
            color: theme.palette.primary.main,
            mb: 2,
          }}
        >
          Where's My Stuff!
        </Typography>
        <Typography 
          variant="h6" 
          color="text.secondary"
          sx={{
            fontSize: { xs: '1rem', sm: '1.125rem' },
            maxWidth: '600px',
            mx: 'auto',
            lineHeight: 1.6,
          }}
        >
          Choose how you want to manage your belongings
        </Typography>
      </Box>

      <Grid 
        container 
        spacing={ isMobile ? 3 : 4 }
        justifyContent="center"
        alignItems="stretch"
      >
        {modules.map((module) => (
          <Grid 
            size={{ xs: 12, sm: 6, md: 5 }}
            key={module.title}
          >
            <ModuleCard {...module} />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ textAlign: 'center', mt: { xs: 4, sm: 6 } }}>
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
        >
          You can switch between modules at any time using the navigation
        </Typography>
      </Box>
    </Container>
  );
}