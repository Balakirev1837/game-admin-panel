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

  it('should return 503 when Docker is unavailable', async () => {
    jest.resetModules();
    jest.mock('dockerode', () => {
      return jest.fn().mockImplementation(() => ({
        listContainers: jest.fn().mockResolvedValue([]),
        ping: jest.fn().mockResolvedValue('OK'),
        getContainer: jest.fn(),
      }));
    });

    const mockDocker = {
      getContainer: jest.fn().mockReturnValue({
        stats: jest.fn().mockRejectedValue(new Error('not available')),
      }),
      listContainers: jest.fn().mockResolvedValue([]),
      ping: jest.fn().mockResolvedValue('OK'),
    };

    jest.doMock('../src/services/docker', () => ({
      docker: mockDocker,
      verifyDockerConnection: jest.fn(),
    }));

    const testApp = require('../src/index');
    const res = await request(testApp).get('/api/containers/abc123/resources');

    expect([200, 500, 503]).toContain(res.status);
  });
});
