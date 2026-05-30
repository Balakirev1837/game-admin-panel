const request = require('supertest');

// Mock dockerode before requiring the app
jest.mock('dockerode', () => {
  const mockListContainers = jest.fn();
  const mockGetContainer = jest.fn();
  function Docker() {
    this.listContainers = mockListContainers;
    this.getContainer = mockGetContainer;
  }
  Docker.__mockListContainers = mockListContainers;
  Docker.__mockGetContainer = mockGetContainer;
  return Docker;
});

const Docker = require('dockerode');
const app = require('../src/index');

describe('GET /api/containers', () => {
  beforeEach(() => {
    Docker.__mockListContainers.mockReset();
    Docker.__mockGetContainer.mockReset();
  });

  it('should return a JSON array of containers', async () => {
    const mockContainers = [
      {
        Id: 'abc123',
        Names: ['/my-container'],
        Image: 'nginx:latest',
        Status: 'Up 2 hours',
        State: 'running',
        Ports: [
          { IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' },
        ],
      },
    ];
    Docker.__mockListContainers.mockResolvedValue(mockContainers);

    const res = await request(app).get('/api/containers');

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: 'abc123',
      name: 'my-container',
      image: 'nginx:latest',
      status: 'Up 2 hours',
      state: 'running',
      game: null,
      ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
    });

    // Verify listContainers was called with all: true and the game label filter
    expect(Docker.__mockListContainers).toHaveBeenCalledWith({
      all: true,
      filters: { label: ['game-admin-panel.enabled=true'] }
    });
  });

  it('should include both running and stopped containers', async () => {
    const mockContainers = [
      {
        Id: 'running1',
        Names: ['/running-app'],
        Image: 'node:18',
        Status: 'Up 1 hour',
        State: 'running',
        Ports: [],
      },
      {
        Id: 'stopped1',
        Names: ['/stopped-app'],
        Image: 'redis:7',
        Status: 'Exited (0) 5 minutes ago',
        State: 'exited',
        Ports: [],
      },
    ];
    Docker.__mockListContainers.mockResolvedValue(mockContainers);

    const res = await request(app).get('/api/containers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].state).toBe('running');
    expect(res.body[1].state).toBe('exited');
  });

  it('should return 500 with error message on Docker failure', async () => {
    Docker.__mockListContainers.mockRejectedValue(new Error('Cannot connect to Docker daemon'));

    const res = await request(app).get('/api/containers');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Cannot connect to Docker daemon');
  });

  it('should return empty array when no containers exist', async () => {
    Docker.__mockListContainers.mockResolvedValue([]);

    const res = await request(app).get('/api/containers');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
