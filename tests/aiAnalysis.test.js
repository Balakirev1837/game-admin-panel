const request = require('supertest');
const { PassThrough, Readable } = require('stream');
const { EventEmitter } = require('events');

const mockGetContainer = jest.fn();
const mockLogs = jest.fn();
const mockInspect = jest.fn();

const mockReadConfig = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('../src/games', () => ({
  get: jest.fn(),
  list: jest.fn(() => []),
  isSupported: jest.fn(() => true),
}));

const originalEnv = process.env;

function createLogStream(lines) {
  const stream = new PassThrough();
  const data = lines.map(l => {
    const header = Buffer.alloc(8);
    header[0] = l.stream === 'stderr' ? 2 : 1;
    header.writeUInt32BE(l.text.length + (l.timestamp ? l.timestamp.length + 1 : 0), 4);
    const ts = l.timestamp ? l.timestamp + ' ' : '';
    return Buffer.concat([header, Buffer.from(ts + l.text)]);
  });
  setImmediate(() => {
    data.forEach(d => stream.push(d));
    stream.push(null);
  });
  return stream;
}

function createMockHttpResponse(body, statusCode = 200) {
  const readable = new Readable({ read() {} });
  readable.statusCode = statusCode;
  readable.setEncoding = function () {};
  setImmediate(() => {
    readable.push(body);
    readable.push(null);
  });
  return readable;
}

