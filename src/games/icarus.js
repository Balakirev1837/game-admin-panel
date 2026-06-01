const icarusConfig = require('../services/icarusConfig');

const CONFIG_FIELDS = [
  { key: 'SessionName', label: 'Server Name', type: 'text', section: null, placeholder: 'ICARUS Server',
    help: 'Shown in the server browser. (deprecated — use SteamServerName instead)' },
  { key: 'JoinPassword', label: 'Join Password', type: 'text', section: null, placeholder: '',
    help: 'Password required to join. Leave empty for no password.' },
  { key: 'MaxPlayers', label: 'Max Players', type: 'number', section: null, placeholder: '8', min: '1', max: '8',
    help: 'Maximum players on the server (1-8).' },
  { key: 'AdminPassword', label: 'Admin Password', type: 'text', section: null, placeholder: '',
    help: 'Password for admin RCON commands. Empty = no password needed for admin.' },
  { key: 'ResumeProspect', label: 'Resume Last Prospect', type: 'select', section: null, options: ['True', 'False'],
    help: 'Automatically resume the last prospect on startup.' },
  { key: 'LastProspectName', label: 'Last Prospect Name', type: 'text', section: null, placeholder: '',
    help: 'The last prospect that was run. Used by ResumeProspect.' },
  { key: 'LoadProspect', label: 'Load Prospect On Startup', type: 'text', section: null, placeholder: '',
    help: 'Prospect name to load on startup (without .json). Empty = wait in lobby.' },
  { key: 'CreateProspect', label: 'Create Prospect On Startup', type: 'text', section: null, placeholder: '',
    help: 'ProspectType Difficulty Hardcore SaveName. e.g. Tier1_Forest_Recon_0 3 false TestProspect01' },
  { key: 'ShutdownIfNotJoinedFor', label: 'Shutdown If Not Joined (sec)', type: 'number', section: null, placeholder: '300', min: '-1',
    help: 'Shutdown if nobody joins within N seconds. -1 = never, 0 = immediately.' },
  { key: 'ShutdownIfEmptyFor', label: 'Shutdown If Empty (sec)', type: 'number', section: null, placeholder: '300', min: '-1',
    help: 'Shutdown after server becomes empty for N seconds. -1 = never, 0 = immediately.' },
  { key: 'AllowNonAdminsToLaunchProspects', label: 'Non-Admins Can Launch', type: 'select', section: null, options: ['True', 'False'],
    help: 'Allow non-admin players to create or load prospects from the lobby.' },
  { key: 'AllowNonAdminsToDeleteProspects', label: 'Non-Admins Can Delete', type: 'select', section: null, options: ['True', 'False'],
    help: 'Allow non-admin players to delete prospects from the server.' },
];

const QUICK_COMMANDS = [
  { label: 'Admin Login...', cmd: 'AdminLogin ', help: 'Gain admin privileges' },
  { label: 'Resume Prospect', cmd: 'ResumeProspect', immediate: true, help: 'Resume the last prospect' },
  { label: 'Load Prospect...', cmd: 'LoadProspect ', help: 'Load prospect by name' },
  { label: 'Create Prospect', cmd: '__MODAL__', immediate: true, modal: 'prospect', help: 'Open prospect creation form' },
  { label: 'Kick Player...', cmd: 'KickPlayer ', help: 'KickPlayer SteamId Reason' },
  { label: 'Ban Player...', cmd: 'BanPlayer ', help: 'BanPlayer SteamId Reason' },
  { label: 'Unban Player...', cmd: 'UnbanPlayer ', help: 'UnbanPlayer SteamId' },
  { label: 'Return to Lobby', cmd: 'ReturnToLobby', immediate: true, help: 'Kick all players, return to lobby' },
  { label: 'Lobby When Empty', cmd: 'ReturnToLobbyWhenEmpty', immediate: true, help: 'Return to lobby as soon as server is empty' },
  { label: 'Admin Say...', cmd: 'AdminSay ', help: 'Broadcast message to all players' },
];

module.exports = {
  id: 'icarus',
  label: 'Icarus',
  badgeColor: 'bg-blue-600',
  configFields: CONFIG_FIELDS,
  quickCommands: QUICK_COMMANDS,
  consoleType: 'rcon',
  gameDataTypes: [],

  async readConfig(containerName, info) {
    const config = icarusConfig.readConfig(containerName);
    const launchParams = icarusConfig.readLaunchParams(containerName);
    return { config, launchParams };
  },

  async writeConfig(containerName, data, info) {
    const written = icarusConfig.writeConfig(containerName, data.config);
    let updatedLaunchParams = null;
    if (data.launchParams) {
      updatedLaunchParams = icarusConfig.writeLaunchParams(containerName, data.launchParams);
    }
    return { config: written, launchParams: updatedLaunchParams };
  },

  validateConfig(data) {
    return icarusConfig.validateConfig(data.config || data);
  },

  async resolveRcon(info) {
    const ports = (info.NetworkSettings && info.NetworkSettings.Ports) || {};
    const DEFAULT_RCON_PORT = 25575;
    let rconHost = '127.0.0.1';
    let rconPort = null;
    let foundPort = false;

    const networks = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
    const gameNet = networks['game-network'];
    if (gameNet && gameNet.IPAddress) {
      rconHost = gameNet.IPAddress;
    }

    if (ports && Object.keys(ports).length > 0) {
      const rconPortKey = `${DEFAULT_RCON_PORT}/tcp`;
      if (ports[rconPortKey] && ports[rconPortKey].length > 0) {
        rconPort = parseInt(ports[rconPortKey][0].HostPort, 10);
        foundPort = true;
      }
      if (!foundPort) {
        for (const [containerPort, bindings] of Object.entries(ports)) {
          if (bindings && bindings.length > 0) {
            const privatePort = parseInt(containerPort.split('/')[0], 10);
            if (privatePort === DEFAULT_RCON_PORT || privatePort === 17777) {
              rconPort = privatePort;
              foundPort = true;
              break;
            }
          }
        }
      }
    }

    if (!foundPort) {
      const env = info.Config && info.Config.Env || [];
      const entry = env.find(e => e.startsWith('SERVER_PORT='));
      if (entry) {
        rconPort = parseInt(entry.split('=').slice(1).join('='), 10);
        foundPort = true;
      }
    }

    const env = info.Config && info.Config.Env || [];
    const rconPw = env.find(e => e.startsWith('ICARUS_RCON_PASSWORD='));
    const password = rconPw ? rconPw.split('=').slice(1).join('=') : undefined;

    return { rconHost, rconPort, foundPort, rconPassword: password };
  },

  async resolveRest() {
    return null;
  },

  async getPlayers(info) {
    return [];
  },
};
