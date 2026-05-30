const fs = require('fs');
const path = require('path');

const { readConfig, writeConfig, validateConfigData, TERRARIA_CONFIG_FIELDS } = require('../src/services/terrariaConfig');

const TMP_DIR = path.join(__dirname, '__tmp_terraria_config__');

function setupConfigDir(containerName, jsonContent) {
  const dir = path.join(TMP_DIR, containerName, 'tshock');
  fs.mkdirSync(dir, { recursive: true });
  if (jsonContent !== undefined) {
    fs.writeFileSync(path.join(dir, 'config.json'), jsonContent, 'utf-8');
  }
  return dir;
}

function cleanupTmpDir() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

describe('terrariaConfig - JSON file read/write', () => {
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
    expect(result.json).toEqual({ ApplicationRestTokens: '' });
  });

  it('should read config from config.json', () => {
    setupConfigDir('terraria', '{"ServerName": "Test Server", "MaxSlots": 20, "ApplicationRestTokens": ["secret"]}');
    const result = readConfig('terraria');
    expect(result.json.ServerName).toBe('Test Server');
    expect(result.json.MaxSlots).toBe(20);
    expect(result.json.ApplicationRestTokens).toBe('secret');
  });

  it('should handle empty ApplicationRestTokens array', () => {
    setupConfigDir('terraria', '{"ApplicationRestTokens": []}');
    const result = readConfig('terraria');
    expect(result.json.ApplicationRestTokens).toBe('');
  });

  it('should write config to config.json', () => {
    setupConfigDir('terraria');
    writeConfig('terraria', { json: { ServerName: 'My Server', MaxSlots: '16', ApplicationRestTokens: 'newsecret' } });
    const result = readConfig('terraria');
    expect(result.json.ServerName).toBe('My Server');
    expect(result.json.MaxSlots).toBe(16);
    expect(result.json.ApplicationRestTokens).toBe('newsecret');
  });

  it('should convert ApplicationRestTokens to array when writing', () => {
    setupConfigDir('terraria');
    writeConfig('terraria', { json: { ApplicationRestTokens: 'token123' } });
    const dir = path.join(TMP_DIR, 'terraria', 'tshock');
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'));
    expect(content.ApplicationRestTokens).toEqual(['token123']);
  });

  it('should convert boolean strings to booleans', () => {
    setupConfigDir('terraria');
    writeConfig('terraria', { json: { RestApiEnabled: 'true' } });
    const dir = path.join(TMP_DIR, 'terraria', 'tshock');
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'));
    expect(content.RestApiEnabled).toBe(true);
  });

  it('should convert number strings to numbers', () => {
    setupConfigDir('terraria');
    writeConfig('terraria', { json: { ServerPort: '7777', MaxSlots: '8' } });
    const dir = path.join(TMP_DIR, 'terraria', 'tshock');
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'));
    expect(content.ServerPort).toBe(7777);
    expect(content.MaxSlots).toBe(8);
  });

  it('should merge with existing config', () => {
    setupConfigDir('terraria', '{"ServerName": "Old", "ServerPassword": "pwd"}');
    writeConfig('terraria', { json: { ServerName: 'New' } });
    const result = readConfig('terraria');
    expect(result.json.ServerName).toBe('New');
    expect(result.json.ServerPassword).toBe('pwd');
  });

  it('should create directory if it does not exist', () => {
    writeConfig('newcontainer', { json: { ServerName: 'Test' } });
    const result = readConfig('newcontainer');
    expect(result.json.ServerName).toBe('Test');
  });

  it('should validate correct data', () => {
    const result = validateConfigData({ json: { ServerName: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateConfigData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateConfigData({ json: { ServerName: big } });
    expect(result.valid).toBe(false);
  });

  it('should have TERRARIA_CONFIG_FIELDS defined', () => {
    expect(TERRARIA_CONFIG_FIELDS).toBeDefined();
    expect(TERRARIA_CONFIG_FIELDS.length).toBeGreaterThan(0);
    expect(TERRARIA_CONFIG_FIELDS[0]).toHaveProperty('key');
    expect(TERRARIA_CONFIG_FIELDS[0]).toHaveProperty('label');
    expect(TERRARIA_CONFIG_FIELDS[0]).toHaveProperty('type');
  });
});
