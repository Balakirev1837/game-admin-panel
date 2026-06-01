const express = require('express');
const { docker } = require('../services/docker');
const scheduler = require('../services/scheduler');
const games = require('../games');

const router = express.Router();

router.get('/', (_req, res) => {
  const schedules = scheduler.loadSchedules();
  res.json({ schedules });
});

router.post('/', (req, res) => {
  const { containerId, containerName, action, cron, enabled } = req.body;
  if (!containerId || !action || !cron) {
    return res.status(400).json({ error: 'containerId, action, and cron are required' });
  }
  if (!['restart', 'stop', 'start'].includes(action)) {
    return res.status(400).json({ error: 'Action must be restart, stop, or start' });
  }
  if (!scheduler.parseCron(cron)) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }
  const schedule = scheduler.addSchedule({ containerId, containerName, action, cron, enabled });
  res.json({ schedule });
});

router.delete('/:id', (req, res) => {
  const removed = scheduler.removeSchedule(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ success: true });
});

router.patch('/:id', (req, res) => {
  const { enabled, cron, action } = req.body;
  const updates = {};
  if (enabled !== undefined) updates.enabled = enabled;
  if (cron !== undefined) {
    if (!scheduler.parseCron(cron)) return res.status(400).json({ error: 'Invalid cron expression' });
    updates.cron = cron;
  }
  if (action !== undefined) {
    if (!['restart', 'stop', 'start'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    updates.action = action;
  }
  const schedule = scheduler.updateSchedule(req.params.id, updates);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ schedule });
});

module.exports = router;
