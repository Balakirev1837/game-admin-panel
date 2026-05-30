const fs = require('fs');
const path = require('path');

const GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT || '/host-games';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS, 10) || 10;

function getBackupDir(containerName) {
  return path.join(GAME_CONFIG_ROOT, containerName, 'backups');
}

function getConfigPath(containerName, game) {
  const base = path.join(GAME_CONFIG_ROOT, containerName);
  switch (game) {
    case 'cs2': return path.join(base, '.env');
    case 'minecraft': return path.join(base, '.env');
    case 'factorio': return path.join(base, 'config', 'server-settings.json');
    case 'terraria': return path.join(base, 'tshock', 'config.json');
    default: return path.join(base, 'Saved', 'Config', 'WindowsServer', 'ServerSettings.ini');
  }
}

function createBackup(containerName, game) {
  const configPath = getConfigPath(containerName, game);
  if (!fs.existsSync(configPath)) return null;

  const backupDir = getBackupDir(containerName);
  fs.mkdirSync(backupDir, { recursive: true });

  const ext = path.extname(configPath) || '.ini';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `config.${timestamp}${ext}`);

  fs.copyFileSync(configPath, backupFile);
  pruneBackups(containerName);

  return {
    file: path.basename(backupFile),
    timestamp,
    size: fs.statSync(backupFile).size,
  };
}

function listBackups(containerName) {
  const backupDir = getBackupDir(containerName);
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('config.'))
    .sort()
    .reverse();

  return files.map(f => {
    const fullPath = path.join(backupDir, f);
    const stat = fs.statSync(fullPath);
    return {
      file: f,
      size: stat.size,
      created: stat.mtime.toISOString(),
    };
  });
}

function restoreBackup(containerName, game, backupFile) {
  const backupDir = getBackupDir(containerName);
  const sourcePath = path.join(backupDir, backupFile);

  if (!fs.existsSync(sourcePath)) {
    throw new Error('Backup file not found');
  }

  const configPath = getConfigPath(containerName, game);
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.copyFileSync(sourcePath, configPath);
  return { restored: backupFile };
}

function pruneBackups(containerName) {
  const backupDir = getBackupDir(containerName);
  if (!fs.existsSync(backupDir)) return;

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('config.'))
    .sort();

  while (files.length > MAX_BACKUPS) {
    const oldest = files.shift();
    fs.unlinkSync(path.join(backupDir, oldest));
  }
}

module.exports = { createBackup, listBackups, restoreBackup };
