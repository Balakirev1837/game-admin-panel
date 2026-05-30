const express = require('express');
const { getContainerResources } = require('../services/resources');
const { docker } = require('../services/docker');

const router = express.Router();

// GET /api/containers/:id/resources - One-shot stats snapshot
router.get('/:id/resources', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }

  try {
    const resources = await getContainerResources(req.params.id);
    return res.json(resources);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;