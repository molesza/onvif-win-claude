import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { metricsApi } from '../services/api';

const Monitoring: React.FC = () => {
  const { data: systemMetrics } = useQuery({
    queryKey: ['system-metrics-history'],
    queryFn: () => metricsApi.history({
      metric: 'cpu',
      from: new Date(Date.now() - 3600000).toISOString(),
      to: new Date().toISOString(),
      interval: '5m'
    }),
  });

  // Mock data for demonstration
  const mockData = [
    { time: '12:00', cpu: 25, memory: 45, network: 120 },
    { time: '12:05', cpu: 35, memory: 48, network: 145 },
    { time: '12:10', cpu: 28, memory: 46, network: 130 },
    { time: '12:15', cpu: 45, memory: 52, network: 180 },
    { time: '12:20', cpu: 38, memory: 50, network: 165 },
    { time: '12:25', cpu: 32, memory: 48, network: 150 },
    { time: '12:30', cpu: 30, memory: 47, network: 140 },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Monitoring
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              CPU Usage
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#8884d8"
                  name="CPU %"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Memory Usage
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  name="Memory %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Network Traffic
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="network"
                  stroke="#ffc658"
                  name="Network MB/s"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Monitoring;