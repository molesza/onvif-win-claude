const express = require('express');
const router = express.Router();
const metricsService = require('../services/metrics.service');

router.get('/system', async (req, res, next) => {
  try {
    const metrics = await metricsService.getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get('/containers', async (req, res, next) => {
  try {
    const metrics = await metricsService.getContainerMetrics(req.query);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const { metric, from, to, interval } = req.query;
    const data = await metricsService.getHistoricalMetrics(metric, from, to, interval);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;