describe('AI Log Analysis', () => {
  let app;

  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    jest.resetModules();
    app = require('../src/index');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    mockGetContainer.mockReset();
    mockLogs.mockReset();
    mockInspect.mockReset();
  });

  describe('GET /api/ai/status', () => {
    it('should return enabled when API key is set', async () => {
      const res = await request(app).get('/api/ai/status');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });
  });

  describe('POST /api/ai/:id/analyze-logs', () => {
    it('should return analysis from AI', async () => {
      const logStream = createLogStream([
        { stream: 'stdout', text: 'Server started on port 25565', timestamp: '2026-01-01T00:00:00Z' },
        { stream: 'stderr', text: 'Warning: low memory' },
      ]);

      mockGetContainer.mockReturnValue({
        logs: mockLogs,
        inspect: mockInspect,
      });
      mockLogs.mockResolvedValue(logStream);
      mockInspect.mockResolvedValue({
        Name: '/minecraft-server',
        Config: { Labels: { 'game-admin-panel.game': 'minecraft' } },
      });

      const aiResponseBody = JSON.stringify({
        choices: [{ message: { content: 'Server looks healthy. One memory warning noted.' } }],
      });
      const mockAiResponse = createMockHttpResponse(aiResponseBody, 200);

      const originalHttps = require('https');
      jest.spyOn(originalHttps, 'request').mockImplementation((_url, _opts, cb) => {
        cb(mockAiResponse);
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });

      const res = await request(app).post('/api/ai/abc123/analyze-logs');

      expect(res.status).toBe(200);
      expect(res.body.analysis).toContain('healthy');
    });

    it('should return 404 for non-existent container', async () => {
      mockGetContainer.mockReturnValue({
        logs: mockLogs,
        inspect: mockInspect,
      });
      const err = new Error('No such container');
      err.statusCode = 404;
      mockLogs.mockRejectedValue(err);

      const res = await request(app).post('/api/ai/nonexistent/analyze-logs');

      expect(res.status).toBe(404);
    });

    it('should handle empty logs', async () => {
      const logStream = createLogStream([]);

      mockGetContainer.mockReturnValue({
        logs: mockLogs,
        inspect: mockInspect,
      });
      mockLogs.mockResolvedValue(logStream);

      const res = await request(app).post('/api/ai/abc123/analyze-logs');

      expect(res.status).toBe(200);
      expect(res.body.analysis).toContain('No logs found');
    });
  });

  describe('POST /api/ai/:id/suggest-config', () => {
    it('should return config suggestions from AI', async () => {
      mockGetContainer.mockReturnValue({
        inspect: mockInspect,
      });
      mockInspect.mockResolvedValue({
        Name: '/minecraft-server',
        Config: { Labels: { 'game-admin-panel.game': 'minecraft' } },
      });

      const games = require('../src/games');
      games.get.mockReturnValue({
        id: 'minecraft',
        label: 'Minecraft',
        configFields: [
          { key: 'SERVER_NAME', type: 'string', label: 'Server Name', help: 'Name shown in server list' },
          { key: 'MAX_PLAYERS', type: 'number', label: 'Max Players', help: 'Maximum concurrent players' },
        ],
        readConfig: mockReadConfig,
      });
      mockReadConfig.mockResolvedValue({
        config: { SERVER_NAME: 'My Server', MAX_PLAYERS: '20' },
      });

      const aiResponseBody = JSON.stringify({
        choices: [{ message: { content: '{"SERVER_NAME": "Hardcore Survival", "MAX_PLAYERS": "10"}' } }],
      });
      const mockAiResponse = createMockHttpResponse(aiResponseBody, 200);

      const originalHttps = require('https');
      jest.spyOn(originalHttps, 'request').mockImplementation((_url, _opts, cb) => {
        cb(mockAiResponse);
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });

      const res = await request(app)
        .post('/api/ai/abc123/suggest-config')
        .send({ prompt: 'Make it a hardcore survival server with fewer players' });

      expect(res.status).toBe(200);
      expect(res.body.suggestions.SERVER_NAME).toBe('Hardcore Survival');
      expect(res.body.suggestions.MAX_PLAYERS).toBe('10');
      expect(res.body.game).toBe('minecraft');
    });

    it('should return 400 without prompt', async () => {
      const res = await request(app).post('/api/ai/abc123/suggest-config').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('prompt');
    });
  });

  describe('POST /api/ai/:id/explain-error', () => {
    it('should return error explanation from AI', async () => {
      const aiResponseBody = JSON.stringify({
        choices: [{ message: { content: 'This is a memory warning. It means the server is running low on RAM. You can ignore it unless it becomes frequent.' } }],
      });
      const mockAiResponse = createMockHttpResponse(aiResponseBody, 200);

      const originalHttps = require('https');
      jest.spyOn(originalHttps, 'request').mockImplementation((_url, _opts, cb) => {
        cb(mockAiResponse);
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });

      mockGetContainer.mockReturnValue({
        inspect: mockInspect,
      });
      mockInspect.mockResolvedValue({
        Name: '/minecraft-server',
        Config: { Labels: { 'game-admin-panel.game': 'minecraft' } },
      });

      const res = await request(app)
        .post('/api/ai/abc123/explain-error')
        .send({ logLine: 'Warning: low memory available', context: 'Server running for 2h' });

      expect(res.status).toBe(200);
      expect(res.body.explanation).toContain('memory');
      expect(res.body.cached).toBe(false);
    });

    it('should return cached explanation for similar errors', async () => {
      const aiResponseBody = JSON.stringify({
        choices: [{ message: { content: 'Cached explanation.' } }],
      });
      const mockAiResponse = createMockHttpResponse(aiResponseBody, 200);

      const originalHttps = require('https');
      jest.spyOn(originalHttps, 'request').mockImplementation((_url, _opts, cb) => {
        cb(mockAiResponse);
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        return req;
      });

      mockGetContainer.mockReturnValue({
        inspect: mockInspect,
      });
      mockInspect.mockResolvedValue({
        Name: '/minecraft-server',
        Config: { Labels: { 'game-admin-panel.game': 'minecraft' } },
      });

      await request(app)
        .post('/api/ai/abc123/explain-error')
        .send({ logLine: 'Warning: low memory available' });

      const callCount = originalHttps.request.mock.calls.length;

      const res = await request(app)
        .post('/api/ai/abc123/explain-error')
        .send({ logLine: 'Warning: low memory available' });

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
      expect(originalHttps.request.mock.calls.length).toBe(callCount);
    });

    it('should return 400 without logLine', async () => {
      const res = await request(app).post('/api/ai/abc123/explain-error').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('logLine');
    });
  });
});

describe('AI Log Analysis - no API key', () => {
  let app;

  beforeAll(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_API_KEY;
    jest.resetModules();
    app = require('../src/index');
  });

  it('should return disabled status when no API key', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('should return 503 when analyzing without API key', async () => {
    const res = await request(app).post('/api/ai/abc123/analyze-logs');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('OPENROUTER_API_KEY');
  });

  it('should return 503 for suggest-config without API key', async () => {
    const res = await request(app).post('/api/ai/abc123/suggest-config').send({ prompt: 'test' });
    expect(res.status).toBe(503);
  });

  it('should return 503 for explain-error without API key', async () => {
    const res = await request(app).post('/api/ai/abc123/explain-error').send({ logLine: 'error' });
    expect(res.status).toBe(503);
  });
});
