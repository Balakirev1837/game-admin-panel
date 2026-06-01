const express = require('express');
const { docker } = require('../services/docker');
const { execInContainer, readFileFromContainer } = require('../services/containerFiles');
const games = require('../games');
const logger = require('../services/logger');

const router = express.Router();

const GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT || '/host-games';
const SNAPSHOTS_DIR = require('path').join(GAME_CONFIG_ROOT, '.game-admin-panel', 'snapshots');
const fs = require('fs');

function ensureSnapshotsDir() {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

function getSnapshotDir(containerName, gameId) {
  return require('path').join(SNAPSHOTS_DIR, gameId, containerName);
}

router.get('/:id/snapshots', async (req, res) => {
  const { id } = req.params;
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();
    const game = info.Config?.Labels?.['game-admin-panel.game'] || 'icarus';
    const name = info.Name.replace(/^\//, '');

    if (!['minecraft', 'factorio'].includes(game)) {
      return res.status(400).json({ error: 'Snapshots not supported for this game' });
    }

    const dir = getSnapshotDir(name, game);
    if (!fs.existsSync(dir)) {
      return res.json({ snapshots: [] });
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.tar.gz'))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(require('path').join(dir, f));
        return { file: f, size: stat.size, created: stat.mtime.toISOString() };
      });

    res.json({ snapshots: files, game });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/snapshots', async (req, res) => {
  const { id } = req.params;
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();
    if (!info.State?.Running) {
      return res.status(400).json({ error: 'Container must be running' });
    }

    const game = info.Config?.Labels?.['game-admin-panel.game'] || 'icarus';
    const name = info.Name.replace(/^\//, '');

    let sourcePath;
    if (game === 'minecraft') sourcePath = '/data/world';
    else if (game === 'factorio') sourcePath = '/factorio/saves';
    else return res.status(400).json({ error: 'Snapshots not supported for this game' });

    const dir = getSnapshotDir(name, game);
    ensureSnapshotsDir();
    fs.mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${game}-snapshot-${timestamp}.tar.gz`;
    const filepath = require('path').join(dir, filename);

    const exec = await container.exec({
      Cmd: ['tar', 'czf', '/tmp/_panel_snapshot.tar.gz', '-C', sourcePath, '.'],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    const archiveStream = await container.getArchive({ path: '/tmp/_panel_snapshot.tar.gz' });
    const archiveChunks = [];
    for await (const chunk of archiveStream) archiveChunks.push(chunk);

    const archiveBuf = Buffer.concat(archiveChunks);
    const tar = require('tar');
    const entries = [];
    await new Promise((resolve, reject) => {
      tar.t({
        onentry: (entry) => {
          let data = Buffer.alloc(0);
          entry.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
          entry.on('end', () => entries.push({ path: entry.path, data }));
        },
        onend: resolve,
      }).end(archiveBuf);
    });

    const snapshotEntry = entries.find(e => e.path === '_panel_snapshot.tar.gz' || e.path === './_panel_snapshot.tar.gz');
    if (!snapshotEntry) {
      return res.status(500).json({ error: 'Failed to create snapshot archive' });
    }

    fs.writeFileSync(filepath, snapshotEntry.data);

    try {
      const exec2 = await container.exec({
        Cmd: ['rm', '-f', '/tmp/_panel_snapshot.tar.gz'],
        AttachStdout: true,
        AttachStderr: true,
      });
      await exec2.start({ hijack: true, stdin: false });
    } catch {}

    logger.info({ game, container: name, file: filename }, 'Snapshot created');
    res.json({ success: true, snapshot: { file: filename, size: fs.statSync(filepath).size } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/snapshots/:file', async (req, res) => {
  const { id, file } = req.params;
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();
    const game = info.Config?.Labels?.['game-admin-panel.game'] || 'icarus';
    const name = info.Name.replace(/^\//, '');

    const dir = getSnapshotDir(name, game);
    const filepath = require('path').join(dir, file);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
