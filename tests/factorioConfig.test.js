const fs = require('fs');
const path = require('path');

const { readConfig, writeConfig, validateConfigData, FACTORIO_CONFIG_FIELDS } = require('../src/services/factorioConfig');

const TMP_DIR = path.join(__dirname, '__tmp_factorio_config__');

function setupConfigDir(containerName, jsonContent, rconContent) {
  const dir = path.join(TMP_DIR, containerName, 'config');
  fs.mkdirSync(dir, { recursive: true });
  if (jsonContent !== undefined) {
    fs.writeFileSync(path.join(dir, 'server-settings.json'), jsonContent, 'utf-8');
  }
  if (rconContent !== undefined) {
    fs.writeFileSync(path.join(dir, 'rconpw'), rconContent, 'utf-8');
  }
  return dir;
}

function cleanupTmpDir() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

describe('factorioConfig - JSON file read/write', () => {
  const originalEnv = process.env.GAME_CONFIG_ROOT;

  beforeAll(() => {
    process.env.GAME_CONFIG_ROOT = TMP_DIR;
  });

  afterAll(() => {
    process.env.GAME_CONFIG_ROOT = originalEnv;
    cleanupTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir();
  });

  it('should read an empty config when no files exist', () => {
    const result = readConfig('nonexistent');
    expect(result.json).toEqual({ rcon_password: '' });
  });

  it('should read config from server-settings.json and rconpw', () => {
    setupConfigDir('factorio', '{"name": "Test Server", "max_players": 20}', 'secret');
    const result = readConfig('factorio');
    expect(result.json.name).toBe('Test Server');
    expect(result.json.max_players).toBe(20);
    expect(result.json.rcon_password).toBe('secret');
  });

  it('should flatten visibility for the UI', () => {
    setupConfigDir('factorio', '{"visibility": {"public": true, "lan": false}}');
    const result = readConfig('factorio');
    expect(result.json['visibility.public']).toBe(true);
    expect(result.json['visibility.lan']).toBe(false);
    expect(result.json.visibility).toBeUndefined();
  });

  it('should write config to server-settings.json and rconpw', () => {
    setupConfigDir('factorio');
    writeConfig('factorio', { json: { name: 'My Server', max_players: '16', rcon_password: 'newsecret' } });
    const result = readConfig('factorio');
    expect(result.json.name).toBe('My Server');
    expect(result.json.max_players).toBe(16);
    expect(result.json.rcon_password).toBe('newsecret');
  });

  it('should unflatten visibility when writing', () => {
    setupConfigDir('factorio');
    writeConfig('factorio', { json: { 'visibility.public': 'true', 'visibility.lan': 'false' } });
    const dir = path.join(TMP_DIR, 'factorio', 'config');
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'server-settings.json'), 'utf-8'));
    expect(content.visibility).toEqual({ public: true, lan: false });
  });

  it('should convert boolean strings to booleans', () => {
    setupConfigDir('factorio');
    writeConfig('factorio', { json: { require_user_verification: 'true', auto_pause: 'false' } });
    const dir = path.join(TMP_DIR, 'factorio', 'config');
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'server-settings.json'), 'utf-8'));
    expect(content.require_user_verification).toBe(true);
    expect(content.auto_pause).toBe(false);
  });

  it('should merge with existing config', () => {
    setupConfigDir('factorio', '{"name": "Old", "description": "Desc"}');
    writeConfig('factorio', { json: { name: 'New' } });
    const result = readConfig('factorio');
    expect(result.json.name).toBe('New');
    expect(result.json.description).toBe('Desc');
  });

  it('should create directory if it does not exist', () => {
    writeConfig('newcontainer', { json: { name: 'Test' } });
    const result = readConfig('newcontainer');
    expect(result.json.name).toBe('Test');
  });

  it('should validate correct data', () => {
    const result = validateConfigData({ json: { name: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateConfigData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateConfigData({ json: { name: big } });
    expect(result.valid).toBe(false);
  });

  it('should have FACTORIO_CONFIG_FIELDS defined', () => {
    expect(FACTORIO_CONFIG_FIELDS).toBeDefined();
    expect(FACTORIO_CONFIG_FIELDS.length).toBeGreaterThan(0);
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('key');
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('label');
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('type');
  });
});
