const fs = require('fs');
const path = require('path');

const { readEnvFile, writeEnvFile, validateEnvData, CS2_ENV_FILEDS } = require('../src/services/cs2Config');

const TMP_DIR = path.join(__dirname, '__tmp_cs2_config__');

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

describe('cs2Config - env file read/write', () => {
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
    setupConfigDir('cs2', 'CS2_SERVERNAME=Test Server\nCS2_MAXPLAYERS=20\nCS2_RCONPW=secret\n');
    const result = readEnvFile('cs2');
    expect(result.env.CS2_SERVERNAME).toBe('Test Server');
    expect(result.env.CS2_MAXPLAYERS).toBe('20');
    expect(result.env.CS2_RCONPW).toBe('secret');
  });

  it('should skip comments and blank lines', () => {
    setupConfigDir('cs2', '# Comment\n\nCS2_SERVERNAME=Test\n  \n');
    const result = readEnvFile('cs2');
    expect(Object.keys(result.env)).toHaveLength(1);
    expect(result.env.CS2_SERVERNAME).toBe('Test');
  });

  it('should write env vars to .env file', () => {
    setupConfigDir('cs2');
    writeEnvFile('cs2', { env: { CS2_SERVERNAME: 'My Server', CS2_MAXPLAYERS: '16' } });
    const result = readEnvFile('cs2');
    expect(result.env.CS2_SERVERNAME).toBe('My Server');
    expect(result.env.CS2_MAXPLAYERS).toBe('16');
  });

  it('should merge with existing env vars', () => {
    setupConfigDir('cs2', 'CS2_SERVERNAME=Old\nCS2_MAXPLAYERS=10\n');
    writeEnvFile('cs2', { env: { CS2_SERVERNAME: 'New' } });
    const result = readEnvFile('cs2');
    expect(result.env.CS2_SERVERNAME).toBe('New');
    expect(result.env.CS2_MAXPLAYERS).toBe('10');
  });

  it('should create directory if it does not exist', () => {
    writeEnvFile('newcontainer', { env: { CS2_SERVERNAME: 'Test' } });
    const result = readEnvFile('newcontainer');
    expect(result.env.CS2_SERVERNAME).toBe('Test');
  });

  it('should validate correct data', () => {
    const result = validateEnvData({ env: { CS2_SERVERNAME: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateEnvData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateEnvData({ env: { CS2_SERVERNAME: big } });
    expect(result.valid).toBe(false);
  });

  it('should only write known CS2 keys', () => {
    setupConfigDir('cs2');
    writeEnvFile('cs2', { env: { CS2_SERVERNAME: 'Test', MALICIOUS_KEY: 'bad' } });
    const result = readEnvFile('cs2');
    expect(result.env.CS2_SERVERNAME).toBe('Test');
    expect(result.env.MALICIOUS_KEY).toBeUndefined();
  });

  it('should have CS2_ENV_FILEDS defined', () => {
    expect(CS2_ENV_FILEDS).toBeDefined();
    expect(CS2_ENV_FILEDS.length).toBeGreaterThan(0);
    expect(CS2_ENV_FILEDS[0]).toHaveProperty('key');
    expect(CS2_ENV_FILEDS[0]).toHaveProperty('label');
    expect(CS2_ENV_FILEDS[0]).toHaveProperty('type');
  });
});
