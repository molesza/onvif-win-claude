# API Specification for ONVIF Web Interface

## Base URL
```
http://localhost:3000/api
```

## Authentication

All API endpoints except `/api/auth/login` require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication Endpoints

#### POST /api/auth/login
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com"
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### NVR Management Endpoints

#### GET /api/nvrs
List all configured NVRs.

**Response:**
```json
{
  "nvrs": [
    {
      "id": "nvr1",
      "name": "NVR1",
      "ip": "192.168.6.201",
      "username": "admin",
      "cameraCount": 32,
      "status": "online",
      "lastSeen": "2025-01-06T12:00:00Z"
    }
  ]
}
```

#### POST /api/nvrs
Add a new NVR.

**Request:**
```json
{
  "name": "NVR4",
  "ip": "192.168.6.205",
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "id": "nvr4",
  "name": "NVR4",
  "ip": "192.168.6.205",
  "username": "admin",
  "status": "online"
}
```

#### POST /api/nvrs/:id/discover
Discover available channels on an NVR.

**Response:**
```json
{
  "channels": [
    {
      "channel": 1,
      "name": "Camera 01",
      "resolution": "1920x1080",
      "framerate": 15,
      "status": "active"
    }
  ]
}
```

#### POST /api/nvrs/:id/generate-config
Generate configuration for an NVR.

**Request:**
```json
{
  "channels": [1, 2, 3, 4, 5],
  "startIp": "192.168.6.100",
  "basePort": 8001
}
```

**Response:**
```json
{
  "configPath": "/configs/nvr4",
  "dockerComposePath": "/docker-compose-nvr4.yml",
  "cameras": [
    {
      "name": "Camera-NVR4-01",
      "ip": "192.168.6.100",
      "port": 8001,
      "mac": "a2:a2:a2:a2:04:01"
    }
  ]
}
```

### Container Management Endpoints

#### GET /api/containers
List all Docker containers.

**Query Parameters:**
- `nvr` - Filter by NVR name
- `status` - Filter by status (running, stopped, all)

**Response:**
```json
{
  "containers": [
    {
      "id": "abc123",
      "name": "onvif-nvr1-cam1",
      "image": "onvif-server:latest",
      "status": "running",
      "state": {
        "Status": "running",
        "Running": true,
        "Paused": false,
        "Restarting": false,
        "OOMKilled": false,
        "Dead": false,
        "Pid": 12345,
        "StartedAt": "2025-01-06T10:00:00Z"
      },
      "ports": {
        "8081/tcp": "8081"
      },
      "networks": ["onvif-test_onvif_net"],
      "nvr": "nvr1",
      "camera": "Camera-NVR1-01"
    }
  ]
}
```

#### GET /api/containers/:id
Get detailed information about a container.

**Response:**
```json
{
  "id": "abc123",
  "name": "onvif-nvr1-cam1",
  "image": "onvif-server:latest",
  "status": "running",
  "created": "2025-01-06T10:00:00Z",
  "state": {
    "Status": "running",
    "Running": true,
    "StartedAt": "2025-01-06T10:00:00Z"
  },
  "config": {
    "Env": [
      "CONFIG_PATH=/app/configs/camera1.yaml"
    ],
    "Cmd": ["node", "main.js", "/app/configs/camera1.yaml"]
  },
  "networkSettings": {
    "Networks": {
      "onvif-test_onvif_net": {
        "IPAddress": "192.168.6.11",
        "MacAddress": "a2:a2:a2:a2:01:01"
      }
    }
  },
  "mounts": [
    {
      "Type": "bind",
      "Source": "/home/user/onvif-test/configs/camera1.yaml",
      "Destination": "/app/configs/camera1.yaml"
    }
  ]
}
```

#### POST /api/containers/:id/start
Start a container.

**Response:**
```json
{
  "success": true,
  "message": "Container started successfully"
}
```

#### POST /api/containers/:id/stop
Stop a container.

