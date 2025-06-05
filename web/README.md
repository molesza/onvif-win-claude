# ONVIF Virtual Camera Web Interface

A modern web-based management interface for the ONVIF Virtual Camera System.

## Features

- **Dashboard**: Real-time system metrics and container overview
- **Container Management**: Start/stop/restart individual cameras
- **NVR Management**: Configure and manage multiple NVRs
- **Monitoring**: Historical graphs and performance metrics
- **Real-time Updates**: WebSocket-based live data
- **Authentication**: Secure login with JWT tokens

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for running ONVIF cameras)

### Installation

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

### Running in Development

1. Start the backend server:
```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

2. In a new terminal, start the frontend:
```bash
cd frontend
npm run dev
# UI runs on http://localhost:3000
```

3. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`

## Architecture

### Backend (Express.js)
- RESTful API with JWT authentication
- WebSocket support for real-time updates
- Docker integration via Dockerode
- SQLite database for metrics storage

### Frontend (React + TypeScript)
- Material-UI components
- React Query for data fetching
- Socket.io for real-time updates
- Recharts for data visualization

## API Documentation

See `/docs/API-SPECIFICATION.md` for complete API documentation.

## Development

See `/docs/DEVELOPMENT-GUIDE.md` for development setup and guidelines.

## Screenshots

[Dashboard, Container Management, Monitoring views will be displayed here]

## Future Enhancements

- [ ] Complete NVR management UI
- [ ] Camera adoption workflow
- [ ] Advanced monitoring features
- [ ] User management
- [ ] Mobile app