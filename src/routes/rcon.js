const express = require('express');
const { docker } = require('../services/docker');
const { sendRconCommand } = require('../services/rconPool');
const games = require('../games');

const router = express.Router();

async function resolveContainerGame(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const game = (info.Config && info.Config.Labels && info.Config.Labels['game-admin-panel.game']) || 'icarus';
    return { info, game };
  } catch (err) {
    if (err.statusCode === 404) {
      return { info: null, game: null, notFound: true };
    }
    throw err;
  }
}

router.post('/:id/rcon', async (req, res) => {
  const { id } = req.params;
  const { command } = req.body || {};

  if (!command || typeof command !== 'string' || command.trim() === '') {
    return res.status(400).json({ success: false, message: 'Command is required and must be a non-empty string' });
  }

  if (!docker) {
    return res.status(503).json({ success: false, message: 'Docker client is not available' });
  }

  let info, game;
  try {
    const result = await resolveContainerGame(id);
    info = result.info;
    game = result.game;
    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Container not found' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  if (!info.State || info.State.Running !== true) {
    return res.status(503).json({ success: false, message: 'Container is not running' });
  }

  const adapter = games.get(game);
  if (!adapter || adapter.consoleType !== 'rcon') {
    return res.status(400).json({ success: false, message: 'RCON is not supported for this game' });
  }

  try {
    const rconResult = await adapter.resolveRcon(info);

    if (!rconResult.foundPort) {
      return res.status(503).json({ success: false, message: 'Container has no RCON port mapped' });
    }

    const response = await sendRconCommand(
      rconResult.rconHost,
      rconResult.rconPort,
      rconResult.rconPassword,
      command.trim()
    );
    return res.status(200).json({ success: true, response });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
