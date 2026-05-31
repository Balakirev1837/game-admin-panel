const express = require('express');
const { docker } = require('../services/docker');
const { readFileFromContainer } = require('../services/containerFiles');

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

async function resolveTerrariaRest(info, containerName) {
  const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
  let restHost = '127.0.0.1';
  let restPort = 7878;
  let foundPort = true;

  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) {
    restHost = gameNet.IPAddress;
  }

  let config = {};
  try {
    const configPaths = ['/tshock/config.json', '/root/.local/share/Terraria/tshock/config.json'];
    for (const p of configPaths) {
      const data = await readFileFromContainer(info.Id, p);
      if (data) {
        config = JSON.parse(data);
        break;
      }
    }
  } catch {}

  if (config.RestApiPort) {
    restPort = config.RestApiPort;
  }

  for (const [containerPort, bindings] of Object.entries(ports)) {
    if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === restPort) {
      restHost = '127.0.0.1';
      restPort = parseInt(bindings[0].HostPort, 10);
      break;
    }
  }

  let token = undefined;
  if (config.ApplicationRestTokens) {
    token = Array.isArray(config.ApplicationRestTokens)
      ? config.ApplicationRestTokens[0]
      : config.ApplicationRestTokens;
  }

  return { restHost, restPort, foundPort, token };
}

router.post('/:id/rest', async (req, res) => {
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

  if (game !== 'terraria') {
    return res.status(400).json({ success: false, message: 'REST API is only supported for Terraria' });
  }

  const containerName = info.Name.replace(/^\//, '');
  const restResult = await resolveTerrariaRest(info, containerName);

  if (!restResult.foundPort) {
    return res.status(503).json({ success: false, message: 'Container has no REST port mapped' });
  }

  if (!restResult.token) {
    return res.status(401).json({ success: false, message: 'No REST API token configured' });
  }

  try {
    // TShock REST API v3 rawcmd endpoint
    const url = `http://${restResult.restHost}:${restResult.restPort}/v3/server/rawcmd?token=${encodeURIComponent(restResult.token)}&cmd=${encodeURIComponent(command.trim())}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '200') {
      // TShock returns response in data.response
      const responseText = Array.isArray(data.response) ? data.response.join('\n') : String(data.response || '');
      return res.status(200).json({ success: true, response: responseText });
    } else {
      return res.status(400).json({ success: false, message: data.error || 'REST API error' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: `REST API request failed: ${err.message}` });
  }
});

module.exports = router;
