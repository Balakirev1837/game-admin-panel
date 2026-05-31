const { readFileFromContainer, writeFileToContainer } = require('./containerFiles');

const TERRARIA_CONFIG_FIELDS = [
  { key: 'ServerName', label: 'Server Name', type: 'text', placeholder: 'Terraria Server', help: 'Name of the server' },
  { key: 'ServerPassword', label: 'Server Password', type: 'text', placeholder: '', help: 'Password to join the server' },
  { key: 'ServerPort', label: 'Server Port', type: 'number', placeholder: '7777', help: 'Game server port' },
  { key: 'MaxSlots', label: 'Max Players', type: 'number', placeholder: '8', help: 'Maximum concurrent players' },
  { key: 'RestApiEnabled', label: 'Enable REST API', type: 'select', options: ['true', 'false'], help: 'Required for panel console' },
  { key: 'RestApiPort', label: 'REST API Port', type: 'number', placeholder: '7878', help: 'Port for REST API' },
  { key: 'ApplicationRestTokens', label: 'REST API Token', type: 'text', placeholder: '', help: 'Token for REST API access' },
];

const CONFIG_PATHS = [
  '/tshock/config.json',
  '/root/.local/share/Terraria/tshock/config.json',
  '/root/.local/share/Terraria/Worlds/tshock/config.json',
];

async function findConfigPath(containerId) {
  for (const p of CONFIG_PATHS) {
    const data = await readFileFromContainer(containerId, p);
    if (data !== null) return { path: p, data };
  }
  return { path: CONFIG_PATHS[0], data: null };
}

async function readConfig(containerNameOrId, info) {
  if (!info || !info.State || info.State.Running !== true) {
    return { json: {}, _stopped: true };
  }

  const containerId = info.Id || containerNameOrId;
  let settings = {};

  const { data } = await findConfigPath(containerId);
  if (data) {
    try {
      settings = JSON.parse(data);
    } catch {}
  }

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

async function writeConfig(containerNameOrId, data, info) {
  const validation = validateConfigData(data);
  if (!validation.valid) {
    const err = new Error(`Invalid config: ${validation.errors.join(', ')}`);
    err.code = 'EINVAL';
    throw err;
  }

  if (!info || !info.State || info.State.Running !== true) {
    throw new Error('Container must be running to write Terraria config');
  }

  const containerId = info.Id || containerNameOrId;
  let merged = data.json || {};

  if (merged.ApplicationRestTokens !== undefined) {
    if (merged.ApplicationRestTokens.trim() === '') {
      merged.ApplicationRestTokens = [];
    } else {
      merged.ApplicationRestTokens = [merged.ApplicationRestTokens.trim()];
    }
  }

  const booleanFields = ['RestApiEnabled'];
  for (const field of booleanFields) {
    if (merged[field] === 'true') merged[field] = true;
    if (merged[field] === 'false') merged[field] = false;
  }

  const numberFields = ['ServerPort', 'MaxSlots', 'RestApiPort'];
  for (const field of numberFields) {
    if (typeof merged[field] === 'string') {
      merged[field] = parseInt(merged[field], 10);
    }
  }

  const { path: configPath, data: existingRaw } = await findConfigPath(containerId);
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      merged = { ...existing, ...merged };
    } catch {}
  }

  await writeFileToContainer(containerId, configPath, JSON.stringify(merged, null, 2));

  return readConfig(containerNameOrId, info);
}

module.exports = {
  TERRARIA_CONFIG_FIELDS,
  readConfig,
  writeConfig,
  validateConfigData,
};
