const express = require('express');
const { docker } = require('../services/docker');
const { readFileFromContainer, execInContainer } = require('../services/containerFiles');
const logger = require('../services/logger');
const games = require('../games');

const router = express.Router();

async function resolveContainerInfo(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ''),
      game: (info.Config && info.Config.Labels && info.Config.Labels['game-admin-panel.game']) || 'icarus',
      running: info.State && info.State.Running === true,
    };
  } catch (err) {
    logger.warn({ err, containerId }, 'Failed to inspect container for game data');
    return { id: null, name: null, game: 'icarus', running: false };
  }
}

router.get('/:id/game-data/:type', async (req, res) => {
  const { id, type } = req.params;
  try {
    const { name, game, running, id: containerId } = await resolveContainerInfo(id);
    if (!name) return res.status(404).json({ error: 'Container not found' });

    const adapter = games.get(game);
    if (!adapter || !adapter.gameDataTypes || adapter.gameDataTypes.length === 0) {
      return res.status(400).json({ error: `No game data for ${game}` });
    }

    const typeDef = adapter.gameDataTypes.find(t => t.type === type);
    if (!typeDef) return res.status(400).json({ error: `Unknown data type: ${type}` });

    if (!running) {
      return res.json({ entries: [], data: null, game, stopped: true });
    }

    if (typeDef.format === 'dir') {
      try {
        const lines = await execInContainer(containerId, `ls -1p ${typeDef.path} 2>/dev/null`);
        const entries = lines
          .filter(l => !l.endsWith('/'))
          .map(name => ({ name: name.replace(/@$/, ''), size: 0, modified: null }));
        return res.json({ entries, game });
      } catch (err) {
        logger.warn({ err, containerId, path: typeDef.path }, 'Failed to list directory in container');
        return res.json({ entries: [], game });
      }
    }

    if (typeDef.format === 'properties') {
      const data = await readFileFromContainer(containerId, typeDef.path);
      if (!data) return res.json({ properties: {}, game });
      const properties = {};
      for (const line of data.split('\n')) {
        const match = line.match(/^([^#][^=]*)=(.*)$/);
        if (match) properties[match[1].trim()] = match[2].trim();
      }
      return res.json({ properties, game });
    }

    const data = await readFileFromContainer(containerId, typeDef.path);
    if (!data) return res.json({ data: [], game });
    try {
      const parsed = JSON.parse(data);
      return res.json({ data: Array.isArray(parsed) ? parsed : [parsed], game });
    } catch (err) {
      logger.warn({ err, containerId, path: typeDef.path }, 'Failed to parse game data JSON');
      return res.json({ data: [], game });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
