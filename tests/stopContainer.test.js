const request = require('supertest');
const Docker = require('dockerode');

// Mock dockerode before requiring the app so it uses the mock
const mockStop = jest.fn();
const mockGetContainer = jest.fn(() => ({ stop: mockStop }));

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
  }));
});

const app = require('../src/index');

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
