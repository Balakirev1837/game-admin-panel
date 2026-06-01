const { validateConfigData, FACTORIO_CONFIG_FIELDS, readConfig, writeConfig } = require('../src/services/factorioConfig');

const mockReadFileFromContainer = jest.fn();
const mockWriteFileToContainer = jest.fn();

jest.mock('../src/services/containerFiles', () => ({
  readFileFromContainer: (...args) => mockReadFileFromContainer(...args),
  writeFileToContainer: (...args) => mockWriteFileToContainer(...args),
}));

jest.mock('../src/services/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
}));

describe('factorioConfig - validation', () => {
  it('should validate correct data', () => {
    const result = validateConfigData({ json: { name: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateConfigData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateConfigData({ json: { name: big } });
    expect(result.valid).toBe(false);
  });

  it('should have FACTORIO_CONFIG_FIELDS defined', () => {
    expect(FACTORIO_CONFIG_FIELDS).toBeDefined();
    expect(FACTORIO_CONFIG_FIELDS.length).toBeGreaterThan(0);
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('key');
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('label');
    expect(FACTORIO_CONFIG_FIELDS[0]).toHaveProperty('type');
  });

  it('should reject string data', () => {
    const result = validateConfigData('not an object');
    expect(result.valid).toBe(false);
  });
});

describe('factorioConfig - readConfig', () => {
  beforeEach(() => {
    mockReadFileFromContainer.mockReset();
    mockWriteFileToContainer.mockReset();
  });

  it('should return _stopped for non-running container', async () => {
    const result = await readConfig('container1', { State: { Running: false } });
    expect(result._stopped).toBe(true);
    expect(result.json).toEqual({});
  });

  it('should return _stopped for null info', async () => {
    const result = await readConfig('container1', null);
    expect(result._stopped).toBe(true);
  });

  it('should read and parse server-settings.json', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(JSON.stringify({ name: 'Test Server', max_players: 0 }))
      .mockResolvedValueOnce('rcon-secret');

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.name).toBe('Test Server');
    expect(result.json.max_players).toBe(0);
    expect(result.json.rcon_password).toBe('rcon-secret');
  });

  it('should flatten visibility object', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(JSON.stringify({ visibility: { public: true, lan: false } }))
      .mockResolvedValueOnce(null);

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json['visibility.public']).toBe(true);
    expect(result.json['visibility.lan']).toBe(false);
    expect(result.json.visibility).toBeUndefined();
  });

  it('should handle missing config file gracefully', async () => {
    mockReadFileFromContainer.mockResolvedValue(null);

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json).toBeDefined();
    expect(result.json.rcon_password).toBe('');
  });

  it('should handle malformed JSON config', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce('not json{{{')
      .mockResolvedValueOnce(null);

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json).toBeDefined();
  });

  it('should trim rcon password whitespace', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce('{}')
      .mockResolvedValueOnce('  my-password  \n');

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.rcon_password).toBe('my-password');
  });
});

describe('factorioConfig - writeConfig', () => {
  beforeEach(() => {
    mockReadFileFromContainer.mockReset();
    mockWriteFileToContainer.mockReset();
  });

  it('should throw when container is not running', async () => {
    await expect(writeConfig('container1', { json: { name: 'Test' } }, { State: { Running: false } }))
      .rejects.toThrow(/running/i);
  });

  it('should write config to container', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ name: 'Updated' }))
      .mockResolvedValueOnce(null);

    const result = await writeConfig('container1', { json: { name: 'Updated' } }, { Id: 'abc', State: { Running: true } });

    expect(mockWriteFileToContainer).toHaveBeenCalledWith(
      'abc',
      '/factorio/config/server-settings.json',
      expect.any(String),
    );
  });

  it('should merge with existing config on write', async () => {
    const existing = { name: 'Old', description: 'Keep me', max_players: 10 };
    mockReadFileFromContainer
      .mockResolvedValueOnce(JSON.stringify(existing))
      .mockResolvedValueOnce(JSON.stringify({ name: 'New', description: 'Keep me', max_players: 10 }))
      .mockResolvedValueOnce(null);

    await writeConfig('container1', { json: { name: 'New' } }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.name).toBe('New');
    expect(parsed.description).toBe('Keep me');
  });

  it('should write rcon password to separate file', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce('{}')
      .mockResolvedValueOnce('{}')
      .mockResolvedValueOnce(null);

    await writeConfig('container1', { json: { name: 'Test', rcon_password: 'new-pass' } }, { Id: 'abc', State: { Running: true } });

    const rconWriteCall = mockWriteFileToContainer.mock.calls.find(
      c => c[1] === '/factorio/config/rconpw'
    );
    expect(rconWriteCall).toBeDefined();
    expect(rconWriteCall[2]).toBe('new-pass');
  });

  it('should reject invalid config data', async () => {
    await expect(writeConfig('container1', null, { Id: 'abc', State: { Running: true } }))
      .rejects.toThrow(/invalid/i);
  });

  it('should convert string booleans to actual booleans', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ auto_pause: true }))
      .mockResolvedValueOnce(null);

    await writeConfig('container1', { json: { auto_pause: 'true' } }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.auto_pause).toBe(true);
  });

  it('should convert visibility dot-notation to nested object', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ visibility: { public: true, lan: true } }))
      .mockResolvedValueOnce(null);

    await writeConfig('container1', {
      json: { 'visibility.public': 'true', 'visibility.lan': 'true' }
    }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.visibility.public).toBe(true);
    expect(parsed.visibility.lan).toBe(true);
    expect(parsed['visibility.public']).toBeUndefined();
  });
});
