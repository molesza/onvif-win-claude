const express = require('express');
const router = express.Router();

// Placeholder implementation
router.get('/', (req, res) => {
  res.json({ nvrs: [] });
});

router.post('/', (req, res) => {
  res.json({ message: 'NVR routes not yet implemented' });
});

module.exports = router;