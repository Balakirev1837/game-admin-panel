jest.mock('../src/services/logger', () => {
  const m = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() };
  m.child = () => m;
  return m;
});

describe('RCON Pool', () => {
  let sendRconCommand;
  let flushPool;

  beforeEach(() => {
    jest.resetModules();
  });

  describe('basic validation', () => {
    beforeEach(() => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockResolvedValue(undefined),
          command: jest.fn().mockResolvedValue('ok'),
          disconnect: jest.fn(),
        }));
      });
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));
    });

    it('should throw if host is missing', async () => {
      await expect(sendRconCommand(null, 25575, 'pass', 'cmd'))
        .rejects.toThrow('host is required');
    });

    it('should throw if port is missing', async () => {
      await expect(sendRconCommand('127.0.0.1', null, 'pass', 'cmd'))
        .rejects.toThrow('port is required');
    });

    it('should throw if command is missing', async () => {
      await expect(sendRconCommand('127.0.0.1', 25575, 'pass', ''))
        .rejects.toThrow('command is required');
    });

    it('should return command response on success', async () => {
      const result = await sendRconCommand('127.0.0.1', 25575, 'pass', 'status');
      expect(result).toBe('ok');
    });
  });

  describe('connection pooling', () => {
    it('should reuse connections for same host:port:password', async () => {
      const mockSrcdsRcon = jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        command: jest.fn().mockResolvedValue('ok'),
        disconnect: jest.fn(),
      }));
      jest.doMock('srcds-rcon', () => mockSrcdsRcon);
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));

      await sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd1');
      await sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd2');

      expect(mockSrcdsRcon).toHaveBeenCalledTimes(1);
    });

    it('should create new connection when password changes', async () => {
      const mockSrcdsRcon = jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        command: jest.fn().mockResolvedValue('ok'),
        disconnect: jest.fn(),
      }));
      jest.doMock('srcds-rcon', () => mockSrcdsRcon);
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));

      await sendRconCommand('127.0.0.1', 25575, 'pass1', 'cmd1');
      await sendRconCommand('127.0.0.1', 25575, 'pass2', 'cmd2');

      expect(mockSrcdsRcon).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error on auth failure', async () => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockRejectedValue(new Error('Authentication failed')),
          disconnect: jest.fn(),
        }));
      });
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));

      await expect(sendRconCommand('127.0.0.1', 25575, 'wrong', 'cmd'))
        .rejects.toThrow('authentication failed');
    });

    it('should throw descriptive error on generic failure', async () => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
          disconnect: jest.fn(),
        }));
      });
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));

      await expect(sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd'))
        .rejects.toThrow('RCON failed');
    });

    it('should evict connection on command failure', async () => {
      let connectCount = 0;
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => {
          connectCount++;
          return {
            connect: jest.fn().mockResolvedValue(undefined),
            command: jest.fn().mockRejectedValue(new Error('broken')),
            disconnect: jest.fn(),
          };
        });
      });
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));

      await expect(sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd')).rejects.toThrow();
      await expect(sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd')).rejects.toThrow();

      expect(connectCount).toBe(2);
    });
  });

  describe('flushPool', () => {
    it('should clear all pooled connections', async () => {
      const mockSrcdsRcon = jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        command: jest.fn().mockResolvedValue('ok'),
        disconnect: jest.fn(),
      }));
      jest.doMock('srcds-rcon', () => mockSrcdsRcon);
      ({ sendRconCommand, flushPool } = require('../src/services/rconPool'));

      await sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd1');
      const initialCalls = mockSrcdsRcon.mock.calls.length;

      flushPool();

      await sendRconCommand('127.0.0.1', 25575, 'pass', 'cmd2');
      expect(mockSrcdsRcon.mock.calls.length).toBe(initialCalls + 1);
    });
  });
});
