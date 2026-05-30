const request = require('supertest');

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
    info: jest.fn().mockResolvedValue({
      ServerVersion: '24.0.2',
      Containers: 5,
      ContainersRunning: 3,
      ContainersPaused: 1,
      ContainersStopped: 1,
      Images: 8,
    }),
  }));
});

const app = require('../src/index');

describe('GET /api/host/stats', () => {
  it('should return host system stats', async () => {
    const res = await request(app).get('/api/host/stats');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hostname');
    expect(res.body).toHaveProperty('platform');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('load_average');
    expect(res.body).toHaveProperty('cpus');
    expect(typeof res.body.cpus).toBe('number');
    expect(res.body.memory).toBeDefined();
    expect(typeof res.body.memory.total).toBe('number');
    expect(typeof res.body.memory.free).toBe('number');
    expect(typeof res.body.memory.used).toBe('number');
    expect(typeof res.body.memory.percent).toBe('number');
    expect(res.body.memory.total_human).toBeDefined();
    expect(res.body.memory.used_human).toBeDefined();
  });

  it('should include Docker info when available', async () => {
    const res = await request(app).get('/api/host/stats');

    expect(res.status).toBe(200);
    expect(res.body.docker).toBeDefined();
    expect(res.body.docker.version).toBe('24.0.2');
    expect(res.body.docker.containers).toBe(5);
    expect(res.body.docker.containers_running).toBe(3);
    expect(res.body.docker.containers_paused).toBe(1);
    expect(res.body.docker.images).toBe(8);
  });

  it('should include disk usage info', async () => {
    const res = await request(app).get('/api/host/stats');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.disk)).toBe(true);
  });
});
