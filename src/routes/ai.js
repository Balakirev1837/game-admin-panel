const express = require('express');
const http = require('http');
const https = require('https');
const { docker } = require('../services/docker');
const { demuxDockerLogs } = require('./logs');

const router = express.Router();

const AI_API_KEY = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || '';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4.1-mini';

const SYSTEM_PROMPT = `You are a game server log analyst. When given server logs, you should:
1. Identify any errors, warnings, or anomalies
2. Diagnose the root cause of issues
3. Suggest specific, actionable fixes
4. Note performance concerns (high CPU, memory, slow ticks, etc.)
5. Assess overall server health

Be concise and practical. Use bullet points. If logs look healthy, say so briefly.`;

router.get('/status', (_req, res) => {
  res.json({ enabled: !!AI_API_KEY });
});

router.post('/:id/analyze-logs', async (req, res) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ error: 'AI analysis is not configured. Set OPENROUTER_API_KEY environment variable.' });
  }

  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }

  const tail = req.query.tail || '200';
  const container = docker.getContainer(req.params.id);

  try {
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail === 'all' ? 'all' : Math.max(1, parseInt(tail, 10) || 200),
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
        const timeout = setTimeout(resolve, 10000);
        logStream.on('end', () => { clearTimeout(timeout); resolve(); });
        logStream.on('error', (err) => { clearTimeout(timeout); reject(err); });
      });
      buf = Buffer.concat(chunks);
    }

    const lines = demuxDockerLogs(buf);
    if (lines.length === 0) {
      return res.json({ analysis: 'No logs found for this container.' });
    }

    const logText = lines.slice(-300).map(l => {
      const prefix = l.stream === 'stderr' ? '[ERR]' : '[OUT]';
      const ts = l.timestamp ? ` ${l.timestamp}` : '';
      return `${prefix}${ts} ${l.text}`;
    }).join('\n');

    const containerInfo = await container.inspect();
    const containerName = containerInfo.Name.replace(/^\//, '');
    const game = (containerInfo.Config && containerInfo.Config.Labels && containerInfo.Config.Labels['game-admin-panel.game']) || 'unknown';

    const userMessage = `Analyze these logs from a ${game} game server container named "${containerName}":\n\n${logText}`;

    const requestBody = JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    const url = new URL(`${AI_BASE_URL}/chat/completions`);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const aiRes = await new Promise((resolve, reject) => {
      const req = transport.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Length': Buffer.byteLength(requestBody),
        },
      }, resolve);
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    let responseBody = '';
    aiRes.setEncoding('utf-8');
    for await (const chunk of aiRes) {
      responseBody += chunk;
    }

    if (aiRes.statusCode !== 200) {
      return res.status(502).json({ error: `AI API returned ${aiRes.statusCode}: ${responseBody.substring(0, 500)}` });
    }

    const aiData = JSON.parse(responseBody);
    const analysis = (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) || 'No analysis returned.';

    return res.json({ analysis });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
