const SrcdsRcon = require('srcds-rcon');
const logger = require('./logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.RCON_TIMEOUT_MS, 10) || 5000;
const IDLE_TIMEOUT_MS = 60000;

const pool = new Map();

function makeKey(host, port) {
  return `${host}:${port}`;
}

async function getConnection(host, port, password) {
  const key = makeKey(host, port);
  const entry = pool.get(key);

  if (entry && entry.password === password) {
    try {
      await entry.client.command('ping');
      clearTimeout(entry.idleTimer);
      entry.idleTimer = setTimeout(() => evict(key), IDLE_TIMEOUT_MS);
      return entry.client;
    } catch (err) {
      logger.warn({ err, host, port }, 'RCON pool ping failed, evicting connection');
      evict(key);
    }
  }

  if (entry) evict(key);

  const client = SrcdsRcon({
    address: `${host}:${port}`,
    password,
    timeout: DEFAULT_TIMEOUT_MS,
  });

  await client.connect();

  const newEntry = {
    client,
    password,
    idleTimer: setTimeout(() => evict(key), IDLE_TIMEOUT_MS),
  };
  pool.set(key, newEntry);
  return client;
}

function evict(key) {
  const entry = pool.get(key);
  if (!entry) return;
  clearTimeout(entry.idleTimer);
  try { entry.client.disconnect(); } catch (err) { logger.warn({ err }, 'RCON pool disconnect error'); }
  pool.delete(key);
}

async function sendRconCommand(host, port, password, command) {
  if (!host) throw new Error('RCON host is required');
  if (!port) throw new Error('RCON port is required');
  if (!command) throw new Error('RCON command is required');

  const rconPassword = password || process.env.ICARUS_RCON_PASSWORD || 'dateniteroolz';

  try {
    const client = await getConnection(host, port, rconPassword);
    return await client.command(command);
  } catch (err) {
    evict(makeKey(host, port));
    const msg = err.message || String(err);
    if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('password')) {
      throw new Error(`RCON authentication failed for ${host}:${port}: ${msg}`);
    }
    throw new Error(`RCON failed on ${host}:${port}: ${msg}`);
  }
}

function flushPool() {
  for (const key of pool.keys()) evict(key);
}

module.exports = { sendRconCommand, flushPool, DEFAULT_RCON_PASSWORD: process.env.ICARUS_RCON_PASSWORD || 'dateniteroolz' };
