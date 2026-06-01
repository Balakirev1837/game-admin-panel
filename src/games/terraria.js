const terrariaConfig = require('../services/terrariaConfig');

const CONFIG_FIELDS = [
  { key: 'ServerName', label: 'Server Name', type: 'text', placeholder: 'Terraria Server', help: 'Name of the server' },
  { key: 'ServerPassword', label: 'Server Password', type: 'text', placeholder: '', help: 'Password to join the server' },
  { key: 'ServerPort', label: 'Server Port', type: 'number', placeholder: '7777', help: 'Game server port' },
  { key: 'MaxSlots', label: 'Max Players', type: 'number', placeholder: '8', help: 'Maximum concurrent players' },
  { key: 'RestApiEnabled', label: 'Enable REST API', type: 'select', options: ['true', 'false'], help: 'Required for panel console' },
  { key: 'RestApiPort', label: 'REST API Port', type: 'number', placeholder: '7878', help: 'Port for REST API' },
  { key: 'ApplicationRestTokens', label: 'REST API Token', type: 'text', placeholder: '', help: 'Token for REST API access' },
];

const QUICK_COMMANDS = [
  { label: 'Status', cmd: 'playing', immediate: true, help: 'List connected players' },
  { label: 'Save', cmd: 'save', immediate: true, help: 'Save the server to disk' },
  { label: 'Kick...', cmd: 'kick ', help: 'kick <player> [reason]' },
  { label: 'Ban...', cmd: 'ban ', help: 'ban <player> [reason]' },
  { label: 'Broadcast...', cmd: 'broadcast ', help: 'broadcast <message>' },
  { label: 'Time', cmd: 'time', immediate: true, help: 'Show game time' },
  { label: 'Off', cmd: 'off', immediate: true, help: 'Gracefully stop the server' },
];

const GAME_DATA_TYPES = [
  { type: 'worlds', label: 'World Files', path: '/root/.local/share/Terraria/Worlds', format: 'dir' },
];

function findRconHost(info) {
  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) return gameNet.IPAddress;
  return '127.0.0.1';
}

module.exports = {
  id: 'terraria',
  label: 'Terraria',
  badgeColor: 'bg-green-600',
  configFields: CONFIG_FIELDS,
  quickCommands: QUICK_COMMANDS,
  consoleType: 'rest',
  gameDataTypes: GAME_DATA_TYPES,

  async readConfig(containerName, info) {
    const config = await terrariaConfig.readConfig(containerName, info);
    return { config };
  },

  async writeConfig(containerName, data, info) {
    const written = await terrariaConfig.writeConfig(containerName, data.config, info);
    return { config: written };
  },

  validateConfig(data) {
    return terrariaConfig.validateConfigData(data.config || data);
  },

  async resolveRcon() {
    return null;
  },

  async resolveRest(info) {
    const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
    let restHost = findRconHost(info);
    let restPort = 7878;
    let foundPort = true;

    let config = {};
    try {
      const { readFileFromContainer } = require('../services/containerFiles');
      const configPaths = ['/tshock/config.json', '/root/.local/share/Terraria/tshock/config.json'];
      for (const p of configPaths) {
        const data = await readFileFromContainer(info.Id, p);
        if (data) {
          try { config = JSON.parse(data); } catch {}
          break;
        }
      }
    } catch {}

    if (config.RestApiPort) restPort = config.RestApiPort;

    for (const [containerPort, bindings] of Object.entries(ports)) {
      if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === restPort) {
        restHost = '127.0.0.1';
        restPort = parseInt(bindings[0].HostPort, 10);
        break;
      }
    }

    let token = undefined;
    if (config.ApplicationRestTokens) {
      token = Array.isArray(config.ApplicationRestTokens)
        ? config.ApplicationRestTokens[0]
        : config.ApplicationRestTokens;
    }

    return { restHost, restPort, foundPort, token };
  },

  async getPlayers(info) {
    const rest = await this.resolveRest(info);
    if (!rest || !rest.token) return [];
    try {
      const http = require('http');
      const response = await new Promise((resolve, reject) => {
        http.get(`http://${rest.restHost}:${rest.restPort}/v3/players/list?token=${rest.token}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      if (!response.players) return [];
      return response.players.map(p => ({ name: p.nickname || p.name || p.username || String(p) }));
    } catch {
      return [];
    }
  },
};
