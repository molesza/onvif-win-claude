const express = require('express');
const router = express.Router();

// Placeholder implementation
router.post('/start', (req, res) => {
  res.json({ sessionId: 'adoption-123', status: 'in_progress' });
});

module.exports = router;