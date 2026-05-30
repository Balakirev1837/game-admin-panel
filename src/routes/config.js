const express = require('express');
const icarusConfig = require('../services/icarusConfig');
const cs2Config = require('../services/cs2Config');
const minecraftConfig = require('../services/minecraftConfig');
const factorioConfig = require('../services/factorioConfig');
const terrariaConfig = require('../services/terrariaConfig');
const backup = require('../services/backup');
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
      return res.json({ config, game });
    } else if (game === 'minecraft') {
      const config = minecraftConfig.readEnvFile(containerName);
      return res.json({ config, game });
    } else if (game === 'factorio') {
      const config = factorioConfig.readConfig(containerName);
      return res.json({ config, game });
    } else if (game === 'terraria') {
      const config = terrariaConfig.readConfig(containerName);
      return res.json({ config, game });
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

    backup.createBackup(containerName, game);

    if (game === 'cs2') {
      const validation = cs2Config.validateEnvData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = cs2Config.writeEnvFile(containerName, config);
      return res.json({ success: true, config: written, game });
    } else if (game === 'minecraft') {
      const validation = minecraftConfig.validateEnvData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = minecraftConfig.writeEnvFile(containerName, config);
      return res.json({ success: true, config: written, game });
    } else if (game === 'factorio') {
      const validation = factorioConfig.validateConfigData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = factorioConfig.writeConfig(containerName, config);
      return res.json({ success: true, config: written, game });
    } else if (game === 'terraria') {
      const validation = terrariaConfig.validateConfigData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = terrariaConfig.writeConfig(containerName, config);
      return res.json({ success: true, config: written, game });
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

router.get('/:id/config/backups', async (req, res) => {
  const { id } = req.params;
  try {
    const { name, game } = await resolveContainerInfo(id);
    const containerName = name || id;
    const backups = backup.listBackups(containerName);
    return res.json({ backups, game });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/config/restore', async (req, res) => {
  const { id } = req.params;
  const { file } = req.body;

  if (!file) {
    return res.status(400).json({ error: 'Backup file name is required' });
  }

  try {
    const { name, game } = await resolveContainerInfo(id);
    const containerName = name || id;
    const result = backup.restoreBackup(containerName, game, file);
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.message === 'Backup file not found') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
