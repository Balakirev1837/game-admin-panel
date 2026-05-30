const express = require('express');
const { docker } = require('../services/docker');

const router = express.Router();

// GET /api/containers - List all Docker containers
router.get('/', async (_req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['game-admin-panel.enabled=true'] }
    });
    const result = containers.map((c) => ({
      id: c.Id,
      name: c.Names[0] ? c.Names[0].replace(/^\//, '') : '',
      image: c.Image,
      status: c.Status,
      state: c.State,
      ports: c.Ports.map((p) => ({
        IP: p.IP || '',
        PrivatePort: p.PrivatePort || null,
        PublicPort: p.PublicPort || null,
        Type: p.Type || '',
      })),
    }));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
