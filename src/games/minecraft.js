const minecraftConfig = require('../services/minecraftConfig');
const logger = require('../services/logger');

const CONFIG_FIELDS = [
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

const QUICK_COMMANDS = [
  { label: 'Status', cmd: 'list', immediate: true, help: 'List connected players' },
  { label: 'Save All', cmd: 'save-all', immediate: true, help: 'Save the server to disk' },
  { label: 'Kick...', cmd: 'kick ', help: 'kick <player> [reason]' },
  { label: 'Ban...', cmd: 'ban ', help: 'ban <player> [reason]' },
  { label: 'Pardon...', cmd: 'pardon ', help: 'pardon <player>' },
  { label: 'Op...', cmd: 'op ', help: 'op <player>' },
  { label: 'Deop...', cmd: 'deop ', help: 'deop <player>' },
  { label: 'Whitelist Add...', cmd: 'whitelist add ', help: 'whitelist add <player>' },
  { label: 'Whitelist Remove...', cmd: 'whitelist remove ', help: 'whitelist remove <player>' },
  { label: 'Stop', cmd: 'stop', immediate: true, help: 'Gracefully stop the server' },
];

const GAME_DATA_TYPES = [
  { type: 'whitelist', label: 'Whitelist', path: '/data/whitelist.json', format: 'json' },
  { type: 'ops', label: 'OPs', path: '/data/ops.json', format: 'json' },
  { type: 'banned-players', label: 'Banned Players', path: '/data/banned-players.json', format: 'json' },
  { type: 'server-properties', label: 'server.properties', path: '/data/server.properties', format: 'properties' },
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
  id: 'minecraft',
  label: 'Minecraft',
  badgeColor: 'bg-emerald-600',
  configFields: CONFIG_FIELDS,
  quickCommands: QUICK_COMMANDS,
  consoleType: 'rcon',
  gameDataTypes: GAME_DATA_TYPES,

  async readConfig(containerName, info, composeDir) {
    const envPath = composeDir ? require('path').join(composeDir, '.env') : undefined;
    const config = minecraftConfig.readEnvFile(containerName, envPath);
    return { config };
  },

  async writeConfig(containerName, data, info, composeDir) {
    const envPath = composeDir ? require('path').join(composeDir, '.env') : undefined;
    const written = minecraftConfig.writeEnvFile(containerName, data.config, envPath);
    return { config: written };
  },

  validateConfig(data) {
    return minecraftConfig.validateEnvData(data.config || data);
  },

  async resolveRcon(info) {
    const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
    let rconHost = findRconHost(info);
    let rconPort = 25575;
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

    const rconPassword = findEnvVar(info, 'RCON_PASSWORD') || undefined;
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
      const response = await sendRconCommand(rcon.rconHost, rcon.rconPort, rcon.rconPassword, 'list');
      const match = response.match(/There are (\d+) of a max of (\d+) players online(?::\s*(.+))?/);
      if (!match) return [];
      const names = match[3] ? match[3].split(', ').map(n => n.trim()).filter(Boolean) : [];
      return names.map(name => ({ name }));
    } catch (err) {
      logger.warn({ err }, 'Minecraft getPlayers failed');
      return [];
    }
  },
};
