const { readFileFromContainer, writeFileToContainer } = require('./containerFiles');

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

async function readConfig(containerNameOrId, info) {
  if (!info || !info.State || info.State.Running !== true) {
    return { json: {}, _stopped: true };
  }

  const containerId = info.Id || containerNameOrId;
  let settings = {};

  const settingsData = await readFileFromContainer(containerId, '/factorio/config/server-settings.json');
  if (settingsData) {
    try {
      settings = JSON.parse(settingsData);
    } catch {}
  }

  let rconPassword = '';
  const rconData = await readFileFromContainer(containerId, '/factorio/config/rconpw');
  if (rconData) {
    rconPassword = rconData.trim();
  }

  if (settings.visibility) {
    settings['visibility.public'] = settings.visibility.public;
    settings['visibility.lan'] = settings.visibility.lan;
    delete settings.visibility;
  }

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

async function writeConfig(containerNameOrId, data, info) {
  const validation = validateConfigData(data);
  if (!validation.valid) {
    const err = new Error(`Invalid config: ${validation.errors.join(', ')}`);
    err.code = 'EINVAL';
    throw err;
  }

  if (!info || !info.State || info.State.Running !== true) {
    throw new Error('Container must be running to write Factorio config');
  }

  const containerId = info.Id || containerNameOrId;

  let merged = data.json || {};

  const rconPassword = merged.rcon_password;
  delete merged.rcon_password;

  if (merged['visibility.public'] !== undefined || merged['visibility.lan'] !== undefined) {
    merged.visibility = {
      public: merged['visibility.public'] === 'true' || merged['visibility.public'] === true,
      lan: merged['visibility.lan'] === 'true' || merged['visibility.lan'] === true
    };
    delete merged['visibility.public'];
    delete merged['visibility.lan'];
  }

  const booleanFields = ['require_user_verification', 'auto_pause', 'non_blocking_saving'];
  for (const field of booleanFields) {
    if (merged[field] === 'true') merged[field] = true;
    if (merged[field] === 'false') merged[field] = false;
  }

  if (typeof merged.max_players === 'string') {
    merged.max_players = parseInt(merged.max_players, 10);
  }

  const existingData = await readFileFromContainer(containerId, '/factorio/config/server-settings.json');
  if (existingData) {
    try {
      const existing = JSON.parse(existingData);
      merged = { ...existing, ...merged };
    } catch {}
  }

  await writeFileToContainer(containerId, '/factorio/config/server-settings.json', JSON.stringify(merged, null, 2));

  if (rconPassword !== undefined) {
    await writeFileToContainer(containerId, '/factorio/config/rconpw', rconPassword);
  }

  return readConfig(containerNameOrId, info);
}

module.exports = {
  FACTORIO_CONFIG_FIELDS,
  readConfig,
  writeConfig,
  validateConfigData,
};
