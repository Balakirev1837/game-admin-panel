const express = require('express');
const http = require('http');
const https = require('https');
const { docker } = require('../services/docker');
const { demuxDockerLogs } = require('./logs');
const games = require('../games');
const logger = require('../services/logger');

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

const CONFIG_SUGGESTION_PROMPT = `You are a game server configuration expert. When given the current config and a user's natural language request, suggest specific config changes.

Rules:
1. Return ONLY a JSON object with the exact keys and values that should change
2. Use the same key names and value types as the input config
3. If a request doesn't make sense for this game, explain why in a "message" field
4. For boolean-like fields that accept "true"/"false" as strings, keep them as strings
5. Never add keys that aren't in the provided config fields list

Example response format:
{"name": "My New Server Name", "max_players": "16"}`;

const ERROR_EXPLANATION_PROMPT = `You are a game server error diagnostician. When given an error log line from a game server, explain:
1. What the error means in plain language
2. Common causes
3. Whether it's critical or can be ignored
4. Suggested fix if applicable

Be concise (2-4 sentences). If the line isn't actually an error, say so briefly.`;

async function callAI(systemPrompt, userMessage) {
  if (!AI_API_KEY) throw new Error('AI not configured');

  const requestBody = JSON.stringify({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
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
  for await (const chunk of aiRes) responseBody += chunk;

  if (aiRes.statusCode !== 200) {
    throw new Error(`AI API returned ${aiRes.statusCode}: ${responseBody.substring(0, 500)}`);
  }

  const aiData = JSON.parse(responseBody);
  return (aiData.choices?.[0]?.message?.content) || '';
}

const errorExplanationCache = new Map();
const ERROR_CACHE_MAX = 100;

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

    const analysis = await callAI(SYSTEM_PROMPT, userMessage);
    return res.json({ analysis });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/suggest-config', async (req, res) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured' });
  }
  if (!docker) {
    return res.status(503).json({ error: 'Docker client is not available' });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const info = await container.inspect();
    const game = info.Config?.Labels?.['game-admin-panel.game'] || 'icarus';
    const adapter = games.get(game);
    if (!adapter) {
      return res.status(400).json({ error: `Unknown game: ${game}` });
    }

    const name = info.Name.replace(/^\//, '');
    let composeDir = null;
    const composeWorkingDir = info.Config?.Labels?.['com.docker.compose.project.working_dir'];
    if (composeWorkingDir) {
      const GAME_CONFIG_ROOT = process.env.GAME_CONFIG_ROOT || '/host-games';
      const GAME_CONFIG_ROOT_HOST = process.env.GAME_CONFIG_ROOT_HOST || '/home/tyler/Docker/games';
      composeDir = composeWorkingDir.replace(GAME_CONFIG_ROOT_HOST, GAME_CONFIG_ROOT);
    }

    const currentConfig = await adapter.readConfig(name, info, composeDir);
    const configFields = adapter.configFields || [];

    const fieldsDesc = configFields.map(f => `${f.key} (${f.type}) - ${f.label}: ${f.help || ''}`).join('\n');
    const configStr = JSON.stringify(currentConfig.config, null, 2);

    const userMessage = `Game: ${adapter.label}\n\nAvailable config fields:\n${fieldsDesc}\n\nCurrent config:\n${configStr}\n\nUser's request: "${prompt}"`;

    const response = await callAI(CONFIG_SUGGESTION_PROMPT, userMessage);

    let suggestions;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: response };
    } catch {
      suggestions = { message: response };
    }

    return res.json({ suggestions, game });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Container not found' });
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/explain-error', async (req, res) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured' });
  }

  const { logLine, context } = req.body || {};
  if (!logLine) {
    return res.status(400).json({ error: 'logLine is required' });
  }

  const signature = logLine.slice(0, 80).replace(/\d+/g, 'N').toLowerCase();
  const cached = errorExplanationCache.get(signature);
  if (cached) {
    return res.json({ explanation: cached, cached: true });
  }

  try {
    const container = docker?.getContainer(req.params.id);
    let game = 'unknown';
    if (container) {
      const info = await container.inspect();
      game = info.Config?.Labels?.['game-admin-panel.game'] || 'unknown';
    }

    const userMessage = `Game: ${game}\nError line: ${logLine}${context ? `\nSurrounding context:\n${context}` : ''}`;
    const explanation = await callAI(ERROR_EXPLANATION_PROMPT, userMessage);

    if (errorExplanationCache.size >= ERROR_CACHE_MAX) {
      const firstKey = errorExplanationCache.keys().next().value;
      errorExplanationCache.delete(firstKey);
    }
    errorExplanationCache.set(signature, explanation);

    return res.json({ explanation, cached: false });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Container not found' });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
