import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const NVRManagement: React.FC = () => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          NVR Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
        >
          Add NVR
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              NVR Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              NVR management features coming soon. This will include:
            </Typography>
            <ul>
              <li>Auto-discovery of NVRs on the network</li>
              <li>Channel detection and configuration</li>
              <li>Automatic IP allocation</li>
              <li>Configuration generation</li>
              <li>Bulk camera adoption</li>
            </ul>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NVRManagement;