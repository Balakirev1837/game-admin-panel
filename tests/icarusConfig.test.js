const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Mock dockerode before requiring the app
jest.mock('dockerode', () => {
  const mockListContainers = jest.fn();
  const mockGetContainer = jest.fn();
  function Docker() {
    this.listContainers = mockListContainers;
    this.getContainer = mockGetContainer;
  }
  Docker.__mockListContainers = mockListContainers;
  Docker.__mockGetContainer = mockGetContainer;
  return Docker;
});

const app = require('../src/index');
const { parseIni, serializeIni, readConfig, writeConfig, validateConfig, readLaunchParams, writeLaunchParams } = require('../src/services/icarusConfig');

const TMP_DIR = path.join(__dirname, '__tmp_icarus_config__');

// Helper to create a temp config directory matching GAME_CONFIG_ROOT/<container>/Saved/Config/WindowsServer/
function setupConfigDir(containerId, iniContent, envContent) {
  const dir = path.join(TMP_DIR, containerId, 'Saved', 'Config', 'WindowsServer');
  fs.mkdirSync(dir, { recursive: true });
  if (iniContent !== undefined) {
    fs.writeFileSync(path.join(dir, 'ServerSettings.ini'), iniContent, 'utf-8');
  }
  if (envContent !== undefined) {
    fs.writeFileSync(path.join(dir, '.env'), envContent, 'utf-8');
  }
  return dir;
}

function cleanupTmpDir() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

describe('icarusConfig - INI parsing', () => {
  it('should parse simple key=value pairs', () => {
    const ini = 'ServerName=MyServer\nMaxPlayers=16\nPassword=secret\n';
    const result = parseIni(ini);
    expect(result._root.ServerName).toBe('MyServer');
    expect(result._root.MaxPlayers).toBe('16');
    expect(result._root.Password).toBe('secret');
  });

  it('should parse sections and key=value pairs', () => {
    const ini = '[/Game/Settings]\nServerName=Test\nMaxPlayers=8\n\n[/Script/Icarus.Settings]\nDifficulty=Hard\n';
    const result = parseIni(ini);
    expect(result._sections['/Game/Settings']).toEqual({ ServerName: 'Test', MaxPlayers: '8' });
    expect(result._sections['/Script/Icarus.Settings']).toEqual({ Difficulty: 'Hard' });
  });

  it('should preserve comments', () => {
    const ini = '; This is a comment\nServerName=Test\n# Another comment\n';
    const result = parseIni(ini);
    expect(result._root.ServerName).toBe('Test');
    expect(result._comments['_root']).toHaveLength(2);
    expect(result._comments['_root'][0].text).toBe('; This is a comment');
  });

  it('should handle empty lines', () => {
    const ini = '\n\nServerName=Test\n\n';
    const result = parseIni(ini);
    expect(result._root.ServerName).toBe('Test');
  });

  it('should handle values with equals signs', () => {
    const ini = 'Command=-log -someflag=value\n';
    const result = parseIni(ini);
    expect(result._root.Command).toBe('-log -someflag=value');
  });

  it('should handle empty string input', () => {
    const result = parseIni('');
    expect(result._sections).toEqual({});
    expect(result._root).toBeUndefined();
  });

  it('should parse section with comments inside', () => {
    const ini = '[Settings]\n; comment inside section\nKey=Value\n';
    const result = parseIni(ini);
    expect(result._sections['Settings']).toEqual({ Key: 'Value' });
    expect(result._comments['Settings']).toHaveLength(1);
  });
});

describe('icarusConfig - INI serialization', () => {
  it('should serialize root-level key=value pairs', () => {
    const config = { _sections: {}, _root: { ServerName: 'MyServer', MaxPlayers: '16' } };
    const result = serializeIni(config);
    expect(result).toContain('ServerName=MyServer');
    expect(result).toContain('MaxPlayers=16');
  });

  it('should serialize sections', () => {
    const config = {
      _sections: {
        '/Game/Settings': { ServerName: 'Test', MaxPlayers: '8' },
      },
    };
    const result = serializeIni(config);
    expect(result).toContain('[/Game/Settings]');
    expect(result).toContain('ServerName=Test');
    expect(result).toContain('MaxPlayers=8');
  });

  it('should round-trip parse -> serialize -> parse', () => {
    const ini = '[/Game/Settings]\nServerName=Test\nMaxPlayers=8\n\n[/Script/Icarus.Settings]\nDifficulty=Hard\n';
    const parsed = parseIni(ini);
    const serialized = serializeIni(parsed);
    const reparsed = parseIni(serialized);
    expect(reparsed._sections['/Game/Settings']).toEqual({ ServerName: 'Test', MaxPlayers: '8' });
    expect(reparsed._sections['/Script/Icarus.Settings']).toEqual({ Difficulty: 'Hard' });
  });

  it('should serialize with comments', () => {
    const config = {
      _sections: { Settings: { Key: 'Value' } },
      _comments: { Settings: [{ text: '; a comment' }] },
    };
    const result = serializeIni(config);
    expect(result).toContain('; a comment');
  });
});

describe('icarusConfig - validation', () => {
  it('should validate a correct config object', () => {
    const config = { _sections: { Settings: { Key: 'Value' } } };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject null config', () => {
    const result = validateConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Config must be a non-null object');
  });

  it('should reject non-object config', () => {
    const result = validateConfig('not an object');
    expect(result.valid).toBe(false);
  });
});

