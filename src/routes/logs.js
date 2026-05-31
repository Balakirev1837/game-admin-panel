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
    const tailVal = tail === 'all' ? 'all' : Math.max(1, parseInt(tail, 10) || 500);
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: tailVal,
      timestamps: true,
    });

    let buf;
    if (Buffer.isBuffer(logStream)) {
      buf = logStream;
    } else if (typeof logStream === 'string') {
      buf = Buffer.from(logStream);
    } else {
      const chunks = [];
      logStream.on('data', (chunk) => chunks.push(chunk));

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 10000);
        logStream.on('end', () => { clearTimeout(timeout); resolve(); });
        logStream.on('error', (err) => { clearTimeout(timeout); reject(err); });
      });
      buf = Buffer.concat(chunks);
    }

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
  if (buf.length === 0) return [];

  const isFramed = (buf[0] === 1 || buf[0] === 2) && buf.length >= 8 &&
    buf.readUInt32BE(4) <= buf.length;

  if (!isFramed) {
    return parsePlainTextLogs(buf.toString('utf-8'));
  }

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

  if (lines.length === 0 && buf.length > 0) {
    return parsePlainTextLogs(buf.toString('utf-8'));
  }

  return lines;
}

function parsePlainTextLogs(text) {
  const lines = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    let timestamp = null;
    let line = raw;
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+/);
    if (tsMatch) {
      timestamp = tsMatch[1];
      line = line.substring(tsMatch[0].length);
    }
    if (line.trim()) {
      lines.push({ stream: 'stdout', timestamp, text: line });
    }
  }
  return lines;
}

module.exports = { router, demuxDockerLogs };
