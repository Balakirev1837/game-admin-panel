const API_BASE = '/api/containers';
const serverList = document.getElementById('server-list');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyEl = document.getElementById('empty');

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
  const card = document.createElement('div');
  card.className =
    'bg-gray-800 rounded-lg shadow-md p-5 border border-gray-700 flex flex-col gap-3';
  card.dataset.containerId = container.id;

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">${container.name}</h2>
      <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${badgeColor}">
        ${container.state}
      </span>
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
  `;

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
