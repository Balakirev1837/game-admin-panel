const API_BASE = '/api/containers';
const serverList = document.getElementById('server-list');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyEl = document.getElementById('empty');
const toastContainer = document.getElementById('toast-container');
const configModal = document.getElementById('config-modal');
const configModalTitle = document.getElementById('config-modal-title');
const configModalBody = document.getElementById('config-modal-body');
const configModalClose = document.getElementById('config-modal-close');
const configModalBackdrop = document.getElementById('config-modal-backdrop');
const configModalCancel = document.getElementById('config-modal-cancel');
const configModalSave = document.getElementById('config-modal-save');

// --- Icarus Prospect Type data ---
// From https://github.com/RocketWerkz/IcarusDedicatedServer/wiki/Prospect-Names
const PROSPECT_TYPES = [
  { key: 'Tier1_Forest_Recon_0', name: 'BEACHHEAD: Recon (T1 Forest)' },
  { key: 'Tier1_Forest_Exploration_0', name: 'ARGOS: Exploration (T1 Forest)' },
  { key: 'Tier1_Forest_Extermination_0', name: 'KILL LIST: Extermination (T1 Forest)' },
  { key: 'Tier1_Forest_Construction', name: 'HOMESTEAD: Construction (T1 Forest)' },
  { key: 'Tier1_Forest_Scan_0', name: 'LIVEWIRE: Terrain Scan (T1 Forest)' },
  { key: 'Tier1_Forest_Research_0', name: 'STRANGE HARVEST: Bio-Research (T1 Forest)' },
  { key: 'Tier1_Forest_Survey_0', name: 'HEADSTONE: Geo-Survey (T1 Forest)' },
  { key: 'Tier1_Forest_Stockpile', name: 'AGRICULTURE: Supply Stockpile (T1 Forest)' },
  { key: 'Tier1_Forest_Range', name: 'POTSHOT: Training (T1 Forest)' },
  { key: 'Tier1_Forest_Defence', name: 'FORSAKEN: Recovery (T1 Forest)' },
  { key: 'Tier1_Forest_WS_Stockpile', name: 'SPELUNKING: Assisted Stockpile (T1 Forest)' },
  { key: 'Tier2_Canyon_Expedition_0', name: 'DRY RUN: Expedition (T2 Canyon)' },
  { key: 'Tier2_Canyon_Exploration_0', name: 'SANDBLAST: Exploration (T2 Canyon)' },
  { key: 'Tier2_Canyon_Scan_0', name: 'DEATH RAY: Scan (T2 Canyon)' },
  { key: 'Tier2_Canyon_Research_0', name: 'BIOSHOCK: Bio-Research (T2 Canyon)' },
  { key: 'Tier2_Canyon_Construction_0', name: 'PYRAMID: Construction (T2 Canyon)' },
  { key: 'Tier3_RiverLands_Exploration_0', name: 'EDELWEISS: Exploration (T3 River Lands)' },
  { key: 'Tier3_RiverLands_Extermination_0', name: 'WET WORK: Extermination (T3 River Lands)' },
  { key: 'Tier3_RiverLands_Expedition_0', name: 'WATERFALL: Expedition (T3 River Lands)' },
  { key: 'Tier3_RiverLands_Extraction', name: 'MERIDIAN: Extraction (T3 River Lands)' },
  { key: 'Tier3_RiverLands_Research_0', name: 'UPLIFT: Bio-Research (T3 River Lands)' },
  { key: 'Tier4_Desert_Exploration_0', name: 'PROMISED LAND: Exploration (T4 Desert)' },
  { key: 'Tier4_Desert_Extermination_0', name: 'DUST UP: Extermination (T4 Desert)' },
  { key: 'Tier4_Desert_Construction_0', name: 'SANDBOX: Construction (T4 Desert)' },
  { key: 'Tier4_Arctic_Exploration_0', name: 'TUNDRA: Exploration (T4 Arctic)' },
  { key: 'Tier4_Arctic_Extraction_0', name: 'PAYDAY: Extraction (T4 Arctic)' },
  { key: 'OpenWorld_Styx', name: 'Styx (Open World)' },
  { key: 'Outpost002_Forest', name: 'ARCWOOD: Outpost' },
  { key: 'Outpost003_Arctic', name: 'ICEHOLM: Outpost' },
  { key: 'Outpost005_Forest', name: 'HOLDFAST: Outpost' },
  { key: 'Outpost006_Olympus', name: 'Olympus' },
  { key: 'STYX_A_Exploration', name: 'HEADLONG: Exploration (Styx)' },
  { key: 'STYX_A_Expedition', name: 'OMPHALOS: Expedition (Styx)' },
];

// --- Known Icarus config field definitions ---
// Matches ServerSettings.ini documented at:
// https://github.com/RocketWerkz/IcarusDedicatedServer/wiki/Server-Config-&-Launch-Parameters
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

