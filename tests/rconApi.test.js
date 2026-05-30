const request = require('supertest');

// Mock dockerode before requiring the app
const mockInspect = jest.fn();
const mockGetContainer = jest.fn(() => ({ inspect: mockInspect }));

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
  }));
});

// Mock the RCON service
const mockSendRconCommand = jest.fn();
jest.mock('../src/services/rcon', () => ({
  sendRconCommand: mockSendRconCommand,
}));

const app = require('../src/index');

describe('POST /api/containers/:id/rcon', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockInspect.mockReset();
    mockSendRconCommand.mockReset();
  });

  it('should return 400 if command is missing', async () => {
    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/command is required/i);
  });

  it('should return 400 if command is empty string', async () => {
    const res = await request(app)
      .post('/api/containers/abc123/rcon')
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
      .post('/api/containers/nonexistent/rcon')
      .send({ command: 'status' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Container not found');
  });

  it('should return 503 if container is not running', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: false },
      NetworkSettings: {},
    });

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: 'status' });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not running/i);
  });

  it('should return 503 if container has no RCON port mapped', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }],
        },
      },
    });

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: 'status' });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no RCON port/i);
  });

  it('should return 200 with response on successful RCON command', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '25575/tcp': [{ HostIp: '0.0.0.0', HostPort: '25575' }],
        },
      },
    });
    mockSendRconCommand.mockResolvedValue('players: 0');

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: 'status' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, response: 'players: 0' });
    expect(mockSendRconCommand).toHaveBeenCalledWith('127.0.0.1', 25575, undefined, 'status');
  });

  it('should return 500 if RCON connection fails', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '25575/tcp': [{ HostIp: '127.0.0.1', HostPort: '25575' }],
        },
      },
    });
    mockSendRconCommand.mockRejectedValue(new Error('RCON connection failed to 127.0.0.1:25575: ECONNREFUSED'));

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: 'status' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/RCON connection failed/);
  });

  it('should use HostIp 127.0.0.1 when binding has no HostIp', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '25575/tcp': [{ HostPort: '32768' }],
        },
      },
    });
    mockSendRconCommand.mockResolvedValue('ok');

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: 'list' });

    expect(res.status).toBe(200);
    expect(mockSendRconCommand).toHaveBeenCalledWith('127.0.0.1', 32768, undefined, 'list');
  });

  it('should trim the command before sending', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '25575/tcp': [{ HostIp: '0.0.0.0', HostPort: '25575' }],
        },
      },
    });
    mockSendRconCommand.mockResolvedValue('done');

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: '  status  ' });

    expect(res.status).toBe(200);
    expect(mockSendRconCommand).toHaveBeenCalledWith('127.0.0.1', 25575, undefined, 'status');
  });

  it('should return 500 if Docker inspect fails with non-404 error', async () => {
    mockGetContainer.mockReturnValue({ inspect: mockInspect });
    mockInspect.mockRejectedValue(new Error('Docker internal error'));

    const res = await request(app)
      .post('/api/containers/abc123/rcon')
      .send({ command: 'status' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Docker internal error');
  });
});
