const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const nvrRoutes = require('./nvr.routes');
const containerRoutes = require('./container.routes');
const metricsRoutes = require('./metrics.routes');
const configRoutes = require('./config.routes');
const alertRoutes = require('./alert.routes');
const adoptionRoutes = require('./adoption.routes');

const { authenticateToken } = require('../middleware/auth');

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/nvrs', authenticateToken, nvrRoutes);
router.use('/containers', authenticateToken, containerRoutes);
router.use('/metrics', authenticateToken, metricsRoutes);
router.use('/config', authenticateToken, configRoutes);
router.use('/alerts', authenticateToken, alertRoutes);
router.use('/adoption', authenticateToken, adoptionRoutes);

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'ONVIF Web Interface API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      nvrs: '/api/nvrs',
      containers: '/api/containers',
      metrics: '/api/metrics',
      config: '/api/config',
      alerts: '/api/alerts',
      adoption: '/api/adoption'
    }
  });
});

module.exports = router;