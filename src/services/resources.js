const Docker = require('dockerode');

let docker;
try {
  docker = new Docker();
} catch {
  docker = null;
}

/**
 * Fetch a one-shot stats snapshot for a container.
 * Returns parsed memory, CPU, and network metrics.
 */
async function getContainerResources(containerId) {
  if (!docker) throw new Error('Docker client not available');

  const container = docker.getContainer(containerId);

  let stats;
  try {
    stats = await container.stats({ stream: false });
  } catch (err) {
    if (err.statusCode === 404) {
      throw Object.assign(new Error('Container not found'), { code: 'NOT_FOUND' });
    }
    throw err;
  }

  return parseStats(stats);
}

function parseStats(stats) {
  const result = {
    memory: {},
    cpu: {},
    network: { rx_bytes: 0, tx_bytes: 0 },
    block: {},
  };

  // Memory
  const memStats = stats.memory_stats || {};
  const usage = memStats.usage || 0;
  const limit = memStats.limit || 0;

  result.memory.usage = usage;
  result.memory.limit = limit;
  result.memory.usage_human = formatBytes(usage);
  result.memory.limit_human = formatBytes(limit);
  result.memory.percent = limit > 0 ? ((usage / limit) * 100) : 0;

  // CPU
  const cpuStats = stats.cpu_stats || {};
  const precpuStats = stats.precpu_stats || {};
  const cpuDelta = (cpuStats.cpu_usage && cpuStats.cpu_usage.total_usage || 0) -
    (precpuStats.cpu_usage && precpuStats.cpu_usage.total_usage || 0);
  const systemDelta = (cpuStats.system_cpu_usage || 0) - (precpuStats.system_cpu_usage || 0);
  const numCores = (cpuStats.online_cpus || 1);

  result.cpu.percent = (systemDelta > 0 && numCores > 0)
    ? ((cpuDelta / systemDelta) * numCores * 100)
    : 0;
  result.cpu.cores = numCores;

  // Network — aggregate all interfaces
  const networks = stats.networks || {};
  for (const iface of Object.values(networks)) {
    result.network.rx_bytes += iface.rx_bytes || 0;
    result.network.tx_bytes += iface.tx_bytes || 0;
  }
  result.network.rx_human = formatBytes(result.network.rx_bytes);
  result.network.tx_human = formatBytes(result.network.tx_bytes);

  // Block I/O
  const blkioStats = stats.blkio_stats || {};
  const ioService = (blkioStats.io_service_bytes_recursive || [])
    .filter(x => x.op === 'Read' || x.op === 'Write');
  let readBytes = 0;
  let writeBytes = 0;
  for (const entry of ioService) {
    if (entry.op === 'Read') readBytes += entry.value || 0;
    if (entry.op === 'Write') writeBytes += entry.value || 0;
  }
  result.block.read = readBytes;
  result.block.write = writeBytes;
  result.block.read_human = formatBytes(readBytes);
  result.block.write_human = formatBytes(writeBytes);

  return result;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

module.exports = { getContainerResources, parseStats, formatBytes };