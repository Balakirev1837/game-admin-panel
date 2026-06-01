const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const { docker } = require('../services/docker');
const logger = require('../services/logger');

const router = express.Router();

let diskCache = { data: [], timestamp: 0 };
const DISK_CACHE_TTL = 30000;

router.get('/stats', async (_req, res) => {
  const disk = await getDiskUsage();
  const result = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    load_average: os.loadavg(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      total_human: formatBytes(os.totalmem()),
      free_human: formatBytes(os.freemem()),
      used_human: formatBytes(os.totalmem() - os.freemem()),
      percent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100),
    },
    cpus: os.cpus().length,
    disk,
    docker: null,
  };

  if (docker) {
    try {
      const info = await docker.info();
      result.docker = {
        version: info.ServerVersion || null,
        containers: info.Containers || 0,
        containers_running: info.ContainersRunning || 0,
        containers_paused: info.ContainersPaused || 0,
        containers_stopped: info.ContainersStopped || 0,
        images: info.Images || 0,
      };
    } catch (err) {
      logger.warn({ err }, 'Failed to get Docker info');
    }
  }

  return res.json(result);
});

async function getDiskUsage() {
  const now = Date.now();
  if (diskCache.data.length > 0 && (now - diskCache.timestamp) < DISK_CACHE_TTL) {
    return diskCache.data;
  }

  try {
    const output = await new Promise((resolve, reject) => {
      exec('df -B1 --output=size,used,avail,pcent,target 2>/dev/null || df -B1 2>/dev/null', {
        timeout: 2000,
        encoding: 'utf-8',
      }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });

    const lines = output.trim().split('\n');
    const disks = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 5) {
        disks.push({
          filesystem: parts.length > 5 ? parts.slice(0, parts.length - 4).join(' ') : '',
          size: parseInt(parts[parts.length - 4], 10) || 0,
          used: parseInt(parts[parts.length - 3], 10) || 0,
          available: parseInt(parts[parts.length - 2], 10) || 0,
          percent: parseInt(parts[parts.length - 1], 10) || 0,
          mount: parts.length > 5 ? parts[parts.length - 1] : parts[parts.length - 5] || '',
          size_human: formatBytes(parseInt(parts[parts.length - 4], 10) || 0),
          used_human: formatBytes(parseInt(parts[parts.length - 3], 10) || 0),
          available_human: formatBytes(parseInt(parts[parts.length - 2], 10) || 0),
        });
      }
    }
    diskCache = { data: disks, timestamp: now };
    return disks;
  } catch (err) {
    logger.warn({ err }, 'Failed to get disk usage');
    return diskCache.data;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

module.exports = router;
