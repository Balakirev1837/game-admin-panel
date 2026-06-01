function statusColor(state) {
  switch (state) {
    case 'running': return 'bg-green-500';
    case 'exited':
    case 'dead': return 'bg-red-500';
    case 'paused': return 'bg-yellow-500';
    case 'restarting': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

function memoryBarColor(percent) {
  if (percent > 80) return 'bg-red-500';
  if (percent > 60) return 'bg-yellow-500';
  return 'bg-green-500';
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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gameLabel(game) {
  if (typeof gameMetadata !== 'undefined' && gameMetadata[game]) {
    return gameMetadata[game].label;
  }
  const labels = {
    cs2: 'CS2',
    minecraft: 'Minecraft',
    factorio: 'Factorio',
    terraria: 'Terraria',
    icarus: 'Icarus',
  };
  return labels[game] || game;
}

function gameBadgeColor(game) {
  if (typeof gameMetadata !== 'undefined' && gameMetadata[game]) {
    return gameMetadata[game].badgeColor;
  }
  const colors = {
    cs2: 'bg-orange-600',
    minecraft: 'bg-emerald-600',
    factorio: 'bg-red-600',
    terraria: 'bg-green-600',
    icarus: 'bg-blue-600',
  };
  return colors[game] || 'bg-blue-600';
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    statusColor,
    memoryBarColor,
    formatPorts,
    escapeHtml,
    gameLabel,
    gameBadgeColor,
    formatDuration,
  };
}
