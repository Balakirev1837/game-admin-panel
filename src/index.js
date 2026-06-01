const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { verifyDockerConnection } = require('./services/docker');
const { router: authRouter, authMiddleware } = require('./routes/auth');
const containersRouter = require('./routes/containers');
const configRouter = require('./routes/config');
const rconRouter = require('./routes/rcon');
const restRouter = require('./routes/rest');
const prospectsRouter = require('./routes/prospects');
const resourcesRouter = require('./routes/resources');
const { router: logsRouter } = require('./routes/logs');
const hostRouter = require('./routes/host');
const playersRouter = require('./routes/players');
const { router: eventsRouter } = require('./routes/events');
const gameDataRouter = require('./routes/gameData');
const aiRouter = require('./routes/ai');
const games = require('./games');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/version', (_req, res) => {
  try {
    const version = fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf-8').trim();
    res.json({ version });
  } catch {
    res.json({ version: 'unknown' });
  }
});

app.get('/api/games', (_req, res) => {
  const gameList = games.list().map(g => ({
    id: g.id,
    label: g.label,
    badgeColor: g.badgeColor,
    consoleType: g.consoleType,
    configFields: g.configFields,
    quickCommands: g.quickCommands,
    gameDataTypes: g.gameDataTypes || [],
  }));
  res.json({ games: gameList });
});

app.use('/api/auth', authRouter);

app.use('/api/containers', authMiddleware);
app.use('/api/containers', containersRouter);
app.use('/api/containers', configRouter);
app.use('/api/containers', rconRouter);
app.use('/api/containers', restRouter);
app.use('/api/containers', prospectsRouter);
app.use('/api/containers', resourcesRouter);
app.use('/api/containers', logsRouter);
app.use('/api/containers', playersRouter);

app.use('/api/events', authMiddleware);
app.use('/api/events', eventsRouter);

app.use('/api/containers', gameDataRouter);

app.use('/api/ai', authMiddleware);
app.use('/api/ai', aiRouter);

app.use('/api/host', authMiddleware);
app.use('/api/host', hostRouter);

if (require.main === module) {
  verifyDockerConnection().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = app;
