/**
 * RCON Client Service
 *
 * Provides a reusable interface for sending RCON (Remote Console) commands
 * to game servers. Built on top of the srcds-rcon library which implements
 * the Valve RCON protocol.
 *
 * Usage:
 *   const { sendRconCommand } = require('./services/rcon');
 *   const response = await sendRconCommand('127.0.0.1', 25575, 'mypassword', 'status');
 *
 * Configuration:
 *   ICARUS_RCON_PASSWORD - Default RCON password (fallback: 'dateniteroolz')
 *   RCON_TIMEOUT_MS      - Command timeout in milliseconds (default: 5000)
 */

const SrcdsRcon = require('srcds-rcon');

const DEFAULT_RCON_PASSWORD = process.env.ICARUS_RCON_PASSWORD || 'dateniteroolz';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.RCON_TIMEOUT_MS, 10) || 5000;

/**
 * Send an RCON command to a game server.
 *
 * @param {string} host     - Server hostname or IP address.
 * @param {number} port     - RCON port number.
 * @param {string} password - RCON password. Falls back to ICARUS_RCON_PASSWORD
 *                            env var or 'dateniteroolz' if omitted/undefined.
 * @param {string} command  - The command string to execute on the server.
 * @returns {Promise<string>} Resolves with the response text from the server.
 */
async function sendRconCommand(host, port, password, command) {
  if (!host) {
    throw new Error('RCON host is required');
  }
  if (!port) {
    throw new Error('RCON port is required');
  }
  if (!command) {
    throw new Error('RCON command is required');
  }

  const rconPassword = password || DEFAULT_RCON_PASSWORD;

  let client;
  try {
    client = SrcdsRcon({
      address: `${host}:${port}`,
      password: rconPassword,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  } catch (err) {
    throw new Error(`RCON client initialization failed for ${host}:${port}: ${err.message}`);
  }

  try {
    await client.connect();
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('password')) {
      throw new Error(`RCON authentication failed for ${host}:${port}: ${msg}`);
    }
    throw new Error(`RCON connection failed to ${host}:${port}: ${msg}`);
  }

  try {
    const response = await client.command(command);
    return response;
  } catch (err) {
    throw new Error(`RCON command execution failed on ${host}:${port}: ${err.message}`);
  } finally {
    try {
      await client.disconnect();
    } catch (_err) {
      // Best-effort disconnect; ignore errors during cleanup
    }
  }
}

module.exports = { sendRconCommand, DEFAULT_RCON_PASSWORD };
