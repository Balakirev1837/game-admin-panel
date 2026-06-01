const express = require('express');
const { docker } = require('../services/docker');

const router = express.Router();

let containerCache = { data: null, timestamp: 0 };
const CONTAINER_CACHE_TTL = process.env.NODE_ENV === 'test' ? 0 : 1500;

async function handleContainerAction(req, res, action, successMessage) {
  const { id } = req.params;
  if (!docker) {
    return res.status(503).json({ success: false, message: 'Docker client is not available' });
  }
  try {
    const container = docker.getContainer(id);
    await container[action]();
    return res.status(200).json({ success: true, message: successMessage });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: 'Container not found' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

function invalidateContainerCache() {
  containerCache = { data: null, timestamp: 0 };
}

router.get('/', async (_req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }

  const now = Date.now();
  if (containerCache.data && (now - containerCache.timestamp) < CONTAINER_CACHE_TTL) {
    return res.json(containerCache.data);
  }

  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['game-admin-panel.enabled=true'] }
    });

    const detailed = await Promise.all(containers.map(async (c) => {
      const base = {
        id: c.Id,
        name: c.Names[0] ? c.Names[0].replace(/^\//, '') : '',
        image: c.Image,
        status: c.Status,
        state: c.State,
        game: (c.Labels && c.Labels['game-admin-panel.game']) || null,
        ports: c.Ports.map((p) => ({
          IP: p.IP || '',
          PrivatePort: p.PrivatePort || null,
          PublicPort: p.PublicPort || null,
          Type: p.Type || '',
        })),
        created: c.Created || null,
      };

      try {
        const container = docker.getContainer(c.Id);
        const info = await container.inspect();
        const state = info.State || {};

        base.started_at = state.StartedAt || null;
        base.finished_at = state.FinishedAt || null;
        base.exit_code = state.ExitCode != null ? state.ExitCode : null;
        base.oom_killed = state.OOMKilled || false;
        base.error = state.Error || null;
        base.restart_policy = (info.HostConfig && info.HostConfig.RestartPolicy && info.HostConfig.RestartPolicy.Name) || null;
        base.image_digest = info.Image || null;
        base.image_created = (info.Config && info.Config.Image) || null;

        if (state.Health) {
          base.health = {
            status: state.Health.Status || null,
            failing_streak: state.Health.FailingStreak || 0,
            last_output: (state.Health.Log && state.Health.Log.length > 0)
              ? state.Health.Log[state.Health.Log.length - 1].Output || null
              : null,
          };
        }

        if (state.Running && state.StartedAt) {
          const started = new Date(state.StartedAt);
          const uptimeSec = (Date.now() - started.getTime()) / 1000;
          base.uptime = formatDuration(uptimeSec);
          base.uptime_seconds = Math.floor(uptimeSec);
        }
      } catch {}

      return base;
    }));

    containerCache = { data: detailed, timestamp: Date.now() };
    return res.json(detailed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/start', async (req, res) => {
  await handleContainerAction(req, res, 'start', 'Container started');
});

router.post('/:id/stop', async (req, res) => {
  await handleContainerAction(req, res, 'stop', 'Container stopped');
});

router.post('/:id/restart', async (req, res) => {
  await handleContainerAction(req, res, 'restart', 'Container restarted');
});

router.get('/:id/image', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }
  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    const imageId = info.Image;
    const image = docker.getImage(imageId);
    const imageInfo = await image.inspect();
    return res.json({
      id: imageInfo.Id,
      repo_tags: imageInfo.RepoTags || [],
      created: imageInfo.Created || null,
      size: imageInfo.Size || 0,
      size_human: formatBytes(imageInfo.Size || 0),
      digest: imageInfo.Id,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Container or image not found' });
    }
    return res.status(500).json({ error: err.message });
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

module.exports = { router, invalidateContainerCache };
