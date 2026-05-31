const fs = require('fs');
const path = require('path');

const DEFAULT_GAME_ROOT = '/host-games';

function getGameRoot() {
  return process.env.GAME_CONFIG_ROOT || DEFAULT_GAME_ROOT;
}

const CS2_ENV_FILEDS = [
  { key: 'SRCDS_TOKEN', label: 'Steam Game Server Token', type: 'text', placeholder: '', help: 'Required. Get one at steamcommunity.com/dev/managegameservers' },
  { key: 'CS2_SERVERNAME', label: 'Server Name', type: 'text', placeholder: 'My CS2 Server', help: 'Visible name in server browser' },
  { key: 'CS2_RCONPW', label: 'RCON Password', type: 'text', placeholder: 'dateniteroolz', help: 'Password for remote console access' },
  { key: 'CS2_PW', label: 'Server Password', type: 'text', placeholder: '', help: 'Password to join. Leave empty for no password.' },
  { key: 'CS2_MAXPLAYERS', label: 'Max Players', type: 'number', placeholder: '10', min: '1', max: '64', help: 'Maximum number of players' },
  { key: 'CS2_PORT', label: 'Server Port', type: 'number', placeholder: '27015', help: 'Game server listen port' },
  { key: 'CS2_LAN', label: 'LAN Mode', type: 'select', options: ['0', '1'], help: '0 = LAN disabled, 1 = LAN enabled' },
  { key: 'CS2_CHEATS', label: 'Cheats', type: 'select', options: ['0', '1'], help: '0 = disabled, 1 = enabled' },
  { key: 'CS2_SERVER_HIBERNATE', label: 'Server Hibernate', type: 'select', options: ['0', '1'], help: 'Low CPU when empty. May cause crashes.' },
  { key: 'CS2_GAMEALIAS', label: 'Game Mode Alias', type: 'select', options: ['', 'casual', 'competitive', 'deathmatch'], help: 'Predefined game type. Overrides GAMETYPE/GAMEMODE.' },
  { key: 'CS2_GAMETYPE', label: 'Game Type', type: 'number', placeholder: '0', help: 'Used if GAMEALIAS not set. See Valve wiki.' },
  { key: 'CS2_GAMEMODE', label: 'Game Mode', type: 'number', placeholder: '1', help: 'Used if GAMEALIAS not set. See Valve wiki.' },
  { key: 'CS2_MAPGROUP', label: 'Map Group', type: 'text', placeholder: 'mg_active', help: 'Map pool. Ignored if using workshop maps.' },
  { key: 'CS2_STARTMAP', label: 'Start Map', type: 'text', placeholder: 'de_inferno', help: 'Starting map. Ignored if using workshop maps.' },
  { key: 'CS2_BOT_DIFFICULTY', label: 'Bot Difficulty', type: 'select', options: ['', '0', '1', '2', '3'], help: '0=easy, 1=normal, 2=hard, 3=expert' },
  { key: 'CS2_BOT_QUOTA', label: 'Bot Quota', type: 'number', placeholder: '', help: 'Number of bots' },
  { key: 'CS2_BOT_QUOTA_MODE', label: 'Bot Quota Mode', type: 'select', options: ['', 'fill', 'competitive'], help: 'How bots are managed' },
  { key: 'TV_ENABLE', label: 'CSTV Enable', type: 'select', options: ['0', '1'], help: 'Enable SourceTV/CSTV broadcasting' },
  { key: 'TV_PORT', label: 'CSTV Port', type: 'number', placeholder: '27020', help: 'SourceTV/CSTV port' },
  { key: 'TV_AUTORECORD', label: 'CSTV Auto Record', type: 'select', options: ['0', '1'], help: 'Automatically record demos' },
  { key: 'TV_PW', label: 'CSTV Password', type: 'text', placeholder: 'changeme', help: 'Password for CSTV clients' },
  { key: 'TV_RELAY_PW', label: 'CSTV Relay Password', type: 'text', placeholder: 'changeme', help: 'Password for relay proxies' },
  { key: 'CS2_LOG', label: 'Logging', type: 'select', options: ['on', 'off'], help: 'Enable/disable logging' },
  { key: 'CS2_LOG_MONEY', label: 'Log Money', type: 'select', options: ['0', '1'], help: 'Log money events' },
  { key: 'CS2_LOG_DETAIL', label: 'Log Detail', type: 'select', options: ['0', '1', '2', '3'], help: '0=disabled, 1=enemy, 2=friendly, 3=all combat damage' },
  { key: 'CS2_LOG_ITEMS', label: 'Log Items', type: 'select', options: ['0', '1'], help: 'Log item events' },
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

  const result = { env: params };
  return result;
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
  CS2_ENV_FILEDS,
  getEnvFilePath,
  readEnvFile,
  writeEnvFile,
  validateEnvData,
};
