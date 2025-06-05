# Network Access Configuration

## Overview
The web interface is now configured to be accessible from your local network, not just localhost.

## Access URLs

### From ANY device on your network:
- Frontend: http://192.168.6.240:3000
- Backend API: http://192.168.6.240:3001

The interface is now accessible from any device, regardless of VLAN or subnet!

## Configuration Changes Made

### 1. Frontend (Vite)
- Updated `vite.config.ts` to listen on all interfaces (`host: '0.0.0.0'`)
- Dynamic API URL detection based on browser location

### 2. Backend (Express)
- Server listens on all interfaces (`0.0.0.0`)
- CORS configured to accept ALL origins (development mode)
- WebSocket server accepts connections from any host
- Helmet security middleware relaxed for cross-origin access

### 3. CORS Configuration
The backend now accepts requests from ANY origin:
- `origin: true` allows all origins
- Perfect for development across VLANs
- ⚠️ **WARNING**: Restrict this in production!

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