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

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
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