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

// --- Known Icarus config field definitions ---
// Maps flat config keys to friendly labels, types, and options.
// These are rendered as form fields in the editor.
const CONFIG_FIELDS = [
  { key: 'ServerName', label: 'Server Name', type: 'text', section: null, placeholder: 'My Icarus Server' },
  { key: 'MaxPlayers', label: 'Max Players', type: 'number', section: null, placeholder: '8', min: '1', max: '128' },
  { key: 'Password', label: 'Server Password', type: 'text', section: null, placeholder: '' },
  { key: 'ServerPassword', label: 'Server Password', type: 'text', section: '/Game/Settings', placeholder: '' },
  { key: 'ServerName', label: 'Server Name', type: 'text', section: '/Game/Settings', placeholder: 'My Icarus Server' },
  { key: 'MaxPlayers', label: 'Max Players', type: 'number', section: '/Game/Settings', placeholder: '8', min: '1', max: '128' },
  { key: 'MissionName', label: 'Mission / Scenario', type: 'text', section: '/Game/Settings', placeholder: '' },
  { key: 'Map', label: 'Map', type: 'select', section: '/Game/Settings', options: ['', 'Forest', 'Desert', 'Prometheus'] },
  { key: 'Difficulty', label: 'Difficulty', type: 'select', section: '/Script/Icarus.Settings', options: ['', 'Normal', 'Hard', 'Custom'] },
  { key: 'bEnabled', label: 'Enabled', type: 'select', section: '/Script/Icarus.Settings', options: ['', 'True', 'False'] },
];

// Track the current container being edited
let currentEditContainer = null;
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

function createRconPanel(containerId) {
  const session = getRconSession(containerId);

  const panel = document.createElement('div');
  panel.className = 'rcon-panel mt-3 border-t border-gray-600 pt-3 flex flex-col gap-2';

  // Output area
  const output = document.createElement('div');
  output.className =
    'bg-gray-900 rounded border border-gray-700 p-2 h-40 overflow-y-auto text-xs font-mono';
  output.innerHTML = '<div class="text-gray-500 text-xs">RCON Console ready. Type a command and press Send.</div>';

  // Input row
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

  // Quick commands
  const quickRow = document.createElement('div');
  quickRow.className = 'flex flex-wrap gap-2 mt-1';
  
  const quickCommands = [
    { label: 'Resume Prospect', cmd: 'ResumeProspect', immediate: true },
    { label: 'Load Prospect...', cmd: 'LoadProspect ' },
    { label: 'Create Prospect...', cmd: 'CreateProspect ' },
    { label: 'Save', cmd: 'Server.Save', immediate: true },
    { label: 'Shutdown', cmd: 'Shutdown', immediate: true }
  ];

  quickCommands.forEach(qc => {
    const btn = document.createElement('button');
    btn.className = 'px-2 py-1 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs text-gray-300 transition-colors';
    btn.textContent = qc.label;
    btn.addEventListener('click', () => {
      if (qc.immediate) {
        sendRconCommand(containerId, qc.cmd, output, session);
      } else {
        input.value = qc.cmd;
        input.focus();
      }
    });
    quickRow.appendChild(btn);
  });

  // Wire up send
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

  const card = document.createElement('div');
  card.className =
    'bg-gray-800 rounded-lg shadow-md p-5 border border-gray-700 flex flex-col gap-3';
  card.dataset.containerId = container.id;

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">${container.name}</h2>
      <div class="flex items-center gap-2">
        <button class="rcon-toggle-btn px-3 py-1 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Open RCON Console">
          RCON
        </button>
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${badgeColor}">
          ${container.state}
        </span>
      </div>
    </div>
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Image:</span> ${container.image}
    </div>
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Status:</span> ${container.status}
    </div>
    <div class="text-sm text-gray-400">
      <span class="font-medium text-gray-300">Ports:</span> ${formatPorts(container.ports)}
    </div>
    <div class="flex gap-2 mt-2">
      <button class="config-btn px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition text-sm font-medium" data-container-id="${container.id}" data-container-name="${container.name}" data-container-state="${container.state}">
        Server Config
      </button>
    </div>
    <div class="rcon-container"></div>
  `;

  // Attach event listener for config button
  card.querySelector('.config-btn').addEventListener('click', function () {
    openConfigEditor(this.dataset.containerId, this.dataset.containerName, this.dataset.containerState);
  });

  // Wire up RCON toggle button
  const toggleBtn = card.querySelector('.rcon-toggle-btn');
  const rconContainer = card.querySelector('.rcon-container');

  if (session.open) {
    // Re-render the panel if it was previously open
    rconContainer.appendChild(createRconPanel(container.id));
    toggleBtn.textContent = 'Close RCON';
    toggleBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    toggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
  }

  toggleBtn.addEventListener('click', () => {
    session.open = !session.open;
    if (session.open) {
      rconContainer.appendChild(createRconPanel(container.id));
      toggleBtn.textContent = 'Close RCON';
      toggleBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      toggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
      // Focus the input
      const input = rconContainer.querySelector('.rcon-input');
      if (input) input.focus();
    } else {
      rconContainer.innerHTML = '';
      toggleBtn.textContent = 'RCON';
      toggleBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      toggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    }
  });

  return card;
}

function renderContainers(containers) {
  serverList.innerHTML = '';

  if (containers.length === 0) {
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  containers.forEach((container) => {
    serverList.appendChild(renderContainerCard(container));
  });
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

/**
 * Render a single form field as HTML.
 */
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
      <label for="${inputId}" class="block text-sm font-medium text-gray-300 mb-1">${field.label}</label>
      ${inputHtml}
    </div>
  `;
}

/**
 * Collect form values and merge them back into the original config structure.
 */
function collectFormConfig() {
  // Deep clone the original config to preserve comments and unknown sections
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
      // Root level
      if (!updatedConfig._root) updatedConfig._root = {};
      updatedConfig._root[key] = value;
    } else if (section) {
      // Section level
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
async function openConfigEditor(containerId, containerName, containerState) {
  currentEditContainer = { id: containerId, name: containerName, state: containerState };
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
    currentEditConfig = data.config;
    currentEditLaunchParams = data.launchParams || {};

    let bodyHtml = '';

    // Show restart warning if container is running
    if (containerState === 'running') {
      bodyHtml += `
        <div class="mb-4 p-3 rounded-md bg-yellow-900 border border-yellow-700 text-yellow-200 text-sm">
          <strong>Warning:</strong> This server is currently running. Config changes may require a restart to take effect.
        </div>
      `;
    }

    bodyHtml += buildConfigForm(currentEditConfig, currentEditLaunchParams);
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
});

// Initial fetch
fetchContainers();

// Auto-refresh every 5 seconds
setInterval(fetchContainers, 5000);
