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

  it('should parse specific minute and hour', () => {
    const matches = parseCron('30 14 * * *');
    expect(matches).not.toBeNull();
    expect(matches(new Date(2026, 0, 15, 14, 30))).toBe(true);
    expect(matches(new Date(2026, 0, 15, 14, 31))).toBe(false);
  });

  it('should parse day-of-week field', () => {
    const matches = parseCron('0 0 * * 1');
    expect(matches).not.toBeNull();
    expect(matches(new Date(2026, 0, 5))).toBe(true);
    expect(matches(new Date(2026, 0, 4))).toBe(false);
  });

  it('should parse step values', () => {
    const matches = parseCron('*/15 * * * *');
    expect(matches).not.toBeNull();
    expect(matches(new Date(2026, 0, 15, 10, 0))).toBe(true);
    expect(matches(new Date(2026, 0, 15, 10, 15))).toBe(true);
    expect(matches(new Date(2026, 0, 15, 10, 30))).toBe(true);
    expect(matches(new Date(2026, 0, 15, 10, 7))).toBe(false);
  });

  it('should reject cron with non-numeric fields', () => {
    expect(parseCron('a b c d e')).toBeNull();
  });

  it('should reject cron with zero step', () => {
    expect(parseCron('*/0 * * * *')).toBeNull();
  });

  it('should reject cron with negative step', () => {
    expect(parseCron('*/-1 * * * *')).toBeNull();
  });
});

describe('Scheduler execution and persistence', () => {
  const { loadSchedules, addSchedule, removeSchedule, updateSchedule, executeAction, parseCron } = require('../src/services/scheduler');

  beforeEach(() => {
    const schedules = loadSchedules();
    for (const s of schedules) {
      removeSchedule(s.id);
    }
  });

  it('should persist schedules across loadSchedules calls', () => {
    const added = addSchedule({
      containerId: 'persist-test',
      containerName: 'persist-server',
      action: 'restart',
      cron: '0 0 * * *',
    });

    const loaded = loadSchedules();
    expect(loaded.find(s => s.id === added.id)).toBeDefined();
    expect(loaded.find(s => s.id === added.id).action).toBe('restart');

    removeSchedule(added.id);
  });

  it('should update a schedule', () => {
    const added = addSchedule({
      containerId: 'update-test',
      containerName: 'update-server',
      action: 'restart',
      cron: '0 0 * * *',
    });

    const updated = updateSchedule(added.id, { action: 'stop', cron: '0 4 * * *' });
    expect(updated).not.toBeNull();
    expect(updated.action).toBe('stop');
    expect(updated.cron).toBe('0 4 * * *');

    const loaded = loadSchedules();
    const found = loaded.find(s => s.id === added.id);
    expect(found.action).toBe('stop');

    removeSchedule(added.id);
  });

  it('should return null for updating non-existent schedule', () => {
    const result = updateSchedule('nonexistent', { action: 'restart' });
    expect(result).toBeNull();
  });

  it('should return false for deleting non-existent schedule', () => {
    const result = removeSchedule('nonexistent');
    expect(result).toBe(false);
  });

  it('should add schedule with enabled defaulting to true', () => {
    const added = addSchedule({
      containerId: 'enabled-test',
      containerName: 'enabled-server',
      action: 'restart',
      cron: '0 0 * * *',
    });
    expect(added.enabled).toBe(true);
    removeSchedule(added.id);
  });

  it('should add schedule with enabled=false when specified', () => {
    const added = addSchedule({
      containerId: 'disabled-test',
      containerName: 'disabled-server',
      action: 'restart',
      cron: '0 0 * * *',
      enabled: false,
    });
    expect(added.enabled).toBe(false);
    removeSchedule(added.id);
  });

  it('should handle corrupted schedules.json gracefully', () => {
    const fs = require('fs');
    const path = require('path');
    const schedulesFile = path.join(TMP_DIR, '.game-admin-panel', 'schedules.json');
    fs.writeFileSync(schedulesFile, 'not valid json{{{');

    const result = loadSchedules();
    expect(result).toEqual([]);
  });

  it('should execute restart action via Docker', async () => {
    const mockRestart = jest.fn().mockResolvedValue(undefined);
    mockGetContainer.mockReturnValue({ restart: mockRestart });

    await executeAction({
      id: 'test-exec',
      containerId: 'abc123',
      containerName: 'test-server',
      action: 'restart',
    });

    expect(mockRestart).toHaveBeenCalled();
  });

  it('should execute stop action via Docker', async () => {
    const mockStop = jest.fn().mockResolvedValue(undefined);
    mockGetContainer.mockReturnValue({ stop: mockStop });

    await executeAction({
      id: 'test-exec',
      containerId: 'abc123',
      containerName: 'test-server',
      action: 'stop',
    });

    expect(mockStop).toHaveBeenCalled();
  });

  it('should execute start action via Docker', async () => {
    const mockStart = jest.fn().mockResolvedValue(undefined);
    mockGetContainer.mockReturnValue({ start: mockStart });

    await executeAction({
      id: 'test-exec',
      containerId: 'abc123',
      containerName: 'test-server',
      action: 'start',
    });

    expect(mockStart).toHaveBeenCalled();
  });

  it('should handle unknown action gracefully', async () => {
    mockGetContainer.mockReturnValue({ restart: jest.fn() });
    await expect(executeAction({
      id: 'test-exec',
      containerId: 'abc123',
      containerName: 'test-server',
      action: 'explode',
    })).resolves.toBeUndefined();
  });

  it('should handle Docker execution failure gracefully', async () => {
    mockGetContainer.mockReturnValue({
      restart: jest.fn().mockRejectedValue(new Error('container not found')),
    });

    await expect(executeAction({
      id: 'test-exec',
      containerId: 'abc123',
      containerName: 'test-server',
      action: 'restart',
    })).resolves.toBeUndefined();
  });

  it('should handle null Docker gracefully', async () => {
    jest.doMock('../src/services/docker', () => ({
      docker: null,
      verifyDockerConnection: jest.fn(),
    }));

    await expect(executeAction({
      id: 'test-exec',
      containerId: 'abc123',
      containerName: 'test-server',
      action: 'restart',
    })).resolves.toBeUndefined();
  });
});
