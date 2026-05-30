const express = require('express');
const icarusConfig = require('../services/icarusConfig');
const { docker } = require('../services/docker');

const router = express.Router();

async function resolveContainerName(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.Name.replace(/^\//, '');
  } catch {
    return null;
  }
}

/**
 * GET /api/containers/:id/config
 * Returns the current server config as JSON.
 */
router.get('/:id/config', async (req, res) => {
  const { id } = req.params;
  try {
    const containerName = await resolveContainerName(id);
    const config = icarusConfig.readConfig(containerName || id);
    const launchParams = icarusConfig.readLaunchParams(containerName || id);
    return res.json({ config, launchParams });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/containers/:id/config
 * Accepts a JSON config object, validates, writes, and returns success.
 */
router.put('/:id/config', async (req, res) => {
  const { id } = req.params;
  const { config, launchParams } = req.body;

  try {
    if (!config) {
      return res.status(400).json({ error: 'Request body must include a config object' });
    }

    const validation = icarusConfig.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
    }

    const containerName = await resolveContainerName(id);
    const written = icarusConfig.writeConfig(containerName || id, config);

    let updatedLaunchParams = null;
    if (launchParams) {
      updatedLaunchParams = icarusConfig.writeLaunchParams(containerName || id, launchParams);
    }

    return res.json({ success: true, config: written, launchParams: updatedLaunchParams });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
