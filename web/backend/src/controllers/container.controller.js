const dockerService = require('../services/docker.service');
const logger = require('../utils/logger');

async function listContainers(req, res, next) {
  try {
    const { nvr, status } = req.query;
    const filters = {};

    if (nvr) {
      filters.label = [`com.onvif.nvr=${nvr}`];
    }

    const containers = await dockerService.listContainers(filters);

    // Filter by status if provided
    const filteredContainers = status ? 
      containers.filter(c => c.status.toLowerCase() === status.toLowerCase()) :
      containers;

    res.json({ containers: filteredContainers });
  } catch (error) {
    next(error);
  }
}

async function getContainer(req, res, next) {
  try {
    const { id } = req.params;
    const container = await dockerService.getContainer(id);
    res.json(container);
  } catch (error) {
    next(error);
  }
}

async function startContainer(req, res, next) {
  try {
    const { id } = req.params;
    const result = await dockerService.startContainer(id);
    logger.info(`Container started: ${id}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function stopContainer(req, res, next) {
  try {
    const { id } = req.params;
    const result = await dockerService.stopContainer(id);
    logger.info(`Container stopped: ${id}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function restartContainer(req, res, next) {
  try {
    const { id } = req.params;
    const result = await dockerService.restartContainer(id);
    logger.info(`Container restarted: ${id}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getContainerLogs(req, res, next) {
  try {
    const { id } = req.params;
    const { tail, since, follow } = req.query;

    if (follow === 'true') {
      // Upgrade to WebSocket for streaming logs
      // This would be handled by the WebSocket module
      return res.status(501).json({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Log streaming via WebSocket not yet implemented'
        }
      });
    }

    const logs = await dockerService.getContainerLogs(id, {
      tail: parseInt(tail) || 100,
      since
    });

    res.json({ logs });
  } catch (error) {
    next(error);
  }
}

async function getContainerStats(req, res, next) {
  try {
    const { id } = req.params;
    const stats = await dockerService.getContainerStats(id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listContainers,
  getContainer,
  startContainer,
  stopContainer,
  restartContainer,
  getContainerLogs,
  getContainerStats
};