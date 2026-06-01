const request = require('supertest');

const mockGetContainer = jest.fn();
const mockSendRcon = jest.fn();
const mockReadFileFromContainer = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('../src/services/rcon', () => ({
  sendRconCommand: mockSendRcon,
}));

jest.mock('../src/services/containerFiles', () => ({
  readFileFromContainer: mockReadFileFromContainer,
}));

const app = require('../src/index');

function mockInspect(game, running = true) {
  return {
    Id: 'abc123',
    Name: `/${game}-server`,
    Config: {
      Labels: { 'game-admin-panel.game': game },
      Env: [],
    },
    State: { Running: running },
    NetworkSettings: { Ports: {}, Networks: {} },
  };
}

describe('GET /api/containers/:id/players', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockSendRcon.mockReset();
    mockReadFileFromContainer.mockReset();
  });

  it('should return empty array for stopped containers', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('cs2', false)),
    });

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });

  it('should parse CS2 status output', async () => {
    const statusOutput = [
      '# userid name uniqueid connected ping loss state',
      '# 1 "Player1" [U:1:12345] 00:05 45 0 active',
      '# 2 "Player2" [U:1:67890] 00:12 32 0 active',
    ].join('\n');

    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('cs2')),
    });
    mockSendRcon.mockResolvedValue(statusOutput);

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.players[0].name).toBe('Player1');
    expect(res.body.players[0].steamid).toBe('[U:1:12345]');
    expect(res.body.players[1].name).toBe('Player2');
  });

  it('should parse Minecraft list output', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('minecraft')),
    });
    mockSendRcon.mockResolvedValue('There are 2 of a max of 20 players online: Steve, Alex');

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.players[0].name).toBe('Steve');
    expect(res.body.players[1].name).toBe('Alex');
  });

  it('should handle Minecraft empty server', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('minecraft')),
    });
    mockSendRcon.mockResolvedValue('There are 0 of a max of 20 players online:');

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });

  it('should handle RCON failure gracefully', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('cs2')),
    });
    mockSendRcon.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });

  it('should return 404 for non-existent container', async () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockRejectedValue(err),
    });

    const res = await request(app).get('/api/containers/nonexistent/players');

    expect(res.status).toBe(404);
  });

  it('should return empty array for Icarus (no player list)', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('icarus')),
    });

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
    expect(res.body.game).toBe('icarus');
  });

  it('should parse Factorio players via container file read', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('factorio')),
    });
    mockReadFileFromContainer.mockResolvedValue('myrconpw');
    mockSendRcon.mockResolvedValue('Players online:\n  Alice (online)\n  Bob (online)\n  Charlie');

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.players[0].name).toBe('Alice');
    expect(res.body.players[1].name).toBe('Bob');
    expect(mockReadFileFromContainer).toHaveBeenCalledWith('abc123', '/factorio/config/rconpw');
  });

  it('should handle Factorio RCON read failure gracefully', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('factorio')),
    });
    mockReadFileFromContainer.mockRejectedValue(new Error('container error'));

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });

  it('should parse Terraria players via container file read', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('terraria')),
    });
    mockReadFileFromContainer.mockResolvedValue(JSON.stringify({
      RestApiPort: 7878,
      ApplicationRestTokens: ['test-token-123'],
    }));

    const http = require('http');
    const mockGet = jest.fn((url, cb) => {
      const res = {
        on: (evt, handler) => {
          if (evt === 'data') handler(JSON.stringify({ players: [{ nickname: 'Alice' }, { nickname: 'Bob' }] }));
          if (evt === 'end') handler();
        }
      };
      cb(res);
      return { on: jest.fn() };
    });
    jest.spyOn(http, 'get').mockImplementation(mockGet);

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.players[0].name).toBe('Alice');

    http.get.mockRestore();
  });

  it('should handle Terraria with no REST token', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(mockInspect('terraria')),
    });
    mockReadFileFromContainer.mockResolvedValue(JSON.stringify({
      RestApiPort: 7878,
      ApplicationRestTokens: [],
    }));

    const res = await request(app).get('/api/containers/abc/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });
});