describe('icarusConfig - file read/write with GAME_CONFIG_ROOT', () => {
  const originalEnv = {};

  beforeAll(() => {
    originalEnv.GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT;
    process.env.GAME_CONFIG_ROOT = TMP_DIR;
  });

  afterAll(() => {
    process.env.GAME_CONFIG_ROOT = originalEnv.GAME_CONFIG_ROOT;
    cleanupTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir();
  });

  it('should read a config file', () => {
    setupConfigDir('test-container', '[Settings]\nServerName=MyServer\nMaxPlayers=16\n');
    const config = readConfig('test-container');
    expect(config._sections['Settings']).toEqual({ ServerName: 'MyServer', MaxPlayers: '16' });
  });

  it('should return empty config for missing config file', () => {
    // Don't create the file
    setupConfigDir('missing-container');
    const config = readConfig('missing-container');
    expect(config._root).toEqual({});
    expect(config._sections).toEqual({});
  });

  it('should write a config file and read it back', () => {
    setupConfigDir('write-container', '[Settings]\nServerName=Old\n');
    const newConfig = {
      _sections: { Settings: { ServerName: 'NewServer', MaxPlayers: '32' } },
    };
    writeConfig('write-container', newConfig);
    const readBack = readConfig('write-container');
    expect(readBack._sections['Settings'].ServerName).toBe('NewServer');
    expect(readBack._sections['Settings'].MaxPlayers).toBe('32');
  });

  it('should create directory and file if they do not exist', () => {
    const newConfig = {
      _sections: { Settings: { ServerName: 'BrandNew' } },
    };
    writeConfig('new-container', newConfig);
    const readBack = readConfig('new-container');
    expect(readBack._sections['Settings'].ServerName).toBe('BrandNew');
  });

  it('should read launch params from .env file', () => {
    setupConfigDir('env-container', '', 'ICARUS_PORT=17777\nICARUS_MAP=Forest\n');
    const params = readLaunchParams('env-container');
    expect(params.ICARUS_PORT).toBe('17777');
    expect(params.ICARUS_MAP).toBe('Forest');
  });

  it('should write launch params to .env file', () => {
    setupConfigDir('env-write-container', '');
    writeLaunchParams('env-write-container', { ICARUS_PORT: '17777', ICARUS_MAP: 'Desert' });
    const params = readLaunchParams('env-write-container');
    expect(params.ICARUS_PORT).toBe('17777');
    expect(params.ICARUS_MAP).toBe('Desert');
  });

  it('should return empty object when no .env file exists', () => {
    setupConfigDir('no-env-container', '');
    const params = readLaunchParams('no-env-container');
    expect(params).toEqual({});
  });

  it('should reject invalid launch params', () => {
    expect(() => writeLaunchParams('test', null)).toThrow('Launch params must be a non-null object');
  });
});

describe('Config API endpoints', () => {
  const originalEnv = {};
  const Docker = require('dockerode');

  beforeAll(() => {
    originalEnv.GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT;
    process.env.GAME_CONFIG_ROOT = TMP_DIR;
  });

  afterAll(() => {
    process.env.GAME_CONFIG_ROOT = originalEnv.GAME_CONFIG_ROOT;
    cleanupTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir();
    jest.clearAllMocks();
  });

  function mockContainerInspect(name) {
    const mockInspect = jest.fn().mockResolvedValue({ Name: `/${name}`, State: {} });
    Docker.__mockGetContainer.mockReturnValue({ inspect: mockInspect });
    return mockInspect;
  }

  describe('GET /api/containers/:id/config', () => {
    it('should return config as JSON', async () => {
      setupConfigDir('api-container', '[/Game/Settings]\nServerName=TestServer\nMaxPlayers=8\n');
      mockContainerInspect('api-container');

      const res = await request(app).get('/api/containers/api-container/config');

      expect(res.status).toBe(200);
      expect(res.body.config._sections['/Game/Settings']).toEqual({
        ServerName: 'TestServer',
        MaxPlayers: '8',
      });
    });

    it('should return 200 with empty config if config file does not exist', async () => {
      setupConfigDir('missing-container');
      mockContainerInspect('missing-container');

      const res = await request(app).get('/api/containers/missing-container/config');

      expect(res.status).toBe(200);
      expect(res.body.config._sections).toEqual({});
      expect(res.body.launchParams).toEqual({});
    });

    it('should include launch params in response', async () => {
      setupConfigDir('params-container', '[Settings]\nKey=Value\n', 'MODE=HARD\n');
      mockContainerInspect('params-container');

      const res = await request(app).get('/api/containers/params-container/config');

      expect(res.status).toBe(200);
      expect(res.body.launchParams).toEqual({ MODE: 'HARD' });
    });
  });

  describe('PUT /api/containers/:id/config', () => {
    it('should write config and return success', async () => {
      setupConfigDir('write-api-container', '[Settings]\nServerName=Old\n');
      mockContainerInspect('write-api-container');

      const res = await request(app)
        .put('/api/containers/write-api-container/config')
        .send({ config: { _sections: { Settings: { ServerName: 'NewServer' } } } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config._sections['Settings'].ServerName).toBe('NewServer');
    });

    it('should write config and launch params together', async () => {
      setupConfigDir('write-both-container', '[Settings]\nKey=Value\n');
      mockContainerInspect('write-both-container');

      const res = await request(app)
        .put('/api/containers/write-both-container/config')
        .send({
          config: { _sections: { Settings: { Key: 'Updated' } } },
          launchParams: { PORT: '17777' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.launchParams).toEqual({ PORT: '17777' });
    });

    it('should return 400 if config is missing from body', async () => {
      const res = await request(app)
        .put('/api/containers/some-container/config')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid config', async () => {
      const res = await request(app)
        .put('/api/containers/some-container/config')
        .send({ config: null });

      expect(res.status).toBe(400);
    });
  });
});
