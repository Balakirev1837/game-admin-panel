const express = require('express');
const { docker } = require('../services/docker');

const router = express.Router();

router.get('/:id/logs', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }

  const tail = req.query.tail || '500';
  const container = docker.getContainer(req.params.id);

  try {
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail === 'all' ? 'all' : Math.max(1, parseInt(tail, 10) || 500),
      timestamps: true,
    });

    const chunks = [];
    logStream.on('data', (chunk) => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      logStream.on('end', resolve);
      logStream.on('error', reject);
    });

    const buf = Buffer.concat(chunks);
    const lines = demuxDockerLogs(buf);

    return res.json({ logs: lines });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.status(500).json({ error: err.message });
  }
});

function demuxDockerLogs(buf) {
  const lines = [];
  let offset = 0;

  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;

    const header = buf[offset];
    const streamType = header === 1 ? 'stdout' : header === 2 ? 'stderr' : 'stdout';
    const length = buf.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + length > buf.length) break;

    const content = buf.toString('utf-8', offset, offset + length).replace(/\n$/, '');
    offset += length;

    let timestamp = null;
    let text = content;
    const tsMatch = text.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+/);
    if (tsMatch) {
      timestamp = tsMatch[1];
      text = text.substring(tsMatch[0].length);
    }

    lines.push({ stream: streamType, timestamp, text });
  }

  return lines;
}

module.exports = router;
