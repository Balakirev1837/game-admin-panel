const request = require('supertest');

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockRestart = jest.fn();
const mockGetContainer = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

const app = require('../src/index');

describe('POST /api/containers/:id/start', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockStart.mockReset();
  });

  it('should return 200 when container is started successfully', async () => {
    mockGetContainer.mockReturnValue({ start: mockStart });
    mockStart.mockResolvedValue(undefined);

    const res = await request(app).post('/api/containers/abc123/start');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Container started' });
    expect(mockGetContainer).toHaveBeenCalledWith('abc123');
    expect(mockStart).toHaveBeenCalled();
  });

  it('should return 404 when container does not exist', async () => {
    mockGetContainer.mockReturnValue({ start: mockStart });
    const err = new Error('No such container');
    err.statusCode = 404;
    mockStart.mockRejectedValue(err);

    const res = await request(app).post('/api/containers/nonexistent/start');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Container not found');
  });

  it('should return 500 when Docker fails to start the container', async () => {
    mockGetContainer.mockReturnValue({ start: mockStart });
    const err = new Error('Internal Docker error');
    err.statusCode = 500;
    mockStart.mockRejectedValue(err);

    const res = await request(app).post('/api/containers/abc123/start');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Internal Docker error');
  });
});

describe('POST /api/containers/:id/stop', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockStop.mockReset();
  });

  it('should return 200 when container is stopped successfully', async () => {
    mockGetContainer.mockReturnValue({ stop: mockStop });
    mockStop.mockResolvedValue(undefined);

    const res = await request(app).post('/api/containers/abc123/stop');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Container stopped' });
    expect(mockGetContainer).toHaveBeenCalledWith('abc123');
    expect(mockStop).toHaveBeenCalled();
  });

  it('should return 404 when container does not exist', async () => {
    mockGetContainer.mockReturnValue({ stop: mockStop });
    const err = new Error('No such container');
    err.statusCode = 404;
    mockStop.mockRejectedValue(err);

    const res = await request(app).post('/api/containers/nonexistent/stop');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Container not found');
  });

  it('should return 500 when Docker fails to stop the container', async () => {
    mockGetContainer.mockReturnValue({ stop: mockStop });
    const err = new Error('Internal Docker error');
    err.statusCode = 500;
    mockStop.mockRejectedValue(err);

    const res = await request(app).post('/api/containers/abc123/stop');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Internal Docker error');
  });
});

describe('POST /api/containers/:id/restart', () => {
  beforeEach(() => {
    mockGetContainer.mockReset();
    mockRestart.mockReset();
  });

  it('should return 200 when container is restarted successfully', async () => {
    mockGetContainer.mockReturnValue({ restart: mockRestart });
    mockRestart.mockResolvedValue(undefined);

    const res = await request(app).post('/api/containers/abc123/restart');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Container restarted' });
    expect(mockGetContainer).toHaveBeenCalledWith('abc123');
    expect(mockRestart).toHaveBeenCalled();
  });

  it('should return 404 when container does not exist', async () => {
    mockGetContainer.mockReturnValue({ restart: mockRestart });
    const err = new Error('No such container');
    err.statusCode = 404;
    mockRestart.mockRejectedValue(err);

    const res = await request(app).post('/api/containers/nonexistent/restart');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Container not found');
  });

  it('should return 500 when Docker fails to restart the container', async () => {
    mockGetContainer.mockReturnValue({ restart: mockRestart });
    const err = new Error('Internal Docker error');
    err.statusCode = 500;
    mockRestart.mockRejectedValue(err);

    const res = await request(app).post('/api/containers/abc123/restart');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Internal Docker error');
  });
});