const CS2_CONFIG_FIELDS = [
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

const MINECRAFT_CONFIG_FIELDS = [
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

const TERRARIA_CONFIG_FIELDS = [
  { key: 'ServerName', label: 'Server Name', type: 'text', placeholder: 'Terraria Server', help: 'Name of the server' },
  { key: 'ServerPassword', label: 'Server Password', type: 'text', placeholder: '', help: 'Password to join the server' },
  { key: 'ServerPort', label: 'Server Port', type: 'number', placeholder: '7777', help: 'Game server port' },
  { key: 'MaxSlots', label: 'Max Players', type: 'number', placeholder: '8', help: 'Maximum concurrent players' },
  { key: 'RestApiEnabled', label: 'Enable REST API', type: 'select', options: ['true', 'false'], help: 'Required for panel console' },
  { key: 'RestApiPort', label: 'REST API Port', type: 'number', placeholder: '7878', help: 'Port for REST API' },
  { key: 'ApplicationRestTokens', label: 'REST API Token', type: 'text', placeholder: '', help: 'Token for REST API access' },
];

const CS2_RCON_QUICK_COMMANDS = [
  { label: 'Status', cmd: 'status', immediate: true, help: 'Show server status and player list' },
  { label: 'Change Map...', cmd: 'changelevel ', help: 'changelevel <mapname>' },
  { label: 'Kick...', cmd: 'kick ', help: 'kick <player>' },
  { label: 'Ban...', cmd: 'banid 0 ', help: 'banid 0 <steamid>' },
  { label: 'Add Bot', cmd: 'bot_add', immediate: true, help: 'Add a bot' },
  { label: 'Kick All Bots', cmd: 'bot_kick', immediate: true, help: 'Remove all bots' },
  { label: 'Max Rounds...', cmd: 'mp_maxrounds ', help: 'Set max rounds' },
  { label: 'Round Time...', cmd: 'mp_roundtime ', help: 'Set round time in minutes' },
];

const ICARUS_RCON_QUICK_COMMANDS = [
  { label: 'Admin Login...', cmd: 'AdminLogin ', help: 'Gain admin privileges' },
  { label: 'Resume Prospect', cmd: 'ResumeProspect', immediate: true, help: 'Resume the last prospect' },
  { label: 'Load Prospect...', cmd: 'LoadProspect ', help: 'Load prospect by name' },
  { label: 'Create Prospect', cmd: '__MODAL__', immediate: true, modal: 'prospect', help: 'Open prospect creation form' },
  { label: 'Kick Player...', cmd: 'KickPlayer ', help: 'KickPlayer SteamId Reason' },
  { label: 'Ban Player...', cmd: 'BanPlayer ', help: 'BanPlayer SteamId Reason' },
  { label: 'Unban Player...', cmd: 'UnbanPlayer ', help: 'UnbanPlayer SteamId' },
  { label: 'Return to Lobby', cmd: 'ReturnToLobby', immediate: true, help: 'Kick all players, return to lobby' },
  { label: 'Lobby When Empty', cmd: 'ReturnToLobbyWhenEmpty', immediate: true, help: 'Return to lobby as soon as server is empty' },
  { label: 'Admin Say...', cmd: 'AdminSay ', help: 'Broadcast message to all players' }
];

const MINECRAFT_RCON_QUICK_COMMANDS = [
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

const FACTORIO_RCON_QUICK_COMMANDS = [
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

const TERRARIA_REST_QUICK_COMMANDS = [
  { label: 'Status', cmd: 'playing', immediate: true, help: 'List connected players' },
  { label: 'Save', cmd: 'save', immediate: true, help: 'Save the server to disk' },
  { label: 'Kick...', cmd: 'kick ', help: 'kick <player> [reason]' },
  { label: 'Ban...', cmd: 'ban ', help: 'ban <player> [reason]' },
  { label: 'Broadcast...', cmd: 'broadcast ', help: 'broadcast <message>' },
  { label: 'Time', cmd: 'time', immediate: true, help: 'Show game time' },
  { label: 'Off', cmd: 'off', immediate: true, help: 'Gracefully stop the server' },
];

// Track the current container being edited
let currentEditContainer = null;
let currentEditGame = null;
// Store the raw config/launchParams from the API so we can preserve sections not shown in the form
let currentEditConfig = null;
let currentEditLaunchParams = null;

// Per-container RCON session state
const rconSessions = {};

function getRconSession(containerId) {
  if (!rconSessions[containerId]) {
    rconSessions[containerId] = {
      open: false,
      history: [],
      historyIndex: -1,
      loading: false,
    };
  }
  return rconSessions[containerId];
}

function appendRconOutput(outputEl, text, type) {
  const line = document.createElement('div');
  line.className = 'text-xs font-mono whitespace-pre-wrap break-all';
  if (type === 'error') {
    line.classList.add('text-red-400');
  } else if (type === 'command') {
    line.classList.add('text-cyan-400');
  } else {
    line.classList.add('text-gray-300');
  }
  line.textContent = text;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

async function sendRconCommand(containerId, command, outputEl, session) {
  if (!command.trim()) return;

  // Record in history
  session.history.push(command);
  session.historyIndex = session.history.length;

  appendRconOutput(outputEl, `> ${command}`, 'command');

  session.loading = true;
  const panel = outputEl.closest('.rcon-panel');
  const sendBtn = panel.querySelector('.rcon-send-btn');
  const input = panel.querySelector('.rcon-input');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
  }

  try {
    const res = await fetch(`${API_BASE}/${containerId}/rcon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      appendRconOutput(outputEl, data.response || '(empty response)', 'response');
    } else {
      const errMsg = data.message || `Error ${res.status}`;
      appendRconOutput(outputEl, `Error: ${errMsg}`, 'error');
    }
  } catch (err) {
    appendRconOutput(outputEl, `Error: ${err.message}`, 'error');
  } finally {
    session.loading = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
    if (input) {
      input.focus();
    }
  }
}

function createRconPanel(containerId, game) {
  const session = getRconSession(containerId);

  const panel = document.createElement('div');
  panel.className = 'rcon-panel mt-3 border-t border-gray-600 pt-3 flex flex-col gap-2';

  const output = document.createElement('div');
  output.className =
    'bg-gray-900 rounded border border-gray-700 p-2 h-40 overflow-y-auto text-xs font-mono';
  output.innerHTML = '<div class="text-gray-500 text-xs">RCON Console ready. Type a command and press Send.</div>';

  const inputRow = document.createElement('div');
  inputRow.className = 'flex gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.className =
    'rcon-input flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500';
  input.placeholder = 'Enter RCON command...';
  input.disabled = false;

  const sendBtn = document.createElement('button');
  sendBtn.className =
    'rcon-send-btn px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors';
  sendBtn.textContent = 'Send';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  const quickRow = document.createElement('div');
  quickRow.className = 'flex flex-wrap gap-2 mt-1';

  const quickCommands = (game === 'cs2') ? CS2_RCON_QUICK_COMMANDS :
                        (game === 'minecraft') ? MINECRAFT_RCON_QUICK_COMMANDS :
                        (game === 'factorio') ? FACTORIO_RCON_QUICK_COMMANDS :
                        ICARUS_RCON_QUICK_COMMANDS;

  quickCommands.forEach(qc => {
    const btn = document.createElement('button');
    btn.className = 'px-2 py-1 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs text-gray-300 transition-colors';
    btn.textContent = qc.label;
    if (qc.help) btn.title = qc.help;
    if (qc.modal === 'prospect') btn.classList.add('create-prospect-btn');
    btn.addEventListener('click', () => {
      if (qc.modal === 'prospect') {
        openProspectModal(containerId);
      } else if (qc.immediate) {
        sendRconCommand(containerId, qc.cmd, output, session);
      } else {
        input.value = qc.cmd;
        input.focus();
      }
    });
    quickRow.appendChild(btn);
  });

  function handleSend() {
    const cmd = input.value;
    if (!cmd.trim() || session.loading) return;
    input.value = '';
    sendRconCommand(containerId, cmd, output, session);
  }

  sendBtn.addEventListener('click', handleSend);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (session.history.length === 0) return;
      if (session.historyIndex > 0) {
        session.historyIndex--;
      }
      input.value = session.history[session.historyIndex] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (session.historyIndex < session.history.length - 1) {
        session.historyIndex++;
        input.value = session.history[session.historyIndex] || '';
      } else {
        session.historyIndex = session.history.length;
        input.value = '';
      }
    }
  });

  panel.appendChild(output);
  panel.appendChild(quickRow);
  panel.appendChild(inputRow);

  return panel;
}

async function sendRestCommand(containerId, command, outputEl, session) {
  if (!command.trim()) return;

  session.history.push(command);
  session.historyIndex = session.history.length;

  appendRconOutput(outputEl, `> ${command}`, 'command');

  session.loading = true;
  const panel = outputEl.closest('.rcon-panel');
  const sendBtn = panel.querySelector('.rcon-send-btn');
  const input = panel.querySelector('.rcon-input');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
  }

  try {
    const res = await fetch(`${API_BASE}/${containerId}/rest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      appendRconOutput(outputEl, data.response || '(empty response)', 'response');
    } else {
      const errMsg = data.message || `Error ${res.status}`;
      appendRconOutput(outputEl, `Error: ${errMsg}`, 'error');
    }
  } catch (err) {
    appendRconOutput(outputEl, `Error: ${err.message}`, 'error');
  } finally {
    session.loading = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
    if (input) {
      input.focus();
    }
  }
}

function createRestPanel(containerId) {
  const session = getRconSession(containerId);

  const panel = document.createElement('div');
  panel.className = 'rcon-panel mt-3 border-t border-gray-600 pt-3 flex flex-col gap-2';

  const output = document.createElement('div');
  output.className =
    'bg-gray-900 rounded border border-gray-700 p-2 h-40 overflow-y-auto text-xs font-mono';
  output.innerHTML = '<div class="text-gray-500 text-xs">REST Console ready. Type a command and press Send.</div>';

  const inputRow = document.createElement('div');
  inputRow.className = 'flex gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.className =
    'rcon-input flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500';
  input.placeholder = 'Enter REST command...';
  input.disabled = false;

  const sendBtn = document.createElement('button');
  sendBtn.className =
    'rcon-send-btn px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors';
  sendBtn.textContent = 'Send';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  const quickRow = document.createElement('div');
  quickRow.className = 'flex flex-wrap gap-2 mt-1';

  TERRARIA_REST_QUICK_COMMANDS.forEach(qc => {
    const btn = document.createElement('button');
    btn.className = 'px-2 py-1 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs text-gray-300 transition-colors';
    btn.textContent = qc.label;
    if (qc.help) btn.title = qc.help;
    btn.addEventListener('click', () => {
      if (qc.immediate) {
        sendRestCommand(containerId, qc.cmd, output, session);
      } else {
        input.value = qc.cmd;
        input.focus();
      }
    });
    quickRow.appendChild(btn);
  });

  function handleSend() {
    const cmd = input.value;
    if (!cmd.trim() || session.loading) return;
    input.value = '';
    sendRestCommand(containerId, cmd, output, session);
  }

  sendBtn.addEventListener('click', handleSend);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (session.history.length === 0) return;
      if (session.historyIndex > 0) {
        session.historyIndex--;
      }
      input.value = session.history[session.historyIndex] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (session.historyIndex < session.history.length - 1) {
        session.historyIndex++;
        input.value = session.history[session.historyIndex] || '';
      } else {
        session.historyIndex = session.history.length;
        input.value = '';
      }
    }
  });

  panel.appendChild(output);
  panel.appendChild(quickRow);
  panel.appendChild(inputRow);

  return panel;
}

// ===================== Toast notifications =====================

function showToast(message, type) {
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-yellow-600';
  toast.className = `${bgColor} text-white px-4 py-3 rounded-md shadow-lg text-sm font-medium transition-opacity duration-300`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===================== Container list =====================

function statusColor(state) {
  switch (state) {
    case 'running':
      return 'bg-green-500';
    case 'exited':
    case 'dead':
      return 'bg-red-500';
    case 'paused':
      return 'bg-yellow-500';
    case 'restarting':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

function formatPorts(ports) {
  if (!ports || ports.length === 0) return 'None';
  return ports
    .map((p) => {
      if (p.PublicPort) {
        return `${p.PublicPort}->${p.PrivatePort}/${p.Type}`;
      }
      return `${p.PrivatePort}/${p.Type}`;
    })
    .join(', ');
}

function renderContainerCard(container) {
  const badgeColor = statusColor(container.state);
  const session = getRconSession(container.id);
  const game = container.game || 'icarus';
  const gameLabel = game === 'cs2' ? 'CS2' : 
                    game === 'minecraft' ? 'Minecraft' :
                    game === 'factorio' ? 'Factorio' :
                    game === 'terraria' ? 'Terraria' :
                    game === 'icarus' ? 'Icarus' : game;
  
  const gameBadgeColor = game === 'cs2' ? 'bg-orange-600' : 
                         game === 'minecraft' ? 'bg-emerald-600' :
                         game === 'factorio' ? 'bg-red-600' :
                         game === 'terraria' ? 'bg-green-600' :
                         'bg-blue-600';

  const card = document.createElement('div');
  card.className =
    'bg-gray-800 rounded-lg shadow-md p-5 border border-gray-700 flex flex-col gap-3';
  card.dataset.containerId = container.id;
  card.dataset.game = game;

  const prospectsBtnHtml = game === 'icarus'
    ? `<button class="prospects-btn px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500 transition text-sm font-medium" data-container-id="${container.id}" data-container-name="${container.name}">Prospects</button>`
    : '';

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-semibold text-white">${container.name}</h2>
        <span class="px-2 py-0.5 rounded text-xs font-medium text-white ${gameBadgeColor}">${gameLabel}</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="start-btn px-3 py-1 text-xs font-medium rounded bg-green-700 hover:bg-green-600 text-white transition-colors ${container.state === 'running' ? 'opacity-50 cursor-not-allowed' : ''}" ${container.state === 'running' ? 'disabled' : ''}>Start</button>
        <button class="stop-btn px-3 py-1 text-xs font-medium rounded bg-red-700 hover:bg-red-600 text-white transition-colors ${container.state !== 'running' ? 'opacity-50 cursor-not-allowed' : ''}" ${container.state !== 'running' ? 'disabled' : ''}>Stop</button>
        <button class="rcon-toggle-btn px-3 py-1 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Open Console">
          ${game === 'terraria' ? 'Console' : 'RCON'}
        </button>
        <span class="state-badge inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${badgeColor}">
          ${container.state}
        </span>
      </div>
    </div>
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Image:</span> ${container.image}
    </div>
    <div class="container-status text-sm text-gray-400">
      <span class="font-medium text-gray-300">Status:</span> ${container.status}
    </div>
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Ports:</span> ${formatPorts(container.ports)}
    </div>
    <div class="flex gap-2 mt-2">
      <button class="config-btn px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition text-sm font-medium" data-container-id="${container.id}" data-container-name="${container.name}" data-container-state="${container.state}">
        Server Config
      </button>
      ${prospectsBtnHtml}
    </div>
    <div class="resources-container ${container.state === 'running' ? '' : 'hidden'}">
    </div>
    <div class="rcon-container"></div>
  `;

  // Attach event listener for config button
  card.querySelector('.config-btn').addEventListener('click', function () {
    openConfigEditor(this.dataset.containerId, this.dataset.containerName, this.dataset.containerState, game);
  });

  // Attach event listener for prospects button (Icarus only)
  const prospectsBtn = card.querySelector('.prospects-btn');
  if (prospectsBtn) {
    prospectsBtn.addEventListener('click', function () {
      openProspectsModal(this.dataset.containerId, this.dataset.containerName);
    });
  }

  // Start button
  card.querySelector('.start-btn').addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = '...';
    try {
      const res = await fetch(`${API_BASE}/${container.id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`${container.name} started`, 'success');
      } else {
        showToast(data.message || 'Start failed', 'error');
        this.disabled = false;
        this.textContent = 'Start';
      }
    } catch (err) {
      showToast(err.message, 'error');
      this.disabled = false;
      this.textContent = 'Start';
    }
  });

  // Stop button
  card.querySelector('.stop-btn').addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = '...';
    try {
      const res = await fetch(`${API_BASE}/${container.id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`${container.name} stopped`, 'success');
      } else {
        showToast(data.message || 'Stop failed', 'error');
        this.disabled = false;
        this.textContent = 'Stop';
      }
    } catch (err) {
      showToast(err.message, 'error');
      this.disabled = false;
      this.textContent = 'Stop';
    }
  });

  // Wire up RCON toggle button
  const toggleBtn = card.querySelector('.rcon-toggle-btn');
  const rconContainer = card.querySelector('.rcon-container');

  if (session.open) {
    if (game === 'terraria') {
      rconContainer.appendChild(createRestPanel(container.id));
    } else {
      rconContainer.appendChild(createRconPanel(container.id, game));
    }
    toggleBtn.textContent = game === 'terraria' ? 'Close Console' : 'Close RCON';
    toggleBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    toggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
  }

  toggleBtn.addEventListener('click', () => {
    session.open = !session.open;
    if (session.open) {
      if (game === 'terraria') {
        rconContainer.appendChild(createRestPanel(container.id));
      } else {
        rconContainer.appendChild(createRconPanel(container.id, game));
      }
      toggleBtn.textContent = game === 'terraria' ? 'Close Console' : 'Close RCON';
      toggleBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      toggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
      const input = rconContainer.querySelector('.rcon-input');
      if (input) input.focus();
    } else {
      rconContainer.innerHTML = '';
      toggleBtn.textContent = game === 'terraria' ? 'Console' : 'RCON';
      toggleBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      toggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    }
  });

  return card;
}

function renderContainers(containers) {
  if (containers.length === 0) {
    serverList.innerHTML = '';
    Object.keys(rconSessions).forEach(k => { rconSessions[k].open = false; });
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  const existingIds = new Set(
    Array.from(serverList.querySelectorAll('[data-container-id]')).map(el => el.dataset.containerId)
  );
  const incomingIds = new Set(containers.map(c => c.id));

  // Remove cards for containers that no longer exist
  serverList.querySelectorAll('[data-container-id]').forEach(card => {
    if (!incomingIds.has(card.dataset.containerId)) {
      // Clean up RCON session
      delete rconSessions[card.dataset.containerId];
      card.remove();
    }
  });

  // Add new cards or update existing ones
  containers.forEach((container) => {
    if (existingIds.has(container.id)) {
      updateCard(container);
    } else {
      const card = renderContainerCard(container);
      serverList.appendChild(card);
      if (container.state === 'running') {
        fetchResources(container.id);
      }
    }
  });
}

function updateCard(container) {
  const card = document.querySelector(`[data-container-id="${container.id}"]`);
  if (!card) return;

  // Update status badge
  const badge = card.querySelector('.state-badge');
  if (badge) {
    const badgeColor = statusColor(container.state);
    badge.className = `state-badge inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${badgeColor}`;
    badge.textContent = container.state;
  }

  // Update start/stop button states
  const startBtn = card.querySelector('.start-btn');
  const stopBtn = card.querySelector('.stop-btn');
  if (startBtn) {
    startBtn.disabled = container.state === 'running';
    startBtn.classList.toggle('opacity-50', container.state === 'running');
    startBtn.classList.toggle('cursor-not-allowed', container.state === 'running');
    if (container.state !== 'running') startBtn.textContent = 'Start';
  }
  if (stopBtn) {
    stopBtn.disabled = container.state !== 'running';
    stopBtn.classList.toggle('opacity-50', container.state !== 'running');
    stopBtn.classList.toggle('cursor-not-allowed', container.state !== 'running');
    if (container.state === 'running') stopBtn.textContent = 'Stop';
  }

  // Update status text
  const statusEl = card.querySelector('.container-status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="font-medium text-gray-300">Status:</span> ${container.status}`;
  }

  // Show/hide resources section — timer handles data updates
  const resContainer = card.querySelector('.resources-container');
  if (resContainer) {
    if (container.state === 'running') {
      resContainer.classList.remove('hidden');
    } else {
      resContainer.classList.add('hidden');
      resContainer.dataset.loaded = '';  // reset so it re-inits on next start
      resContainer.innerHTML = '';
    }
  }
}

function showError(msg) {
  serverList.innerHTML = '';
  loadingEl.classList.add('hidden');
  emptyEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  errorEl.querySelector('p').textContent =
    'Failed to load servers: ' + msg;
}

async function fetchContainers() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const containers = await res.json();
    renderContainers(containers);
  } catch (err) {
    showError(err.message);
  }
}

