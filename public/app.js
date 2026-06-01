// ============================================================================
// TABLE OF CONTENTS
// ============================================================================
// 1. Constants & State
// 2. Auth
// 3. API Helpers
// 4. RCON / REST Console
// 5. Container Cards & List
// 6. Players
// 7. Resources
// 8. Logs & AI Analysis
// 9. Game Data
// 10. Config Editor
// 11. Prospects (Icarus)
// 12. Host Stats
// 13. Events / SSE
// 14. Bootstrap
// ============================================================================

// ============================================================================
// 1. CONSTANTS & STATE
// ============================================================================
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

// Track the current container being edited
let currentEditContainer = null;
let currentEditGame = null;
// Store the raw config/launchParams from the API so we can preserve sections not shown in the form
let currentEditConfig = null;
let currentEditLaunchParams = null;

// Game metadata loaded from /api/games
let gameMetadata = {};

async function loadGameMetadata() {
  try {
    const res = await fetch('/api/games');
    if (res.ok) {
      const data = await res.json();
      for (const g of data.games) {
        gameMetadata[g.id] = g;
      }
    }
  } catch {}
}

function getGameMeta(gameId) {
  return gameMetadata[gameId] || {
    id: gameId,
    label: gameId,
    badgeColor: 'bg-blue-600',
    consoleType: 'rcon',
    configFields: CONFIG_FIELDS,
    quickCommands: [],
    gameDataTypes: [],
  };
}

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

  const quickCommands = (getGameMeta(game).quickCommands || []);

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

  (getGameMeta(game).quickCommands || []).forEach(qc => {
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

// ============================================================================
// 3. API HELPERS
// ============================================================================

// ============================================================================
// 7. LOGS & AI ANALYSIS
// ============================================================================

function createLogsPanel(containerId) {
  const panel = document.createElement('div');
  panel.className = 'mt-2 pt-2 border-t border-gray-700';

  let currentTail = '200';
  let aiEnabled = false;

  fetch('/api/ai/status').then(r => r.json()).then(d => { aiEnabled = d.enabled; updateAiBtn(); }).catch(() => {});

  panel.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <select class="logs-tail-select bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white">
        <option value="100">Last 100</option>
        <option value="200" selected>Last 200</option>
        <option value="500">Last 500</option>
        <option value="1000">Last 1000</option>
        <option value="all">All</option>
      </select>
      <button class="logs-refresh-btn px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Refresh</button>
      <button class="logs-download-btn px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Download</button>
      <button class="logs-ai-btn px-2 py-1 text-xs rounded bg-violet-700 text-gray-300 hover:bg-violet-600 hidden" disabled>Analyze with AI</button>
      <input type="text" class="logs-search bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white w-40" placeholder="Filter logs...">
      <span class="logs-count text-xs text-gray-500"></span>
    </div>
    <div class="logs-output bg-gray-950 rounded p-2 font-mono text-xs overflow-y-auto max-h-64 whitespace-pre-wrap break-all"></div>
    <div class="ai-analysis-container"></div>
  `;

  const output = panel.querySelector('.logs-output');
  const searchInput = panel.querySelector('.logs-search');
  const countSpan = panel.querySelector('.logs-count');
  const aiBtn = panel.querySelector('.logs-ai-btn');
  const aiContainer = panel.querySelector('.ai-analysis-container');
  let allLogs = [];

  function updateAiBtn() {
    if (aiEnabled) {
      aiBtn.classList.remove('hidden');
      aiBtn.disabled = false;
    }
  }

  async function loadLogs() {
    output.textContent = 'Loading...';
    try {
      const res = await fetch(`${API_BASE}/${containerId}/logs?tail=${currentTail}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allLogs = data.logs || [];
      renderFilteredLogs();
    } catch (err) {
      output.innerHTML = `<span class="text-red-400">Failed to load logs: ${escapeHtml(err.message)}</span>`;
    }
  }

  function renderFilteredLogs() {
    const query = (searchInput.value || '').toLowerCase();
    const filtered = query
      ? allLogs.filter(l => l.text.toLowerCase().includes(query))
      : allLogs;
    countSpan.textContent = `${filtered.length} lines`;
    output.innerHTML = filtered.map((l, idx) => {
      const color = l.stream === 'stderr' ? 'text-red-400' : 'text-gray-300';
      const ts = l.timestamp ? `<span class="text-gray-600">${l.timestamp}</span> ` : '';
      const clickable = l.stream === 'stderr' ? `cursor-pointer hover:bg-red-900/30 rounded px-0.5" data-stderr-idx="${idx}` : '';
      return `<div class="${color} ${clickable}">${ts}${escapeHtml(l.text)}</div>`;
    }).join('');
    output.scrollTop = output.scrollHeight;
  }

  panel.querySelector('.logs-tail-select').addEventListener('change', function () {
    currentTail = this.value;
    loadLogs();
  });
  panel.querySelector('.logs-refresh-btn').addEventListener('click', loadLogs);
  panel.querySelector('.logs-download-btn').addEventListener('click', () => {
    const text = allLogs.map(l => `[${l.stream}]${l.timestamp ? ' ' + l.timestamp : ''} ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logs-${containerId.substring(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  searchInput.addEventListener('input', renderFilteredLogs);

  output.addEventListener('click', async (e) => {
    const line = e.target.closest('[data-stderr-idx]');
    if (!line || !aiEnabled) return;

    const existing = line.querySelector('.ai-explain-popover');
    if (existing) { existing.remove(); return; }

    const logLine = line.textContent.trim();
    const context = allLogs.slice(Math.max(0, parseInt(line.dataset.stderrIdx) - 3), parseInt(line.dataset.stderrIdx) + 4)
      .map(l => `[${l.stream}] ${l.text}`).join('\n');

    line.insertAdjacentHTML('beforeend', '<span class="ai-explain-popover ml-2 text-yellow-400 text-xs italic">explaining...</span>');

    try {
      const res = await fetch(`/api/ai/${containerId}/explain-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logLine, context }),
      });
      const data = await res.json();
      const popover = line.querySelector('.ai-explain-popover');
      if (popover) {
        const badge = data.cached ? ' <span class="text-gray-500">(cached)</span>' : '';
        popover.outerHTML = `<span class="ai-explain-popover ml-2 text-xs text-yellow-300 bg-gray-800 border border-yellow-700 rounded px-2 py-1 inline-block mt-1">${escapeHtml(data.explanation)}${badge}</span>`;
      }
    } catch {
      const popover = line.querySelector('.ai-explain-popover');
      if (popover) popover.textContent = '(explanation failed)';
    }
  });

  aiBtn.addEventListener('click', async () => {
    if (aiBtn.disabled) return;
    aiBtn.disabled = true;
    aiBtn.textContent = 'Analyzing...';
    aiContainer.innerHTML = '<div class="mt-2 p-3 bg-gray-900 rounded border border-gray-700 text-xs text-gray-400">AI is analyzing logs...</div>';

    try {
      const res = await fetch(`/api/ai/${containerId}/analyze-logs?tail=${currentTail}`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const analysisHtml = data.analysis
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-violet-300">$1</strong>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 rounded text-violet-200">$1</code>');
      aiContainer.innerHTML = `<div class="mt-2 p-3 bg-gray-900 rounded border border-violet-800/50 text-xs text-gray-300 leading-relaxed"><div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700"><span class="text-violet-400 font-medium">AI Log Analysis</span></div>${analysisHtml}</div>`;
    } catch (err) {
      aiContainer.innerHTML = `<div class="mt-2 p-3 bg-gray-900 rounded border border-red-800/50 text-xs text-red-400">Analysis failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = 'Analyze with AI';
    }
  });

  loadLogs();
  return panel;
}

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

// ============================================================================
// 4. CONTAINER CARDS & LIST
// ============================================================================

function renderContainerCard(container) {
  const badgeColor = statusColor(container.state);
  const session = getRconSession(container.id);
  const game = container.game || 'icarus';
  const meta = getGameMeta(game);
  const gameLabel = meta.label;
  const gameBadgeColor = meta.badgeColor;

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
        <h2 class="text-xl font-semibold text-white">${escapeHtml(container.name)}</h2>
        <span class="px-2 py-0.5 rounded text-xs font-medium text-white ${gameBadgeColor}">${escapeHtml(gameLabel)}</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="start-btn px-3 py-1 text-xs font-medium rounded bg-green-700 hover:bg-green-600 text-white transition-colors ${container.state === 'running' ? 'opacity-50 cursor-not-allowed' : ''}" ${container.state === 'running' ? 'disabled' : ''}>Start</button>
        <button class="stop-btn px-3 py-1 text-xs font-medium rounded bg-red-700 hover:bg-red-600 text-white transition-colors ${container.state !== 'running' ? 'opacity-50 cursor-not-allowed' : ''}" ${container.state !== 'running' ? 'disabled' : ''}>Stop</button>
        <button class="restart-btn px-3 py-1 text-xs font-medium rounded bg-yellow-700 hover:bg-yellow-600 text-white transition-colors ${container.state !== 'running' ? 'opacity-50 cursor-not-allowed' : ''}" ${container.state !== 'running' ? 'disabled' : ''}>Restart</button>
        <button class="logs-btn px-3 py-1 text-xs font-medium rounded bg-gray-600 hover:bg-gray-500 text-gray-300 transition-colors">Logs</button>
        <button class="rcon-toggle-btn px-3 py-1 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Open Console">
          ${game === 'terraria' ? 'Console' : 'RCON'}
        </button>
        <span class="state-badge inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${badgeColor}">
          ${escapeHtml(container.state)}
        </span>
      </div>
    </div>
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Image:</span> ${escapeHtml(container.image)}
    </div>
    <div class="container-status text-sm text-gray-400">
      <span class="font-medium text-gray-300">Status:</span> ${escapeHtml(container.status)}${container.uptime ? ' &middot; <span class="font-medium text-gray-300">Uptime:</span> ' + escapeHtml(container.uptime) : ''}${container.restart_policy ? ' &middot; <span class="font-medium text-gray-300">Restart:</span> ' + escapeHtml(container.restart_policy) : ''}${container.exit_code != null && container.state !== 'running' ? ' &middot; <span class="text-red-400">Exit: ' + escapeHtml(String(container.exit_code)) + (container.oom_killed ? ' (OOM Killed)' : '') + '</span>' : ''}
    </div>
    ${container.health ? '<div class="text-sm text-gray-400"><span class="font-medium text-gray-300">Health:</span> <span class="' + (container.health.status === 'healthy' ? 'text-green-400' : container.health.status === 'unhealthy' ? 'text-red-400' : 'text-yellow-400') + '">' + escapeHtml(container.health.status) + '</span></div>' : ''}
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Ports:</span> ${formatPorts(container.ports)}
    </div>
    <div class="flex gap-2 mt-2">
      <button class="config-btn px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition text-sm font-medium" data-container-id="${escapeHtml(container.id)}" data-container-name="${escapeHtml(container.name)}" data-container-state="${escapeHtml(container.state)}">
        Server Config
      </button>
      ${(meta.gameDataTypes && meta.gameDataTypes.length > 0) ? `<button class="gamedata-btn px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition text-sm font-medium" data-container-id="${escapeHtml(container.id)}" data-container-name="${escapeHtml(container.name)}" data-game="${escapeHtml(game)}">Game Data</button>` : ''}
      ${prospectsBtnHtml}
    </div>
    <div class="resources-container ${container.state === 'running' ? '' : 'hidden'}">
    </div>
    <div class="players-container ${container.state === 'running' ? '' : 'hidden'}">
    </div>
    <div class="rcon-container"></div>
    <div class="logs-container"></div>
    <div class="gamedata-container"></div>
  `;

  // Attach event listener for config button
  card.querySelector('.config-btn').addEventListener('click', function () {
    openConfigEditor(this.dataset.containerId, this.dataset.containerName, this.dataset.containerState, game);
  });

  const gameDataBtn = card.querySelector('.gamedata-btn');
  if (gameDataBtn) {
    gameDataBtn.addEventListener('click', function () {
      const container = this.closest('[data-container-id]');
      const dataEl = container.querySelector('.gamedata-container');
      if (dataEl.innerHTML) {
        dataEl.innerHTML = '';
        return;
      }
      loadGameData(this.dataset.containerId, game, dataEl);
    });
  }

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

  // Restart button
  card.querySelector('.restart-btn').addEventListener('click', async function () {
    if (!confirm('Restart this server? Players will be disconnected.')) return;
    this.disabled = true;
    this.textContent = 'Restarting...';
    try {
      const res = await fetch(`${API_BASE}/${container.id}/restart`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`${container.name} restarted`, 'success');
      } else {
        showToast(data.message || 'Restart failed', 'error');
        this.disabled = false;
        this.textContent = 'Restart';
      }
    } catch (err) {
      showToast(err.message, 'error');
      this.disabled = false;
      this.textContent = 'Restart';
    }
  });

  // Logs button
  card.querySelector('.logs-btn').addEventListener('click', function () {
    const logsContainer = card.querySelector('.logs-container');
    if (logsContainer.innerHTML) {
      logsContainer.innerHTML = '';
      this.textContent = 'Logs';
      this.classList.remove('bg-teal-700');
      this.classList.add('bg-gray-600');
      return;
    }
    this.textContent = 'Close Logs';
    this.classList.remove('bg-gray-600');
    this.classList.add('bg-teal-700');
    logsContainer.appendChild(createLogsPanel(container.id));
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
        fetchPlayers(container.id);
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

  const restartBtn = card.querySelector('.restart-btn');
  if (restartBtn) {
    restartBtn.disabled = container.state !== 'running';
    restartBtn.classList.toggle('opacity-50', container.state !== 'running');
    restartBtn.classList.toggle('cursor-not-allowed', container.state !== 'running');
    if (container.state === 'running') restartBtn.textContent = 'Restart';
  }

  const statusEl = card.querySelector('.container-status');
  if (statusEl) {
    let statusHtml = `<span class="font-medium text-gray-300">Status:</span> ${container.status}`;
    if (container.uptime) statusHtml += ` &middot; <span class="font-medium text-gray-300">Uptime:</span> ${container.uptime}`;
    if (container.restart_policy) statusHtml += ` &middot; <span class="font-medium text-gray-300">Restart:</span> ${container.restart_policy}`;
    if (container.exit_code != null && container.state !== 'running') statusHtml += ` &middot; <span class="text-red-400">Exit: ${container.exit_code}${container.oom_killed ? ' (OOM Killed)' : ''}</span>`;
    statusEl.innerHTML = statusHtml;
  }

  // Show/hide resources section — timer handles data updates
  const resContainer = card.querySelector('.resources-container');
  if (resContainer) {
    if (container.state === 'running') {
      resContainer.classList.remove('hidden');
    } else {
      resContainer.classList.add('hidden');
      resContainer.dataset.loaded = '';
      resContainer.innerHTML = '';
    }
  }

  const playersContainer = card.querySelector('.players-container');
  if (playersContainer) {
    if (container.state === 'running') {
      playersContainer.classList.remove('hidden');
    } else {
      playersContainer.classList.add('hidden');
      playersContainer.innerHTML = '';
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

// ============================================================================
// 5. PLAYERS
// ============================================================================

async function fetchPlayers(containerId) {
  const container = document.querySelector(`[data-container-id="${containerId}"]`);
  if (!container) return;
  const el = container.querySelector('.players-container');
  if (!el || el.classList.contains('hidden')) return;

  try {
    const res = await fetch(`${API_BASE}/${containerId}/players`);
    if (!res.ok) return;
    const data = await res.json();
    const players = data.players || [];
    if (players.length === 0) {
      el.innerHTML = '<div class="mt-1 pt-1 border-t border-gray-700 text-xs text-gray-600">No players connected</div>';
    } else {
      el.innerHTML = `
        <div class="mt-1 pt-1 border-t border-gray-700 text-xs">
          <div class="flex justify-between text-gray-400 mb-1">
            <span>Players (${players.length})</span>
          </div>
          <div class="flex flex-wrap gap-1">
            ${players.map(p => `<span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-700 text-gray-300">${escapeHtml(p.name)}${p.ping ? ' <span class="text-gray-500 ml-1">' + p.ping + 'ms</span>' : ''}</span>`).join('')}
          </div>
        </div>
      `;
    }
  } catch { /* ignore */ }
}

function fetchAllPlayers() {
  document.querySelectorAll('[data-container-id]').forEach(card => {
    const el = card.querySelector('.players-container');
    if (el && !el.classList.contains('hidden')) {
      fetchPlayers(card.dataset.containerId);
    }
  });
}

// ============================================================================
// 6. RESOURCES
// ============================================================================

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
          <div class="flex justify-between text-gray-500 mt-0.5">
            <span></span>
            <span class="res-peak-label"></span>
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
        <div class="flex justify-between text-gray-500 res-pids-row hidden">
          <span>Processes</span>
          <span class="res-pids-label">—</span>
        </div>
      </div>
    `;
  }

  const memLabel = resEl.querySelector('.res-mem-label');
  const memBar = resEl.querySelector('.res-mem-bar');
  const peakLabel = resEl.querySelector('.res-peak-label');
  const cpuLabel = resEl.querySelector('.res-cpu-label');
  const netrxLabel = resEl.querySelector('.res-netrx-label');
  const nettxLabel = resEl.querySelector('.res-nettx-label');
  const pidsRow = resEl.querySelector('.res-pids-row');
  const pidsLabel = resEl.querySelector('.res-pids-label');

  if (memLabel) memLabel.textContent = `${mem.usage_human || '—'} / ${mem.limit_human || '—'} (${(mem.percent || 0).toFixed(1)}%)`;
  if (memBar) {
    memBar.style.width = `${Math.min(mem.percent || 0, 100)}%`;
    memBar.className = `res-mem-bar ${memoryBarColor(mem.percent || 0)} h-1.5 rounded-full transition-all duration-700`;
  }
  if (peakLabel && mem.max_usage_human) peakLabel.textContent = `Peak: ${mem.max_usage_human}`;
  if (cpuLabel) cpuLabel.textContent = `${(cpu.percent || 0).toFixed(1)}%`;
  if (netrxLabel) netrxLabel.textContent = net.rx_human || '—';
  if (nettxLabel) nettxLabel.textContent = net.tx_human || '—';
  if (pidsRow && pidsLabel && resources.pids != null) {
    pidsRow.classList.remove('hidden');
    pidsLabel.textContent = resources.pids;
  }
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

// ============================================================================
// 8. GAME DATA
// ============================================================================

async function loadGameData(containerId, game, el) {
  const types = (getGameMeta(game).gameDataTypes || []);
  if (!types || types.length === 0) {
    el.innerHTML = '<div class="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-600">No game data available for this game</div>';
    return;
  }

  el.innerHTML = '<div class="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">Loading game data...</div>';

  const sections = [];
  for (const t of types) {
    try {
      const res = await fetch(`${API_BASE}/${containerId}/game-data/${t.type}`);
      if (!res.ok) continue;
      const data = await res.json();

      if (t.type === 'saves' || t.type === 'mods' || t.type === 'worlds') {
        const entries = data.entries || [];
        if (entries.length === 0) {
          sections.push(`<div><span class="font-medium text-gray-300">${t.label}:</span> <span class="text-gray-500">None found</span></div>`);
        } else {
          const list = entries.map(e => {
            const size = e.size > 1048576 ? (e.size / 1048576).toFixed(1) + ' MB' : (e.size / 1024).toFixed(1) + ' KB';
            return `<div class="flex justify-between py-0.5"><span class="text-gray-300">${escapeHtml(e.name)}</span><span class="text-gray-500">${size}</span></div>`;
          }).join('');
          sections.push(`<div class="mb-2"><span class="font-medium text-gray-300">${t.label} (${entries.length})</span><div class="ml-2 mt-1">${list}</div></div>`);
        }
      } else if (t.type === 'server-properties') {
        const props = data.properties || {};
        const keys = Object.keys(props).slice(0, 15);
        const rows = keys.map(k => `<div class="flex justify-between"><span class="text-gray-400">${k}</span><span class="text-gray-300">${escapeHtml(props[k])}</span></div>`).join('');
        sections.push(`<div class="mb-2"><span class="font-medium text-gray-300">${t.label}</span><div class="ml-2 mt-1">${rows}</div></div>`);
      } else {
        const items = data.data || [];
        if (Array.isArray(items) && items.length > 0) {
          const names = items.map(i => {
            if (typeof i === 'string') return i;
            return i.name || i.username || i.nickname || JSON.stringify(i);
          });
          sections.push(`<div class="mb-2"><span class="font-medium text-gray-300">${t.label} (${items.length})</span><div class="flex flex-wrap gap-1 ml-2 mt-1">${names.map(n => `<span class="px-2 py-0.5 rounded bg-gray-700 text-gray-300">${escapeHtml(n)}</span>`).join('')}</div></div>`);
        } else {
          sections.push(`<div><span class="font-medium text-gray-300">${t.label}:</span> <span class="text-gray-500">Empty</span></div>`);
        }
      }
    } catch {}
  }

  if (sections.length === 0) {
    el.innerHTML = '<div class="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-600">No data available</div>';
  } else {
    el.innerHTML = `<div class="mt-2 pt-2 border-t border-gray-700 text-xs space-y-1">${sections.join('')}</div>`;
  }
}

// ============================================================================
// 9. CONFIG EDITOR
// ============================================================================

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
  (getGameMeta('cs2').configFields || []).forEach(f => { fieldMap[f.key] = f; });

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
  (getGameMeta('minecraft').configFields || []).forEach(f => { fieldMap[f.key] = f; });

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
  (getGameMeta('factorio').configFields || []).forEach(f => { fieldMap[f.key] = f; });

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
  (getGameMeta('terraria').configFields || []).forEach(f => { fieldMap[f.key] = f; });

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
function addAiSuggestToConfigForm() {
  fetch('/api/ai/status').then(r => r.json()).then(({ enabled }) => {
    if (!enabled) return;
    const form = configModalBody.querySelector('.config-form') || configModalBody.querySelector('div');
    if (!form) return;

    const suggestBar = document.createElement('div');
    suggestBar.className = 'mb-4 p-3 rounded-md bg-violet-900/30 border border-violet-700/50';
    suggestBar.innerHTML = `
      <div class="flex items-center gap-2">
        <input type="text" class="ai-suggest-input flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white" placeholder="Describe changes in plain language, e.g. &quot;make it creative mode with 10 max players&quot;">
        <button class="ai-suggest-btn px-3 py-1.5 text-sm rounded bg-violet-600 text-white hover:bg-violet-500" disabled>Suggest</button>
      </div>
      <div class="ai-suggest-result mt-2 hidden"></div>
    `;

    form.insertBefore(suggestBar, form.firstChild);

    const input = suggestBar.querySelector('.ai-suggest-input');
    const btn = suggestBar.querySelector('.ai-suggest-btn');
    const result = suggestBar.querySelector('.ai-suggest-result');

    input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) btn.click(); });

    btn.addEventListener('click', async () => {
      if (!currentEditContainer || !input.value.trim()) return;
      btn.disabled = true;
      btn.textContent = 'Thinking...';
      result.classList.remove('hidden');
      result.innerHTML = '<span class="text-xs text-gray-400">Asking AI...</span>';

      try {
        const res = await fetch(`/api/ai/${currentEditContainer.id}/suggest-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input.value.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || res.statusText);
        }
        const data = await res.json();
        const suggestions = data.suggestions || {};

        if (suggestions.message) {
          result.innerHTML = `<div class="text-xs text-yellow-300 p-2">${escapeHtml(suggestions.message)}</div>`;
          return;
        }

        const keys = Object.keys(suggestions);
        if (keys.length === 0) {
          result.innerHTML = '<div class="text-xs text-gray-400">No suggestions returned.</div>';
          return;
        }

        let html = '<div class="text-xs text-violet-300 mb-2">AI suggests these changes:</div><div class="space-y-1">';
        for (const key of keys) {
          html += `<label class="flex items-center gap-2 p-1.5 rounded bg-gray-800 hover:bg-gray-750 cursor-pointer">
            <input type="checkbox" class="ai-suggest-check" data-key="${escapeHtml(key)}" data-value="${escapeHtml(String(suggestions[key]))}" checked>
            <span class="font-mono text-gray-300">${escapeHtml(key)}</span>
            <span class="text-gray-500">&rarr;</span>
            <span class="text-green-400">${escapeHtml(String(suggestions[key]))}</span>
          </label>`;
        }
        html += '</div><button class="ai-suggest-apply mt-2 px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-500">Apply Selected</button>';
        result.innerHTML = html;

        result.querySelector('.ai-suggest-apply').addEventListener('click', () => {
          result.querySelectorAll('.ai-suggest-check:checked').forEach(cb => {
            const formInput = configModalBody.querySelector(`[data-config-key="${cb.dataset.key}"]`);
            if (formInput) {
              formInput.value = cb.dataset.value;
              formInput.dispatchEvent(new Event('change'));
            }
          });
          result.innerHTML = '<div class="text-xs text-green-400">Applied! Review and save.</div>';
        });
      } catch (err) {
        result.innerHTML = `<div class="text-xs text-red-400">${escapeHtml(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Suggest';
      }
    });
  }).catch(() => {});
}

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

    addAiSuggestToConfigForm();
  } catch (err) {
    configModalBody.innerHTML = `<div class="text-center py-8"><p class="text-red-400 text-sm">Failed to load config: ${escapeHtml(err.message)}</p></div>`;
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
  configModalSave.classList.remove('hidden');
  configModalSave.textContent = 'Save Config';
  document.getElementById('config-modal-backups').classList.remove('hidden');
}

/**
 * Save the config via PUT request.
 */
async function showConfigDiffAndSave() {
  if (!currentEditContainer) return;

  const { config, launchParams } = collectFormConfig();
  const changes = buildConfigDiff(currentEditConfig, config, currentEditLaunchParams, launchParams);

  if (changes.length === 0) {
    showToast('No changes detected', 'warning');
    return;
  }

  let diffHtml = '<div class="space-y-1.5 max-h-96 overflow-y-auto">';
  for (const change of changes) {
    const arrow = '<span class="text-gray-500 mx-1">&rarr;</span>';
    diffHtml += `<div class="flex items-center gap-2 text-sm py-1 px-2 rounded ${change.section === 'json' ? 'bg-gray-800' : 'bg-gray-750'}">
      <span class="text-gray-400 font-mono text-xs">${escapeHtml(change.key)}</span>
      <span class="text-red-400 line-through">${escapeHtml(String(change.old)) || '<em class="text-gray-600">empty</em>'}</span>
      ${arrow}
      <span class="text-green-400">${escapeHtml(String(change.new)) || '<em class="text-gray-600">empty</em>'}</span>
    </div>`;
  }
  diffHtml += '</div>';

  configModalBody.innerHTML = `
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-yellow-400 mb-3">${changes.length} change${changes.length > 1 ? 's' : ''} detected</h3>
      ${diffHtml}
    </div>
    <div class="flex gap-3 justify-end">
      <button id="diff-cancel" class="px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 transition text-sm font-medium">Cancel</button>
      <button id="diff-confirm" class="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-500 transition text-sm font-medium">Confirm Save</button>
    </div>
  `;

  document.getElementById('diff-cancel').addEventListener('click', () => {
    openConfigEditor(currentEditContainer.id, currentEditContainer.name, currentEditContainer.state, currentEditGame);
  });
  document.getElementById('diff-confirm').addEventListener('click', () => doSaveConfig(config, launchParams));
}

function buildConfigDiff(oldConfig, newConfig, oldLaunch, newLaunch) {
  const changes = [];
  const game = currentEditGame;
  const meta = getGameMeta(game);

  if (game === 'icarus') {
    const oldSec = oldConfig?._sections || {};
    const newSec = newConfig?._sections || {};
    const allSections = new Set([...Object.keys(oldSec), ...Object.keys(newSec)]);
    for (const section of allSections) {
      const oldFields = oldSec[section] || {};
      const newFields = newSec[section] || {};
      const allKeys = new Set([...Object.keys(oldFields), ...Object.keys(newFields)]);
      for (const key of allKeys) {
        if (String(oldFields[key] || '') !== String(newFields[key] || '')) {
          changes.push({ key: `${section}.${key}`, old: oldFields[key] || '', new: newFields[key] || '', section: 'ini' });
        }
      }
    }
  } else if (game === 'cs2' || game === 'minecraft') {
    const oldEnv = oldConfig?.env || {};
    const newEnv = newConfig?.env || {};
    const allKeys = new Set([...Object.keys(oldEnv), ...Object.keys(newEnv)]);
    for (const key of allKeys) {
      if (String(oldEnv[key] || '') !== String(newEnv[key] || '')) {
        changes.push({ key, old: oldEnv[key] || '', new: newEnv[key] || '', section: 'env' });
      }
    }
  } else if (game === 'factorio' || game === 'terraria') {
    const oldJson = oldConfig?.json || {};
    const newJson = newConfig?.json || {};
    const allKeys = new Set([...Object.keys(oldJson), ...Object.keys(newJson)]);
    for (const key of allKeys) {
      const oldVal = String(oldJson[key] ?? '');
      const newVal = String(newJson[key] ?? '');
      if (oldVal !== newVal) {
        changes.push({ key, old: oldVal, new: newVal, section: 'json' });
      }
    }
  }

  if (oldLaunch && newLaunch) {
    const allKeys = new Set([...Object.keys(oldLaunch), ...Object.keys(newLaunch)]);
    for (const key of allKeys) {
      if (String(oldLaunch[key] || '') !== String(newLaunch[key] || '')) {
        changes.push({ key: `launch:${key}`, old: oldLaunch[key] || '', new: newLaunch[key] || '', section: 'launch' });
      }
    }
  }

  return changes;
}

async function doSaveConfig(config, launchParams) {
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
configModalSave.addEventListener('click', showConfigDiffAndSave);

document.getElementById('config-modal-backups').addEventListener('click', async function () {
  if (!currentEditContainer) return;
  this.disabled = true;
  this.textContent = 'Loading...';
  try {
    const res = await fetch(`${API_BASE}/${currentEditContainer.id}/config/backups`);
    const data = await res.json();
    const backups = data.backups || [];
    if (backups.length === 0) {
      showToast('No backups found', 'warning');
      this.disabled = false;
      this.textContent = 'Backups';
      return;
    }
    const listHtml = backups.map(b => {
      const date = new Date(b.created).toLocaleString();
      const size = b.size > 1024 ? (b.size / 1024).toFixed(1) + ' KB' : b.size + ' B';
      return `<div class="flex items-center justify-between py-2 px-3 bg-gray-700 rounded mb-1.5">
        <div>
          <div class="text-sm text-white">${date}</div>
          <div class="text-xs text-gray-400">${size} &middot; ${b.file}</div>
        </div>
        <button class="backup-restore-btn px-3 py-1 text-xs rounded bg-yellow-700 hover:bg-yellow-600 text-white" data-file="${b.file}">Restore</button>
      </div>`;
    }).join('');
    configModalBody.innerHTML = `
      <div class="mb-3">
        <h3 class="text-sm font-medium text-gray-300 mb-2">Backup History (${backups.length})</h3>
        ${listHtml}
      </div>
    `;
    configModalBody.querySelectorAll('.backup-restore-btn').forEach(btn => {
      btn.addEventListener('click', async function () {
        if (!confirm('Restore this backup? Current config will be replaced.')) return;
        this.disabled = true;
        this.textContent = 'Restoring...';
        try {
          const restoreRes = await fetch(`${API_BASE}/${currentEditContainer.id}/config/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: this.dataset.file }),
          });
          const restoreData = await restoreRes.json();
          if (restoreRes.ok) {
            showToast('Backup restored. Reload config to see changes.', 'success');
          } else {
            showToast(restoreData.error || 'Restore failed', 'error');
          }
        } catch (err) {
          showToast('Restore failed: ' + err.message, 'error');
        }
        this.disabled = false;
        this.textContent = 'Restore';
      });
    });
    configModalSave.classList.add('hidden');
    document.getElementById('config-modal-backups').classList.add('hidden');
  } catch (err) {
    showToast('Failed to load backups', 'error');
  }
  this.disabled = false;
  this.textContent = 'Backups';
});

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

// ============================================================================
// 10. PROSPECTS (ICARUS)
// ============================================================================

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
    prospectsModalBody.innerHTML = `<p class="text-red-400 text-sm">Failed to load: ${escapeHtml(err.message)}</p>`;
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

// ============================================================================
// 2. AUTH
// ============================================================================

let authToken = null;

async function checkSession() {
  try {
    const headers = {};
    if (authToken) headers['x-session-token'] = authToken;
    const res = await fetch('/api/auth/session', { headers });
    const data = await res.json();
    if (data.authenticated) {
      if (data.token) authToken = data.token;
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('logout-btn').classList.toggle('hidden', !data.authRequired);
      return true;
    }
    if (data.authRequired) {
      showLoginModal();
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

function showLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('login-username').focus();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.authenticated) {
      authToken = data.token || null;
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('logout-btn').classList.toggle('hidden', !authToken);
      document.getElementById('login-password').value = '';
      fetchContainers();
    } else {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.textContent = 'Connection error';
    errorEl.classList.remove('hidden');
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Sign In';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  const headers = {};
  if (authToken) headers['x-session-token'] = authToken;
  await fetch('/api/auth/logout', { method: 'POST', headers });
  authToken = null;
  document.getElementById('logout-btn').classList.add('hidden');
  showLoginModal();
});

const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  if (authToken && typeof url === 'string' && url.startsWith('/api/') && !url.startsWith('/api/auth')) {
    options.headers = { ...(options.headers || {}), 'x-session-token': authToken };
  }
  return originalFetch(url, options).then(res => {
    if (res.status === 401 && typeof url === 'string' && !url.startsWith('/api/auth')) {
      showLoginModal();
    }
    return res;
  });
};

// Initial fetch
loadGameMetadata();
checkSession().then(authed => { if (authed) fetchContainers(); });

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

// ============================================================================
// 11. HOST STATS
// ============================================================================

async function fetchHostStats() {
  try {
    const res = await fetch('/api/host/stats');
    if (!res.ok) return;
    const data = await res.json();
    const el = document.getElementById('host-stats');
    if (!el) return;
    el.classList.remove('hidden');

    const nameEl = document.getElementById('host-name');
    const uptimeEl = document.getElementById('host-uptime');
    const dockerVerEl = document.getElementById('host-docker-ver');
    const memLabel = document.getElementById('host-mem-label');
    const memBar = document.getElementById('host-mem-bar');
    const loadLabel = document.getElementById('host-load-label');
    const cpusLabel = document.getElementById('host-cpus-label');
    const containersLabel = document.getElementById('host-containers-label');

    if (nameEl) nameEl.textContent = data.hostname || '';
    if (uptimeEl) {
      const d = Math.floor(data.uptime / 86400);
      const h = Math.floor((data.uptime % 86400) / 3600);
      uptimeEl.textContent = `Up ${d}d ${h}h`;
    }
    if (dockerVerEl && data.docker) dockerVerEl.textContent = `Docker ${data.docker.version || ''}`;

    if (memLabel && data.memory) {
      memLabel.textContent = `${data.memory.used_human || '—'} / ${data.memory.total_human || '—'} (${(data.memory.percent || 0).toFixed(1)}%)`;
    }
    if (memBar && data.memory) {
      const pct = Math.min(data.memory.percent || 0, 100);
      memBar.style.width = `${pct}%`;
      memBar.className = `${memoryBarColor(pct)} h-1.5 rounded-full transition-all duration-700`;
    }
    if (loadLabel && data.load_average) {
      loadLabel.textContent = data.load_average.map(v => v.toFixed(2)).join(' / ');
    }
    if (cpusLabel) cpusLabel.textContent = data.cpus || '—';
    if (containersLabel && data.docker) {
      containersLabel.textContent = `${data.docker.containers_running || 0} running / ${data.docker.containers || 0} total`;
    }
  } catch { /* ignore */ }
}
fetchHostStats();

// ============================================================================
// 12. EVENTS / SSE & POLLING
// ============================================================================

// Polling intervals (paused when tab hidden)
let pollTimers = {};
let isTabVisible = true;

function startPolling() {
  stopPolling();
  pollTimers.resources = setInterval(() => { if (isTabVisible) fetchAllResources(); }, 10000);
  pollTimers.host = setInterval(() => { if (isTabVisible) fetchHostStats(); }, 10000);
  pollTimers.players = setInterval(() => { if (isTabVisible) fetchAllPlayers(); }, 15000);
  pollTimers.containers = setInterval(() => { if (isTabVisible) fetchContainers(); }, 30000);
}

function stopPolling() {
  for (const timer of Object.values(pollTimers)) clearInterval(timer);
  pollTimers = {};
}

document.addEventListener('visibilitychange', () => {
  isTabVisible = !document.hidden;
  if (isTabVisible) {
    fetchContainers();
    fetchAllResources();
    fetchHostStats();
    fetchAllPlayers();
  }
});

startPolling();

// Docker Events SSE for real-time notifications + container refresh
(function connectEvents() {
  const headers = {};
  if (authToken) headers['x-session-token'] = authToken;
  fetch('/api/events/stream', { headers }).then(res => {
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          setTimeout(connectEvents, 5000);
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6));
            if (event.action === 'die' && event.name) {
              showToast(`${event.name} stopped unexpectedly`, 'error');
              fetchContainers();
            } else if (event.action === 'start' && event.name) {
              showToast(`${event.name} started`, 'success');
              fetchContainers();
            } else if (event.action === 'restart' || event.action === 'stop' || event.action === 'pause' || event.action === 'unpause' || event.action === 'rename' || event.action === 'destroy') {
              fetchContainers();
            }
          } catch (err) {
            console.warn('Failed to parse SSE event:', err);
          }
        }
        read();
      }).catch(() => setTimeout(connectEvents, 5000));
    }
    read();
  }).catch(() => setTimeout(connectEvents, 30000));
})();
