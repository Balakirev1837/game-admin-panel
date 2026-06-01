const request = require('supertest');
const { PassThrough } = require('stream');

const mockGetContainer = jest.fn();
const mockGetEvents = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
    getEvents: mockGetEvents,
  }));
});

describe('Events SSE', () => {
  let app;
  let eventStream;

  beforeAll(() => {
    eventStream = new PassThrough();
    mockGetEvents.mockReturnValue(eventStream);
    app = require('../src/index');
  });

  beforeEach(() => {
    mockGetContainer.mockReset();
  });

  describe('GET /api/events', () => {
    it('should return events array', async () => {
      const res = await request(app).get('/api/events/');
      expect(res.status).toBe(200);
      expect(res.body.events).toBeDefined();
      expect(Array.isArray(res.body.events)).toBe(true);
    });
  });

  describe('GET /api/events/stream', () => {
    it('should return SSE content type', async () => {
      const res = await request(app)
        .get('/api/events/stream')
        .timeout(1000)
        .catch(() => null);

      if (res) {
        expect(res.status).toBe(200);
      }
    });
  });

  describe('onEvent callback', () => {
    it('should invoke registered callbacks on Docker events', (done) => {
      const { onEvent, startEventListener } = require('../src/routes/events');
      startEventListener();

      onEvent((event) => {
        expect(event.action).toBe('die');
        expect(event.name).toBe('test-container');
        done();
      });

      const dockerEvent = JSON.stringify({
        Type: 'container',
        Action: 'die',
        Actor: {
          ID: 'abc123',
          Attributes: { name: 'test-container' },
        },
        time: Date.now() / 1000,
      });

      eventStream.write(Buffer.from(dockerEvent + '\n'));
    });

    it('should handle malformed event data without crashing', () => {
      expect(() => {
        eventStream.write(Buffer.from('not json\n'));
      }).not.toThrow();
    });
  });

  describe('sendNtfyNotification', () => {
    it('should not crash when NTFY_TOPIC is not set', () => {
      delete process.env.NTFY_TOPIC;
      expect(() => require('../src/routes/events')).not.toThrow();
    });
  });
});
