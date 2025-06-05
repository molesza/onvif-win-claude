const metricsService = require('../../services/metrics.service');
const logger = require('../../utils/logger');

function metricsHandler(io, socket) {
  const intervals = new Map();

  socket.on('subscribe', async (data) => {
    const { channel, interval = 5000, filter } = data;

    if (channel === 'system.metrics') {
      // Clear any existing interval
      if (intervals.has('system.metrics')) {
        clearInterval(intervals.get('system.metrics'));
      }

      // Send initial data
      try {
        const metrics = await metricsService.getSystemMetrics();
        socket.emit('system.metrics', metrics);
      } catch (error) {
        logger.error('Error getting system metrics:', error);
      }

      // Set up periodic updates
      const intervalId = setInterval(async () => {
        try {
          const metrics = await metricsService.getSystemMetrics();
          socket.emit('system.metrics', metrics);
        } catch (error) {
          logger.error('Error getting system metrics:', error);
        }
      }, interval);

      intervals.set('system.metrics', intervalId);
    }

    if (channel === 'container.metrics') {
      // Clear any existing interval
      if (intervals.has('container.metrics')) {
        clearInterval(intervals.get('container.metrics'));
      }

      // Send initial data
      try {
        const metrics = await metricsService.getContainerMetrics(filter);
        socket.emit('container.metrics', metrics);
      } catch (error) {
        logger.error('Error getting container metrics:', error);
      }

      // Set up periodic updates
      const intervalId = setInterval(async () => {
        try {
          const metrics = await metricsService.getContainerMetrics(filter);
          socket.emit('container.metrics', metrics);
        } catch (error) {
          logger.error('Error getting container metrics:', error);
        }
      }, interval);

      intervals.set('container.metrics', intervalId);
    }
  });

  socket.on('unsubscribe', (data) => {
    const { channel } = data;
    if (intervals.has(channel)) {
      clearInterval(intervals.get(channel));
      intervals.delete(channel);
    }
  });

  // Clean up intervals on disconnect
  socket.on('disconnect', () => {
    intervals.forEach(intervalId => clearInterval(intervalId));
    intervals.clear();
  });
}

module.exports = metricsHandler;