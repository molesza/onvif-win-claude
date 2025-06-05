const os = require('os');
const dockerService = require('./docker.service');
const logger = require('../utils/logger');

class MetricsService {
  async getSystemMetrics() {
    try {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const loadAverage = os.loadavg();

      // Calculate CPU usage
      const cpuUsage = await this.getCpuUsage();

      // Get network stats
      const networkStats = await this.getNetworkStats();

      return {
        timestamp: new Date().toISOString(),
        cpu: {
          usage: cpuUsage,
          cores: cpus.length,
          loadAverage
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          percent: (usedMemory / totalMemory) * 100
        },
        network: networkStats,
        uptime: os.uptime()
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  }

  async getContainerMetrics(filter = {}) {
    try {
      const containers = await dockerService.listContainers();
      const runningContainers = containers.filter(c => c.state.Running);

      // Get stats for all running containers
      const statsPromises = runningContainers.map(async (container) => {
        try {
          const stats = await dockerService.getContainerStats(container.id);
          return {
            id: container.id,
            name: container.name,
            nvr: container.nvr,
            stats
          };
        } catch (error) {
          logger.error(`Error getting stats for container ${container.id}:`, error);
          return null;
        }
      });

      const containerStats = (await Promise.all(statsPromises)).filter(Boolean);

      // Calculate summary
      const summary = {
        total: containers.length,
        running: runningContainers.length,
        stopped: containers.length - runningContainers.length,
        cpu_usage: 0,
        memory_usage: 0,
        network_rx: 0,
        network_tx: 0
      };

      // Group by NVR
      const byNvr = {};

      containerStats.forEach(({ nvr, stats }) => {
        summary.cpu_usage += stats.cpu.usage;
        summary.memory_usage += stats.memory.usage;
        summary.network_rx += stats.network.rx_bytes;
        summary.network_tx += stats.network.tx_bytes;

        if (!byNvr[nvr]) {
          byNvr[nvr] = {
            total: 0,
            running: 0,
            cpu_usage: 0,
            memory_usage: 0
          };
        }

        byNvr[nvr].running++;
        byNvr[nvr].cpu_usage += stats.cpu.usage;
        byNvr[nvr].memory_usage += stats.memory.usage;
      });

      // Add total counts to byNvr
      containers.forEach(container => {
        if (!byNvr[container.nvr]) {
          byNvr[container.nvr] = {
            total: 0,
            running: 0,
            cpu_usage: 0,
            memory_usage: 0
          };
        }
        byNvr[container.nvr].total++;
      });

      // Store metrics in database
      this.storeMetrics('container_cpu', summary.cpu_usage);
      this.storeMetrics('container_memory', summary.memory_usage);
      this.storeMetrics('container_network_rx', summary.network_rx);
      this.storeMetrics('container_network_tx', summary.network_tx);

      return {
        summary,
        byNvr,
        containers: filter.detailed ? containerStats : undefined
      };
    } catch (error) {
      logger.error('Error getting container metrics:', error);
      throw error;
    }
  }

  async getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  async getNetworkStats() {
    // This is a simplified version - in production you'd read from /proc/net/dev
    const networkInterfaces = os.networkInterfaces();
    const interfaces = [];

    Object.entries(networkInterfaces).forEach(([name, addresses]) => {
      if (name !== 'lo' && addresses.some(addr => !addr.internal)) {
        interfaces.push({
          name,
          rx_bytes: 0, // Would need to read from system stats
          tx_bytes: 0,
          rx_speed: 0,
          tx_speed: 0
        });
      }
    });

    return { interfaces };
  }

  storeMetrics(type, value, metadata = null) {
    try {
      global.db.run(
        'INSERT INTO metrics (type, value, metadata) VALUES (?, ?, ?)',
        [type, value, metadata ? JSON.stringify(metadata) : null],
        (err) => {
          if (err) {
            logger.error('Error storing metrics:', err);
          }
        }
      );
    } catch (error) {
      logger.error('Error storing metrics:', error);
    }
  }

  async getHistoricalMetrics(type, from, to, interval = '5m') {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          datetime(timestamp, 'start of day', '+' || (strftime('%s', timestamp) - strftime('%s', date(timestamp))) / ? * ? || ' seconds') as bucket,
          AVG(value) as value
        FROM metrics
        WHERE type = ? AND timestamp BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket
      `;

      const intervalSeconds = this.parseInterval(interval);

      global.db.all(
        query,
        [intervalSeconds, intervalSeconds, type, from, to],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const data = rows.map(row => ({
            timestamp: row.bucket,
            value: row.value
          }));

          resolve({
            metric: type,
            interval,
            data
          });
        }
      );
    });
  }

  parseInterval(interval) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };

    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid interval format');
    }

    return parseInt(match[1]) * units[match[2]];
  }
}

module.exports = new MetricsService();