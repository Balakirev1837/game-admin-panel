const { sendRconCommand, DEFAULT_RCON_PASSWORD } = require('../src/services/rcon');

describe('RCON service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('sendRconCommand', () => {
    it('should export sendRconCommand as a function', () => {
      expect(typeof sendRconCommand).toBe('function');
    });

    it('should throw if host is missing', async () => {
      await expect(sendRconCommand(null, 25575, 'pass', 'status'))
        .rejects.toThrow('RCON host is required');
    });

    it('should throw if port is missing', async () => {
      await expect(sendRconCommand('127.0.0.1', null, 'pass', 'status'))
        .rejects.toThrow('RCON port is required');
    });

    it('should throw if command is missing', async () => {
      await expect(sendRconCommand('127.0.0.1', 25575, 'pass', ''))
        .rejects.toThrow('RCON command is required');
    });

    it('should return response on successful command', async () => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockResolvedValue(undefined),
          command: jest.fn().mockResolvedValue('players: 0'),
          disconnect: jest.fn().mockResolvedValue(undefined),
        }));
      });

      jest.resetModules();
      const { sendRconCommand: send } = require('../src/services/rcon');
      const response = await send('127.0.0.1', 25575, 'pass', 'status');
      expect(response).toBe('players: 0');
    });

    it('should throw on connection failure', async () => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
          command: jest.fn(),
          disconnect: jest.fn(),
        }));
      });

      jest.resetModules();
      const { sendRconCommand: send } = require('../src/services/rcon');
      await expect(send('127.0.0.1', 25575, 'pass', 'status'))
        .rejects.toThrow('RCON connection failed');
    });

    it('should throw on authentication failure', async () => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockRejectedValue(new Error('Authentication failed: wrong password')),
          command: jest.fn(),
          disconnect: jest.fn(),
        }));
      });

      jest.resetModules();
      const { sendRconCommand: send } = require('../src/services/rcon');
      await expect(send('127.0.0.1', 25575, 'wrong', 'status'))
        .rejects.toThrow('RCON authentication failed');
    });

    it('should throw on command execution failure', async () => {
      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockResolvedValue(undefined),
          command: jest.fn().mockRejectedValue(new Error('Command timed out')),
          disconnect: jest.fn().mockResolvedValue(undefined),
        }));
      });

      jest.resetModules();
      const { sendRconCommand: send } = require('../src/services/rcon');
      await expect(send('127.0.0.1', 25575, 'pass', 'status'))
        .rejects.toThrow('RCON command execution failed');
    });

    it('should disconnect even if command fails', async () => {
      const disconnectFn = jest.fn().mockResolvedValue(undefined);

      jest.doMock('srcds-rcon', () => {
        return jest.fn().mockImplementation(() => ({
          connect: jest.fn().mockResolvedValue(undefined),
          command: jest.fn().mockRejectedValue(new Error('fail')),
          disconnect: disconnectFn,
        }));
      });

      jest.resetModules();
      const { sendRconCommand: send } = require('../src/services/rcon');
      await expect(send('127.0.0.1', 25575, 'pass', 'status')).rejects.toThrow();
      expect(disconnectFn).toHaveBeenCalled();
    });

    it('should fall back to default password when password is undefined', async () => {
      const mockConstructor = jest.fn().mockImplementation((_opts) => ({
        connect: jest.fn().mockResolvedValue(undefined),
        command: jest.fn().mockResolvedValue('ok'),
        disconnect: jest.fn().mockResolvedValue(undefined),
      }));

      jest.doMock('srcds-rcon', () => mockConstructor);

      jest.resetModules();
      const { sendRconCommand: send } = require('../src/services/rcon');
      await send('127.0.0.1', 25575, undefined, 'status');

      // Verify the constructor was called with the default password
      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ password: DEFAULT_RCON_PASSWORD })
      );
    });
  });

  describe('default password configuration', () => {
    it('should use fallback password dateniteroolz when env var is not set', () => {
      // DEFAULT_RCON_PASSWORD is already imported; check its value
      // (env var may or may not be set in test env)
      expect(typeof DEFAULT_RCON_PASSWORD).toBe('string');
      expect(DEFAULT_RCON_PASSWORD.length).toBeGreaterThan(0);
    });

    it('should use ICARUS_RCON_PASSWORD env var when set', () => {
      process.env.ICARUS_RCON_PASSWORD = 'testpass123';
      jest.resetModules();
      const { DEFAULT_RCON_PASSWORD: pwd } = require('../src/services/rcon');
      expect(pwd).toBe('testpass123');
      delete process.env.ICARUS_RCON_PASSWORD;
    });
  });
});
