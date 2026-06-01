const cs2Config = require('../services/cs2Config');

const CONFIG_FIELDS = [
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
  { key: 'CS2_GAMETYPE', label: 'Game Type', type: 'number', placeholder: '0', help: 'Used if GAMEALIAS not set' },
  { key: 'CS2_GAMEMODE', label: 'Game Mode', type: 'number', placeholder: '1', help: 'Used if GAMEALIAS not set' },
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
  { key: 'CS2_LOG_DETAIL', label: 'Log Detail', type: 'select', options: ['0', '1', '2', '3'], help: '0=disabled, 1=enemy, 2=friendly, 3=all' },
  { key: 'CS2_LOG_ITEMS', label: 'Log Items', type: 'select', options: ['0', '1'], help: 'Log item events' },
];

const QUICK_COMMANDS = [
  { label: 'Status', cmd: 'status', immediate: true, help: 'Show server status and player list' },
  { label: 'Change Map...', cmd: 'changelevel ', help: 'changelevel <mapname>' },
  { label: 'Kick...', cmd: 'kick ', help: 'kick <player>' },
  { label: 'Ban...', cmd: 'banid 0 ', help: 'banid 0 <steamid>' },
  { label: 'Add Bot', cmd: 'bot_add', immediate: true, help: 'Add a bot' },
  { label: 'Kick All Bots', cmd: 'bot_kick', immediate: true, help: 'Remove all bots' },
  { label: 'Max Rounds...', cmd: 'mp_maxrounds ', help: 'Set max rounds' },
  { label: 'Round Time...', cmd: 'mp_roundtime ', help: 'Set round time in minutes' },
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
  id: 'cs2',
  label: 'CS2',
  badgeColor: 'bg-orange-600',
  configFields: CONFIG_FIELDS,
  quickCommands: QUICK_COMMANDS,
  consoleType: 'rcon',
  gameDataTypes: [],

  async readConfig(containerName, info, composeDir) {
    const envPath = composeDir ? require('path').join(composeDir, '.env') : undefined;
    const config = cs2Config.readEnvFile(containerName, envPath);
    return { config };
  },

  async writeConfig(containerName, data, info, composeDir) {
    const envPath = composeDir ? require('path').join(composeDir, '.env') : undefined;
    const written = cs2Config.writeEnvFile(containerName, data.config, envPath);
    return { config: written };
  },

  validateConfig(data) {
    return cs2Config.validateEnvData(data.config || data);
  },

  async resolveRcon(info) {
    const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
    let rconHost = findRconHost(info);
    let rconPort = 27015;
    let foundPort = true;

    const cs2Port = findEnvVar(info, 'CS2_PORT');
    if (cs2Port) rconPort = parseInt(cs2Port, 10);

    const rconPortEnv = findEnvVar(info, 'CS2_RCON_PORT');
    if (rconPortEnv) rconPort = parseInt(rconPortEnv, 10);

    for (const [containerPort, bindings] of Object.entries(ports)) {
      if (bindings && bindings.length > 0 && parseInt(containerPort.split('/')[0], 10) === rconPort) {
        rconHost = '127.0.0.1';
        rconPort = parseInt(bindings[0].HostPort, 10);
        break;
      }
    }

    const rconPassword = findEnvVar(info, 'CS2_RCONPW') || undefined;
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
      const response = await sendRconCommand(rcon.rconHost, rcon.rconPort, rcon.rconPassword, 'status');
      const players = [];
      for (const line of response.split('\n')) {
        const match = line.match(/^#\s*\d+\s+"(.+?)"\s+(\[U:\S+?\])\s+\S+\s+(\d+)/);
        if (match) {
          players.push({ name: match[1], steamid: match[2], ping: parseInt(match[3], 10) || 0 });
        }
      }
      return players;
    } catch {
      return [];
    }
  },
};
