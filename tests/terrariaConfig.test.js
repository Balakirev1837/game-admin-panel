const { validateConfigData, TERRARIA_CONFIG_FIELDS, readConfig, writeConfig } = require('../src/services/terrariaConfig');

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

describe('terrariaConfig - validation', () => {
  it('should validate correct data', () => {
    const result = validateConfigData({ json: { ServerName: 'Test' } });
    expect(result.valid).toBe(true);
  });

  it('should reject null data', () => {
    const result = validateConfigData(null);
    expect(result.valid).toBe(false);
  });

  it('should reject oversized data', () => {
    const big = 'x'.repeat(1024 * 1024 + 1);
    const result = validateConfigData({ json: { ServerName: big } });
    expect(result.valid).toBe(false);
  });

  it('should have TERRARIA_CONFIG_FIELDS defined', () => {
    expect(TERRARIA_CONFIG_FIELDS).toBeDefined();
    expect(TERRARIA_CONFIG_FIELDS.length).toBeGreaterThan(0);
  });

  it('should reject string data', () => {
    const result = validateConfigData('not an object');
    expect(result.valid).toBe(false);
  });
});

describe('terrariaConfig - readConfig', () => {
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

  it('should read config from first path', async () => {
    mockReadFileFromContainer.mockResolvedValueOnce(
      JSON.stringify({ ServerName: 'My Server', MaxSlots: 8 })
    );

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.ServerName).toBe('My Server');
    expect(result.json.MaxSlots).toBe(8);
  });

  it('should try fallback paths if first fails', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ ServerName: 'Fallback' }));

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.ServerName).toBe('Fallback');
    expect(mockReadFileFromContainer).toHaveBeenCalledTimes(2);
  });

  it('should flatten ApplicationRestTokens to first token string', async () => {
    mockReadFileFromContainer.mockResolvedValueOnce(
      JSON.stringify({ ApplicationRestTokens: ['token-abc123', 'token-def456'] })
    );

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.ApplicationRestTokens).toBe('token-abc123');
  });

  it('should set empty string for empty ApplicationRestTokens array', async () => {
    mockReadFileFromContainer.mockResolvedValueOnce(
      JSON.stringify({ ApplicationRestTokens: [] })
    );

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.ApplicationRestTokens).toBe('');
  });

  it('should set empty string for missing ApplicationRestTokens', async () => {
    mockReadFileFromContainer.mockResolvedValueOnce(
      JSON.stringify({ ServerName: 'Test' })
    );

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.ApplicationRestTokens).toBe('');
  });

  it('should handle malformed JSON config', async () => {
    mockReadFileFromContainer.mockResolvedValueOnce('not json{{{');

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json).toBeDefined();
  });

  it('should handle all config paths returning null', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await readConfig('container1', { Id: 'abc', State: { Running: true } });

    expect(result.json.ApplicationRestTokens).toBe('');
  });
});

describe('terrariaConfig - writeConfig', () => {
  beforeEach(() => {
    mockReadFileFromContainer.mockReset();
    mockWriteFileToContainer.mockReset();
  });

  it('should throw when container is not running', async () => {
    await expect(writeConfig('container1', { json: { ServerName: 'Test' } }, { State: { Running: false } }))
      .rejects.toThrow(/running/i);
  });

  it('should write config to container', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(JSON.stringify({ ServerName: 'Updated' }))
      .mockResolvedValueOnce(JSON.stringify({ ServerName: 'Updated' }));

    await writeConfig('container1', { json: { ServerName: 'Updated' } }, { Id: 'abc', State: { Running: true } });

    expect(mockWriteFileToContainer).toHaveBeenCalled();
  });

  it('should merge with existing config on write', async () => {
    const existing = { ServerName: 'Old', MaxSlots: 8, ServerPassword: 'secret' };
    mockReadFileFromContainer
      .mockResolvedValueOnce(JSON.stringify(existing))
      .mockResolvedValueOnce(JSON.stringify({ ServerName: 'New', MaxSlots: 8, ServerPassword: 'secret' }));

    await writeConfig('container1', { json: { ServerName: 'New' } }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.ServerName).toBe('New');
    expect(parsed.ServerPassword).toBe('secret');
  });

  it('should convert string REST token to array', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ ApplicationRestTokens: ['my-token'] }));

    await writeConfig('container1', {
      json: { ApplicationRestTokens: 'my-token' }
    }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.ApplicationRestTokens).toEqual(['my-token']);
  });

  it('should convert empty REST token to empty array', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ ApplicationRestTokens: [] }));

    await writeConfig('container1', {
      json: { ApplicationRestTokens: '  ' }
    }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.ApplicationRestTokens).toEqual([]);
  });

  it('should reject invalid config data', async () => {
    await expect(writeConfig('container1', null, { Id: 'abc', State: { Running: true } }))
      .rejects.toThrow(/invalid/i);
  });

  it('should convert string numbers to integers', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ MaxSlots: 16 }));

    await writeConfig('container1', {
      json: { MaxSlots: '16', ServerPort: '7777', RestApiPort: '7878' }
    }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.MaxSlots).toBe(16);
    expect(parsed.ServerPort).toBe(7777);
    expect(parsed.RestApiPort).toBe(7878);
  });

  it('should convert string booleans to actual booleans', async () => {
    mockReadFileFromContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ RestApiEnabled: true }));

    await writeConfig('container1', {
      json: { RestApiEnabled: 'true' }
    }, { Id: 'abc', State: { Running: true } });

    const writtenContent = mockWriteFileToContainer.mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.RestApiEnabled).toBe(true);
  });
});
