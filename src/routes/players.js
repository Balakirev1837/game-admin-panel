const express = require('express');
const { docker } = require('../services/docker');
const games = require('../games');

const router = express.Router();

async function resolveContainerInfo(containerId) {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const game = (info.Config && info.Config.Labels && info.Config.Labels['game-admin-panel.game']) || 'icarus';
  return { info, game };
}

router.get('/:id/players', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();

    if (!info.State || info.State.Running !== true) {
      return res.json({ players: [] });
    }

    const game = (info.Config && info.Config.Labels && info.Config.Labels['game-admin-panel.game']) || 'icarus';

    const adapter = games.get(game);
    let players = [];
    if (adapter) {
      players = await adapter.getPlayers(info);
    }

    return res.json({ players, game });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