// ===================== Resource Monitor =====================

function memoryBarColor(percent) {
  if (percent > 80) return 'bg-red-500';
  if (percent > 60) return 'bg-yellow-500';
  return 'bg-green-500';
}

function renderResources(containerId, resources) {
  const container = document.querySelector(`[data-container-id="${containerId}"]`);
  if (!container) return;
  const resEl = container.querySelector('.resources-container');
  if (!resEl) return;

  const mem = resources.memory || {};
  const cpu = resources.cpu || {};
  const net = resources.network || {};

  // Only full render on first load (replaces spinner)
  if (!resEl.dataset.loaded) {
    resEl.dataset.loaded = '1';
    resEl.innerHTML = `
      <div class="mt-2 pt-2 border-t border-gray-700 text-xs space-y-1.5">
        <div>
          <div class="flex justify-between text-gray-400 mb-0.5">
            <span>Memory</span>
            <span class="res-mem-label">—</span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-1.5">
            <div class="res-mem-bar bg-green-500 h-1.5 rounded-full transition-all duration-700" style="width:0%"></div>
          </div>
        </div>
        <div class="flex justify-between text-gray-400">
          <span>CPU</span>
          <span class="res-cpu-label">—</span>
        </div>
        <div class="flex justify-between text-gray-400">
          <span>Network Rx</span>
          <span class="res-netrx-label">—</span>
        </div>
        <div class="flex justify-between text-gray-400">
          <span>Network Tx</span>
          <span class="res-nettx-label">—</span>
        </div>
      </div>
    `;
  }

  // Patch values in-place — no flicker
  const memLabel = resEl.querySelector('.res-mem-label');
  const memBar = resEl.querySelector('.res-mem-bar');
  const cpuLabel = resEl.querySelector('.res-cpu-label');
  const netrxLabel = resEl.querySelector('.res-netrx-label');
  const nettxLabel = resEl.querySelector('.res-nettx-label');

  if (memLabel) memLabel.textContent = `${mem.usage_human || '—'} / ${mem.limit_human || '—'} (${(mem.percent || 0).toFixed(1)}%)`;
  if (memBar) {
    memBar.style.width = `${Math.min(mem.percent || 0, 100)}%`;
    memBar.className = `res-mem-bar ${memoryBarColor(mem.percent || 0)} h-1.5 rounded-full transition-all duration-700`;
  }
  if (cpuLabel) cpuLabel.textContent = `${(cpu.percent || 0).toFixed(1)}%`;
  if (netrxLabel) netrxLabel.textContent = net.rx_human || '—';
  if (nettxLabel) nettxLabel.textContent = net.tx_human || '—';
}

