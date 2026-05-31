const request = require('supertest');

const mockInspect = jest.fn();
const mockGetContainer = jest.fn(() => ({ inspect: mockInspect }));

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
  }));
});

const mockReadFileFromContainer = jest.fn();
jest.mock('../src/services/containerFiles', () => ({
  readFileFromContainer: mockReadFileFromContainer,
  writeFileToContainer: jest.fn(),
  execInContainer: jest.fn(),
}));

global.fetch = jest.fn();

const app = require('../src/index');

describe('POST /api/containers/:id/rest', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockInspect.mockReset();
    mockReadFileFromContainer.mockReset();
    global.fetch.mockReset();
  });

  it('should return 400 if command is missing', async () => {
    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/command is required/i);
  });

  it('should return 400 if command is empty string', async () => {
    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({ command: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 if container does not exist', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    const err = new Error('No such container');
    err.statusCode = 404;
    mockInspect.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/containers/nonexistent/rest')
      .send({ command: 'status' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Container not found');
  });

  it('should return 503 if container is not running', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: false },
      Config: { Labels: { 'game-admin-panel.game': 'terraria' } },
      NetworkSettings: {},
    });

    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({ command: 'status' });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not running/i);
  });

  it('should return 400 if game is not terraria', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: true },
      Config: { Labels: { 'game-admin-panel.game': 'icarus' } },
      NetworkSettings: {},
    });

    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({ command: 'status' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/only supported for Terraria/i);
  });

  it('should return 401 if no REST API token is configured', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      Name: '/terraria',
      Id: 'ter-id',
      State: { Running: true },
      Config: { Labels: { 'game-admin-panel.game': 'terraria' } },
      NetworkSettings: {
        Ports: {
          '7878/tcp': [{ HostIp: '0.0.0.0', HostPort: '7878' }],
        },
      },
    });
    mockReadFileFromContainer.mockResolvedValue(JSON.stringify({ ApplicationRestTokens: [] }));

    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({ command: 'status' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/No REST API token/i);
  });

  it('should return 200 with response on successful REST command', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      Name: '/terraria',
      Id: 'ter-id',
      State: { Running: true },
      Config: { Labels: { 'game-admin-panel.game': 'terraria' } },
      NetworkSettings: {
        Ports: {
          '7878/tcp': [{ HostIp: '0.0.0.0', HostPort: '7878' }],
        },
      },
    });
    mockReadFileFromContainer.mockResolvedValue(JSON.stringify({ ApplicationRestTokens: ['secret'] }));

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: '200', response: ['players: 0'] })
    });

    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({ command: 'playing' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, response: 'players: 0' });
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:7878/v3/server/rawcmd?token=secret&cmd=playing');
  });

  it('should return 400 if REST API returns error status', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      Name: '/terraria',
      Id: 'ter-id',
      State: { Running: true },
      Config: { Labels: { 'game-admin-panel.game': 'terraria' } },
      NetworkSettings: {
        Ports: {
          '7878/tcp': [{ HostIp: '0.0.0.0', HostPort: '7878' }],
        },
      },
    });
    mockReadFileFromContainer.mockResolvedValue(JSON.stringify({ ApplicationRestTokens: ['secret'] }));

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: '403', error: 'Invalid token' })
    });

    const res = await request(app)
      .post('/api/containers/abc123/rest')
      .send({ command: 'playing' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid token');
  });
});
