const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

const mockGetContainer = jest.fn();
const mockListContainers = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: mockListContainers,
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-test-'));
const originalRoot = process.env.GAME_CONFIG_ROOT;

beforeAll(() => {
  process.env.GAME_CONFIG_ROOT = TMP_DIR;
  jest.resetModules();
});

afterAll(() => {
  process.env.GAME_CONFIG_ROOT = originalRoot;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const app = require('../src/index');

describe('Schedules API', () => {
  it('should return schedules array', async () => {
    const res = await request(app).get('/api/schedules/');
    expect(res.status).toBe(200);
    expect(res.body.schedules).toBeDefined();
    expect(Array.isArray(res.body.schedules)).toBe(true);
  });

  it('should create and delete a schedule', async () => {
    const res = await request(app)
      .post('/api/schedules/')
      .send({
        containerId: 'abc123',
        containerName: 'test-server',
        action: 'restart',
        cron: '0 4 * * *',
      });
    expect(res.status).toBe(200);
    expect(res.body.schedule).toBeDefined();
    expect(res.body.schedule.action).toBe('restart');

    const delRes = await request(app).delete(`/api/schedules/${res.body.schedule.id}`);
    expect(delRes.status).toBe(200);
  });

  it('should reject invalid action', async () => {
    const res = await request(app)
      .post('/api/schedules/')
      .send({
        containerId: 'abc123',
        action: 'delete',
        cron: '0 4 * * *',
      });
    expect(res.status).toBe(400);
  });

  it('should reject invalid cron', async () => {
    const res = await request(app)
      .post('/api/schedules/')
      .send({
        containerId: 'abc123',
        action: 'restart',
        cron: 'invalid',
      });
    expect(res.status).toBe(400);
  });
});

describe('Scheduler cron parsing', () => {
  const { parseCron } = require('../src/services/scheduler');

  it('should parse every day at 4am', () => {
    const matches = parseCron('0 4 * * *');
    expect(matches).not.toBeNull();
    const date = new Date(2026, 0, 15, 4, 0, 0);
    expect(matches(date)).toBe(true);
    const date2 = new Date(2026, 0, 15, 5, 0, 0);
    expect(matches(date2)).toBe(false);
  });

  it('should parse every 6 hours', () => {
    const matches = parseCron('0 */6 * * *');
    expect(matches).not.toBeNull();
    expect(matches(new Date(2026, 0, 15, 0, 0, 0))).toBe(true);
    expect(matches(new Date(2026, 0, 15, 6, 0, 0))).toBe(true);
    expect(matches(new Date(2026, 0, 15, 3, 0, 0))).toBe(false);
  });

  it('should reject invalid cron expressions', () => {
    expect(parseCron('invalid')).toBeNull();
    expect(parseCron('')).toBeNull();
    expect(parseCron('0 0 0 0 0 0')).toBeNull();
  });
});
