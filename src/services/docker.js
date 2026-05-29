const Docker = require('dockerode');

let dockerHost;
try {
  if (process.env.DOCKER_HOST) {
    dockerHost = process.env.DOCKER_HOST;
  }
} catch (err) {
  console.error('Error reading DOCKER_HOST environment variable:', err.message);
}

let docker;
try {
  if (dockerHost) {
    docker = new Docker(dockerHost);
  } else {
    docker = new Docker();
  }
} catch (err) {
  console.error('Failed to initialize Docker client:', err.message);
  docker = null;
}

/**
 * Verify Docker connectivity by pinging the Docker daemon.
 * Logs a warning if the connection cannot be established.
 */
async function verifyDockerConnection() {
  if (!docker) {
    console.warn('Docker client is not initialized. Docker features will be unavailable.');
    return false;
  }
  try {
    await docker.ping();
    console.log('Docker connection established successfully.');
    return true;
  } catch (err) {
    console.warn('Docker connection failed:', err.message);
    console.warn('Docker features will be unavailable until the connection is restored.');
    return false;
  }
}

module.exports = { docker, verifyDockerConnection };
