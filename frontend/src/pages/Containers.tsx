
import { Box } from '@mui/material';
import ContainerList from '../components/ContainerList';

export default function Containers() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ContainerList />
    </Box>
  );
}