const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000;

function isEnabled() {
  return ADMIN_PASSWORD !== null && ADMIN_PASSWORD !== '';
}

function authMiddleware(req, res, next) {
  if (!isEnabled()) return next();

  const token = req.headers['x-session-token'] ||
    (req.cookies && req.cookies['admin-session']) ||
    null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = sessions.get(token);
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  req.session = { user: session.user, token };
  next();
}

router.post('/login', (req, res) => {
  if (!isEnabled()) {
    return res.json({ authenticated: true, user: { name: 'admin' } });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: { name: username }, createdAt: Date.now() });

  res.cookie('admin-session', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL,
  });

  return res.json({ authenticated: true, user: { name: username }, token });
});

router.post('/logout', (req, res) => {
  const token = req.headers['x-session-token'] ||
    (req.cookies && req.cookies['admin-session']) ||
    null;

  if (token) sessions.delete(token);

  res.clearCookie('admin-session');
  return res.json({ success: true });
});

router.get('/session', (req, res) => {
  if (!isEnabled()) {
    return res.json({ authenticated: true, user: { name: 'admin' }, authRequired: false });
  }

  const token = req.headers['x-session-token'] ||
    (req.cookies && req.cookies['admin-session']) ||
    null;

  if (!token || !sessions.has(token)) {
    return res.json({ authenticated: false, authRequired: true });
  }

  const session = sessions.get(token);
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return res.json({ authenticated: false, authRequired: true });
  }

  return res.json({ authenticated: true, user: session.user, authRequired: true, token });
});

function cleanup() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(token);
    }
  }
}

if (require.main === module) {
  setInterval(cleanup, 60 * 60 * 1000);
}

module.exports = { router, authMiddleware, isEnabled };
