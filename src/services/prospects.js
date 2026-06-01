const fs = require('fs');
const path = require('path');

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

function validateProspectName(name) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    const err = new Error('Prospect name is required');
    err.code = 'EINVAL';
    throw err;
  }

  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    const err = new Error('Prospect name must not contain path separators or traversal sequences');
    err.code = 'EINVAL';
    throw err;
  }
}

function saveProspect(containerName, name, content) {
  validateProspectName(name);

  if (typeof content !== 'string' || content.trim() === '') {
    const err = new Error('Prospect content is required');
    err.code = 'EINVAL';
    throw err;
  }

  let ProspectID;
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    ProspectID = parsed.ProspectInfo && parsed.ProspectInfo.ProspectID;
  } catch (err) {
    const err2 = new Error('Invalid JSON content — file may be corrupted');
    err2.code = 'EINVAL';
    throw err2;
  }

  if (ProspectID !== undefined && ProspectID !== null) {
    const expectedName = ProspectID + '.json';
    const safeName = name.endsWith('.json') ? name : `${name}.json`;
    if (safeName !== expectedName) {
      const err = new Error(
        `Filename "${safeName}" must match ProspectID "${expectedName}" — renaming prospect files corrupts save data`
      );
      err.code = 'EINVAL';
      throw err;
    }
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

  fs.writeFileSync(filePath, content, 'utf-8');
  return { name: safeName };
}

module.exports = { listProspects, saveProspect, getProspectsDir };
