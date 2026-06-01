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

  it('should ignore non-JSON files in listing', async () => {
    const dir = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'text');
    fs.writeFileSync(path.join(dir, '.hidden'), 'stuff');
    fs.writeFileSync(path.join(dir, 'valid.json'), '{}');

    const res = await request(app).get('/api/containers/test-container/prospects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: 'valid.json' }]);
  });
});

describe('POST /api/containers/:id/prospects', () => {
  it('should save a valid prospect file byte-for-byte', async () => {
    const rawContent = JSON.stringify({ ProspectInfo: { ProspectID: "TestWorld" }, Data: "abc" });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'TestWorld', content: rawContent });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.prospect).toBe('TestWorld.json');

    const filePath = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects', 'TestWorld.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const saved = fs.readFileSync(filePath, 'utf-8');
    expect(saved).toBe(rawContent);
  });

  it('should preserve exact formatting including whitespace and indentation', async () => {
    const rawContent = '{\n\t"ProspectInfo": {\n\t\t"ProspectID": "SpacedOut"\n\t}\n}';

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'SpacedOut', content: rawContent });

    expect(res.status).toBe(201);

    const filePath = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects', 'SpacedOut.json');
    const saved = fs.readFileSync(filePath, 'utf-8');
    expect(saved).toBe(rawContent);
  });

  it('should preserve CRLF line endings', async () => {
    const rawContent = '{\r\n\t"ProspectInfo": {\r\n\t\t"ProspectID": "Windows"\r\n\t}\r\n}';

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Windows', content: rawContent });

    expect(res.status).toBe(201);

    const filePath = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects', 'Windows.json');
    const saved = fs.readFileSync(filePath, 'utf-8');
    expect(saved).toBe(rawContent);
  });

  it('should preserve large 64-bit integer SteamIDs as strings without truncation', async () => {
    const rawContent = JSON.stringify({
      ProspectInfo: {
        ProspectID: "SteamTest",
        ClaimedAccountID: "76561198022761874"
      }
    });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'SteamTest', content: rawContent });

    expect(res.status).toBe(201);

    const filePath = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects', 'SteamTest.json');
    const saved = fs.readFileSync(filePath, 'utf-8');
    expect(saved).toContain('76561198022761874');
  });

  it('should reject mismatched filename vs ProspectID', async () => {
    const rawContent = JSON.stringify({
      ProspectInfo: { ProspectID: "RealName" }
    });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'WrongName', content: rawContent });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must match ProspectID/i);
  });

  it('should accept prospect without ProspectInfo (no ID check)', async () => {
    const rawContent = JSON.stringify({ someData: "value" });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'NoInfo', content: rawContent });

    expect(res.status).toBe(201);
  });

  it('should append .json to name if missing', async () => {
    const rawContent = JSON.stringify({ ProspectInfo: { ProspectID: "NoExtension" } });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'NoExtension', content: rawContent });

    expect(res.status).toBe(201);
    expect(res.body.prospect).toBe('NoExtension.json');
  });

  it('should accept name already ending in .json', async () => {
    const rawContent = JSON.stringify({ ProspectInfo: { ProspectID: "AlreadyDotJson" } });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'AlreadyDotJson.json', content: rawContent });

    expect(res.status).toBe(201);
    expect(res.body.prospect).toBe('AlreadyDotJson.json');
  });

  it('should return 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ content: '{}' });

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

  it('should return 400 for non-object JSON content', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Array', content: '[1,2,3]' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid json/i);
  });

  it('should return 409 if prospect already exists', async () => {
    const dir = path.join(TMP_DIR, 'test-container', 'Saved', 'PlayerData', 'DedicatedServer', 'Prospects');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Existing.json'), '{}');

    const rawContent = JSON.stringify({ ProspectInfo: { ProspectID: "Existing" } });
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Existing', content: rawContent });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('should reject path traversal in name', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: '../../etc/passwd', content: '{}' });

    expect(res.status).toBe(400);
  });

  it('should reject path traversal with double-dot in middle', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'foo/../../bar', content: '{}' });

    expect(res.status).toBe(400);
  });

  it('should reject name with forward slashes', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'sub/dir', content: '{}' });

    expect(res.status).toBe(400);
  });

  it('should reject name with backslashes', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'sub\\dir', content: '{}' });

    expect(res.status).toBe(400);
  });

  it('should handle empty name string', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: '', content: '{}' });

    expect(res.status).toBe(400);
  });

  it('should handle empty content string', async () => {
    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'test', content: '' });

    expect(res.status).toBe(400);
  });

  it('should handle prospect with commas in ProspectID matching filename', async () => {
    const rawContent = JSON.stringify({
      ProspectInfo: { ProspectID: "Newtown, Pennsylvania" }
    });

    const res = await request(app)
      .post('/api/containers/test-container/prospects')
      .send({ name: 'Newtown, Pennsylvania', content: rawContent });

    expect(res.status).toBe(201);
    expect(res.body.prospect).toBe('Newtown, Pennsylvania.json');
  });
});
