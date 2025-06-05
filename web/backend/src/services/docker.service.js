const Docker = require('dockerode');
const logger = require('../utils/logger');

class DockerService {
  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock'
    });
  }

  async listContainers(filters = {}) {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['com.onvif.camera=true'],
          ...filters
        }
      });

      return containers.map(this.formatContainer);
    } catch (error) {
      logger.error('Error listing containers:', error);
      throw error;
    }
  }

  async getContainer(id) {
    try {
      const container = this.docker.getContainer(id);
      const info = await container.inspect();
      return this.formatContainerInfo(info);
    } catch (error) {
      if (error.statusCode === 404) {
        const err = new Error('Container not found');
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      throw error;
    }
  }

  async startContainer(id) {
    try {
      const container = this.docker.getContainer(id);
      await container.start();
      return { success: true, message: 'Container started successfully' };
    } catch (error) {
      if (error.statusCode === 304) {
        return { success: true, message: 'Container already running' };
      }
      throw error;
    }
  }

  async stopContainer(id) {
    try {
      const container = this.docker.getContainer(id);
      await container.stop();
      return { success: true, message: 'Container stopped successfully' };
    } catch (error) {
      if (error.statusCode === 304) {
        return { success: true, message: 'Container already stopped' };
      }
      throw error;
    }
  }

  async restartContainer(id) {
    try {
      const container = this.docker.getContainer(id);
      await container.restart();
      return { success: true, message: 'Container restarted successfully' };
    } catch (error) {
      throw error;
    }
  }

  async getContainerLogs(id, options = {}) {
    try {
      const container = this.docker.getContainer(id);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        timestamps: true,
        ...options
      });

      // Parse logs
      const logs = stream.toString('utf8').split('\n').filter(Boolean);
      return logs.map(log => {
        // Extract timestamp and message
        const match = log.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z) (.+)/);
        if (match) {
          return {
            timestamp: match[1],
            message: match[2]
          };
        }
        return { message: log };
      });
    } catch (error) {
      throw error;
    }
  }

  async getContainerStats(id) {
    try {
      const container = this.docker.getContainer(id);
      const stats = await container.stats({ stream: false });
      return this.calculateStats(stats);
    } catch (error) {
      throw error;
    }
  }

  formatContainer(container) {
    const labels = container.Labels || {};
    return {
      id: container.Id,
      name: container.Names[0]?.replace('/', '') || '',
      image: container.Image,
      status: container.State,
      state: {
        Status: container.State,
        Running: container.State === 'running',
        StartedAt: container.Status
      },
      ports: container.Ports.reduce((acc, port) => {
        if (port.PublicPort) {
          acc[`${port.PrivatePort}/tcp`] = String(port.PublicPort);
        }
        return acc;
      }, {}),
      networks: Object.keys(container.NetworkSettings?.Networks || {}),
      nvr: labels['com.onvif.nvr'] || 'unknown',
      camera: labels['com.onvif.camera.name'] || container.Names[0]?.replace('/', '')
    };
  }

  formatContainerInfo(info) {
    const labels = info.Config?.Labels || {};
    return {
      id: info.Id,
      name: info.Name.replace('/', ''),
      image: info.Config.Image,
      status: info.State.Status,
      created: info.Created,
      state: info.State,
      config: {
        Env: info.Config.Env,
        Cmd: info.Config.Cmd
      },
      networkSettings: {
        Networks: info.NetworkSettings.Networks
      },
      mounts: info.Mounts,
      nvr: labels['com.onvif.nvr'] || 'unknown',
      camera: labels['com.onvif.camera.name'] || info.Name.replace('/', '')
    };
  }

  calculateStats(stats) {
    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                        stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

    // Network stats
    const networks = stats.networks || {};
    let rxBytes = 0, txBytes = 0;
    Object.values(networks).forEach(net => {
      rxBytes += net.rx_bytes || 0;
      txBytes += net.tx_bytes || 0;
    });

    return {
      cpu: {
        usage: cpuPercent,
        system: stats.cpu_stats.system_cpu_usage,
        cores: stats.cpu_stats.online_cpus || 1
      },
      memory: {
        usage: stats.memory_stats.usage || 0,
        limit: stats.memory_stats.limit || 0,
        percent: stats.memory_stats.limit > 0 ? 
          (stats.memory_stats.usage / stats.memory_stats.limit) * 100 : 0
      },
      network: {
        rx_bytes: rxBytes,
        tx_bytes: txBytes,
        rx_packets: 0, // Not available in basic stats
        tx_packets: 0
      }
    };
  }

  subscribeToEvents(callback) {
    this.docker.getEvents((err, stream) => {
      if (err) {
        logger.error('Error subscribing to Docker events:', err);
        return;
      }

      stream.on('data', (chunk) => {
        try {
          const event = JSON.parse(chunk.toString());
          if (event.Type === 'container') {
            callback(event);
          }
        } catch (error) {
          logger.error('Error parsing Docker event:', error);
        }
      });
    });
  }
}

module.exports = new DockerService();