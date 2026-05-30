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
  });
});
