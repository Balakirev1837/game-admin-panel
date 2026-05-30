const express = require('express');
const cors = require('cors');
const { docker, verifyDockerConnection } = require('./services/docker');
const containersRouter = require('./routes/containers');
const configRouter = require('./routes/config');
const rconRouter = require('./routes/rcon');
const prospectsRouter = require('./routes/prospects');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount container routes
app.use('/api/containers', containersRouter);

// Mount config routes
app.use('/api/containers', configRouter);

// Mount RCON routes
app.use('/api/containers', rconRouter);

// Mount prospect routes
app.use('/api/containers', prospectsRouter);

// Stop a Docker container
app.post('/api/containers/:id/stop', async (req, res) => {
  const { id } = req.params;
  if (!docker) {
    return res.status(503).json({ success: false, message: 'Docker client is not available' });
  }
  try {
    const container = docker.getContainer(id);
    await container.stop();
    return res.status(200).json({ success: true, message: 'Container stopped' });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: 'Container not found' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Start a Docker container
app.post('/api/containers/:id/start', async (req, res) => {
  const { id } = req.params;
  if (!docker) {
    return res.status(503).json({ success: false, message: 'Docker client is not available' });
  }
  try {
    const container = docker.getContainer(id);
    await container.start();
    return res.status(200).json({ success: true, message: 'Container started' });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: 'Container not found' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

if (require.main === module) {
  verifyDockerConnection().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = app;
