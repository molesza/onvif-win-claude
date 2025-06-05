# Network Access Configuration

## Overview
The web interface is now configured to be accessible from your local network, not just localhost.

## Access URLs

### From the Raspberry Pi itself:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### From your development PC (192.168.104.182):
- Frontend: http://192.168.6.204:3000
- Backend API: http://192.168.6.204:3001

### From any device on your network:
- Frontend: http://<raspberry-pi-ip>:3000
- Backend API: http://<raspberry-pi-ip>:3001

## Configuration Changes Made

### 1. Frontend (Vite)
- Updated `vite.config.ts` to listen on all interfaces (`host: '0.0.0.0'`)
- Dynamic API URL detection based on browser location

### 2. Backend (Express)
- Server listens on all interfaces (`0.0.0.0`)
- CORS configured to accept multiple origins
- WebSocket server accepts connections from remote hosts

### 3. Environment Variables
The backend `.env` file includes allowed CORS origins:
```
CORS_ORIGIN=http://localhost:3000,http://192.168.104.182:3000,http://192.168.6.204:3000
```

## Security Notes

⚠️ **Important**: The current configuration is suitable for development on a trusted local network.

For production deployment:
1. Use HTTPS instead of HTTP
2. Restrict CORS origins to specific domains
3. Implement proper firewall rules
4. Use environment-specific configurations
5. Enable additional security headers

## Troubleshooting

### Cannot access from remote machine:
1. Check firewall settings on Raspberry Pi
2. Ensure ports 3000 and 3001 are not blocked
3. Verify both services are running

### CORS errors:
1. Add your client's URL to CORS_ORIGIN in backend `.env`
2. Restart the backend server

### Connection refused:
1. Verify services are running: `npm run dev`
2. Check if ports are already in use
3. Ensure correct IP address is used