require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initializeWebSocket } = require('./src/websocket');
const { initializeDatabase } = require('./src/database/init');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket
    const io = initializeWebSocket(server);
    app.set('io', io);

    // Start server on all interfaces
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on http://0.0.0.0:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Accessible from network at http://<your-ip>:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();