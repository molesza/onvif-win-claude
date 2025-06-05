import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Divider,
} from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Configuration
            </Typography>
            <Box component="form" sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="API Endpoint"
                defaultValue="http://localhost:3001/api"
                margin="normal"
              />
              <TextField
                fullWidth
                label="WebSocket URL"
                defaultValue="ws://localhost:3001"
                margin="normal"
              />
              <TextField
                fullWidth
                label="Refresh Interval (seconds)"
                type="number"
                defaultValue="5"
                margin="normal"
              />
              <Button variant="contained" sx={{ mt: 2 }}>
                Save Configuration
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              User Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              User management features coming soon.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              About
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">
              ONVIF Virtual Camera Web Interface v1.0.0
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Manage your virtual ONVIF cameras with ease through this modern web interface.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;