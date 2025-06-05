const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const metricsHandler = require('./handlers/metrics.handler');
const containerHandler = require('./handlers/container.handler');
const adoptionHandler = require('./handlers/adoption.handler');

function initializeWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Invalid token'));
      }
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id} (user: ${socket.user.username})`);

    // Register handlers
    metricsHandler(io, socket);
    containerHandler(io, socket);
    adoptionHandler(io, socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
}

module.exports = { initializeWebSocket };