const fs = require('fs');
const path = require('path');
const logger = require('./logger');

function getGameRoot() {
  return process.env.GAME_CONFIG_ROOT || '/host-games';
}

function getProspectsDir(containerName) {
  return path.join(getGameRoot(), containerName, 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects');
}

function listProspects(containerName) {
  const dir = getProspectsDir(containerName);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f }));
}

function saveProspect(containerName, name, content) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    const err = new Error('Prospect name is required');
    err.code = 'EINVAL';
    throw err;
  }

  let parsed;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (err) {
    logger.warn({ err, name }, 'Failed to parse prospect JSON content');
    const err2 = new Error('Invalid JSON content — file may be corrupted');
    err2.code = 'EINVAL';
    throw err2;
  }

  if (!parsed || typeof parsed !== 'object') {
    const err = new Error('Prospect content must be a valid JSON object');
    err.code = 'EINVAL';
    throw err;
  }

  const safeName = name.endsWith('.json') ? name : `${name}.json`;
  const dir = getProspectsDir(containerName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, safeName);
  if (fs.existsSync(filePath)) {
    const err = new Error(`Prospect "${safeName}" already exists`);
    err.code = 'EEXIST';
    throw err;
  }

  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
  return { name: safeName };
}

module.exports = { listProspects, saveProspect, getProspectsDir };