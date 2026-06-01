const request = require('supertest');

const mockGetContainer = jest.fn();
const mockInspect = jest.fn();
const mockReadFileFromContainer = jest.fn();
const mockExecInContainer = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('../src/services/containerFiles', () => ({
  readFileFromContainer: mockReadFileFromContainer,
  writeFileToContainer: jest.fn(),
  execInContainer: mockExecInContainer,
}));

function makeInspect(game, running = true) {
  return {
    Id: 'container-id-123',
    Name: `/${game}-server`,
    Config: {
      Labels: { 'game-admin-panel.enabled': 'true', 'game-admin-panel.game': game },
    },
    State: { Running: running },
  };
}

const app = require('../src/index');

describe('Game Data API', () => {
  beforeEach(() => {
    delete process.env.ADMIN_PASSWORD;
    mockGetContainer.mockReset();
    mockInspect.mockReset();
    mockReadFileFromContainer.mockReset();
    mockExecInContainer.mockReset();
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
  });

  describe('GET /api/containers/:id/game-data/:type', () => {
    it('should return empty for stopped container', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio', false));
      const res = await request(app).get('/api/containers/abc123/game-data/saves');
      expect(res.status).toBe(200);
      expect(res.body.stopped).toBe(true);
      expect(res.body.entries).toEqual([]);
    });

    it('should return 400 for unknown data type', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      const res = await request(app).get('/api/containers/abc123/game-data/nonexistent');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unknown data type/i);
    });

    it('should return 400 for game with no data types', async () => {
      mockInspect.mockResolvedValue(makeInspect('icarus'));
      const res = await request(app).get('/api/containers/abc123/game-data/anything');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no game data/i);
    });

    it('should handle dir format (Factorio saves)', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockExecInContainer.mockResolvedValue(['save1.zip', 'save2.zip', 'autosave/']);
      const res = await request(app).get('/api/containers/abc123/game-data/saves');
      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBe(2);
      expect(res.body.entries.map(e => e.name)).toEqual(['save1.zip', 'save2.zip']);
    });

    it('should filter directory entries from dir listing', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockExecInContainer.mockResolvedValue(['save1.zip', 'mods/', 'save2.zip', '']);
      const res = await request(app).get('/api/containers/abc123/game-data/saves');
      expect(res.status).toBe(200);
      const names = res.body.entries.map(e => e.name);
      expect(names).not.toContain('mods/');
    });

    it('should handle dir format exec failure gracefully', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockExecInContainer.mockRejectedValue(new Error('exec failed'));
      const res = await request(app).get('/api/containers/abc123/game-data/saves');
      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual([]);
    });

    it('should handle properties format (Minecraft server.properties)', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      mockReadFileFromContainer.mockResolvedValue('max-players=20\nmotd=A Minecraft Server\n# comment\nview-distance=10\n');
      const res = await request(app).get('/api/containers/abc123/game-data/server-properties');
      expect(res.status).toBe(200);
      expect(res.body.properties).toEqual({
        'max-players': '20',
        'motd': 'A Minecraft Server',
        'view-distance': '10',
      });
    });

    it('should return empty properties when file not found', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      mockReadFileFromContainer.mockResolvedValue(null);
      const res = await request(app).get('/api/containers/abc123/game-data/server-properties');
      expect(res.status).toBe(200);
      expect(res.body.properties).toEqual({});
    });

    it('should handle JSON format (Factorio adminlist)', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockReadFileFromContainer.mockResolvedValue(JSON.stringify(['player1', 'player2']));
      const res = await request(app).get('/api/containers/abc123/game-data/adminlist');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(['player1', 'player2']);
    });

    it('should wrap non-array JSON in array', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockReadFileFromContainer.mockResolvedValue(JSON.stringify({ key: 'value' }));
      const res = await request(app).get('/api/containers/abc123/game-data/adminlist');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ key: 'value' }]);
    });

    it('should return empty data for null file read', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockReadFileFromContainer.mockResolvedValue(null);
      const res = await request(app).get('/api/containers/abc123/game-data/adminlist');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockInspect.mockResolvedValue(makeInspect('factorio'));
      mockReadFileFromContainer.mockResolvedValue('not valid json {{{');
      const res = await request(app).get('/api/containers/abc123/game-data/adminlist');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return 404 when container not found', async () => {
      const err = new Error('No such container');
      err.statusCode = 404;
      mockInspect.mockRejectedValue(err);
      const res = await request(app).get('/api/containers/nonexistent/game-data/saves');
      expect(res.status).toBe(404);
    });

    it('should return 404 when Docker inspect fails', async () => {
      mockInspect.mockRejectedValue(new Error('Docker internal error'));
      const res = await request(app).get('/api/containers/abc123/game-data/saves');
      expect(res.status).toBe(404);
    });

    it('should return 400 for Minecraft unknown data type', async () => {
      mockInspect.mockResolvedValue(makeInspect('minecraft'));
      const res = await request(app).get('/api/containers/abc123/game-data/nonexistent');
      expect(res.status).toBe(400);
    });
  });
});
