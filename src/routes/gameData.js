const express = require('express');
const fs = require('fs');
const path = require('path');
const { docker } = require('../services/docker');

const router = express.Router();

const GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT || '/host-games';

async function resolveContainerName(containerId) {
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

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function resolvePath(containerName, game, type) {
  const base = path.join(GAME_CONFIG_ROOT, containerName);
  switch (`${game}:${type}`) {
    case 'minecraft:whitelist': return path.join(base, 'whitelist.json');
    case 'minecraft:ops': return path.join(base, 'ops.json');
    case 'minecraft:banned-players': return path.join(base, 'banned-players.json');
    case 'minecraft:server-properties': return path.join(base, 'server.properties');
    case 'factorio:saves': return path.join(base, 'saves');
    case 'factorio:mods': return path.join(base, 'mods');
    case 'factorio:adminlist': return path.join(base, 'config', 'server-adminlist.json');
    case 'factorio:banlist': return path.join(base, 'config', 'server-banlist.json');
    case 'terraria:worlds': return path.join(base, 'Worlds');
    default: return null;
  }
}

router.get('/:id/game-data/:type', async (req, res) => {
  const { id, type } = req.params;
  try {
    const { name, game } = await resolveContainerName(id);
    if (!name) return res.status(404).json({ error: 'Container not found' });

    const filePath = resolvePath(name, game, type);
    if (!filePath) return res.status(400).json({ error: `Unknown data type: ${type} for game: ${game}` });

    if (type === 'saves' || type === 'mods' || type === 'worlds') {
      if (!fs.existsSync(filePath)) return res.json({ entries: [] });
      const entries = fs.readdirSync(filePath)
        .filter(f => !f.startsWith('.'))
        .map(f => {
          const stat = fs.statSync(path.join(filePath, f));
          return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
        });
      return res.json({ entries, game });
    }

    if (type === 'server-properties') {
      if (!fs.existsSync(filePath)) return res.json({ properties: {}, game });
      const content = fs.readFileSync(filePath, 'utf-8');
      const properties = {};
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#][^=]*)=(.*)$/);
        if (match) properties[match[1].trim()] = match[2].trim();
      }
      return res.json({ properties, game });
    }

    const data = readJsonFile(filePath);
    return res.json({ data: data || [], game });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
