const Docker = require('dockerode');

describe('Docker service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should export a docker client instance', () => {
    const { docker } = require('../src/services/docker');
    expect(docker).toBeDefined();
    expect(typeof docker.listContainers).toBe('function');
    expect(typeof docker.ping).toBe('function');
    expect(typeof docker.getContainer).toBe('function');
  });

  it('should export a verifyDockerConnection function', () => {
    const { verifyDockerConnection } = require('../src/services/docker');
    expect(typeof verifyDockerConnection).toBe('function');
  });

  it('should return true when Docker ping succeeds', async () => {
    jest.doMock('dockerode', () => {
      return jest.fn().mockImplementation(() => ({
        ping: jest.fn().mockResolvedValue('OK'),
      }));
    });

    const { verifyDockerConnection } = require('../src/services/docker');
    const result = await verifyDockerConnection();
    expect(result).toBe(true);
  });

  it('should return false when Docker ping fails', async () => {
    jest.doMock('dockerode', () => {
      return jest.fn().mockImplementation(() => ({
        ping: jest.fn().mockRejectedValue(new Error('Connection refused')),
      }));
    });

    const { verifyDockerConnection } = require('../src/services/docker');
    const result = await verifyDockerConnection();
    expect(result).toBe(false);
  });

  it('should set docker to null when Dockerode constructor throws', () => {
    jest.doMock('dockerode', () => {
      return jest.fn().mockImplementation(() => {
        throw new Error('Cannot connect to Docker');
      });
    });

    const { docker } = require('../src/services/docker');
    expect(docker).toBeNull();
  });

  it('should return false from verifyDockerConnection when docker is null', async () => {
    jest.doMock('dockerode', () => {
      return jest.fn().mockImplementation(() => {
        throw new Error('Cannot connect to Docker');
      });
    });

    const { verifyDockerConnection } = require('../src/services/docker');
    const result = await verifyDockerConnection();
    expect(result).toBe(false);
  });
});

describe('Docker list containers', () => {
  it('should list containers via docker.listContainers', async () => {
    const mockContainers = [
      {
        Id: 'abc123',
        Names: ['/test-container'],
        Image: 'nginx:latest',
        Status: 'Up 2 hours',
        State: 'running',
        Ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
      },
    ];

    jest.doMock('dockerode', () => {
      return jest.fn().mockImplementation(() => ({
        listContainers: jest.fn().mockResolvedValue(mockContainers),
        ping: jest.fn().mockResolvedValue('OK'),
      }));
    });

    jest.resetModules();
    const { docker } = require('../src/services/docker');
    const containers = await docker.listContainers({ all: true });
    expect(containers).toHaveLength(1);
    expect(containers[0].Id).toBe('abc123');
    expect(containers[0].Names[0]).toBe('/test-container');
    expect(containers[0].Image).toBe('nginx:latest');
    expect(containers[0].State).toBe('running');
  });
});
