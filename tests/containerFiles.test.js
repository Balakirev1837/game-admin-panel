const { PassThrough } = require('stream');

const mockGetContainer = jest.fn();
const mockGetArchive = jest.fn();
const mockPutArchive = jest.fn();
const mockExec = jest.fn();

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
    listContainers: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('../src/services/logger', () => {
  const m = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() };
  m.child = () => m;
  return m;
});

describe('containerFiles', () => {
  let readFileFromContainer;
  let writeFileToContainer;
  let execInContainer;

  beforeEach(() => {
    jest.resetModules();
    mockGetContainer.mockReset();
    mockGetArchive.mockReset();
    mockPutArchive.mockReset();
    mockExec.mockReset();

    mockGetContainer.mockReturnValue({
      getArchive: mockGetArchive,
      putArchive: mockPutArchive,
      exec: mockExec,
    });
  });

  describe('readFileFromContainer', () => {
    it('should return null when file not found (404)', async () => {
      const err = new Error('Not found');
      err.statusCode = 404;
      mockGetArchive.mockRejectedValue(err);

      ({ readFileFromContainer } = require('../src/services/containerFiles'));
      const result = await readFileFromContainer('container123', '/nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on non-404 errors', async () => {
      const err = new Error('Internal error');
      err.statusCode = 500;
      mockGetArchive.mockRejectedValue(err);

      ({ readFileFromContainer } = require('../src/services/containerFiles'));
      await expect(readFileFromContainer('container123', '/path'))
        .rejects.toThrow('Internal error');
    });

    it('should throw on generic errors without statusCode', async () => {
      mockGetArchive.mockRejectedValue(new Error('connection refused'));

      ({ readFileFromContainer } = require('../src/services/containerFiles'));
      await expect(readFileFromContainer('container123', '/path'))
        .rejects.toThrow('connection refused');
    });
  });

  describe('writeFileToContainer', () => {
    it('should throw when container putArchive fails', async () => {
      mockPutArchive.mockRejectedValue(new Error('write failed'));

      ({ writeFileToContainer } = require('../src/services/containerFiles'));
      await expect(writeFileToContainer('container123', '/path/file.txt', 'data'))
        .rejects.toThrow();
    });
  });

  describe('execInContainer', () => {
    it('should execute a command and return output lines', async () => {
      const mockStart = jest.fn().mockImplementation(() => {
        const s = new PassThrough();
        setImmediate(() => s.end('line1\nline2\nline3\n'));
        return Promise.resolve(s);
      });

      mockExec.mockResolvedValue({ start: mockStart });

      ({ execInContainer } = require('../src/services/containerFiles'));
      const result = await execInContainer('container123', 'ls -1');

      expect(result).toEqual(['line1', 'line2', 'line3']);
      expect(mockExec).toHaveBeenCalledWith({
        Cmd: ['sh', '-c', 'ls -1'],
        AttachStdout: true,
        AttachStderr: true,
      });
    });

    it('should filter blank lines from output', async () => {
      const mockStart = jest.fn().mockImplementation(() => {
        const s = new PassThrough();
        setImmediate(() => s.end('a\n\nb\n\nc\n'));
        return Promise.resolve(s);
      });

      mockExec.mockResolvedValue({ start: mockStart });

      ({ execInContainer } = require('../src/services/containerFiles'));
      const result = await execInContainer('container123', 'echo test');

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return empty array for empty output', async () => {
      const mockStart = jest.fn().mockImplementation(() => {
        const s = new PassThrough();
        setImmediate(() => s.end(''));
        return Promise.resolve(s);
      });

      mockExec.mockResolvedValue({ start: mockStart });

      ({ execInContainer } = require('../src/services/containerFiles'));
      const result = await execInContainer('container123', 'true');

      expect(result).toEqual([]);
    });

    it('should throw when exec fails', async () => {
      mockExec.mockRejectedValue(new Error('exec failed'));

      ({ execInContainer } = require('../src/services/containerFiles'));
      await expect(execInContainer('container123', 'bad-cmd'))
        .rejects.toThrow('exec failed');
    });

    it('should throw when start fails', async () => {
      mockExec.mockResolvedValue({
        start: jest.fn().mockRejectedValue(new Error('start failed')),
      });

      ({ execInContainer } = require('../src/services/containerFiles'));
      await expect(execInContainer('container123', 'cmd'))
        .rejects.toThrow('start failed');
    });
  });
});
