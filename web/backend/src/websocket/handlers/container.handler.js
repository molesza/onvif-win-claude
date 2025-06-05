const dockerService = require('../../services/docker.service');
const logger = require('../../utils/logger');

function containerHandler(io, socket) {
  // Subscribe to Docker events
  dockerService.subscribeToEvents((event) => {
    if (event.Actor && event.Actor.Attributes && 
        event.Actor.Attributes['com.onvif.camera'] === 'true') {
      
      const containerEvent = {
        type: 'container.event',
        data: {
          id: event.id,
          action: event.Action,
          status: event.status,
          attributes: event.Actor.Attributes,
          timestamp: new Date(event.time * 1000).toISOString()
        }
      };

      // Emit to all connected clients
      io.emit('container.event', containerEvent);
    }
  });
}

module.exports = containerHandler;