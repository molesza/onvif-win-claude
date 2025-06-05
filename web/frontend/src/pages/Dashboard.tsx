import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  NetworkCheck as NetworkIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { metricsApi, containerApi } from '../services/api';

const Dashboard: React.FC = () => {
  const { data: systemMetrics, isLoading: systemLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => metricsApi.system(),
    refetchInterval: 5000,
  });

  const { data: containerMetrics, isLoading: containerLoading } = useQuery({
    queryKey: ['container-metrics'],
    queryFn: () => metricsApi.containers(),
    refetchInterval: 5000,
  });

  const { data: containers } = useQuery({
    queryKey: ['containers'],
    queryFn: () => containerApi.list(),
  });

  if (systemLoading || containerLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const system = systemMetrics?.data;
  const containerStats = containerMetrics?.data;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* System Metrics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SpeedIcon color="primary" />
                <Typography variant="h6" ml={1}>
                  CPU Usage
                </Typography>
              </Box>
              <Typography variant="h3">
                {system?.cpu?.usage?.toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={system?.cpu?.usage || 0}
                color={system?.cpu?.usage > 80 ? 'error' : 'primary'}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <MemoryIcon color="primary" />
                <Typography variant="h6" ml={1}>
                  Memory Usage
                </Typography>
              </Box>
              <Typography variant="h3">
                {system?.memory?.percent?.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {(system?.memory?.used / 1024 / 1024 / 1024).toFixed(1)} GB / 
                {(system?.memory?.total / 1024 / 1024 / 1024).toFixed(1)} GB
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <StorageIcon color="primary" />
                <Typography variant="h6" ml={1}>
                  Containers
                </Typography>
              </Box>
              <Typography variant="h3">
                {containerStats?.summary?.running}/{containerStats?.summary?.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Running / Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <NetworkIcon color="primary" />
                <Typography variant="h6" ml={1}>
                  Network
                </Typography>
              </Box>
              <Typography variant="h3">
                {((containerStats?.summary?.network_rx || 0) / 1024 / 1024).toFixed(1)} MB
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total RX
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Container Stats by NVR */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Containers by NVR
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(containerStats?.byNvr || {}).map(([nvr, stats]: [string, any]) => (
                <Grid item xs={12} sm={6} md={4} key={nvr}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {nvr.toUpperCase()}
                      </Typography>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Running:</Typography>
                        <Typography variant="body2">{stats.running}/{stats.total}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">CPU:</Typography>
                        <Typography variant="body2">{stats.cpu_usage.toFixed(1)}%</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Memory:</Typography>
                        <Typography variant="body2">
                          {(stats.memory_usage / 1024 / 1024).toFixed(0)} MB
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* System Info */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              System Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">CPU Cores:</Typography>
                  <Typography variant="body2">{system?.cpu?.cores}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Load Average:</Typography>
                  <Typography variant="body2">
                    {system?.cpu?.loadAverage?.map((l: number) => l.toFixed(2)).join(', ')}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Uptime:</Typography>
                  <Typography variant="body2">
                    {Math.floor((system?.uptime || 0) / 86400)}d {Math.floor(((system?.uptime || 0) % 86400) / 3600)}h
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Containers:</Typography>
                  <Typography variant="body2">{containers?.data?.containers?.length || 0}</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;