const express = require('express');
const icarusConfig = require('../services/icarusConfig');

const router = express.Router();

/**
 * GET /api/containers/:id/config
 * Returns the current server config as JSON.
 */
router.get('/:id/config', (req, res) => {
  const { id } = req.params;
  try {
    const config = icarusConfig.readConfig(id);
    const launchParams = icarusConfig.readLaunchParams(id);
    return res.json({ config, launchParams });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/containers/:id/config
 * Accepts a JSON config object, validates, writes, and returns success.
 */
router.put('/:id/config', (req, res) => {
  const { id } = req.params;
  const { config, launchParams } = req.body;

  try {
    // Config is required
    if (!config) {
      return res.status(400).json({ error: 'Request body must include a config object' });
    }

    const validation = icarusConfig.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
    }

    const written = icarusConfig.writeConfig(id, config);

    // Optionally update launch params if provided
    let updatedLaunchParams = null;
    if (launchParams) {
      updatedLaunchParams = icarusConfig.writeLaunchParams(id, launchParams);
    }

    return res.json({ success: true, config: written, launchParams: updatedLaunchParams });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
