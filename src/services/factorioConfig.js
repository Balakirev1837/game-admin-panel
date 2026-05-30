const fs = require('fs');
const path = require('path');

const DEFAULT_GAME_ROOT = '/host-games';

function getGameRoot() {
  return process.env.GAME_CONFIG_ROOT || DEFAULT_GAME_ROOT;
}

const FACTORIO_CONFIG_FIELDS = [
  { key: 'name', label: 'Server Name', type: 'text', placeholder: 'Factorio Server', help: 'Name of the server' },
  { key: 'description', label: 'Description', type: 'text', placeholder: '', help: 'Server description' },
  { key: 'max_players', label: 'Max Players', type: 'number', placeholder: '0', help: '0 means unlimited' },
  { key: 'game_password', label: 'Game Password', type: 'text', placeholder: '', help: 'Password to join the server' },
  { key: 'require_user_verification', label: 'Verify Users', type: 'select', options: ['true', 'false'], help: 'Verify players with Factorio.com' },
  { key: 'visibility.public', label: 'Public Visibility', type: 'select', options: ['true', 'false'], help: 'Show in public server browser' },
  { key: 'visibility.lan', label: 'LAN Visibility', type: 'select', options: ['true', 'false'], help: 'Show in LAN server browser' },
  { key: 'auto_pause', label: 'Auto Pause', type: 'select', options: ['true', 'false'], help: 'Pause game when no players are connected' },
  { key: 'non_blocking_saving', label: 'Non-blocking Saving', type: 'select', options: ['true', 'false'], help: 'Save in background (Linux only)' },
  { key: 'rcon_password', label: 'RCON Password', type: 'text', placeholder: '', help: 'Password for remote console (saved to rconpw file)' },
];

function getConfigDirPath(containerName) {
  return path.join(getGameRoot(), containerName, 'config');
}

function readConfig(containerName) {
  const dir = getConfigDirPath(containerName);
  const settingsPath = path.join(dir, 'server-settings.json');
  const rconPath = path.join(dir, 'rconpw');
  
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (err) {
      console.error(`Failed to parse Factorio config for ${containerName}:`, err.message);
    }
  }

  let rconPassword = '';
  if (fs.existsSync(rconPath)) {
    rconPassword = fs.readFileSync(rconPath, 'utf-8').trim();
  }

  // Flatten visibility for the UI
  if (settings.visibility) {
    settings['visibility.public'] = settings.visibility.public;
    settings['visibility.lan'] = settings.visibility.lan;
    delete settings.visibility;
  }

  // Add rcon password to the config object for the UI
  settings.rcon_password = rconPassword;

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

  const dir = getConfigDirPath(containerName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const settingsPath = path.join(dir, 'server-settings.json');
  const rconPath = path.join(dir, 'rconpw');

  let merged = data.json || {};

  // Extract rcon password
  const rconPassword = merged.rcon_password;
  delete merged.rcon_password;

  // Unflatten visibility
  if (merged['visibility.public'] !== undefined || merged['visibility.lan'] !== undefined) {
    merged.visibility = {
      public: merged['visibility.public'] === 'true' || merged['visibility.public'] === true,
      lan: merged['visibility.lan'] === 'true' || merged['visibility.lan'] === true
    };
    delete merged['visibility.public'];
    delete merged['visibility.lan'];
  }

  // Convert boolean strings to actual booleans for JSON
  const booleanFields = ['require_user_verification', 'auto_pause', 'non_blocking_saving'];
  for (const field of booleanFields) {
    if (merged[field] === 'true') merged[field] = true;
    if (merged[field] === 'false') merged[field] = false;
  }

  // Convert number strings to actual numbers
  if (typeof merged.max_players === 'string') {
    merged.max_players = parseInt(merged.max_players, 10);
  }

  if (fs.existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      merged = { ...existing, ...merged };
    } catch (err) {
      // Ignore parse errors on existing file, just overwrite
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');

  if (rconPassword !== undefined) {
    fs.writeFileSync(rconPath, rconPassword, 'utf-8');
  }

  // Re-read to return the flattened format expected by the UI
  return readConfig(containerName);
}

module.exports = {
  FACTORIO_CONFIG_FIELDS,
  readConfig,
  writeConfig,
  validateConfigData,
};
