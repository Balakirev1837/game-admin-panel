const fs = require('fs');
const path = require('path');

function getGameConfigRoot() {
  return process.env.GAME_CONFIG_ROOT || '/host-games';
}

function getMaxBackups() {
  return parseInt(process.env.MAX_BACKUPS, 10) || 10;
}

const CONTAINER_CONFIG_GAMES = new Set(['factorio', 'terraria']);

function getBackupDir(containerName) {
  return path.join(getGameConfigRoot(), containerName, 'backups');
}

function getHostConfigPath(containerName, game) {
  const base = path.join(getGameConfigRoot(), containerName);
  switch (game) {
    case 'cs2': return path.join(base, '.env');
    case 'minecraft': return path.join(base, '.env');
    default: return path.join(base, 'Saved', 'Config', 'WindowsServer', 'ServerSettings.ini');
  }
}

async function readConfigFromContainer(containerId, game) {
  const { readFileFromContainer } = require('./containerFiles');
  if (game === 'factorio') {
    const data = await readFileFromContainer(containerId, '/factorio/config/server-settings.json');
    return data;
  } else if (game === 'terraria') {
    const paths = ['/tshock/config.json', '/root/.local/share/Terraria/tshock/config.json'];
    for (const p of paths) {
      const data = await readFileFromContainer(containerId, p);
      if (data) return data;
    }
  }
  return null;
}

async function createBackup(containerName, game, info) {
  const backupDir = getBackupDir(containerName);
  fs.mkdirSync(backupDir, { recursive: true });

  let configContent;
  let ext;

  if (CONTAINER_CONFIG_GAMES.has(game)) {
    if (!info || !info.State || info.State.Running !== true) {
      return null;
    }
    const containerId = info.Id || containerName;
    configContent = await readConfigFromContainer(containerId, game);
    ext = '.json';
  } else {
    const configPath = getHostConfigPath(containerName, game);
    if (!fs.existsSync(configPath)) return null;
    configContent = fs.readFileSync(configPath, 'utf-8');
    ext = path.extname(configPath) || '.ini';
  }

  if (configContent === null) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `config.${timestamp}${ext}`);

  fs.writeFileSync(backupFile, configContent);
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

  const configPath = getHostConfigPath(containerName, game);
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

  while (files.length > getMaxBackups()) {
    const oldest = files.shift();
    fs.unlinkSync(path.join(backupDir, oldest));
  }
}

module.exports = { createBackup, listBackups, restoreBackup };
