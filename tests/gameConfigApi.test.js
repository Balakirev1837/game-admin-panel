const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'config-api-test-'));
const originalRoot = process.env.GAME_CONFIG_ROOT;

const mockGetContainer = jest.fn();
const mockReadFileFromContainer = jest.fn();
const mockWriteFileToContainer = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('../src/services/containerFiles', () => ({
  readFileFromContainer: mockReadFileFromContainer,
  writeFileToContainer: mockWriteFileToContainer,
  execInContainer: jest.fn(),
}));

const app = require('../src/index');

function mockInspect(name, game, running = false, composeDir = null) {
  const labels = { 'game-admin-panel.game': game };
  if (composeDir) labels['com.docker.compose.project.working_dir'] = composeDir;
  mockGetContainer.mockReturnValue({
    inspect: jest.fn().mockResolvedValue({
      Id: `${name}-id`,
      Name: `/${name}`,
      Config: { Labels: labels },
      State: { Running: running },
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
  mockReadFileFromContainer.mockReset();
  mockWriteFileToContainer.mockReset();
  jest.clearAllMocks();
});

describe('CS2 Config API', () => {
  it('should read CS2 env config', async () => {
    writeFile('cs2-server', '.env', 'CS2_SERVERNAME=TestServer\nCS2_PORT=27015\n');
    mockInspect('cs2-server', 'cs2', false, `${TMP_DIR}/cs2-server`);

    const res = await request(app).get('/api/containers/cs2-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('cs2');
    expect(res.body.config.env.CS2_SERVERNAME).toBe('TestServer');
  });

  it('should write CS2 env config', async () => {
    writeFile('cs2-write', '.env', 'CS2_SERVERNAME=Old\n');
    mockInspect('cs2-write', 'cs2', false, `${TMP_DIR}/cs2-write`);

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
    mockInspect('mc-server', 'minecraft', false, `${TMP_DIR}/mc-server`);

    const res = await request(app).get('/api/containers/mc-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('minecraft');
    expect(res.body.config.env.EULA).toBe('TRUE');
  });

  it('should write Minecraft env config', async () => {
    writeFile('mc-write', '.env', 'EULA=FALSE\n');
    mockInspect('mc-write', 'minecraft', false, `${TMP_DIR}/mc-write`);

    const res = await request(app)
      .put('/api/containers/mc-write-id/config')
      .send({ config: { env: { EULA: 'TRUE', MOTD: 'Test Server' } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.env.EULA).toBe('TRUE');
  });
});

describe('Factorio Config API', () => {
  it('should read Factorio JSON config from container', async () => {
    mockInspect('fac-server', 'factorio', true);
    mockReadFileFromContainer.mockImplementation(async (id, p) => {
      if (p.includes('server-settings')) return JSON.stringify({ name: 'Factorio Server', description: 'Test', visibility: { public: true, lan: true } });
      if (p.includes('rconpw')) return 'secret';
      return null;
    });

    const res = await request(app).get('/api/containers/fac-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('factorio');
    expect(res.body.config.json.name).toBe('Factorio Server');
  });

  it('should write Factorio JSON config to container', async () => {
    mockInspect('fac-write', 'factorio', true);
    mockReadFileFromContainer.mockImplementation(async (id, p) => {
      if (p.includes('server-settings')) return JSON.stringify({ name: 'Old', visibility: { public: true, lan: true } });
      return null;
    });
    mockWriteFileToContainer.mockResolvedValue(true);

    const res = await request(app)
      .put('/api/containers/fac-write-id/config')
      .send({ config: { json: { name: 'New Server', rcon_password: 'pass' } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return empty config for stopped Factorio container', async () => {
    mockInspect('fac-stopped', 'factorio', false);

    const res = await request(app).get('/api/containers/fac-stopped-id/config');

    expect(res.status).toBe(200);
    expect(res.body.config._stopped).toBe(true);
  });
});

describe('Terraria Config API', () => {
  it('should read Terraria config from container', async () => {
    mockInspect('ter-server', 'terraria', true);
    mockReadFileFromContainer.mockImplementation(async (id, p) => {
      if (p.includes('config.json')) return JSON.stringify({
        ServerName: 'Terraria World', MaxSlots: 8, RestApiEnabled: true, ApplicationRestTokens: ['my-token'],
      });
      return null;
    });

    const res = await request(app).get('/api/containers/ter-id/config');

    expect(res.status).toBe(200);
    expect(res.body.game).toBe('terraria');
    expect(res.body.config.json.ServerName).toBe('Terraria World');
  });

  it('should write Terraria config to container', async () => {
    mockInspect('ter-write', 'terraria', true);
    mockReadFileFromContainer.mockImplementation(async (id, p) => {
      if (p.includes('config.json')) return JSON.stringify({ ServerName: 'Old', ApplicationRestTokens: [] });
      return null;
    });
    mockWriteFileToContainer.mockResolvedValue(true);

    const res = await request(app)
      .put('/api/containers/ter-write-id/config')
      .send({ config: { json: { ServerName: 'New World', MaxSlots: 16 } } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
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