function renderResourcesError(containerId) {
  const container = document.querySelector(`[data-container-id="${containerId}"]`);
  if (!container) return;
  const resEl = container.querySelector('.resources-container');
  if (!resEl) return;

  if (!resEl.dataset.loaded) {
    resEl.dataset.loaded = '1';
    resEl.innerHTML = `
      <div class="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-600">
        Resources unavailable
      </div>
    `;
  }
}

async function fetchResources(containerId) {
  try {
    const res = await fetch(`${API_BASE}/${containerId}/resources`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderResources(containerId, data);
  } catch {
    renderResourcesError(containerId);
  }
}

function fetchAllResources() {
  Array.from(document.querySelectorAll('[data-container-id]')).forEach(card => {
    const resEl = card.querySelector('.resources-container');
    // Only fetch if resources section is visible (container is running)
    if (resEl && !resEl.classList.contains('hidden')) {
      fetchResources(card.dataset.containerId);
    }
  });
}

// ===================== Config Editor =====================

/**
 * Get a config value from the parsed config object, searching across
 * root level and all sections.
 */
function getConfigValue(config, key, section) {
  if (section) {
    return (config._sections && config._sections[section] && config._sections[section][key]) || '';
  }
  // Check root first, then all sections
  if (config._root && config._root[key] !== undefined) {
    return config._root[key];
  }
  if (config._sections) {
    for (const sec of Object.values(config._sections)) {
      if (sec[key] !== undefined) return sec[key];
    }
  }
  return '';
}

/**
 * Build the form fields for the config editor. Shows known Icarus fields
 * with current values, plus any additional fields found in the config that
 * aren't in our known list.
 */
function buildConfigForm(config, launchParams) {
  let html = '';

  // Show any additional root-level or section keys not covered by known fields
  const knownRootKeys = CONFIG_FIELDS.filter(f => f.section === null).map(f => f.key);
  const knownSectionKeys = {};
  CONFIG_FIELDS.forEach(f => {
    if (f.section) {
      if (!knownSectionKeys[f.section]) knownSectionKeys[f.section] = new Set();
      knownSectionKeys[f.section].add(f.key);
    }
  });

  // Render known fields grouped by section
  const rootFields = CONFIG_FIELDS.filter(f => f.section === null);
  const sectionFields = {};
  CONFIG_FIELDS.forEach(f => {
    if (f.section) {
      if (!sectionFields[f.section]) sectionFields[f.section] = [];
      sectionFields[f.section].push(f);
    }
  });

  // Root-level known fields
  if (rootFields.length > 0) {
    html += '<div class="mb-4">';
    html += '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">General Settings</h3>';
    rootFields.forEach(field => {
      const value = getConfigValue(config, field.key, null);
      html += renderFormField(field, value);
    });
    html += '</div>';
  }

  // Section-level known fields
  for (const [section, fields] of Object.entries(sectionFields)) {
    html += `<div class="mb-4">`;
    html += `<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">${section}</h3>`;
    fields.forEach(field => {
      const value = getConfigValue(config, field.key, field.section);
      html += renderFormField(field, value);
    });
    html += '</div>';
  }

  // Render additional root-level keys not in known fields
  if (config._root) {
    const extraRootKeys = Object.keys(config._root).filter(k => !knownRootKeys.includes(k));
    if (extraRootKeys.length > 0) {
      html += '<div class="mb-4">';
      html += '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Other Settings</h3>';
      extraRootKeys.forEach(key => {
        html += renderFormField(
          { key, label: key, type: 'text', section: null },
          config._root[key]
        );
      });
      html += '</div>';
    }
  }

  // Render additional section keys not in known fields
  if (config._sections) {
    for (const [sectionName, sectionData] of Object.entries(config._sections)) {
      const known = knownSectionKeys[sectionName] || new Set();
      const extraKeys = Object.keys(sectionData).filter(k => !known.has(k));
      if (extraKeys.length > 0) {
        html += `<div class="mb-4">`;
        html += `<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Other - ${sectionName}</h3>`;
        extraKeys.forEach(key => {
          html += renderFormField(
            { key, label: key, type: 'text', section: sectionName },
            sectionData[key]
          );
        });
        html += '</div>';
      }
    }
  }

  // Launch params section
  if (launchParams && Object.keys(launchParams).length > 0) {
    html += '<div class="mb-4">';
    html += '<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Launch Parameters</h3>';
    for (const [key, value] of Object.entries(launchParams)) {
      html += renderFormField(
        { key, label: key, type: 'text', section: '__launch__' },
        value
      );
    }
    html += '</div>';
  }

  return html;
}

function buildCs2ConfigForm(config) {
  let html = '';
  const env = (config && config.env) || {};

  const groups = [
    { title: 'Server', fields: ['SRCDS_TOKEN', 'CS2_SERVERNAME', 'CS2_PW', 'CS2_RCONPW', 'CS2_MAXPLAYERS', 'CS2_PORT', 'CS2_LAN', 'CS2_CHEATS', 'CS2_SERVER_HIBERNATE'] },
    { title: 'Game Mode', fields: ['CS2_GAMEALIAS', 'CS2_GAMETYPE', 'CS2_GAMEMODE', 'CS2_MAPGROUP', 'CS2_STARTMAP'] },
    { title: 'Bots', fields: ['CS2_BOT_DIFFICULTY', 'CS2_BOT_QUOTA', 'CS2_BOT_QUOTA_MODE'] },
    { title: 'CSTV', fields: ['TV_ENABLE', 'TV_PORT', 'TV_AUTORECORD', 'TV_PW', 'TV_RELAY_PW'] },
    { title: 'Logging', fields: ['CS2_LOG', 'CS2_LOG_MONEY', 'CS2_LOG_DETAIL', 'CS2_LOG_ITEMS'] },
  ];

  const fieldMap = {};
  CS2_CONFIG_FIELDS.forEach(f => { fieldMap[f.key] = f; });

  groups.forEach(group => {
    html += '<div class="mb-4">';
    html += `<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">${group.title}</h3>`;
    group.fields.forEach(key => {
      const field = fieldMap[key];
      if (field) {
        const value = env[key] !== undefined ? env[key] : '';
        html += renderCs2FormField(field, value);
      }
    });
    html += '</div>';
  });

  return html;
}

function buildMinecraftConfigForm(config) {
  let html = '';
  const env = (config && config.env) || {};

  const groups = [
    { title: 'Server', fields: ['EULA', 'VERSION', 'TYPE', 'MOTD', 'MAX_PLAYERS', 'MEMORY'] },
    { title: 'Gameplay', fields: ['DIFFICULTY', 'MODE', 'LEVEL', 'SEED', 'VIEW_DISTANCE'] },
    { title: 'Advanced', fields: ['ONLINE_MODE', 'ENABLE_RCON', 'RCON_PASSWORD'] },
  ];

  const fieldMap = {};
  MINECRAFT_CONFIG_FIELDS.forEach(f => { fieldMap[f.key] = f; });

  groups.forEach(group => {
    html += '<div class="mb-4">';
    html += `<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">${group.title}</h3>`;
    group.fields.forEach(key => {
      const field = fieldMap[key];
      if (field) {
        const value = env[key] !== undefined ? env[key] : '';
        html += renderCs2FormField(field, value); // Reuse the env var renderer
      }
    });
    html += '</div>';
  });

  return html;
}

function buildFactorioConfigForm(config) {
  let html = '';
  const json = (config && config.json) || {};

  const groups = [
    { title: 'Server', fields: ['name', 'description', 'max_players', 'game_password'] },
    { title: 'Visibility', fields: ['visibility.public', 'visibility.lan'] },
    { title: 'Advanced', fields: ['require_user_verification', 'auto_pause', 'non_blocking_saving', 'rcon_password'] },
  ];

  const fieldMap = {};
  FACTORIO_CONFIG_FIELDS.forEach(f => { fieldMap[f.key] = f; });

  groups.forEach(group => {
    html += '<div class="mb-4">';
    html += `<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">${group.title}</h3>`;
    group.fields.forEach(key => {
      const field = fieldMap[key];
      if (field) {
        let value = json[key];
        if (value === true) value = 'true';
        if (value === false) value = 'false';
        if (value === undefined) value = '';
        html += renderJsonFormField(field, value);
      }
    });
    html += '</div>';
  });

  return html;
}

function buildTerrariaConfigForm(config) {
  let html = '';
  const json = (config && config.json) || {};

  const groups = [
    { title: 'Server', fields: ['ServerName', 'ServerPassword', 'ServerPort', 'MaxSlots'] },
    { title: 'REST API', fields: ['RestApiEnabled', 'RestApiPort', 'ApplicationRestTokens'] },
  ];

  const fieldMap = {};
  TERRARIA_CONFIG_FIELDS.forEach(f => { fieldMap[f.key] = f; });

  groups.forEach(group => {
    html += '<div class="mb-4">';
    html += `<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">${group.title}</h3>`;
    group.fields.forEach(key => {
      const field = fieldMap[key];
      if (field) {
        let value = json[key];
        if (value === true) value = 'true';
        if (value === false) value = 'false';
        if (value === undefined) value = '';
        html += renderJsonFormField(field, value);
      }
    });
    html += '</div>';
  });

  return html;
}

function renderJsonFormField(field, value) {
  const escaped = String(value || '').replace(/"/g, '&quot;');
  const inputId = `cfg-json-${field.key}`.replace(/[^a-zA-Z0-9-]/g, '_');
  let inputHtml = '';

  if (field.type === 'select' && field.options) {
    inputHtml = `<select id="${inputId}" data-key="${field.key}" data-section="json" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
    field.options.forEach(opt => {
      const selected = (String(value) === opt) ? 'selected' : '';
      const label = opt === '' ? '-- Default --' : opt;
      inputHtml += `<option value="${opt}" ${selected}>${label}</option>`;
    });
    inputHtml += '</select>';
  } else if (field.type === 'number') {
    const minAttr = field.min ? `min="${field.min}"` : '';
    const maxAttr = field.max ? `max="${field.max}"` : '';
    inputHtml = `<input type="number" id="${inputId}" data-key="${field.key}" data-section="json" value="${escaped}" placeholder="${field.placeholder || ''}" ${minAttr} ${maxAttr} class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
  } else {
    inputHtml = `<input type="text" id="${inputId}" data-key="${field.key}" data-section="json" value="${escaped}" placeholder="${field.placeholder || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
  }

  return `
    <div class="mb-3">
      <label for="${inputId}" class="block text-sm font-medium text-gray-300 mb-1">${field.label}${field.help ? `<span class="block text-xs font-normal text-gray-500 mt-0.5">${field.help}</span>` : ''}</label>
      ${inputHtml}
    </div>
  `;
}
function renderCs2FormField(field, value) {
  const escaped = String(value || '').replace(/"/g, '&quot;');
  const inputId = `cfg-cs2-${field.key}`.replace(/[^a-zA-Z0-9-]/g, '_');
  let inputHtml = '';

  if (field.type === 'select' && field.options) {
    inputHtml = `<select id="${inputId}" data-key="${field.key}" data-section="cs2-env" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
    field.options.forEach(opt => {
      const selected = (value === opt) ? 'selected' : '';
      const label = opt === '' ? '-- Default --' : opt;
      inputHtml += `<option value="${opt}" ${selected}>${label}</option>`;
    });
    inputHtml += '</select>';
  } else if (field.type === 'number') {
    const minAttr = field.min ? `min="${field.min}"` : '';
    const maxAttr = field.max ? `max="${field.max}"` : '';
    inputHtml = `<input type="number" id="${inputId}" data-key="${field.key}" data-section="cs2-env" value="${escaped}" placeholder="${field.placeholder || ''}" ${minAttr} ${maxAttr} class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
  } else {
    inputHtml = `<input type="text" id="${inputId}" data-key="${field.key}" data-section="cs2-env" value="${escaped}" placeholder="${field.placeholder || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
  }

  return `
    <div class="mb-3">
      <label for="${inputId}" class="block text-sm font-medium text-gray-300 mb-1">${field.label}${field.help ? `<span class="block text-xs font-normal text-gray-500 mt-0.5">${field.help}</span>` : ''}</label>
      ${inputHtml}
    </div>
  `;
}
function renderFormField(field, value) {
  const escaped = String(value || '').replace(/"/g, '&quot;');
  const inputId = `cfg-${field.section || 'root'}-${field.key}`.replace(/[^a-zA-Z0-9-]/g, '_');
  let inputHtml = '';

  if (field.type === 'select' && field.options) {
    inputHtml = `<select id="${inputId}" data-key="${field.key}" data-section="${field.section || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
    field.options.forEach(opt => {
      const selected = (value === opt) ? 'selected' : '';
      const label = opt === '' ? '-- Default --' : opt;
      inputHtml += `<option value="${opt}" ${selected}>${label}</option>`;
    });
    inputHtml += '</select>';
  } else if (field.type === 'number') {
    const minAttr = field.min ? `min="${field.min}"` : '';
    const maxAttr = field.max ? `max="${field.max}"` : '';
    inputHtml = `<input type="number" id="${inputId}" data-key="${field.key}" data-section="${field.section || ''}" value="${escaped}" placeholder="${field.placeholder || ''}" ${minAttr} ${maxAttr} class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
  } else {
    inputHtml = `<input type="text" id="${inputId}" data-key="${field.key}" data-section="${field.section || ''}" value="${escaped}" placeholder="${field.placeholder || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">`;
  }

  return `
    <div class="mb-3">
      <label for="${inputId}" class="block text-sm font-medium text-gray-300 mb-1">${field.label}${field.help ? `<span class="block text-xs font-normal text-gray-500 mt-0.5">${field.help}</span>` : ''}</label>
      ${inputHtml}
    </div>
  `;
}

/**
 * Collect form values and merge them back into the original config structure.
 */
function collectFormConfig() {
  if (currentEditGame === 'cs2' || currentEditGame === 'minecraft') {
    const updatedEnv = {};
    const inputs = configModalBody.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (input.dataset.section === 'cs2-env') {
        updatedEnv[input.dataset.key] = input.value;
      }
    });
    const updatedConfig = JSON.parse(JSON.stringify(currentEditConfig));
    if (!updatedConfig.env) updatedConfig.env = {};
    Object.assign(updatedConfig.env, updatedEnv);
    return { config: updatedConfig, launchParams: null };
  }

  if (currentEditGame === 'factorio' || currentEditGame === 'terraria') {
    const updatedJson = {};
    const inputs = configModalBody.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (input.dataset.section === 'json') {
        updatedJson[input.dataset.key] = input.value;
      }
    });
    const updatedConfig = JSON.parse(JSON.stringify(currentEditConfig));
    if (!updatedConfig.json) updatedConfig.json = {};
    Object.assign(updatedConfig.json, updatedJson);
    return { config: updatedConfig, launchParams: null };
  }

  const updatedConfig = JSON.parse(JSON.stringify(currentEditConfig));
  const updatedLaunchParams = currentEditLaunchParams ? { ...currentEditLaunchParams } : {};

  const inputs = configModalBody.querySelectorAll('input, select');
  inputs.forEach(input => {
    const key = input.dataset.key;
    const section = input.dataset.section;
    const value = input.value;

    if (section === '__launch__') {
      updatedLaunchParams[key] = value;
      return;
    }

    if (section === '') {
      if (!updatedConfig._root) updatedConfig._root = {};
      updatedConfig._root[key] = value;
    } else if (section) {
      if (!updatedConfig._sections) updatedConfig._sections = {};
      if (!updatedConfig._sections[section]) updatedConfig._sections[section] = {};
      updatedConfig._sections[section][key] = value;
    }
  });

  return { config: updatedConfig, launchParams: updatedLaunchParams };
}

