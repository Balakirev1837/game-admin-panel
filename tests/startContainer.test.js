const request = require('supertest');
const Docker = require('dockerode');

// Mock dockerode before requiring the app so it uses the mock
const mockStart = jest.fn();
const mockGetContainer = jest.fn(() => ({ start: mockStart }));

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
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
