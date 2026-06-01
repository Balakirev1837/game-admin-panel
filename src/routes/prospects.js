const express = require('express');
const prospects = require('../services/prospects');
const { docker } = require('../services/docker');
const logger = require('../services/logger');

const router = express.Router();

async function resolveContainerName(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.Name.replace(/^\//, '');
  } catch (err) {
    logger.warn({ err, containerId }, 'Failed to resolve container name');
    return null;
  }
}

// GET /api/containers/:id/prospects - List prospect files
router.get('/:id/prospects', async (req, res) => {
  try {
    const containerName = await resolveContainerName(req.params.id);
    const items = prospects.listProspects(containerName || req.params.id);
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/containers/:id/prospects - Upload a prospect .json save
router.post('/:id/prospects', async (req, res) => {
  const { name, content } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Prospect name is required' });
  }
  if (!content) {
    return res.status(400).json({ error: 'Prospect content is required' });
  }

  try {
    const containerName = await resolveContainerName(req.params.id);
    const result = prospects.saveProspect(containerName || req.params.id, name, content);
    return res.status(201).json({ success: true, prospect: result.name });
  } catch (err) {
    if (err.code === 'EINVAL') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;