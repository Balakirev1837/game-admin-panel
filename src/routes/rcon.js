const express = require('express');
const { docker } = require('../services/docker');
const { sendRconCommand } = require('../services/rcon');

const router = express.Router();

// POST /api/containers/:id/rcon - Send an RCON command to a container's game server
router.post('/:id/rcon', async (req, res) => {
  const { id } = req.params;
  const { command } = req.body || {};

  // Validate command
  if (!command || typeof command !== 'string' || command.trim() === '') {
    return res.status(400).json({ success: false, message: 'Command is required and must be a non-empty string' });
  }

  if (!docker) {
    return res.status(503).json({ success: false, message: 'Docker client is not available' });
  }

  let info;
  try {
    const container = docker.getContainer(id);
    info = await container.inspect();
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: 'Container not found' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }

  // Check container is running
  if (!info.State || info.State.Running !== true) {
    return res.status(503).json({ success: false, message: 'Container is not running' });
  }

  // Discover RCON port from container port bindings
  // Look for port 25575/tcp (standard RCON port) in NetworkSettings.Ports
  const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
  const DEFAULT_RCON_PORT = 25575;

  // Resolve host: prefer game-network IP, but for host-mode containers
  // fall back to 127.0.0.1 (container binds directly to host interfaces)
  let rconHost = '127.0.0.1';
  let rconPort = null;
  let foundPort = false;

  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) {
    rconHost = gameNet.IPAddress;
  }

  // Try to find port mappings from Docker (works for bridge-mode containers)
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

  // Host-mode fallback: no port bindings in inspect — use container env vars
  if (!foundPort) {
    const envServerPort = (info.Config && info.Config.Env)
      ? info.Config.Env.find(e => e.startsWith('SERVER_PORT='))
      : null;
    if (envServerPort) {
      rconPort = parseInt(envServerPort.split('=')[1], 10);
      foundPort = true;
    }
  }

  if (!foundPort) {
    return res.status(503).json({ success: false, message: 'Container has no RCON port mapped' });
  }

  try {
    const response = await sendRconCommand(rconHost, rconPort, undefined, command.trim());
    return res.status(200).json({ success: true, response });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
