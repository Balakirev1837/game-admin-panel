const request = require('supertest');
const { PassThrough, Readable } = require('stream');
const { EventEmitter } = require('events');

const mockGetContainer = jest.fn();
const mockLogs = jest.fn();
const mockInspect = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

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
});
