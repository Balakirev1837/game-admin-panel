const express = require('express');
const icarusConfig = require('../services/icarusConfig');
const cs2Config = require('../services/cs2Config');
const minecraftConfig = require('../services/minecraftConfig');
const factorioConfig = require('../services/factorioConfig');
const terrariaConfig = require('../services/terrariaConfig');
const backup = require('../services/backup');
const { docker } = require('../services/docker');

const router = express.Router();

const GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT || '/host-games';
const GAME_CONFIG_ROOT_HOST = process.env.GAME_CONFIG_ROOT_HOST || '/home/tyler/Docker/games';

async function resolveContainerInfo(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const labels = (info.Config && info.Config.Labels) || {};
    const game = labels['game-admin-panel.game'] || 'icarus';
    const name = info.Name.replace(/^\//, '');

    let composeDir = null;
    const composeWorkingDir = labels['com.docker.compose.project.working_dir'];
    if (composeWorkingDir) {
      composeDir = composeWorkingDir.replace(GAME_CONFIG_ROOT_HOST, GAME_CONFIG_ROOT);
    }

    return { name, game, info, composeDir };
  } catch {
    return { name: null, game: 'icarus', info: null, composeDir: null };
  }
}

function resolveEnvPath(containerName, composeDir) {
  if (composeDir) {
    return require('path').join(composeDir, '.env');
  }
  return cs2Config.getEnvFilePath(containerName);
}

router.get('/:id/config', async (req, res) => {
  const { id } = req.params;
  try {
    const { name, game, info, composeDir } = await resolveContainerInfo(id);
    const containerName = name || id;

    if (game === 'cs2') {
      const envPath = resolveEnvPath(containerName, composeDir);
      const config = cs2Config.readEnvFile(containerName, envPath);
      return res.json({ config, game });
    } else if (game === 'minecraft') {
      const envPath = resolveEnvPath(containerName, composeDir);
      const config = minecraftConfig.readEnvFile(containerName, envPath);
      return res.json({ config, game });
    } else if (game === 'factorio') {
      const config = await factorioConfig.readConfig(containerName, info);
      return res.json({ config, game });
    } else if (game === 'terraria') {
      const config = await terrariaConfig.readConfig(containerName, info);
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

    const { name, game, info, composeDir } = await resolveContainerInfo(id);
    const containerName = name || id;

    await backup.createBackup(containerName, game, info);

    if (game === 'cs2') {
      const validation = cs2Config.validateEnvData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const envPath = resolveEnvPath(containerName, composeDir);
      const written = cs2Config.writeEnvFile(containerName, config, envPath);
      return res.json({ success: true, config: written, game });
    } else if (game === 'minecraft') {
      const validation = minecraftConfig.validateEnvData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const envPath = resolveEnvPath(containerName, composeDir);
      const written = minecraftConfig.writeEnvFile(containerName, config, envPath);
      return res.json({ success: true, config: written, game });
    } else if (game === 'factorio') {
      const validation = factorioConfig.validateConfigData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = await factorioConfig.writeConfig(containerName, config, info);
      return res.json({ success: true, config: written, game });
    } else if (game === 'terraria') {
      const validation = terrariaConfig.validateConfigData(config);
      if (!validation.valid) {
        return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const written = await terrariaConfig.writeConfig(containerName, config, info);
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
