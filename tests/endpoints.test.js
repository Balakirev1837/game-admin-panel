const request = require('supertest');

describe('GET /health', () => {
  const app = require('../src/index');

  it('should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/version', () => {
  const app = require('../src/index');

  it('should return version from VERSION file', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('GET /api/games', () => {
  const app = require('../src/index');

  it('should return list of supported games', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(200);
    expect(res.body.games).toBeDefined();
    expect(Array.isArray(res.body.games)).toBe(true);
    expect(res.body.games.length).toBeGreaterThanOrEqual(5);

    const ids = res.body.games.map(g => g.id);
    expect(ids).toContain('icarus');
    expect(ids).toContain('cs2');
    expect(ids).toContain('minecraft');
    expect(ids).toContain('factorio');
    expect(ids).toContain('terraria');
  });

  it('should include config fields for each game', async () => {
    const res = await request(app).get('/api/games');
    const cs2 = res.body.games.find(g => g.id === 'cs2');
    expect(cs2).toBeDefined();
    expect(cs2.label).toBe('CS2');
    expect(cs2.badgeColor).toBe('bg-orange-600');
    expect(cs2.configFields.length).toBeGreaterThan(0);
    expect(cs2.quickCommands.length).toBeGreaterThan(0);
  });
});

describe('GET /api/containers/:id/resources route', () => {
  it('should return resource data from stats', async () => {
    const { parseStats } = require('../src/services/resources');

    const rawStats = {
      memory_stats: { usage: 1073741824, limit: 8589934592, max_usage: 1610612736 },
      cpu_stats: { cpu_usage: { total_usage: 100000 }, system_cpu_usage: 500000, online_cpus: 2 },
      precpu_stats: { cpu_usage: { total_usage: 50000 }, system_cpu_usage: 250000 },
      networks: {},
      blkio_stats: {},
      pids_stats: { current: 12 },
    };

    const result = parseStats(rawStats);
    expect(result.memory.usage).toBe(1073741824);
    expect(result.memory.max_usage).toBe(1610612736);
    expect(result.cpu).toBeDefined();
    expect(result.pids).toBe(12);
  });
});