**Response:**
```json
{
  "success": true,
  "message": "Container stopped successfully"
}
```

#### POST /api/containers/:id/restart
Restart a container.

**Response:**
```json
{
  "success": true,
  "message": "Container restarted successfully"
}
```

#### GET /api/containers/:id/logs
Get container logs.

**Query Parameters:**
- `tail` - Number of lines to return (default: 100)
- `since` - Show logs since timestamp
- `follow` - Stream logs (WebSocket upgrade)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-06T12:00:00Z",
      "message": "ONVIF server started on port 8081"
    }
  ]
}
```

#### GET /api/containers/:id/stats
Get container resource statistics.

**Response:**
```json
{
  "cpu": {
    "usage": 2.5,
    "system": 1000000000,
    "cores": 4
  },
  "memory": {
    "usage": 52428800,
    "limit": 1073741824,
    "percent": 4.88
  },
  "network": {
    "rx_bytes": 1048576,
    "tx_bytes": 2097152,
    "rx_packets": 1000,
    "tx_packets": 2000
  }
}
```

### Monitoring Endpoints

#### GET /api/metrics/system
Get system-wide metrics.

**Response:**
```json
{
  "timestamp": "2025-01-06T12:00:00Z",
  "cpu": {
    "usage": 25.5,
    "cores": 4,
    "loadAverage": [1.5, 1.2, 1.0]
  },
  "memory": {
    "total": 8589934592,
    "used": 4294967296,
    "free": 4294967296,
    "percent": 50.0
  },
  "disk": {
    "total": 107374182400,
    "used": 53687091200,
    "free": 53687091200,
    "percent": 50.0
  },
  "network": {
    "interfaces": [
      {
        "name": "eth0",
        "rx_bytes": 1073741824,
        "tx_bytes": 2147483648,
        "rx_speed": 125000000,
        "tx_speed": 125000000
      }
    ]
  }
}
```

#### GET /api/metrics/containers
Get aggregated container metrics.

**Response:**
```json
{
  "summary": {
    "total": 80,
    "running": 75,
    "stopped": 5,
    "cpu_usage": 35.5,
    "memory_usage": 2147483648,
    "network_rx": 10737418240,
    "network_tx": 21474836480
  },
  "byNvr": {
    "nvr1": {
      "total": 32,
      "running": 32,
      "cpu_usage": 15.5,
      "memory_usage": 858993459
    }
  }
}
```

#### GET /api/metrics/history
Get historical metrics data.

**Query Parameters:**
- `metric` - Metric type (cpu, memory, network)
- `from` - Start timestamp
- `to` - End timestamp
- `interval` - Data point interval (5m, 1h, 1d)

**Response:**
```json
{
  "metric": "cpu",
  "interval": "5m",
  "data": [
    {
      "timestamp": "2025-01-06T12:00:00Z",
      "value": 25.5
    },
    {
      "timestamp": "2025-01-06T12:05:00Z",
      "value": 28.2
    }
  ]
}
```

### Adoption Endpoints

#### POST /api/adoption/start
Start the adoption workflow for an NVR.

**Request:**
```json
{
  "nvrId": "nvr4",
  "cameras": ["cam1", "cam2", "cam3"]
}
```

**Response:**
```json
{
  "sessionId": "adoption-123",
  "totalCameras": 3,
  "status": "in_progress"
}
```

#### GET /api/adoption/:sessionId/status
Get adoption session status.

**Response:**
```json
{
  "sessionId": "adoption-123",
  "status": "in_progress",
  "totalCameras": 3,
  "adopted": 1,
  "failed": 0,
  "skipped": 0,
  "currentCamera": {
    "name": "Camera-NVR4-02",
    "status": "waiting"
  }
}
```

#### POST /api/adoption/:sessionId/skip
Skip current camera in adoption.

**Response:**
```json
{
  "success": true,
  "message": "Camera skipped"
}
```

#### POST /api/adoption/:sessionId/retry
Retry failed camera adoption.

**Response:**
```json
{
  "success": true,
  "message": "Retrying camera adoption"
}
```

### Configuration Endpoints

#### GET /api/config/cameras/:id
Get camera configuration.

**Response:**
```json
{
  "mac": "a2:a2:a2:a2:01:01",
  "serverPort": 8081,
  "rtspPort": 8554,
  "snapshotPort": 8080,
  "name": "Camera-NVR1-01",
  "uuid": "uuid-camera-1",
  "streams": {
    "highQuality": {
      "rtsp": "rtsp://192.168.6.201:7447/uuid-1/2",
      "snapshot": "http://192.168.6.201:7080/api/cameras/uuid-1/snapshot",
      "width": 1920,
      "height": 1080,
      "framerate": 15,
      "bitrate": 2048,
      "quality": 5
    }
  }
}
```

#### PUT /api/config/cameras/:id
Update camera configuration.

**Request:**
```json
{
  "streams": {
    "highQuality": {
      "framerate": 30,
      "bitrate": 4096
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated",
  "restartRequired": true
}
```

### Alert Endpoints

#### GET /api/alerts/rules
Get all alert rules.

**Response:**
```json
{
  "rules": [
    {
      "id": "alert-1",
      "name": "High CPU Usage",
      "condition": {
        "metric": "cpu",
        "operator": ">",
        "threshold": 80,
        "duration": "5m"
      },
      "actions": [
        {
          "type": "email",
          "to": "admin@example.com"
        }
      ],
      "enabled": true
    }
  ]
}
```

#### POST /api/alerts/rules
Create a new alert rule.

**Request:**
```json
{
  "name": "Memory Alert",
  "condition": {
    "metric": "memory",
    "operator": ">",
    "threshold": 90,
    "duration": "10m"
  },
  "actions": [
    {
      "type": "webhook",
      "url": "https://hooks.example.com/alert"
    }
  ]
}
```

**Response:**
```json
{
  "id": "alert-2",
  "name": "Memory Alert",
  "created": "2025-01-06T12:00:00Z"
}
```

## WebSocket Events

### Connection
Connect to WebSocket endpoint at:
```
ws://localhost:3000/ws
```

### Authentication
Send authentication immediately after connection:
```json
{
  "type": "auth",
  "token": "Bearer eyJhbGciOiJIUzI1NiIs..."
}
```

### Subscriptions

#### Subscribe to system metrics
```json
{
  "type": "subscribe",
  "channel": "system.metrics",
  "interval": 5000
}
```

#### Subscribe to container updates
```json
{
  "type": "subscribe",
  "channel": "containers",
  "filter": {
    "nvr": "nvr1"
  }
}
```

### Events from Server

#### System metrics update
```json
{
  "type": "system.metrics",
  "data": {
    "timestamp": "2025-01-06T12:00:00Z",
    "cpu": 25.5,
    "memory": 50.0
  }
}
```

#### Container status change
```json
{
  "type": "container.status",
  "data": {
    "id": "abc123",
    "name": "onvif-nvr1-cam1",
    "status": "running",
    "previousStatus": "stopped"
  }
}
```

#### Adoption progress
```json
{
  "type": "adoption.progress",
  "data": {
    "sessionId": "adoption-123",
    "camera": "Camera-NVR4-02",
    "status": "adopted",
    "progress": 66.7
  }
}
```

#### Alert triggered
```json
{
  "type": "alert.triggered",
  "data": {
    "ruleId": "alert-1",
    "ruleName": "High CPU Usage",
    "value": 85.5,
    "threshold": 80,
    "timestamp": "2025-01-06T12:00:00Z"
  }
}
```

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "ip",
      "reason": "Invalid IP address format"
    }
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` - Invalid or missing authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `CONFLICT` - Resource conflict
- `INTERNAL_ERROR` - Server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Authentication endpoints: 5 requests per minute
- Read endpoints: 100 requests per minute
- Write endpoints: 30 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641465600
```