# Development Guide for ONVIF Web Interface

## Project Structure

```
onvif-test/
├── web/                      # Web interface root
│   ├── frontend/            # React frontend application
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── pages/      # Page components
│   │   │   ├── hooks/      # Custom React hooks
│   │   │   ├── services/   # API service layer
│   │   │   ├── utils/      # Utility functions
│   │   │   ├── types/      # TypeScript type definitions
│   │   │   ├── App.tsx     # Main application component
│   │   │   └── main.tsx    # Application entry point
│   │   ├── public/         # Static assets
│   │   ├── package.json    # Frontend dependencies
│   │   ├── tsconfig.json   # TypeScript configuration
│   │   └── vite.config.ts  # Vite configuration
│   │
│   ├── backend/            # Express backend application
│   │   ├── src/
│   │   │   ├── controllers/ # Request handlers
│   │   │   ├── routes/     # API route definitions
│   │   │   ├── services/   # Business logic
│   │   │   ├── middleware/ # Express middleware
│   │   │   ├── models/     # Data models
│   │   │   ├── utils/      # Utility functions
│   │   │   ├── websocket/  # WebSocket handlers
│   │   │   ├── database/   # SQLite database layer
│   │   │   └── app.js      # Express application setup
│   │   ├── tests/          # Backend tests
│   │   ├── package.json    # Backend dependencies
│   │   └── server.js       # Server entry point
│   │
│   └── shared/             # Shared types and utilities
│       └── types/          # Shared TypeScript types
│
├── configs/                # Camera configuration files
├── docker/                 # Docker-related files
├── scripts/               # Utility scripts
└── docs/                  # Documentation
```

## Development Setup

### Prerequisites

1. Node.js 18+ and npm
2. Docker and Docker Compose
3. Git

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd onvif-test
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd web/backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Setup environment variables**
   ```bash
   # Backend (.env)
   cp web/backend/.env.example web/backend/.env
   
   # Frontend (.env)
   cp web/frontend/.env.example web/frontend/.env
   ```

4. **Initialize database**
   ```bash
   cd web/backend
   npm run db:init
   ```

### Running in Development

1. **Start backend server**
   ```bash
   cd web/backend
   npm run dev
   # Server runs on http://localhost:3001
   ```

2. **Start frontend development server**
   ```bash
   cd web/frontend
   npm run dev
   # UI runs on http://localhost:3000
   ```

3. **Start existing ONVIF services** (optional)
   ```bash
   # Start some test cameras
   docker compose -f docker-compose-nvr1-192.168.6.201.yml up -d
   ```

## Frontend Development

### Component Structure

```typescript
// components/CameraCard.tsx
import React from 'react';
import { Card, CardContent, Typography, Switch } from '@mui/material';
import { Camera } from '../types';

interface CameraCardProps {
  camera: Camera;
  onToggle: (id: string, enabled: boolean) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({ camera, onToggle }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{camera.name}</Typography>
        <Typography color="textSecondary">
          {camera.ip}:{camera.port}
        </Typography>
        <Switch
          checked={camera.enabled}
          onChange={(e) => onToggle(camera.id, e.target.checked)}
        />
      </CardContent>
    </Card>
  );
};
```

### API Service Layer

```typescript
// services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API methods
export const cameraApi = {
  list: () => api.get('/cameras'),
  get: (id: string) => api.get(`/cameras/${id}`),
  update: (id: string, data: any) => api.put(`/cameras/${id}`, data),
  delete: (id: string) => api.delete(`/cameras/${id}`),
};
```

### Custom Hooks

```typescript
// hooks/useContainers.ts
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { containerApi } from '../services/api';

export function useContainers(nvrId?: string) {
  return useQuery(
    ['containers', nvrId],
    () => containerApi.list({ nvr: nvrId }),
    {
      refetchInterval: 5000, // Poll every 5 seconds
    }
  );
}

export function useContainerAction() {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, action }: { id: string; action: string }) => 
      containerApi.action(id, action),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('containers');
      },
    }
  );
}
```

### WebSocket Integration

```typescript
// hooks/useWebSocket.ts
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io(import.meta.env.VITE_WS_URL, {
      auth: { token },
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  return socket;
}

// Usage in component
const socket = useWebSocket();

useEffect(() => {
  if (!socket) return;
  
  socket.on('system.metrics', (data) => {
    setMetrics(data);
  });
  
  socket.emit('subscribe', { channel: 'system.metrics' });
}, [socket]);
```

## Backend Development

### Controller Example

```javascript
// controllers/cameraController.js
const { cameraService } = require('../services');

exports.listCameras = async (req, res) => {
  try {
    const { nvr } = req.query;
    const cameras = await cameraService.list({ nvr });
    res.json({ cameras });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const camera = await cameraService.update(id, req.body);
    res.json({ camera });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
```

### Service Layer

