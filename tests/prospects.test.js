const fs = require('fs');
const path = require('path');
const request = require('supertest');

jest.mock('dockerode', () => {
  const mockInspect = jest.fn();
  const mockGetContainer = jest.fn(() => ({ inspect: mockInspect }));
  function Docker() {
    this.getContainer = mockGetContainer;
    this.listContainers = jest.fn().mockResolvedValue([]);
  }
  Docker.__mockGetContainer = mockGetContainer;
  Docker.__mockInspect = mockInspect;
  return Docker;
});

const app = require('../src/index');
const Docker = require('dockerode');

const TMP_DIR = path.join(__dirname, '__tmp_prospects_test__');

beforeAll(() => {
  process.env.GAME_CONFIG_ROOT = TMP_DIR;
});

afterAll(() => {
  delete process.env.GAME_CONFIG_ROOT;
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

beforeEach(() => {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
  jest.clearAllMocks();
  Docker.__mockInspect.mockResolvedValue({ Name: '/test-container', State: {} });
  Docker.__mockGetContainer.mockReturnValue({ inspect: Docker.__mockInspect });
});

describe('GET /api/containers/:id/prospects', () => {
  it('should return empty array when no prospects exist', async () => {
    const res = await request(app).get('/api/containers/test-container/prospects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should list .json files in the Prospects directory', async () => {
    const dir = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'MyWorld.json'), '{}');
    fs.writeFileSync(path.join(dir, 'OtherProspect.json'), '{}');
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'ignored');

    const res = await request(app).get('/api/containers/test-container/prospects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { name: 'MyWorld.json' },
      { name: 'OtherProspect.json' },
    ]);
  });
});

describe('POST /api/containers/:id/prospects', () => {
  it('should save a valid prospect file', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'NewProspect', content: { foo: 'bar' } });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.prospect).toBe('NewProspect.json');

    const filePath = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects', 'NewProspect.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(saved).toEqual({ foo: 'bar' });
  });

  it('should append .json to name if missing', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'NoExtension', content: { a: 1 } });

    expect(res.status).toBe(201);
    expect(res.body.prospect).toBe('NoExtension.json');
  });

  it('should accept stringified JSON content', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Stringified', content: JSON.stringify({ key: 'val' }) });

    expect(res.status).toBe(201);

    const filePath = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects', 'Stringified.json');
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(saved).toEqual({ key: 'val' });
  });

  it('should return 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ content: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  it('should return 400 if content is missing', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content is required/i);
  });

  it('should return 400 for invalid JSON content', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Bad', content: 'not json{{{[' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid json/i);
  });

  it('should return 409 if prospect already exists', async () => {
    const dir = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Existing.json'), '{}');

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Existing', content: {} });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});