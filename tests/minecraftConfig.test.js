const fs = require('fs');
const path = require('path');

const { readEnvFile, writeEnvFile, validateEnvData, MINECRAFT_ENV_FIELDS } = require('../src/services/minecraftConfig');

const TMP_DIR = path.join(__dirname, '__tmp_minecraft_config__');

function setupConfigDir(containerName, envContent) {
  const dir = path.join(TMP_DIR, containerName);
  fs.mkdirSync(dir, { recursive: true });
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

describe('minecraftConfig - env file read/write', () => {
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

  it('should read an empty config when no .env file exists', () => {
    const result = readEnvFile('nonexistent');
    expect(result.env).toEqual({});
  });

  it('should read env vars from .env file', () => {
    setupConfigDir('minecraft', 'MOTD=Test Server\nMAX_PLAYERS=20\nRCON_PASSWORD=secret\n');
    const result = readEnvFile('minecraft');
    expect(result.env.MOTD).toBe('Test Server');
    expect(result.env.MAX_PLAYERS).toBe('20');
    expect(result.env.RCON_PASSWORD).toBe('secret');
  });

  it('should skip comments and blank lines', () => {
    setupConfigDir('minecraft', '# Comment\n\nMOTD=Test\n  \n');
    const result = readEnvFile('minecraft');
    expect(Object.keys(result.env)).toHaveLength(1);
    expect(result.env.MOTD).toBe('Test');
  });

  it('should write env vars to .env file', () => {
    setupConfigDir('minecraft');
    writeEnvFile('minecraft', { env: { MOTD: 'My Server', MAX_PLAYERS: '16' } });
    const result = readEnvFile('minecraft');
    expect(result.env.MOTD).toBe('My Server');
    expect(result.env.MAX_PLAYERS).toBe('16');
  });

  it('should merge with existing env vars', () => {
    setupConfigDir('minecraft', 'MOTD=Old\nMAX_PLAYERS=10\n');
    writeEnvFile('minecraft', { env: { MOTD: 'New' } });
    const result = readEnvFile('minecraft');
    expect(result.env.MOTD).toBe('New');
    expect(result.env.MAX_PLAYERS).toBe('10');
  });

  it('should create directory if it does not exist', () => {
    writeEnvFile('newcontainer', { env: { MOTD: 'Test' } });
    const result = readEnvFile('newcontainer');
    expect(result.env.MOTD).toBe('Test');
  });

  it('should validate correct data', () => {
    const result = validateEnvData({ env: { MOTD: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateEnvData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateEnvData({ env: { MOTD: big } });
    expect(result.valid).toBe(false);
  });

  it('should preserve all existing keys on write', () => {
    setupConfigDir('minecraft');
    writeEnvFile('minecraft', { env: { MOTD: 'Test', EXTRA_KEY: 'preserved' } });
    const result = readEnvFile('minecraft');
    expect(result.env.MOTD).toBe('Test');
    expect(result.env.EXTRA_KEY).toBe('preserved');
  });

  it('should have MINECRAFT_ENV_FIELDS defined', () => {
    expect(MINECRAFT_ENV_FIELDS).toBeDefined();
    expect(MINECRAFT_ENV_FIELDS.length).toBeGreaterThan(0);
    expect(MINECRAFT_ENV_FIELDS[0]).toHaveProperty('key');
    expect(MINECRAFT_ENV_FIELDS[0]).toHaveProperty('label');
    expect(MINECRAFT_ENV_FIELDS[0]).toHaveProperty('type');
  });
});
