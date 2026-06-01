const request = require('supertest');

const mockGetContainer = jest.fn();
const mockSendRcon = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('../src/services/rconPool', () => ({
  sendRconCommand: mockSendRcon,
  flushPool: jest.fn(),
}));

const mockReadFileFromContainer = jest.fn();
jest.mock('../src/services/containerFiles', () => ({
  readFileFromContainer: mockReadFileFromContainer,
  writeFileToContainer: jest.fn(),
  execInContainer: jest.fn(),
}));

const app = require('../src/index');

function makeInspect(game, envVars = {}, ports = {}, networks = {}) {
  return {
    Name: `/${game}-server`,
    Config: {
      Labels: { 'game-admin-panel.enabled': 'true', 'game-admin-panel.game': game },
      Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    },
    State: { Running: true },
    NetworkSettings: {
      Ports: ports,
      Networks: networks,
    },
  };
}

describe('CS2 RCON resolution', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockSendRcon.mockReset();
    mockSendRcon.mockResolvedValue('OK');
  });

  it('should use default port 27015 when no env vars', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('cs2')),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, undefined, 'status');
  });

  it('should use CS2_PORT env var', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('cs2', { CS2_PORT: '27020' })),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27020, undefined, 'status');
  });

  it('should use CS2_RCONPW for password', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('cs2', { CS2_RCONPW: 'secret123' })),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, 'secret123', 'status');
  });

  it('should resolve game-network IP', async () => {
    const networks = { 'game-network': { IPAddress: '172.18.0.5' } };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('cs2', {}, {}, networks)),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('172.18.0.5', 27015, undefined, 'status');
  });

  it('should use port mapping when available', async () => {
    const ports = { '27015/tcp': [{ HostPort: '27015' }] };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('cs2', {}, ports, { 'game-network': { IPAddress: '172.18.0.5' } })),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, undefined, 'status');
  });
});

describe('Minecraft RCON resolution', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockSendRcon.mockReset();
    mockSendRcon.mockResolvedValue('OK');
  });

  it('should use default port 25575', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('minecraft')),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'list' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 25575, undefined, 'list');
  });

  it('should use RCON_PORT env var', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('minecraft', { RCON_PORT: '25580' })),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'list' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 25580, undefined, 'list');
  });

  it('should use RCON_PASSWORD env var', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('minecraft', { RCON_PASSWORD: 'mc-pass' })),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'list' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 25575, 'mc-pass', 'list');
  });

  it('should resolve game-network IP', async () => {
    const networks = { 'game-network': { IPAddress: '172.18.0.3' } };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('minecraft', {}, {}, networks)),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'list' });
    expect(mockSendRcon).toHaveBeenCalledWith('172.18.0.3', 25575, undefined, 'list');
  });
});

describe('Factorio RCON resolution', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockSendRcon.mockReset();
    mockSendRcon.mockResolvedValue('OK');
    mockReadFileFromContainer.mockReset();
  });

  it('should use default port 27015', async () => {
    mockReadFileFromContainer.mockResolvedValue(null);

    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('factorio')),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: '/players' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, undefined, '/players');
  });

  it('should read rcon_password from container', async () => {
    mockReadFileFromContainer.mockResolvedValue('fac-pass');

    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('factorio')),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: '/players' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, 'fac-pass', '/players');
  });
});

describe('Icarus RCON resolution', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockSendRcon.mockReset();
    mockSendRcon.mockResolvedValue('OK');
  });

  it('should use game-network IP when available with port mapping', async () => {
    const networks = { 'game-network': { IPAddress: '172.18.0.2' } };
    const ports = { '25575/tcp': [{ HostPort: '25575' }] };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('icarus', {}, ports, networks)),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('172.18.0.2', 25575, undefined, 'status');
  });

  it('should resolve RCON port from port mapping', async () => {
    const ports = { '25575/tcp': [{ HostPort: '25575' }] };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('icarus', {}, ports)),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 25575, undefined, 'status');
  });

  it('should fall back to SERVER_PORT env var when no port mapping', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('icarus', { SERVER_PORT: '25575' })),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 25575, undefined, 'status');
  });

  it('should use ICARUS_RCON_PASSWORD env var', async () => {
    const ports = { '25575/tcp': [{ HostPort: '25575' }] };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('icarus', { ICARUS_RCON_PASSWORD: 'icarus-pass' }, ports)),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 25575, 'icarus-pass', 'status');
  });

  it('should return 503 when no RCON port found', async () => {
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('icarus')),
    });
    const res = await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(res.status).toBe(503);
  });

  it('should match port 17777 as RCON port', async () => {
    const ports = { '17777/tcp': [{ HostPort: '17777' }] };
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('icarus', {}, ports)),
    });
    await request(app).post('/api/containers/abc/rcon').send({ command: 'status' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 17777, undefined, 'status');
  });
});
