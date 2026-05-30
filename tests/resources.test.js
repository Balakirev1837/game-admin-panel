const { parseStats, formatBytes } = require('../src/services/resources');

describe('parseStats', () => {
  it('should parse memory from Docker stats', () => {
    const stats = {
      memory_stats: { usage: 2147483648, limit: 17179869184 },
      cpu_stats: {
        cpu_usage: { total_usage: 100000000 },
        system_cpu_usage: 500000000,
        online_cpus: 4,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 50000000 },
        system_cpu_usage: 250000000,
      },
      networks: {
        eth0: { rx_bytes: 1000000, tx_bytes: 500000 },
        eth1: { rx_bytes: 500000, tx_bytes: 300000 },
      },
    };

    const result = parseStats(stats);

    expect(result.memory.usage).toBe(2147483648);
    expect(result.memory.limit).toBe(17179869184);
    expect(result.memory.usage_human).toBe('2.0 GB');
    expect(result.memory.limit_human).toBe('16.0 GB');
    expect(result.memory.percent).toBeCloseTo(12.5, 1);

    expect(result.cpu.percent).toBeGreaterThan(0);
    expect(result.cpu.cores).toBe(4);

    expect(result.network.rx_bytes).toBe(1500000);
    expect(result.network.tx_bytes).toBe(800000);
  });

  it('should handle zero memory limit gracefully', () => {
    const stats = {
      memory_stats: { usage: 1000000, limit: 0 },
      cpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0, online_cpus: 1 },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
      networks: {},
    };
    const result = parseStats(stats);
    expect(result.memory.percent).toBe(0);
    expect(result.memory.limit_human).toBe('0 B');
  });

  it('should handle missing cpu stats gracefully', () => {
    const stats = {
      memory_stats: { usage: 0, limit: 1024 },
      cpu_stats: {},
      precpu_stats: {},
      networks: {},
      blkio_stats: { io_service_bytes_recursive: [] },
    };
    const result = parseStats(stats);
    expect(result.cpu.percent).toBe(0);
    expect(result.cpu.cores).toBe(1);
  });

  it('should handle dangling blkio server-side', () => {
    const stats = {
      memory_stats: { usage: 0, limit: 1024 },
      cpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0, online_cpus: 1 },
      precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
      networks: {},
      blkio_stats: { io_service_bytes_recursive: [
        { op: 'Read', value: 100 },
        { op: 'Write', value: 200 },
      ] },
    };
    const result = parseStats(stats);
    expect(result.block.read).toBe(100);
    expect(result.block.write).toBe(200);
    expect(result.block.read_human).toBe('100 B');
    expect(result.block.write_human).toBe('200 B');
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
    expect(formatBytes(2040000000)).toBe('1.9 GB');
  });
});