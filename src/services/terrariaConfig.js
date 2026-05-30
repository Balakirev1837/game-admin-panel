const fs = require('fs');
const path = require('path');

const DEFAULT_GAME_ROOT = '/host-games';

function getGameRoot() {
  return process.env.GAME_CONFIG_ROOT || DEFAULT_GAME_ROOT;
}

const TERRARIA_CONFIG_FIELDS = [
  { key: 'ServerName', label: 'Server Name', type: 'text', placeholder: 'Terraria Server', help: 'Name of the server' },
  { key: 'ServerPassword', label: 'Server Password', type: 'text', placeholder: '', help: 'Password to join the server' },
  { key: 'ServerPort', label: 'Server Port', type: 'number', placeholder: '7777', help: 'Game server port' },
  { key: 'MaxSlots', label: 'Max Players', type: 'number', placeholder: '8', help: 'Maximum concurrent players' },
  { key: 'RestApiEnabled', label: 'Enable REST API', type: 'select', options: ['true', 'false'], help: 'Required for panel console' },
  { key: 'RestApiPort', label: 'REST API Port', type: 'number', placeholder: '7878', help: 'Port for REST API' },
  { key: 'ApplicationRestTokens', label: 'REST API Token', type: 'text', placeholder: '', help: 'Token for REST API access' },
];

function getConfigFilePath(containerName) {
  return path.join(getGameRoot(), containerName, 'tshock', 'config.json');
}

function readConfig(containerName) {
  const filePath = getConfigFilePath(containerName);
  
  let settings = {};
  if (fs.existsSync(filePath)) {
    try {
      settings = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`Failed to parse Terraria config for ${containerName}:`, err.message);
    }
  }

  // Extract the first REST token for the UI
  if (settings.ApplicationRestTokens && Array.isArray(settings.ApplicationRestTokens) && settings.ApplicationRestTokens.length > 0) {
    settings.ApplicationRestTokens = settings.ApplicationRestTokens[0];
  } else {
    settings.ApplicationRestTokens = '';
  }

  return { json: settings };
}

function validateConfigData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Config must be a non-null object');
    return { valid: false, errors };
  }

  if (data.json && typeof data.json !== 'object') {
    errors.push('json must be an object');
  }

  const serialized = JSON.stringify(data);
  if (serialized.length > 1024 * 1024) {
    errors.push('Config data exceeds maximum size of 1MB');
  }

  return { valid: errors.length === 0, errors };
}

function writeConfig(containerName, data) {
  const validation = validateConfigData(data);
  if (!validation.valid) {
    const err = new Error(`Invalid config: ${validation.errors.join(', ')}`);
    err.code = 'EINVAL';
    throw err;
  }

  const filePath = getConfigFilePath(containerName);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let merged = data.json || {};

  // Handle REST token array
  if (merged.ApplicationRestTokens !== undefined) {
    if (merged.ApplicationRestTokens.trim() === '') {
      merged.ApplicationRestTokens = [];
    } else {
      merged.ApplicationRestTokens = [merged.ApplicationRestTokens.trim()];
    }
  }

  // Convert boolean strings to actual booleans for JSON
  const booleanFields = ['RestApiEnabled'];
  for (const field of booleanFields) {
    if (merged[field] === 'true') merged[field] = true;
    if (merged[field] === 'false') merged[field] = false;
  }

  // Convert number strings to actual numbers
  const numberFields = ['ServerPort', 'MaxSlots', 'RestApiPort'];
  for (const field of numberFields) {
    if (typeof merged[field] === 'string') {
      merged[field] = parseInt(merged[field], 10);
    }
  }

  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      merged = { ...existing, ...merged };
    } catch (err) {
      // Ignore parse errors on existing file, just overwrite
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');

  return readConfig(containerName);
}

module.exports = {
  TERRARIA_CONFIG_FIELDS,
  readConfig,
  writeConfig,
  validateConfigData,
};
