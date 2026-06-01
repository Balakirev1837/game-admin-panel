const express = require('express');
const { docker } = require('../services/docker');
const logger = require('../services/logger');

const router = express.Router();

let eventBuffer = [];
const MAX_BUFFER = 100;
let eventStream = null;
let clients = new Set();
let onEventCallbacks = [];

function onEvent(callback) {
  onEventCallbacks.push(callback);
}

function startEventListener() {
  if (eventStream || !docker) return;

  try {
    eventStream = docker.getEvents({ filters: { type: ['container'] } });

    eventStream.on('data', (chunk) => {
      try {
        const event = JSON.parse(chunk.toString());
        const simplified = {
          type: event.Type,
          action: event.Action,
          container: event.Actor ? event.Actor.ID : null,
          name: event.Actor && event.Actor.Attributes ? event.Actor.Attributes.name : null,
          timestamp: event.time,
        };

        eventBuffer.push(simplified);
        if (eventBuffer.length > MAX_BUFFER) {
          eventBuffer = eventBuffer.slice(-MAX_BUFFER);
        }

        for (const cb of onEventCallbacks) {
          try { cb(simplified); } catch (err) { logger.warn({ err }, 'Event callback error'); }
        }

        const data = JSON.stringify(simplified);
        for (const client of clients) {
          try {
            client.write(`data: ${data}\n\n`);
          } catch (err) { logger.warn({ err }, 'SSE client write error'); }
        }
      } catch (err) { logger.warn({ err }, 'Failed to parse Docker event chunk'); }
    });

    eventStream.on('error', () => {
      eventStream = null;
      setTimeout(startEventListener, 30000);
    });

    eventStream.on('end', () => {
      eventStream = null;
      setTimeout(startEventListener, 5000);
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to start Docker event listener');
    eventStream = null;
  }
}

if (process.env.NODE_ENV !== 'test') {
  startEventListener();
}

router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  for (const event of eventBuffer) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  clients.add(res);

  req.on('close', () => {
    clients.delete(res);
  });
});

router.get('/', (_req, res) => {
  res.json({ events: eventBuffer.slice(-50) });
});

module.exports = { router, startEventListener, onEvent };
