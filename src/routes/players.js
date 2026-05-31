const express = require('express');
const { docker } = require('../services/docker');
const { sendRconCommand } = require('../services/rcon');

const router = express.Router();

async function resolveContainerInfo(containerId) {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const game = (info.Config && info.Config.Labels && info.Config.Labels['game-admin-panel.game']) || 'icarus';
  return { info, game };
}

function findEnvVar(info, key) {
  if (!info.Config || !info.Config.Env) return null;
  const entry = info.Config.Env.find(e => e.startsWith(key + '='));
  return entry ? entry.split('=').slice(1).join('=') : null;
}

function findRconHost(info) {
  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) return gameNet.IPAddress;
  return '127.0.0.1';
}

async function getCs2Players(info) {
  const host = findRconHost(info);
  const port = parseInt(findEnvVar(info, 'CS2_PORT') || '27015', 10);
  const password = findEnvVar(info, 'CS2_RCONPW') || undefined;
  try {
    const response = await sendRconCommand(host, port, password, 'status');
    const players = [];
    const lines = response.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s*\d+\s+"(.+?)"\s+(\[U:\S+?\])\s+\S+\s+(\d+)/);
      if (match) {
        players.push({ name: match[1], steamid: match[2], ping: parseInt(match[3], 10) || 0 });
      }
    }
    return players;
  } catch {
    return [];
  }
}

async function getMinecraftPlayers(info) {
  const host = findRconHost(info);
  const port = parseInt(findEnvVar(info, 'RCON_PORT') || '25575', 10);
  const password = findEnvVar(info, 'RCON_PASSWORD') || undefined;
  try {
    const response = await sendRconCommand(host, port, password, 'list');
    const match = response.match(/There are (\d+) of a max of (\d+) players online(?::\s*(.+))?/);
    if (!match) return [];
    const names = match[3] ? match[3].split(', ').map(n => n.trim()).filter(Boolean) : [];
    return names.map(name => ({ name }));
  } catch {
    return [];
  }
}

async function getFactorioPlayers(info) {
  const host = findRconHost(info);
  const port = 27015;
  const containerName = info.Name.replace(/^\//, '');
  try {
    const factorioConfig = require('../services/factorioConfig');
    const config = factorioConfig.readConfig(containerName);
    const password = config.json.rcon_password || undefined;
    const response = await sendRconCommand(host, port, password, '/players');
    const players = [];
    const lines = response.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(.+?)\s+\(online\)$/);
      if (match) players.push({ name: match[1], online: true });
      else {
        const offlineMatch = line.match(/^\s*(.+?)\s*$/);
        if (offlineMatch && offlineMatch[1].trim() && !line.includes('Players') && !line.includes('(')) {
          players.push({ name: offlineMatch[1].trim(), online: false });
        }
      }
    }
    return players.filter(p => p.online);
  } catch {
    return [];
  }
}

async function getTerrariaPlayers(info) {
  const host = findRconHost(info);
  const terrariaConfig = require('../services/terrariaConfig');
  const containerName = info.Name.replace(/^\//, '');
  const config = terrariaConfig.readConfig(containerName);
  const restPort = config.json.RestApiPort || 7878;
  const tokens = config.json.ApplicationRestTokens;
  const token = Array.isArray(tokens) && tokens.length > 0
    ? (typeof tokens[0] === 'string' ? tokens[0] : tokens[0].value || '')
    : '';
  if (!token) return [];
  try {
    const http = require('http');
    const response = await new Promise((resolve, reject) => {
      http.get(`http://${host}:${restPort}/v3/players/list?token=${token}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    if (!response.players) return [];
    return response.players.map(p => ({ name: p.nickname || p.name || p.username || String(p) }));
  } catch {
    return [];
  }
}

async function getIcarusPlayers() {
  return [];
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

    let players;
    switch (game) {
      case 'cs2': players = await getCs2Players(info); break;
      case 'minecraft': players = await getMinecraftPlayers(info); break;
      case 'factorio': players = await getFactorioPlayers(info); break;
      case 'terraria': players = await getTerrariaPlayers(info); break;
      default: players = await getIcarusPlayers(); break;
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
