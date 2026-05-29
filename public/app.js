const API_BASE = '/api/containers';
const serverList = document.getElementById('server-list');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyEl = document.getElementById('empty');

// Per-container RCON session state
const rconSessions = {};

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
  const sendBtn = outputEl.closest('.rcon-panel').querySelector('.rcon-send-btn');
  const input = outputEl.closest('.rcon-panel').querySelector('.rcon-input');
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
  panel.appendChild(inputRow);

  return panel;
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
    <div class="rcon-container"></div>
  `;

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

// Initial fetch
fetchContainers();

// Auto-refresh every 5 seconds
setInterval(fetchContainers, 5000);
