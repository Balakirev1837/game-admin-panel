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
    Docker.__mockGetContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        State: {
          Running: true,
          StartedAt: '2026-01-01T00:00:00Z',
          FinishedAt: '0001-01-01T00:00:00Z',
          ExitCode: 0,
          OOMKilled: false,
          Error: '',
        },
        HostConfig: { RestartPolicy: { Name: 'unless-stopped' } },
      }),
    });

    const res = await request(app).get('/api/containers');

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('abc123');
    expect(res.body[0].name).toBe('my-container');
    expect(res.body[0].image).toBe('nginx:latest');
    expect(res.body[0].state).toBe('running');
    expect(res.body[0].game).toBeNull();
    expect(res.body[0].ports).toEqual([{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }]);
    expect(res.body[0].restart_policy).toBe('unless-stopped');
    expect(res.body[0].started_at).toBe('2026-01-01T00:00:00Z');
    expect(res.body[0].exit_code).toBe(0);
    expect(res.body[0].uptime).toBeDefined();

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
    Docker.__mockGetContainer.mockImplementation((id) => ({
      inspect: jest.fn().mockResolvedValue({
        State: {
          Running: id === 'running1',
          StartedAt: id === 'running1' ? '2026-01-01T00:00:00Z' : '2025-12-31T00:00:00Z',
          FinishedAt: id === 'stopped1' ? '2026-01-01T01:00:00Z' : '0001-01-01T00:00:00Z',
          ExitCode: id === 'stopped1' ? 0 : 0,
          OOMKilled: false,
          Error: '',
        },
        HostConfig: { RestartPolicy: { Name: 'always' } },
      }),
    }));

    const res = await request(app).get('/api/containers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].state).toBe('running');
    expect(res.body[0].restart_policy).toBe('always');
    expect(res.body[1].state).toBe('exited');
    expect(res.body[1].exit_code).toBe(0);
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