```javascript
// services/dockerService.js
const Docker = require('dockerode');
const docker = new Docker();

class DockerService {
  async listContainers(filters = {}) {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        label: ['onvif-camera=true'],
        ...filters,
      },
    });
    
    return containers.map(this.formatContainer);
  }
  
  async startContainer(id) {
    const container = docker.getContainer(id);
    await container.start();
    return { success: true };
  }
  
  async getContainerStats(id) {
    const container = docker.getContainer(id);
    const stats = await container.stats({ stream: false });
    return this.calculateStats(stats);
  }
  
  formatContainer(container) {
    return {
      id: container.Id,
      name: container.Names[0].replace('/', ''),
      status: container.State,
      image: container.Image,
      ports: container.Ports,
      labels: container.Labels,
    };
  }
  
  calculateStats(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                        stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * 100;
    
    return {
      cpu: cpuPercent,
      memory: {
        usage: stats.memory_stats.usage,
        limit: stats.memory_stats.limit,
        percent: (stats.memory_stats.usage / stats.memory_stats.limit) * 100,
      },
    };
  }
}

module.exports = new DockerService();
```

### WebSocket Handler

```javascript
// websocket/handlers.js
const { dockerService, metricsService } = require('../services');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Authentication
    const token = socket.handshake.auth.token;
    if (!validateToken(token)) {
      socket.disconnect();
      return;
    }
    
    // Handle subscriptions
    socket.on('subscribe', async (data) => {
      const { channel, interval = 5000 } = data;
      
      switch (channel) {
        case 'system.metrics':
          const metricsInterval = setInterval(async () => {
            const metrics = await metricsService.getSystemMetrics();
            socket.emit('system.metrics', metrics);
          }, interval);
          
          socket.on('disconnect', () => {
            clearInterval(metricsInterval);
          });
          break;
          
        case 'containers':
          // Subscribe to Docker events
          dockerService.subscribeToEvents((event) => {
            socket.emit('container.event', event);
          });
          break;
      }
    });
  });
};
```

### Database Integration

```javascript
// database/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, '../../data/metrics.db')
);

// Initialize tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      metadata TEXT
    )
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_metrics_timestamp 
    ON metrics(timestamp)
  `);
});

module.exports = db;
```

## Testing

### Frontend Testing

```typescript
// components/__tests__/CameraCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraCard } from '../CameraCard';

describe('CameraCard', () => {
  const mockCamera = {
    id: '1',
    name: 'Test Camera',
    ip: '192.168.1.100',
    port: 8081,
    enabled: true,
  };
  
  it('renders camera information', () => {
    render(<CameraCard camera={mockCamera} onToggle={() => {}} />);
    
    expect(screen.getByText('Test Camera')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100:8081')).toBeInTheDocument();
  });
  
  it('calls onToggle when switch is clicked', () => {
    const handleToggle = jest.fn();
    render(<CameraCard camera={mockCamera} onToggle={handleToggle} />);
    
    const switchElement = screen.getByRole('checkbox');
    fireEvent.click(switchElement);
    
    expect(handleToggle).toHaveBeenCalledWith('1', false);
  });
});
```

### Backend Testing

```javascript
// tests/dockerService.test.js
const dockerService = require('../src/services/dockerService');

describe('DockerService', () => {
  describe('formatContainer', () => {
    it('should format container data correctly', () => {
      const rawContainer = {
        Id: 'abc123',
        Names: ['/test-container'],
        State: 'running',
        Image: 'test:latest',
        Ports: [],
        Labels: { 'onvif-camera': 'true' },
      };
      
      const formatted = dockerService.formatContainer(rawContainer);
      
      expect(formatted).toEqual({
        id: 'abc123',
        name: 'test-container',
        status: 'running',
        image: 'test:latest',
        ports: [],
        labels: { 'onvif-camera': 'true' },
      });
    });
  });
});
```

## Deployment

### Production Build

```bash
# Build frontend
cd web/frontend
npm run build

# Build backend
cd ../backend
npm run build
```

### Docker Deployment

```dockerfile
# web/Dockerfile
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY web/frontend/package*.json ./
RUN npm ci
COPY web/frontend ./
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY web/backend/package*.json ./
RUN npm ci --production
COPY web/backend ./
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3001
CMD ["node", "server.js"]
```

### Environment Variables

```bash
# Production environment variables
NODE_ENV=production
PORT=3001
DATABASE_PATH=/data/metrics.db
JWT_SECRET=your-secret-key
DOCKER_HOST=/var/run/docker.sock
```

## Best Practices

### Code Style
- Use ESLint and Prettier for consistent formatting
- Follow React hooks rules
- Use TypeScript for type safety
- Write meaningful component and variable names

### Performance
- Implement lazy loading for routes
- Use React.memo for expensive components
- Debounce user input
- Implement virtual scrolling for large lists

### Security
- Validate all user input
- Use parameterized queries
- Implement rate limiting
- Keep dependencies updated
- Use HTTPS in production

### Error Handling
- Implement global error boundaries in React
- Use try-catch blocks in async functions
- Log errors appropriately
- Provide user-friendly error messages

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check CORS configuration
   - Verify authentication token
   - Check firewall rules

2. **Docker API errors**
   - Ensure Docker socket is accessible
   - Check user permissions
   - Verify container labels

3. **Database errors**
   - Check file permissions
   - Verify database path
   - Run migrations

### Debug Mode

Enable debug logging:
```bash
# Backend
DEBUG=onvif:* npm run dev

# Frontend
VITE_DEBUG=true npm run dev
```