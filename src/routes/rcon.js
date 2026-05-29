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

  let rconHost = '127.0.0.1';
  let rconPort = null;
  let foundPort = false;

  // Try to find the default RCON port mapping first
  const rconPortKey = `${DEFAULT_RCON_PORT}/tcp`;
  if (ports[rconPortKey] && ports[rconPortKey].length > 0) {
    const binding = ports[rconPortKey][0];
    rconHost = binding.HostIp || '127.0.0.1';
    rconPort = parseInt(binding.HostPort, 10);
    foundPort = true;
  }

  // If default port not found, look for any port mapping that might be RCON
  if (!foundPort) {
    // Check if any port mapping exists; use the first one we find
    // This is a fallback for containers that might expose RCON on a different port
    for (const [containerPort, bindings] of Object.entries(ports)) {
      if (bindings && bindings.length > 0) {
        // Check if the private/container port is 25575
        const privatePort = parseInt(containerPort.split('/')[0], 10);
        if (privatePort === DEFAULT_RCON_PORT) {
          const binding = bindings[0];
          rconHost = binding.HostIp || '127.0.0.1';
          rconPort = parseInt(binding.HostPort, 10);
          foundPort = true;
          break;
        }
      }
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
