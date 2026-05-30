const express = require('express');
const icarusConfig = require('../services/icarusConfig');
const cs2Config = require('../services/cs2Config');
const { docker } = require('../services/docker');

const router = express.Router();

async function resolveContainerInfo(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return {
      name: info.Name.replace(/^\//, ''),
      game: (info.Config && info.Config.Labels && info.Config.Labels['game-admin-panel.game']) || 'icarus',
    };
  } catch {
    return { name: null, game: 'icarus' };
  }
}

router.get('/:id/config', async (req, res) => {
  const { id } = req.params;
  try {
    const { name, game } = await resolveContainerInfo(id);
    const containerName = name || id;

    if (game === 'cs2') {
      const config = cs2Config.readEnvFile(containerName);
      return res.json({ config, game: 'cs2' });
    }

    const config = icarusConfig.readConfig(containerName);
    const launchParams = icarusConfig.readLaunchParams(containerName);
    return res.json({ config, launchParams, game: 'icarus' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/config', async (req, res) => {
  const { id } = req.params;
  const { config, launchParams } = req.body;

  try {
    if (!config) {
      return res.status(400).json({ error: 'Request body must include a config object' });
    }

    const { name, game } = await resolveContainerInfo(id);
    const containerName = name || id;

    if (game === 'cs2') {
      const validation = cs2Config.validateEnvData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = cs2Config.writeEnvFile(containerName, config);
      return res.json({ success: true, config: written, game: 'cs2' });
    }

    const validation = icarusConfig.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
    }

    const written = icarusConfig.writeConfig(containerName, config);

    let updatedLaunchParams = null;
    if (launchParams) {
      updatedLaunchParams = icarusConfig.writeLaunchParams(containerName, launchParams);
    }

    return res.json({ success: true, config: written, launchParams: updatedLaunchParams, game: 'icarus' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
