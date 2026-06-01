const express = require('express');
const backup = require('../services/backup');
const { docker } = require('../services/docker');
const games = require('../games');

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

router.get('/:id/config', async (req, res) => {
  const { id } = req.params;
  try {
    const { name, game, info, composeDir } = await resolveContainerInfo(id);
    const containerName = name || id;

    const adapter = games.get(game);
    if (adapter) {
      const result = await adapter.readConfig(containerName, info, composeDir);
      return res.json({ ...result, game });
    }

    return res.json({ config: {}, game });
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

    const adapter = games.get(game);
    if (!adapter) {
      return res.status(400).json({ error: `Unknown game: ${game}` });
    }

    const validation = adapter.validateConfig({ config, launchParams });
    if (!validation.valid) {
      return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });
    }

    await backup.createBackup(containerName, game, info);

    const result = await adapter.writeConfig(containerName, { config, launchParams }, info, composeDir);
    return res.json({ success: true, ...result, game });
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
