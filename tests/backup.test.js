const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
const originalRoot = process.env.GAME_CONFIG_ROOT;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  process.env.GAME_CONFIG_ROOT = tmpDir;
  jest.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (originalRoot) process.env.GAME_CONFIG_ROOT = originalRoot;
  else delete process.env.GAME_CONFIG_ROOT;
});

describe('backup service', () => {
  it('should return empty list when no backups exist', () => {
    const backup = require('../src/services/backup');
    const result = backup.listBackups('test-container');
    expect(result).toEqual([]);
  });

  it('should create a backup before write', async () => {
    const containerDir = path.join(tmpDir, 'test-container');
    fs.mkdirSync(containerDir, { recursive: true });
    fs.writeFileSync(path.join(containerDir, '.env'), 'CS2_SERVERNAME=Test\n');

    const backup = require('../src/services/backup');
    const result = await backup.createBackup('test-container', 'cs2');
    expect(result).toBeDefined();
    expect(result.file).toMatch(/^config\.\d{4}-\d{2}-\d{2}T/);
    expect(result.size).toBeGreaterThan(0);

    const backups = backup.listBackups('test-container');
    expect(backups).toHaveLength(1);
  });

  it('should restore a backup', async () => {
    const containerDir = path.join(tmpDir, 'test-container');
    fs.mkdirSync(containerDir, { recursive: true });
    fs.writeFileSync(path.join(containerDir, '.env'), 'CS2_SERVERNAME=Original\n');

    const backup = require('../src/services/backup');
    const b = await backup.createBackup('test-container', 'cs2');

    fs.writeFileSync(path.join(containerDir, '.env'), 'CS2_SERVERNAME=Modified\n');

    backup.restoreBackup('test-container', 'cs2', b.file);

    const content = fs.readFileSync(path.join(containerDir, '.env'), 'utf-8');
    expect(content).toBe('CS2_SERVERNAME=Original\n');
  });

  it('should throw when restoring non-existent backup', () => {
    const backup = require('../src/services/backup');
    expect(() => backup.restoreBackup('test-container', 'cs2', 'nonexistent.env'))
      .toThrow('Backup file not found');
  });

  it('should prune old backups beyond MAX_BACKUPS', async () => {
    process.env.MAX_BACKUPS = '3';
    jest.resetModules();

    const containerDir = path.join(tmpDir, 'test-container');
    fs.mkdirSync(containerDir, { recursive: true });

    const backup = require('../src/services/backup');

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(containerDir, '.env'), `Version ${i}\n`);
      await backup.createBackup('test-container', 'cs2');
    }

    const backups = backup.listBackups('test-container');
    expect(backups.length).toBeLessThanOrEqual(3);

    delete process.env.MAX_BACKUPS;
  });

  it('should return null when no config file exists', async () => {
    const backup = require('../src/services/backup');
    const result = await backup.createBackup('no-config-here', 'cs2');
    expect(result).toBeNull();
  });

  it('should handle icarus config path', async () => {
    const containerDir = path.join(tmpDir, 'icarus-server');
    const configDir = path.join(containerDir, 'Saved', 'Config', 'WindowsServer');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'ServerSettings.ini'), '[ServerSettings]\nMaxPlayers=8\n');

    const backup = require('../src/services/backup');
    const result = await backup.createBackup('icarus-server', 'icarus');
    expect(result).toBeDefined();
    expect(result.file).toMatch(/\.ini$/);

    const backups = backup.listBackups('icarus-server');
    expect(backups).toHaveLength(1);
    expect(backups[0].file).toMatch(/\.ini$/);
  });

  it('should return null for Factorio when container is stopped', async () => {
    const backup = require('../src/services/backup');
    const info = { Id: 'abc123', State: { Running: false } };
    const result = await backup.createBackup('factorio-server', 'factorio', info);
    expect(result).toBeNull();
  });

  it('should return null for Terraria when container is stopped', async () => {
    const backup = require('../src/services/backup');
    const info = { Id: 'abc123', State: { Running: false } };
    const result = await backup.createBackup('terraria-server', 'terraria', info);
    expect(result).toBeNull();
  });
});
