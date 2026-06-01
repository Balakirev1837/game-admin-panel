const fs = require('fs');
const path = require('path');
const { docker } = require('./docker');
const logger = require('./logger');

function getGameConfigRoot() {
  return process.env.GAME_CONFIG_ROOT || '/host-games';
}

const SCHEDULES_FILE = () => require('path').join(getGameConfigRoot(), '.game-admin-panel', 'schedules.json');

function ensureSchedulesDir() {
  const dir = require('path').join(getGameConfigRoot(), '.game-admin-panel');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadSchedules() {
  try {
    ensureSchedulesDir();
    if (!fs.existsSync(SCHEDULES_FILE())) return [];
    return JSON.parse(fs.readFileSync(SCHEDULES_FILE(), 'utf-8'));
  } catch (err) {
    logger.warn({ err }, 'Failed to load schedules');
    return [];
  }
}

function saveSchedules(schedules) {
  ensureSchedulesDir();
  fs.writeFileSync(SCHEDULES_FILE(), JSON.stringify(schedules, null, 2));
}

function addSchedule(schedule) {
  const schedules = loadSchedules();
  const id = 'sched_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const entry = {
    id,
    containerName: schedule.containerName,
    containerId: schedule.containerId,
    action: schedule.action,
    cron: schedule.cron,
    enabled: schedule.enabled !== false,
    lastRun: null,
    createdAt: new Date().toISOString(),
  };
  schedules.push(entry);
  saveSchedules(schedules);
  return entry;
}

function removeSchedule(id) {
  const schedules = loadSchedules();
  const filtered = schedules.filter(s => s.id !== id);
  if (filtered.length === schedules.length) return false;
  saveSchedules(filtered);
  return true;
}

function updateSchedule(id, updates) {
  const schedules = loadSchedules();
  const entry = schedules.find(s => s.id === id);
  if (!entry) return null;
  Object.assign(entry, updates);
  saveSchedules(schedules);
  return entry;
}

async function executeAction(schedule) {
  if (!docker) return;
  try {
    const container = docker.getContainer(schedule.containerId);
    switch (schedule.action) {
      case 'restart':
        await container.restart();
        logger.info({ schedule: schedule.id, action: schedule.action, container: schedule.containerName }, 'Scheduled action executed');
        break;
      case 'stop':
        await container.stop();
        logger.info({ schedule: schedule.id, action: schedule.action, container: schedule.containerName }, 'Scheduled action executed');
        break;
      case 'start':
        await container.start();
        logger.info({ schedule: schedule.id, action: schedule.action, container: schedule.containerName }, 'Scheduled action executed');
        break;
      default:
        logger.warn({ action: schedule.action }, 'Unknown scheduled action');
    }
    schedule.lastRun = new Date().toISOString();
    const schedules = loadSchedules();
    const idx = schedules.findIndex(s => s.id === schedule.id);
    if (idx >= 0) {
      schedules[idx].lastRun = schedule.lastRun;
      saveSchedules(schedules);
    }
  } catch (err) {
    logger.warn({ err, schedule: schedule.id, action: schedule.action }, 'Scheduled action failed');
  }
}

function parseCron(cronExpr) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const minute = parseField(parts[0], 0, 59);
  const hour = parseField(parts[1], 0, 23);
  const dom = parseField(parts[2], 1, 31);
  const month = parseField(parts[3], 1, 12);
  const dow = parseField(parts[4], 0, 6);

  if (!minute || !hour || !dom || !month || !dow) return null;

  return (date) => {
    const m = date.getMinutes();
    const h = date.getHours();
    const d = date.getDate();
    const mo = date.getMonth() + 1;
    const w = date.getDay();
    return minute.has(m) && hour.has(h) && dom.has(d) && month.has(mo) && dow.has(w);
  };
}

function parseField(field, min, max) {
  const result = new Set();
  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) result.add(i);
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) return null;
      let start = min;
      let end = max;
      if (range !== '*') {
        const [s, e] = range.split('-').map(Number);
        if (isNaN(s) || isNaN(e)) return null;
        start = s;
        end = e;
      }
      for (let i = start; i <= end; i += step) result.add(i);
    } else if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      if (isNaN(s) || isNaN(e)) return null;
      for (let i = s; i <= e; i++) result.add(i);
    } else {
      const val = parseInt(part, 10);
      if (isNaN(val)) return null;
      result.add(val);
    }
  }
  return result;
}

let checker = null;

function startScheduler() {
  if (checker || process.env.NODE_ENV === 'test') return;
  let lastMinute = -1;
  checker = setInterval(() => {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    if (currentMinute === lastMinute) return;
    lastMinute = currentMinute;

    const schedules = loadSchedules().filter(s => s.enabled);
    for (const schedule of schedules) {
      const matches = parseCron(schedule.cron);
      if (matches && matches(now)) {
        executeAction(schedule);
      }
    }
  }, 30000);
}

if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}

module.exports = { loadSchedules, addSchedule, removeSchedule, updateSchedule, parseCron, startScheduler };
