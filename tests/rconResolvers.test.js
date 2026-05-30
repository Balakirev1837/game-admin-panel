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

jest.mock('../src/services/rcon', () => ({
  sendRconCommand: mockSendRcon,
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
  });

  it('should use default port 27015', async () => {
    jest.resetModules();
    jest.doMock('../src/services/factorioConfig', () => ({
      readConfig: jest.fn().mockReturnValue({ json: {} }),
    }));
    const testApp = require('../src/index');

    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('factorio')),
    });
    await request(testApp).post('/api/containers/abc/rcon').send({ command: '/players' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, undefined, '/players');
  });

  it('should read rcon_password from factorio config', async () => {
    jest.resetModules();
    jest.doMock('../src/services/factorioConfig', () => ({
      readConfig: jest.fn().mockReturnValue({ json: { rcon_password: 'fac-pass' } }),
    }));
    const testApp = require('../src/index');

    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue(makeInspect('factorio')),
    });
    await request(testApp).post('/api/containers/abc/rcon').send({ command: '/players' });
    expect(mockSendRcon).toHaveBeenCalledWith('127.0.0.1', 27015, 'fac-pass', '/players');
  });
});
