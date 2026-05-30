const request = require('supertest');
const { PassThrough } = require('stream');

const mockGetContainer = jest.fn();
const mockLogs = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

const app = require('../src/index');

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

describe('GET /api/containers/:id/logs', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockLogs.mockReset();
  });

  it('should return logs with stdout and stderr streams', async () => {
    const logStream = createLogStream([
      { stream: 'stdout', text: 'Server started', timestamp: '2026-01-01T00:00:00Z' },
      { stream: 'stderr', text: 'Warning: low memory' },
    ]);
    mockGetContainer.mockReturnValue({ logs: mockLogs });
    mockLogs.mockResolvedValue(logStream);

    const res = await request(app).get('/api/containers/abc123/logs?tail=100');

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.logs[0].stream).toBe('stdout');
    expect(res.body.logs[0].text).toBe('Server started');
    expect(res.body.logs[0].timestamp).toBe('2026-01-01T00:00:00Z');
    expect(res.body.logs[1].stream).toBe('stderr');
    expect(res.body.logs[1].text).toBe('Warning: low memory');
  });

  it('should default to tail=500', async () => {
    const logStream = createLogStream([]);
    mockGetContainer.mockReturnValue({ logs: mockLogs });
    mockLogs.mockResolvedValue(logStream);

    await request(app).get('/api/containers/abc123/logs');

    expect(mockLogs).toHaveBeenCalledWith(expect.objectContaining({ tail: 500, timestamps: true }));
  });

  it('should respect tail query parameter', async () => {
    const logStream = createLogStream([]);
    mockGetContainer.mockReturnValue({ logs: mockLogs });
    mockLogs.mockResolvedValue(logStream);

    await request(app).get('/api/containers/abc123/logs?tail=100');

    expect(mockLogs).toHaveBeenCalledWith(expect.objectContaining({ tail: 100 }));
  });

  it('should support tail=all', async () => {
    const logStream = createLogStream([]);
    mockGetContainer.mockReturnValue({ logs: mockLogs });
    mockLogs.mockResolvedValue(logStream);

    await request(app).get('/api/containers/abc123/logs?tail=all');

    expect(mockLogs).toHaveBeenCalledWith(expect.objectContaining({ tail: 'all' }));
  });

  it('should return 404 for non-existent container', async () => {
    mockGetContainer.mockReturnValue({ logs: mockLogs });
    const err = new Error('No such container');
    err.statusCode = 404;
    mockLogs.mockRejectedValue(err);

    const res = await request(app).get('/api/containers/nonexistent/logs');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Container not found');
  });

  it('should return 500 on Docker error', async () => {
    mockGetContainer.mockReturnValue({ logs: mockLogs });
    mockLogs.mockRejectedValue(new Error('Docker internal error'));

    const res = await request(app).get('/api/containers/abc123/logs');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Docker internal error');
  });
});
