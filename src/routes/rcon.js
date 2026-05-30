const express = require('express');
const { docker } = require('../services/docker');
const { sendRconCommand } = require('../services/rcon');

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

function findEnvVar(info, key) {
  if (!info.Config || !info.Config.Env) return null;
  const entry = info.Config.Env.find(e => e.startsWith(key + '='));
  return entry ? entry.split('=').slice(1).join('=') : null;
}

function resolveIcarusRcon(info) {
  const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
  const DEFAULT_RCON_PORT = 25575;
  let rconHost = '127.0.0.1';
  let rconPort = null;
  let foundPort = false;

  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) {
    rconHost = gameNet.IPAddress;
  }

  if (ports && Object.keys(ports).length > 0) {
    const rconPortKey = `${DEFAULT_RCON_PORT}/tcp`;
    if (ports[rconPortKey] && ports[rconPortKey].length > 0) {
      rconPort = parseInt(ports[rconPortKey][0].HostPort, 10);
      foundPort = true;
    }
    if (!foundPort) {
      for (const [containerPort, bindings] of Object.entries(ports)) {
        if (bindings && bindings.length > 0) {
          const privatePort = parseInt(containerPort.split('/')[0], 10);
          if (privatePort === DEFAULT_RCON_PORT || privatePort === 17777) {
            rconPort = privatePort;
            foundPort = true;
            break;
          }
        }
      }
    }
  }

  if (!foundPort) {
    const envServerPort = findEnvVar(info, 'SERVER_PORT');
    if (envServerPort) {
      rconPort = parseInt(envServerPort, 10);
      foundPort = true;
    }
  }

  return { rconHost, rconPort, foundPort, rconPassword: undefined };
}

function resolveCs2Rcon(info) {
  const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
  let rconHost = '127.0.0.1';
  let rconPort = 27015;
  let foundPort = true;

  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) {
    rconHost = gameNet.IPAddress;
  }

  const cs2Port = findEnvVar(info, 'CS2_PORT');
  if (cs2Port) {
    rconPort = parseInt(cs2Port, 10);
  }

  const rconPortEnv = findEnvVar(info, 'CS2_RCON_PORT');
  if (rconPortEnv) {
    rconPort = parseInt(rconPortEnv, 10);
  }

  for (const [containerPort, bindings] of Object.entries(ports)) {
    if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === rconPort) {
      rconHost = '127.0.0.1';
      rconPort = parseInt(bindings[0].HostPort, 10);
      break;
    }
  }

  const rconPassword = findEnvVar(info, 'CS2_RCONPW') || undefined;

  return { rconHost, rconPort, foundPort, rconPassword };
}

function resolveMinecraftRcon(info) {
  const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
  let rconHost = '127.0.0.1';
  let rconPort = 25575;
  let foundPort = true;

  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) {
    rconHost = gameNet.IPAddress;
  }

  const rconPortEnv = findEnvVar(info, 'RCON_PORT');
  if (rconPortEnv) {
    rconPort = parseInt(rconPortEnv, 10);
  }

  for (const [containerPort, bindings] of Object.entries(ports)) {
    if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === rconPort) {
      rconHost = '127.0.0.1';
      rconPort = parseInt(bindings[0].HostPort, 10);
      break;
    }
  }

  const rconPassword = findEnvVar(info, 'RCON_PASSWORD') || undefined;

  return { rconHost, rconPort, foundPort, rconPassword };
}

function resolveFactorioRcon(info, containerName) {
  const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
  let rconHost = '127.0.0.1';
  let rconPort = 27015;
  let foundPort = true;

  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) {
    rconHost = gameNet.IPAddress;
  }

  const rconPortEnv = findEnvVar(info, 'RCON_PORT');
  if (rconPortEnv) {
    rconPort = parseInt(rconPortEnv, 10);
  }

  for (const [containerPort, bindings] of Object.entries(ports)) {
    if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === rconPort) {
      rconHost = '127.0.0.1';
      rconPort = parseInt(bindings[0].HostPort, 10);
      break;
    }
  }

  // Read password from factorioConfig
  const factorioConfig = require('../services/factorioConfig');
  const config = factorioConfig.readConfig(containerName);
  const rconPassword = config.json.rcon_password || undefined;

  return { rconHost, rconPort, foundPort, rconPassword };
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

  let rconResult;
  if (game === 'cs2') {
    rconResult = resolveCs2Rcon(info);
  } else if (game === 'minecraft') {
    rconResult = resolveMinecraftRcon(info);
  } else if (game === 'factorio') {
    const containerName = info.Name.replace(/^\//, '');
    rconResult = resolveFactorioRcon(info, containerName);
  } else {
    rconResult = resolveIcarusRcon(info);
  }

  if (!rconResult.foundPort) {
    return res.status(503).json({ success: false, message: 'Container has no RCON port mapped' });
  }

  try {
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
