const {
  statusColor,
  memoryBarColor,
  formatPorts,
  escapeHtml,
  gameLabel,
  gameBadgeColor,
  formatDuration,
} = require('../public/utils');

describe('statusColor', () => {
  it('should return green for running', () => {
    expect(statusColor('running')).toBe('bg-green-500');
  });

  it('should return red for exited and dead', () => {
    expect(statusColor('exited')).toBe('bg-red-500');
    expect(statusColor('dead')).toBe('bg-red-500');
  });

  it('should return yellow for paused', () => {
    expect(statusColor('paused')).toBe('bg-yellow-500');
  });

  it('should return blue for restarting', () => {
    expect(statusColor('restarting')).toBe('bg-blue-500');
  });

  it('should return gray for unknown states', () => {
    expect(statusColor('created')).toBe('bg-gray-500');
    expect(statusColor('removing')).toBe('bg-gray-500');
    expect(statusColor('')).toBe('bg-gray-500');
  });
});

describe('memoryBarColor', () => {
  it('should return green below 60%', () => {
    expect(memoryBarColor(30)).toBe('bg-green-500');
    expect(memoryBarColor(0)).toBe('bg-green-500');
    expect(memoryBarColor(59.9)).toBe('bg-green-500');
  });

  it('should return green at exactly 59%', () => {
    expect(memoryBarColor(59)).toBe('bg-green-500');
  });

  it('should return green at exactly 60% (uses >, not >=)', () => {
    expect(memoryBarColor(60)).toBe('bg-green-500');
  });

  it('should return yellow between 61% and 80%', () => {
    expect(memoryBarColor(61)).toBe('bg-yellow-500');
    expect(memoryBarColor(70)).toBe('bg-yellow-500');
    expect(memoryBarColor(79)).toBe('bg-yellow-500');
  });

  it('should return yellow at exactly 80% (uses >, not >=)', () => {
    expect(memoryBarColor(80)).toBe('bg-yellow-500');
  });

  it('should return red above 80%', () => {
    expect(memoryBarColor(81)).toBe('bg-red-500');
    expect(memoryBarColor(100)).toBe('bg-red-500');
    expect(memoryBarColor(200)).toBe('bg-red-500');
  });
});

describe('formatPorts', () => {
  it('should return None for empty array', () => {
    expect(formatPorts([])).toBe('None');
    expect(formatPorts(null)).toBe('None');
    expect(formatPorts(undefined)).toBe('None');
  });

  it('should format public port mappings', () => {
    const ports = [{ PublicPort: 8080, PrivatePort: 80, Type: 'tcp' }];
    expect(formatPorts(ports)).toBe('8080->80/tcp');
  });

  it('should format multiple ports', () => {
    const ports = [
      { PublicPort: 8080, PrivatePort: 80, Type: 'tcp' },
      { PublicPort: 8443, PrivatePort: 443, Type: 'tcp' },
    ];
    expect(formatPorts(ports)).toBe('8080->80/tcp, 8443->443/tcp');
  });

  it('should show private port when no public port', () => {
    const ports = [{ PublicPort: null, PrivatePort: 25575, Type: 'tcp' }];
    expect(formatPorts(ports)).toBe('25575/tcp');
  });
});

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should handle plain text without changes', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('gameLabel', () => {
  it('should return human-readable game names', () => {
    expect(gameLabel('cs2')).toBe('CS2');
    expect(gameLabel('minecraft')).toBe('Minecraft');
    expect(gameLabel('factorio')).toBe('Factorio');
    expect(gameLabel('terraria')).toBe('Terraria');
    expect(gameLabel('icarus')).toBe('Icarus');
  });

  it('should pass through unknown game names', () => {
    expect(gameLabel('unknown')).toBe('unknown');
  });
});

describe('gameBadgeColor', () => {
  it('should return unique colors for each game', () => {
    const colors = new Set();
    ['cs2', 'minecraft', 'factorio', 'terraria', 'icarus'].forEach(g => {
      colors.add(gameBadgeColor(g));
    });
    expect(colors.size).toBe(5);
  });

  it('should return default color for unknown games', () => {
    expect(gameBadgeColor('unknown')).toBe('bg-blue-600');
  });
});

describe('formatDuration', () => {
  it('should return null for invalid input', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
  });

  it('should format seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('should format minutes', () => {
    expect(formatDuration(125)).toBe('2m');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3665)).toBe('1h 1m');
  });

  it('should format days and hours', () => {
    expect(formatDuration(90100)).toBe('1d 1h 1m');
  });

  it('should format complex durations', () => {
    expect(formatDuration(93600)).toBe('1d 2h');
  });

  it('should handle exactly 1 hour', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  it('should handle exactly 1 day', () => {
    expect(formatDuration(86400)).toBe('1d');
  });

  it('should handle exactly 1 minute', () => {
    expect(formatDuration(60)).toBe('1m');
  });
});

describe('resources - formatBytes edge cases', () => {
  const { parseStats } = require('../src/services/resources');

  it('should handle empty stats object', () => {
    const result = parseStats({});
    expect(result).toBeDefined();
  });

  it('should handle missing memory_stats gracefully', () => {
    const result = parseStats({});
    expect(result).toBeDefined();
  });

  it('should handle zero CPU values without division by zero', () => {
    const result = parseStats({
      memory_stats: { usage: 100, limit: 200 },
      cpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0, online_cpus: 1 },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
    });
    expect(result).toBeDefined();
  });

  it('should handle missing networks key', () => {
    const result = parseStats({
      memory_stats: { usage: 100, limit: 200 },
      cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500, online_cpus: 1 },
      precpu_stats: { cpu_usage: { total_usage: 50 }, system_cpu_usage: 250 },
    });
    expect(result).toBeDefined();
  });
});
