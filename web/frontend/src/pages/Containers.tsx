import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RestartIcon,
  Terminal as LogsIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { containerApi } from '../services/api';

const Containers: React.FC = () => {
  const [search, setSearch] = useState('');
  const [nvrFilter, setNvrFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const queryClient = useQueryClient();

  const { data: containersData, isLoading } = useQuery({
    queryKey: ['containers', nvrFilter, statusFilter],
    queryFn: () => containerApi.list({ nvr: nvrFilter || undefined, status: statusFilter || undefined }),
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => containerApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => containerApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => containerApi.restart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const containers = containersData?.data?.containers || [];
  const filteredContainers = containers.filter((container: any) =>
    container.name.toLowerCase().includes(search.toLowerCase()) ||
    container.camera.toLowerCase().includes(search.toLowerCase())
  );

  // Get unique NVRs for filter
  const nvrs = [...new Set(containers.map((c: any) => c.nvr))].filter(Boolean);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'success';
      case 'stopped':
      case 'exited':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Container Management
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>NVR</InputLabel>
            <Select
              value={nvrFilter}
              label="NVR"
              onChange={(e) => setNvrFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {nvrs.map((nvr) => (
                <MenuItem key={nvr} value={nvr}>{nvr}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="stopped">Stopped</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>NVR</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Image</TableCell>
              <TableCell>Ports</TableCell>
              <TableCell>Networks</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredContainers.map((container: any) => (
              <TableRow key={container.id}>
                <TableCell>{container.camera}</TableCell>
                <TableCell>{container.nvr}</TableCell>
                <TableCell>
                  <Chip
                    label={container.status}
                    color={getStatusColor(container.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{container.image}</TableCell>
                <TableCell>
                  {Object.entries(container.ports || {}).map(([internal, external]) => (
                    <div key={internal}>{internal} → {external}</div>
                  ))}
                </TableCell>
                <TableCell>
                  {container.networks.map((net: string) => (
                    <Chip key={net} label={net} size="small" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Start">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => startMutation.mutate(container.id)}
                        disabled={container.state.Running || startMutation.isPending}
                        color="success"
                      >
                        <StartIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Stop">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => stopMutation.mutate(container.id)}
                        disabled={!container.state.Running || stopMutation.isPending}
                        color="error"
                      >
                        <StopIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Restart">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => restartMutation.mutate(container.id)}
                        disabled={!container.state.Running || restartMutation.isPending}
                        color="primary"
                      >
                        <RestartIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="View Logs">
                    <IconButton
                      size="small"
                      onClick={() => {/* TODO: Implement logs viewer */}}
                    >
                      <LogsIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Containers;