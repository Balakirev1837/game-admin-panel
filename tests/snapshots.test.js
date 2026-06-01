const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

const mockGetContainer = jest.fn();
const mockInspect = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-test-'));
process.env.GAME_CONFIG_ROOT = TMP_DIR;

const app = require('../src/index');

afterAll(() => {
  delete process.env.GAME_CONFIG_ROOT;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  mockGetContainer.mockReset();
  mockInspect.mockReset();
  mockGetContainer.mockReturnValue({ inspect: mockInspect });
});

function makeInspect(game, running = true) {
  return {
    Id: 'abc123',
    Name: `/${game}-server`,
    Config: {
      Labels: { 'game-admin-panel.enabled': 'true', 'game-admin-panel.game': game },
    },
    State: { Running: running },
  };
}

describe('Snapshots API', () => {
  describe('GET /api/containers/:id/snapshots', () => {
    it('should return empty array when no snapshots exist', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      const res = await request(app).get('/api/containers/abc123/snapshots');
      expect(res.status).toBe(200);
      expect(res.body.snapshots).toEqual([]);
    });

    it('should return 400 for unsupported game', async () => {
      mockInspect.mockResolvedValue(makeInspect('icarus'));
      const res = await request(app).get('/api/containers/abc123/snapshots');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not supported/i);
    });

    it('should return 400 for CS2', async () => {
      mockInspect.mockResolvedValue(makeInspect('cs2'));
      const res = await request(app).get('/api/containers/abc123/snapshots');
      expect(res.status).toBe(400);
    });

    it('should list existing snapshot files', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      const dir = path.join(TMP_DIR, '.game-admin-panel', 'snapshots', 'minecraft', 'minecraft-server');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'mc-snapshot-2026-01-01.tar.gz'), 'data');

      const res = await request(app).get('/api/containers/abc123/snapshots');
      expect(res.status).toBe(200);
      expect(res.body.snapshots.length).toBe(1);
      expect(res.body.snapshots[0].file).toBe('mc-snapshot-2026-01-01.tar.gz');
      expect(res.body.snapshots[0].size).toBeDefined();
      expect(res.body.game).toBe('minecraft');
    });

    it('should return 500 on Docker error', async () => {
      mockInspect.mockRejectedValue(new Error('Docker error'));
      const res = await request(app).get('/api/containers/abc123/snapshots');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/containers/:id/snapshots', () => {
    it('should return 400 for stopped container', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft', false));
      const res = await request(app).post('/api/containers/abc123/snapshots');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/running/i);
    });

    it('should return 400 for unsupported game', async () => {
      mockInspect.mockResolvedValue(makeInspect('terraria'));
      const res = await request(app).post('/api/containers/abc123/snapshots');
      expect(res.status).toBe(400);
    });

    it('should return 500 on Docker error', async () => {
      mockInspect.mockRejectedValue(new Error('Docker error'));
      const res = await request(app).post('/api/containers/abc123/snapshots');
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/containers/:id/snapshots/:file', () => {
    it('should return 404 for non-existent snapshot', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      const res = await request(app).delete('/api/containers/abc123/snapshots/noexist.tar.gz');
      expect(res.status).toBe(404);
    });

    it('should delete an existing snapshot', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      const dir = path.join(TMP_DIR, '.game-admin-panel', 'snapshots', 'minecraft', 'minecraft-server');
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'to-delete.tar.gz');
      fs.writeFileSync(filePath, 'snapshot data');

      expect(fs.existsSync(filePath)).toBe(true);
      const res = await request(app).delete('/api/containers/abc123/snapshots/to-delete.tar.gz');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
