const express = require('express');
const router = express.Router();
const containerController = require('../controllers/container.controller');
const { validateContainerAction } = require('../middleware/validators');

router.get('/', containerController.listContainers);
router.get('/:id', containerController.getContainer);
router.post('/:id/start', containerController.startContainer);
router.post('/:id/stop', containerController.stopContainer);
router.post('/:id/restart', containerController.restartContainer);
router.get('/:id/logs', containerController.getContainerLogs);
router.get('/:id/stats', containerController.getContainerStats);

module.exports = router;