const fs = require('fs');
const path = require('path');

const DEFAULT_GAME_ROOT = '/host-games';

function getGameRoot() {
  return process.env.GAME_CONFIG_ROOT || DEFAULT_GAME_ROOT;
}

const MINECRAFT_ENV_FIELDS = [
  { key: 'EULA', label: 'Accept EULA', type: 'select', options: ['TRUE', 'FALSE'], help: 'Must be TRUE to run the server' },
  { key: 'VERSION', label: 'Minecraft Version', type: 'text', placeholder: 'LATEST', help: 'e.g. LATEST, SNAPSHOT, 1.21.4' },
  { key: 'TYPE', label: 'Server Type', type: 'select', options: ['VANILLA', 'PAPER', 'SPIGOT', 'FORGE', 'FABRIC'], help: 'Server software type' },
  { key: 'MOTD', label: 'Message of the Day', type: 'text', placeholder: 'A Minecraft Server', help: 'Server description in multiplayer list' },
  { key: 'DIFFICULTY', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], help: 'Game difficulty' },
  { key: 'MODE', label: 'Game Mode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], help: 'Default game mode' },
  { key: 'LEVEL', label: 'World Name', type: 'text', placeholder: 'world', help: 'Name of the world save folder' },
  { key: 'SEED', label: 'World Seed', type: 'text', placeholder: '', help: 'Seed for world generation' },
  { key: 'MAX_PLAYERS', label: 'Max Players', type: 'number', placeholder: '20', min: '1', help: 'Maximum concurrent players' },
  { key: 'VIEW_DISTANCE', label: 'View Distance', type: 'number', placeholder: '10', min: '2', max: '32', help: 'Chunk render distance' },
  { key: 'ONLINE_MODE', label: 'Online Mode', type: 'select', options: ['true', 'false'], help: 'Verify players with Mojang servers' },
  { key: 'MEMORY', label: 'Memory (RAM)', type: 'text', placeholder: '1024M', help: 'JVM heap size (e.g. 2G, 1024M)' },
  { key: 'ENABLE_RCON', label: 'Enable RCON', type: 'select', options: ['true', 'false'], help: 'Required for graceful shutdown and panel console' },
  { key: 'RCON_PASSWORD', label: 'RCON Password', type: 'text', placeholder: 'changeme', help: 'Password for remote console' },
];

function getEnvFilePath(containerName) {
  return path.join(getGameRoot(), containerName, '.env');
}

function readEnvFile(containerName, envPath) {
  const filePath = envPath || getEnvFilePath(containerName);
  const params = {};

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        params[match[1].trim()] = match[2].trim();
      }
    }
  }

  return { env: params };
}

function validateEnvData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Config must be a non-null object');
    return { valid: false, errors };
  }

  if (data.env && typeof data.env !== 'object') {
    errors.push('env must be an object');
  }

  const serialized = JSON.stringify(data);
  if (serialized.length > 1024 * 1024) {
    errors.push('Config data exceeds maximum size of 1MB');
  }

  return { valid: errors.length === 0, errors };
}

function writeEnvFile(containerName, data, envPath) {
  const validation = validateEnvData(data);
  if (!validation.valid) {
    const err = new Error(`Invalid config: ${validation.errors.join(', ')}`);
    err.code = 'EINVAL';
    throw err;
  }

  const filePath = envPath || getEnvFilePath(containerName);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let merged = data.env || {};

  if (fs.existsSync(filePath)) {
    const existing = readEnvFile(containerName, filePath);
    merged = { ...existing.env, ...merged };
  }

  const lines = [];
  for (const [key, value] of Object.entries(merged)) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');

  return { env: merged };
}

module.exports = {
  MINECRAFT_ENV_FIELDS,
  getEnvFilePath,
  readEnvFile,
  writeEnvFile,
  validateEnvData,
};
