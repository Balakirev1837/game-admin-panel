const factorioConfig = require('../services/factorioConfig');
const logger = require('../services/logger');

const CONFIG_FIELDS = [
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

const QUICK_COMMANDS = [
  { label: 'Status', cmd: '/players', immediate: true, help: 'List connected players' },
  { label: 'Save', cmd: '/server-save', immediate: true, help: 'Save the server to disk' },
  { label: 'Kick...', cmd: '/kick ', help: '/kick <player> [reason]' },
  { label: 'Ban...', cmd: '/ban ', help: '/ban <player> [reason]' },
  { label: 'Unban...', cmd: '/unban ', help: '/unban <player>' },
  { label: 'Admins', cmd: '/admins', immediate: true, help: 'List admins' },
  { label: 'Promote...', cmd: '/promote ', help: '/promote <player>' },
  { label: 'Demote...', cmd: '/demote ', help: '/demote <player>' },
  { label: 'Time', cmd: '/time', immediate: true, help: 'Show game time' },
];

const GAME_DATA_TYPES = [
  { type: 'saves', label: 'Save Files', path: '/factorio/saves', format: 'dir' },
  { type: 'mods', label: 'Mods', path: '/factorio/mods', format: 'dir' },
  { type: 'adminlist', label: 'Admin List', path: '/factorio/config/server-adminlist.json', format: 'json' },
  { type: 'banlist', label: 'Ban List', path: '/factorio/config/server-banlist.json', format: 'json' },
];

function findEnvVar(info, key) {
  if (!info.Config || !info.Config.Env) return null;
  const entry = info.Config.Env.find(e => e.startsWith(key + '='));
  return entry ? entry.split('=').slice(1).join('=') : null;
}

function findRconHost(info) {
  const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
  const gameNet = networks['game-network'];
  if (gameNet && gameNet.IPAddress) return gameNet.IPAddress;
  return '127.0.0.1';
}

module.exports = {
  id: 'factorio',
  label: 'Factorio',
  badgeColor: 'bg-red-600',
  configFields: CONFIG_FIELDS,
  quickCommands: QUICK_COMMANDS,
  consoleType: 'rcon',
  gameDataTypes: GAME_DATA_TYPES,

  async readConfig(containerName, info) {
    const config = await factorioConfig.readConfig(containerName, info);
    return { config };
  },

  async writeConfig(containerName, data, info) {
    const written = await factorioConfig.writeConfig(containerName, data.config, info);
    return { config: written };
  },

  validateConfig(data) {
    return factorioConfig.validateConfigData(data.config || data);
  },

  async resolveRcon(info) {
    const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
    let rconHost = findRconHost(info);
    let rconPort = 27015;
    let foundPort = true;

    const rconPortEnv = findEnvVar(info, 'RCON_PORT');
    if (rconPortEnv) rconPort = parseInt(rconPortEnv, 10);

    for (const [containerPort, bindings] of Object.entries(ports)) {
      if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === rconPort) {
        rconHost = '127.0.0.1';
        rconPort = parseInt(bindings[0].HostPort, 10);
        break;
      }
    }

    let rconPassword = undefined;
    try {
      const { readFileFromContainer } = require('../services/containerFiles');
      const rconData = await readFileFromContainer(info.Id, '/factorio/config/rconpw');
      if (rconData) rconPassword = rconData.trim();
    } catch (err) {
      logger.warn({ err }, 'Factorio resolveRcon failed to read rconpw');
    }

    return { rconHost, rconPort, foundPort, rconPassword };
  },

  async resolveRest() {
    return null;
  },

  async getPlayers(info) {
    const { sendRconCommand } = require('../services/rconPool');
    const rcon = await this.resolveRcon(info);
    if (!rcon.foundPort) return [];
    try {
      const response = await sendRconCommand(rcon.rconHost, rcon.rconPort, rcon.rconPassword, '/players');
      const players = [];
      for (const line of response.split('\n')) {
        const match = line.match(/^\s*(.+?)\s+\(online\)$/);
        if (match) players.push({ name: match[1], online: true });
      }
      return players;
    } catch (err) {
      logger.warn({ err }, 'Factorio getPlayers failed');
      return [];
    }
  },
};
