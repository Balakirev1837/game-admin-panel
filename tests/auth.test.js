const request = require('supertest');

const mockGetContainer = jest.fn();
const mockListContainers = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: mockListContainers,
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

const ORIGINAL_PASSWORD = process.env.ADMIN_PASSWORD;

describe('Authentication', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    mockGetContainer.mockReturnValue({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      inspect: jest.fn().mockResolvedValue({ State: {} }),
      logs: jest.fn(),
      stats: jest.fn(),
    });
    mockListContainers.mockResolvedValue([]);
  });

  afterEach(() => {
    if (ORIGINAL_PASSWORD !== undefined) {
      process.env.ADMIN_PASSWORD = ORIGINAL_PASSWORD;
    } else {
      delete process.env.ADMIN_PASSWORD;
    }
  });

  describe('when ADMIN_PASSWORD is not set', () => {
    beforeEach(() => {
      delete process.env.ADMIN_PASSWORD;
      app = require('../src/index');
    });

    it('should allow unauthenticated access to protected endpoints', async () => {
      const res = await request(app).get('/api/containers');
      expect(res.status).toBe(200);
    });

    it('should return authRequired: false on session check', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.authRequired).toBe(false);
      expect(res.body.authenticated).toBe(true);
    });
  });

  describe('when ADMIN_PASSWORD is set', () => {
    beforeEach(() => {
      process.env.ADMIN_PASSWORD = 'test-secret';
      app = require('../src/index');
    });

    it('should reject unauthenticated access to protected endpoints', async () => {
      const res = await request(app).get('/api/containers');
      expect(res.status).toBe(401);
    });

    it('should reject access to /api/host/stats', async () => {
      const res = await request(app).get('/api/host/stats');
      expect(res.status).toBe(401);
    });

    it('should reject access to /api/schedules without auth', async () => {
      const res = await request(app).get('/api/schedules/');
      expect(res.status).toBe(401);
    });

    it('should reject access to /api/ai/status without auth when key is set', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      jest.resetModules();
      const authApp = require('../src/index');
      const res = await request(authApp).get('/api/ai/status');
      expect(res.status).toBe(401);
      delete process.env.OPENROUTER_API_KEY;
    });

    it('should reject access to /api/events without auth', async () => {
      const res = await request(app).get('/api/events/');
      expect(res.status).toBe(401);
    });

    it('should reject config write without auth', async () => {
      const res = await request(app)
        .put('/api/containers/abc123/config')
        .send({ config: {} });
      expect(res.status).toBe(401);
    });

    it('should reject RCON without auth', async () => {
      const res = await request(app)
        .post('/api/containers/abc123/rcon')
        .send({ command: 'status' });
      expect(res.status).toBe(401);
    });

    it('should reject REST without auth', async () => {
      const res = await request(app)
        .post('/api/containers/abc123/rest')
        .send({ command: 'status' });
      expect(res.status).toBe(401);
    });

    it('should reject start without auth', async () => {
      const res = await request(app).post('/api/containers/abc123/start');
      expect(res.status).toBe(401);
    });

    it('should reject logs without auth', async () => {
      const res = await request(app).get('/api/containers/abc123/logs');
      expect(res.status).toBe(401);
    });

    it('should reject players without auth', async () => {
      const res = await request(app).get('/api/containers/abc123/players');
      expect(res.status).toBe(401);
    });

    it('should reject game data without auth', async () => {
      const res = await request(app).get('/api/containers/abc123/game-data/saves');
      expect(res.status).toBe(401);
    });

    it('should reject snapshots without auth', async () => {
      const res = await request(app).get('/api/containers/abc123/snapshots');
      expect(res.status).toBe(401);
    });

    it('should allow access to /health without auth', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });

    it('should allow access to /api/version without auth', async () => {
      const res = await request(app).get('/api/version');
      expect(res.status).toBe(200);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('should reject login with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });
      expect(res.status).toBe(400);
    });

    it('should return a session token on successful login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('should allow access with valid session token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/containers')
        .set('x-session-token', token);
      expect(res.status).toBe(200);
    });

    it('should reject invalid session tokens', async () => {
      const res = await request(app)
        .get('/api/containers')
        .set('x-session-token', 'invalid-token');
      expect(res.status).toBe(401);
    });

    it('should return authRequired: true on session check when not authenticated', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.authRequired).toBe(true);
      expect(res.body.authenticated).toBe(false);
    });

    it('should return session info for valid token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/session')
        .set('x-session-token', token);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.name).toBe('admin');
    });

    it('should logout and invalidate the session', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const token = loginRes.body.token;

      await request(app)
        .post('/api/auth/logout')
        .set('x-session-token', token);

      const res = await request(app)
        .get('/api/containers')
        .set('x-session-token', token);
      expect(res.status).toBe(401);
    });

    it('should accept custom ADMIN_USERNAME', async () => {
      process.env.ADMIN_USERNAME = 'customadmin';
      jest.resetModules();
      const customApp = require('../src/index');

      const res = await request(customApp)
        .post('/api/auth/login')
        .send({ username: 'customadmin', password: 'test-secret' });
      expect(res.status).toBe(200);

      delete process.env.ADMIN_USERNAME;
    });

    it('should reject expired sessions', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const token = loginRes.body.token;

      const originalNow = Date.now;
      const twentyFiveHours = 25 * 60 * 60 * 1000;
      Date.now = () => originalNow() + twentyFiveHours;

      try {
        const res = await request(app)
          .get('/api/containers')
          .set('x-session-token', token);
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/expired/i);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should allow multiple concurrent sessions', async () => {
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const login2 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });

      expect(login1.body.token).not.toBe(login2.body.token);

      const res1 = await request(app).get('/api/containers').set('x-session-token', login1.body.token);
      const res2 = await request(app).get('/api/containers').set('x-session-token', login2.body.token);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it('should only invalidate the logged-out session, not all sessions', async () => {
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const login2 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });

      await request(app)
        .post('/api/auth/logout')
        .set('x-session-token', login1.body.token);

      const res1 = await request(app).get('/api/containers').set('x-session-token', login1.body.token);
      const res2 = await request(app).get('/api/containers').set('x-session-token', login2.body.token);
      expect(res1.status).toBe(401);
      expect(res2.status).toBe(200);
    });

    it('should reject login with wrong username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'notadmin', password: 'test-secret' });
      expect(res.status).toBe(401);
    });

    it('should reject login with both fields missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should handle logout without token gracefully', async () => {
      const res = await request(app)
        .post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject session check with expired token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-secret' });
      const token = loginRes.body.token;

      const originalNow = Date.now;
      Date.now = () => originalNow() + 25 * 60 * 60 * 1000;

      try {
        const res = await request(app)
          .get('/api/auth/session')
          .set('x-session-token', token);
        expect(res.body.authenticated).toBe(false);
      } finally {
        Date.now = originalNow;
      }
    });
  });
});