/**
 * Open the config editor modal for a given container.
 */
async function openConfigEditor(containerId, containerName, containerState, game) {
  currentEditContainer = { id: containerId, name: containerName, state: containerState };
  currentEditGame = game || 'icarus';
  configModalTitle.textContent = `Server Config — ${containerName}`;
  configModalBody.innerHTML = '<div class="flex items-center justify-center py-8"><svg class="animate-spin h-6 w-6 text-blue-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg><span class="text-gray-400">Loading config...</span></div>';
  configModal.classList.remove('hidden');
  configModalSave.disabled = true;
  configModalSave.classList.add('opacity-50', 'cursor-not-allowed');

  try {
    const res = await fetch(`${API_BASE}/${containerId}/config`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    currentEditGame = data.game || currentEditGame;
    currentEditConfig = data.config;
    currentEditLaunchParams = data.launchParams || {};

    let bodyHtml = '';

    if (containerState === 'running') {
      bodyHtml += `
        <div class="mb-4 p-3 rounded-md bg-yellow-900 border border-yellow-700 text-yellow-200 text-sm">
          <strong>Warning:</strong> This server is currently running. Config changes will take effect after restart.
        </div>
      `;
    }

    if (currentEditGame === 'cs2') {
      bodyHtml += buildCs2ConfigForm(currentEditConfig);
    } else if (currentEditGame === 'minecraft') {
      bodyHtml += buildMinecraftConfigForm(currentEditConfig);
    } else if (currentEditGame === 'factorio') {
      bodyHtml += buildFactorioConfigForm(currentEditConfig);
    } else if (currentEditGame === 'terraria') {
      bodyHtml += buildTerrariaConfigForm(currentEditConfig);
    } else {
      bodyHtml += buildConfigForm(currentEditConfig, currentEditLaunchParams);
    }
    configModalBody.innerHTML = bodyHtml;

    configModalSave.disabled = false;
    configModalSave.classList.remove('opacity-50', 'cursor-not-allowed');
  } catch (err) {
    configModalBody.innerHTML = `<div class="text-center py-8"><p class="text-red-400 text-sm">Failed to load config: ${err.message}</p></div>`;
  }
}

/**
 * Close the config editor modal.
 */
function closeConfigEditor() {
  configModal.classList.add('hidden');
  configModalBody.innerHTML = '';
  currentEditContainer = null;
  currentEditConfig = null;
  currentEditLaunchParams = null;
  currentEditGame = null;
}

/**
 * Save the config via PUT request.
 */
async function saveConfig() {
  if (!currentEditContainer) return;

  const { config, launchParams } = collectFormConfig();

  configModalSave.disabled = true;
  configModalSave.textContent = 'Saving...';

  try {
    const res = await fetch(`${API_BASE}/${currentEditContainer.id}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, launchParams }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Show validation errors
      const errorMsg = data.error || `HTTP ${res.status}`;
      showToast('Save failed: ' + errorMsg, 'error');
      configModalSave.disabled = false;
      configModalSave.textContent = 'Save Config';
      return;
    }

    showToast('Config saved successfully!', 'success');
    currentEditConfig = data.config;
    currentEditLaunchParams = data.launchParams || {};
    closeConfigEditor();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
    configModalSave.disabled = false;
    configModalSave.textContent = 'Save Config';
  }
}

// Modal event listeners
configModalClose.addEventListener('click', closeConfigEditor);
configModalCancel.addEventListener('click', closeConfigEditor);
configModalBackdrop.addEventListener('click', closeConfigEditor);
configModalSave.addEventListener('click', saveConfig);

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !configModal.classList.contains('hidden')) {
    closeConfigEditor();
  }
  if (e.key === 'Escape' && !prospectModal.classList.contains('hidden')) {
    closeProspectModal();
  }
  if (e.key === 'Escape' && !prospectsModal.classList.contains('hidden')) {
    closeProspectsModal();
  }
});

// ===================== Create Prospect Modal =====================

const prospectModal = document.getElementById('prospect-modal');
const prospectModalClose = document.getElementById('prospect-modal-close');
const prospectModalBackdrop = document.getElementById('prospect-modal-backdrop');
const prospectModalCancel = document.getElementById('prospect-modal-cancel');
const prospectModalSend = document.getElementById('prospect-modal-send');
const prospectTypeEl = document.getElementById('prospect-type');
const prospectDifficultyEl = document.getElementById('prospect-difficulty');
const prospectHardcoreEl = document.getElementById('prospect-hardcore');
const prospectSavenameEl = document.getElementById('prospect-savename');
let prospectContainerId = null;

function populateProspectTypes() {
  prospectTypeEl.innerHTML = PROSPECT_TYPES.map(pt =>
    `<option value="${pt.key}">${pt.name}</option>`
  ).join('');
}

function openProspectModal(containerId) {
  prospectContainerId = containerId;
  populateProspectTypes();
  prospectModal.classList.remove('hidden');
}

function closeProspectModal() {
  prospectModal.classList.add('hidden');
  prospectContainerId = null;
}

function sendProspectCommand() {
  if (!prospectContainerId) return;
  const type = prospectTypeEl.value;
  const difficulty = prospectDifficultyEl.value;
  const hardcore = prospectHardcoreEl.value;
  const savename = prospectSavenameEl.value.trim();
  const cmd = `CreateProspect ${type} ${difficulty} ${hardcore}${savename ? ' ' + savename : ''}`;

  const session = getRconSession(prospectContainerId);
  if (!session.open) {
    showToast('Open the RCON console first for this server', 'error');
    closeProspectModal();
    return;
  }

  const panel = document.querySelector(`[data-container-id="${prospectContainerId}"] .rcon-panel`);
  const output = panel ? panel.querySelector('div:first-child') : null;
  if (output) {
    sendRconCommand(prospectContainerId, cmd, output, session);
  }
  closeProspectModal();
}

// Update the "Create Prospect" quick button to open the modal instead
function makeQuickCreateButton(containerId) {
  const rconContainer = document.querySelector(`[data-container-id="${containerId}"] .rcon-container`);
  if (!rconContainer) return;
  const panel = rconContainer.querySelector('.rcon-panel');
  if (!panel) return;
  const rows = panel.querySelectorAll('div > div');
  const quickRow = panel.querySelector('div.flex.flex-wrap');
  if (!quickRow) return;

  const createBtn = quickRow.querySelector('.create-prospect-btn');
  if (createBtn) {
    createBtn.onclick = () => openProspectModal(containerId);
  }
}

prospectModalClose.addEventListener('click', closeProspectModal);
prospectModalBackdrop.addEventListener('click', closeProspectModal);
prospectModalCancel.addEventListener('click', closeProspectModal);
prospectModalSend.addEventListener('click', sendProspectCommand);

// ===================== Prospects Upload Modal =====================

const prospectsModal = document.getElementById('prospects-modal');
const prospectsModalClose = document.getElementById('prospects-modal-close');
const prospectsModalBackdrop = document.getElementById('prospects-modal-backdrop');
const prospectsModalCancel = document.getElementById('prospects-modal-cancel');
const prospectsModalUpload = document.getElementById('prospects-modal-upload');
const prospectsModalBody = document.getElementById('prospects-modal-body');
const prospectsModalTitle = document.getElementById('prospects-modal-title');
let prospectsContainerId = null;
let prospectsContainerName = null;
let pendingProspectFile = null;
let pendingProspectJSON = null;

function closeProspectsModal() {
  prospectsModal.classList.add('hidden');
  prospectsContainerId = null;
  prospectsContainerName = null;
  pendingProspectFile = null;
  pendingProspectJSON = null;
  prospectsModalUpload.disabled = false;
  prospectsModalUpload.textContent = 'Upload';
}

function renderProspectsList(prospects) {
  if (!prospects || prospects.length === 0) {
    return '<p class="text-gray-500 text-sm">No prospect files on server.</p>';
  }
  return `
    <div class="mb-3">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Server Prospects</h3>
      <ul class="space-y-1">
        ${prospects.map(p => `<li class="text-sm text-gray-300 bg-gray-900 rounded px-3 py-1.5 font-mono">${p.name}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderUploadArea() {
  const status = pendingProspectFile
    ? `Selected: <span class="text-green-400">${pendingProspectFile.name}</span>`
    : 'Drop a .json prospect file here or click to browse';
  const statusColor = pendingProspectFile ? 'border-green-500 bg-green-900 bg-opacity-20' : 'border-dashed border-gray-500';

  return `
    <div class="mb-3">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Upload Local Prospect</h3>
      <div id="prospect-drop-zone" class="border-2 ${statusColor} rounded-lg p-6 text-center cursor-pointer text-sm text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors">
        <p>${status}</p>
      </div>
      <p class="text-xs text-gray-500 mt-1">The file is validated client-side before upload to prevent corruption.</p>
      <div id="prospect-name-area" class="${pendingProspectFile ? '' : 'hidden'} mt-3">
        <label for="prospect-upload-name" class="block text-sm font-medium text-gray-300 mb-1">Prospect Name</label>
        <input type="text" id="prospect-upload-name" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
      </div>
    </div>
  `;
}

async function openProspectsModal(containerId, containerName) {
  prospectsContainerId = containerId;
  prospectsContainerName = containerName;
  prospectsModalTitle.textContent = `Prospects — ${containerName}`;
  prospectsModalUpload.disabled = true;
  prospectsModalUpload.textContent = 'Upload';
  pendingProspectFile = null;
  pendingProspectJSON = null;

  prospectsModalBody.innerHTML = '<div class="flex items-center justify-center py-8"><span class="text-gray-400 text-sm">Loading...</span></div>';
  prospectsModal.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/${containerId}/prospects`);
    const data = await res.json();
    pendingProspectList = Array.isArray(data) ? data : [];
    prospectsModalBody.innerHTML = renderProspectsList(pendingProspectList) + renderUploadArea();
    setupDropZone();
  } catch (err) {
    pendingProspectList = [];
    prospectsModalBody.innerHTML = `<p class="text-red-400 text-sm">Failed to load: ${err.message}</p>`;
  }
}

function setupDropZone() {
  const zone = document.getElementById('prospect-drop-zone');
  if (!zone) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  zone.appendChild(input);

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('border-blue-400', 'text-blue-400');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('border-blue-400', 'text-blue-400');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('border-blue-400', 'text-blue-400');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
}

function handleFileSelect(file) {
  if (!file.name.endsWith('.json')) {
    showToast('Only .json files are accepted', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object') {
        showToast('File does not contain a valid JSON object — may be corrupted', 'error');
        return;
      }
      pendingProspectFile = file;
      pendingProspectJSON = parsed;

      const nameFromFile = file.name.replace(/\.json$/i, '');
      prospectsModalBody.innerHTML = renderProspectsList(pendingProspectList) + renderUploadArea();
      const nameInput = document.getElementById('prospect-upload-name');
      if (nameInput) {
        nameInput.value = nameFromFile;
      }
      prospectsModalUpload.disabled = false;
      setupDropZone();
      showToast('Prospect file validated successfully', 'success');
    } catch {
      showToast('Invalid JSON — file may be corrupted', 'error');
    }
  };
  reader.onerror = () => showToast('Failed to read file', 'error');
  reader.readAsText(file);
}

let pendingProspectList = []; // stored from list API

prospectsModalUpload.addEventListener('click', async () => {
  if (!pendingProspectFile || !pendingProspectJSON || !prospectsContainerId) return;

  const nameInput = document.getElementById('prospect-upload-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Please enter a prospect name', 'error');
    return;
  }

  prospectsModalUpload.disabled = true;
  prospectsModalUpload.textContent = 'Uploading...';

  try {
    const res = await fetch(`${API_BASE}/${prospectsContainerId}/prospects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content: pendingProspectJSON }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`Prospect "${name}.json" uploaded successfully!`, 'success');

      // Offer to set LoadProspect in config
      if (confirm(`Set LoadProspect to "${name}" so the server auto-loads this prospect on startup?`)) {
        try {
          const cfgRes = await fetch(`${API_BASE}/${prospectsContainerId}/config`);
          const cfgData = await cfgRes.json();
          const config = cfgData.config || {};
          if (!config._root) config._root = {};
          config._root.LoadProspect = name;
          await fetch(`${API_BASE}/${prospectsContainerId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config }),
          });
          showToast('LoadProspect set in server config', 'success');
        } catch {
          showToast('Prospect uploaded, but failed to update config', 'error');
        }
      }

      closeProspectsModal();
    } else {
      showToast(data.error || 'Upload failed', 'error');
      prospectsModalUpload.disabled = false;
      prospectsModalUpload.textContent = 'Upload';
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
    prospectsModalUpload.disabled = false;
    prospectsModalUpload.textContent = 'Upload';
  }
});

prospectsModalClose.addEventListener('click', closeProspectsModal);
prospectsModalBackdrop.addEventListener('click', closeProspectsModal);
prospectsModalCancel.addEventListener('click', closeProspectsModal);

// Initial fetch
fetchContainers();

// Load version
async function loadVersion() {
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    const el = document.getElementById('version-display');
    if (el) el.textContent = 'v' + (data.version || '?');
  } catch { /* ignore */ }
}
loadVersion();

// Auto-refresh every 5 seconds
setInterval(fetchContainers, 5000);

// Auto-refresh resources every 10 seconds
setInterval(fetchAllResources, 10000);
