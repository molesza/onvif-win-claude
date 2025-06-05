const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { auth: authLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validateRefresh } = require('../middleware/validators');

router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/refresh', authLimiter, validateRefresh, authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;