const express = require('express');
const path = require('path');
const { docker } = require('../services/docker');
const { readFileFromContainer, execInContainer } = require('../services/containerFiles');

const router = express.Router();

const GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT || '/host-games';

const GAME_DATA_TYPES = {
  minecraft: [
    { type: 'whitelist', label: 'Whitelist', path: '/data/whitelist.json', format: 'json', listKey: null },
    { type: 'ops', label: 'OPs', path: '/data/ops.json', format: 'json', listKey: null },
    { type: 'banned-players', label: 'Banned Players', path: '/data/banned-players.json', format: 'json', listKey: null },
    { type: 'server-properties', label: 'server.properties', path: '/data/server.properties', format: 'properties' },
  ],
  factorio: [
    { type: 'saves', label: 'Save Files', path: '/factorio/saves', format: 'dir' },
    { type: 'mods', label: 'Mods', path: '/factorio/mods', format: 'dir' },
    { type: 'adminlist', label: 'Admin List', path: '/factorio/config/server-adminlist.json', format: 'json', listKey: null },
    { type: 'banlist', label: 'Ban List', path: '/factorio/config/server-banlist.json', format: 'json', listKey: null },
  ],
  terraria: [
    { type: 'worlds', label: 'World Files', path: '/root/.local/share/Terraria/Worlds', format: 'dir' },
  ],
};

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
  } catch {
    return { id: null, name: null, game: 'icarus', running: false };
  }
}

router.get('/:id/game-data/:type', async (req, res) => {
  const { id, type } = req.params;
  try {
    const { name, game, running, id: containerId } = await resolveContainerInfo(id);
    if (!name) return res.status(404).json({ error: 'Container not found' });

    const types = GAME_DATA_TYPES[game];
    if (!types) return res.status(400).json({ error: `No game data for ${game}` });

    const typeDef = types.find(t => t.type === type);
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
      } catch {
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
    } catch {
      return res.json({ data: [], game });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
