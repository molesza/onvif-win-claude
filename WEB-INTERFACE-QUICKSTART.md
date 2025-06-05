# Web Interface Quick Start Guide

## 🚀 Getting Started

### 1. Navigate to the web directory
```bash
cd web
```

### 2. Install all dependencies (one-time setup)
```bash
npm install
npm run install:all
```

### 3. Start the development servers
```bash
npm run dev
```

This will start:
- Backend API server on http://localhost:3001
- Frontend UI on http://localhost:3000

### 4. Login
Open http://localhost:3000 in your browser and login with:
- Username: `admin`
- Password: `admin123`

## 📁 Project Structure

```
web/
├── backend/          # Express.js API server
│   ├── src/         # Source code
│   └── server.js    # Entry point
├── frontend/        # React TypeScript app
│   ├── src/         # Source code
│   └── index.html   # Entry point
└── package.json     # Root package.json with dev scripts
```

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start both frontend and backend
- `npm run dev:backend` - Start only backend
- `npm run dev:frontend` - Start only frontend

### Production
- `npm run build` - Build frontend for production
- `npm start` - Start backend in production mode

## 🎯 Features

1. **Dashboard** - System overview with real-time metrics
2. **Container Management** - Control Docker containers
3. **NVR Management** - Configure camera systems
4. **Monitoring** - Performance graphs and analytics
5. **Settings** - System configuration

## 🔧 Configuration

### Backend (.env)
Create `web/backend/.env`:
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your-secret-key
DATABASE_PATH=./data/metrics.db
```

### Frontend (.env)
Already configured in `web/frontend/.env`

## 📝 Notes

- The backend requires Docker to be running for container management
- WebSocket connections provide real-time updates
- All API calls are authenticated with JWT tokens
- The database is automatically created on first run

## 🐛 Troubleshooting

### Backend won't start
- Check if port 3001 is available
- Ensure Docker is running
- Check `.env` configuration

### Frontend won't connect
- Verify backend is running
- Check browser console for errors
- Ensure correct API URL in frontend `.env`

### Container features not working
- Verify Docker socket access
- Check Docker is running
- Ensure containers have proper labels

## 🚢 Next Steps

1. Deploy some ONVIF cameras using the existing scripts
2. Access the web interface to manage them
3. Monitor system performance
4. Configure NVRs through the UI (coming soon)