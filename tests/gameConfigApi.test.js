const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'config-api-test-'));
const originalRoot = process.env.GAME_CONFIG_ROOT;

const mockGetContainer = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

const app = require('../src/index');

function mockInspect(name, game) {
  mockGetContainer.mockReturnValue({
    inspect: jest.fn().mockResolvedValue({
      Name: `/${name}`,
      Config: { Labels: { 'game-admin-panel.game': game } },
      State: {},
    }),
  });
}

function writeFile(containerName, filePath, content) {
  const dir = path.dirname(path.join(TMP_DIR, containerName, filePath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, containerName, filePath), content);
}

beforeAll(() => {
  process.env.GAME_CONFIG_ROOT = TMP_DIR;
});

afterAll(() => {
  process.env.GAME_CONFIG_ROOT = originalRoot;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  mockGetContainer.mockReset();
  jest.clearAllMocks();
});

describe('CS2 Config API', () => {
  it('should read CS2 env config', async () => {
    writeFile('cs2-server', '.env', 'CS2_SERVERNAME=TestServer\nCS2_PORT=27015\n');
    mockInspect('cs2-server', 'cs2');

    const res = await request(app).get('/api/containers/cs2-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('cs2');
    expect(res.body.config.env.CS2_SERVERNAME).toBe('TestServer');
    expect(res.body.config.env.CS2_PORT).toBe('27015');
  });

  it('should write CS2 env config', async () => {
    writeFile('cs2-write', '.env', 'CS2_SERVERNAME=Old\n');
    mockInspect('cs2-write', 'cs2');

    const res = await request(app)
      .put('/api/containers/cs2-write-id/config')
      .send({ config: { env: { CS2_SERVERNAME: 'NewServer' } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.env.CS2_SERVERNAME).toBe('NewServer');
  });
});

describe('Minecraft Config API', () => {
  it('should read Minecraft env config', async () => {
    writeFile('mc-server', '.env', 'EULA=TRUE\nVERSION=1.21\nTYPE=PAPER\n');
    mockInspect('mc-server', 'minecraft');

    const res = await request(app).get('/api/containers/mc-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('minecraft');
    expect(res.body.config.env.EULA).toBe('TRUE');
    expect(res.body.config.env.VERSION).toBe('1.21');
  });

  it('should write Minecraft env config', async () => {
    writeFile('mc-write', '.env', 'EULA=FALSE\n');
    mockInspect('mc-write', 'minecraft');

    const res = await request(app)
      .put('/api/containers/mc-write-id/config')
      .send({ config: { env: { EULA: 'TRUE', MOTD: 'Test Server' } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.env.EULA).toBe('TRUE');
    expect(res.body.config.env.MOTD).toBe('Test Server');
  });
});

describe('Factorio Config API', () => {
  it('should read Factorio JSON config', async () => {
    const config = { name: 'Factorio Server', description: 'Test', rcon_password: 'secret' };
    writeFile('fac-server', 'config/server-settings.json', JSON.stringify(config, null, 2));
    writeFile('fac-server', 'config/rconpw', 'secret');
    mockInspect('fac-server', 'factorio');

    const res = await request(app).get('/api/containers/fac-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('factorio');
    expect(res.body.config.json.name).toBe('Factorio Server');
  });

  it('should write Factorio JSON config', async () => {
    writeFile('fac-write', 'config/server-settings.json', '{"name":"Old"}');
    writeFile('fac-write', 'config/rconpw', '');
    mockInspect('fac-write', 'factorio');

    const res = await request(app)
      .put('/api/containers/fac-write-id/config')
      .send({ config: { json: { name: 'New Server', rcon_password: 'pass' } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.json.name).toBe('New Server');
  });
});

describe('Terraria Config API', () => {
  it('should read Terraria TShock config', async () => {
    const config = {
      ServerName: 'Terraria World',
      MaxSlots: 8,
      RestApiEnabled: true,
      ApplicationRestTokens: [{ value: 'my-token' }],
    };
    writeFile('ter-server', 'tshock/config.json', JSON.stringify(config, null, 2));
    mockInspect('ter-server', 'terraria');

    const res = await request(app).get('/api/containers/ter-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('terraria');
    expect(res.body.config.json.ServerName).toBe('Terraria World');
  });

  it('should write Terraria TShock config', async () => {
    writeFile('ter-write', 'tshock/config.json', '{"ServerName":"Old","ApplicationRestTokens":[]}');
    mockInspect('ter-write', 'terraria');

    const res = await request(app)
      .put('/api/containers/ter-write-id/config')
      .send({ config: { json: { ServerName: 'New World', MaxSlots: 16 } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.json.ServerName).toBe('New World');
  });
});

describe('Config API edge cases', () => {
  it('should default to icarus for unknown game label', async () => {
    writeFile('unknown-game', 'Saved/Config/WindowsServer/ServerSettings.ini', '[/Game/Settings]\nServerName=Test\n');
    mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Name: '/unknown-game',
        Config: { Labels: {} },
        State: {},
      }),
    });

    const res = await request(app).get('/api/containers/unknown-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('icarus');
  });

  it('should return 400 for missing config on PUT', async () => {
    const res = await request(app)
      .put('/api/containers/some-id/config')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('config');
  });

  it('should return 400 for null config on PUT', async () => {
    mockInspect('null-config', 'cs2');
    const res = await request(app)
      .put('/api/containers/null-config/config')
      .send({ config: null });

    expect(res.status).toBe(400);
  });
});
