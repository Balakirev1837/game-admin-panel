const tar = require('tar');
const { docker } = require('./docker');

async function readFileFromContainer(containerId, filePath) {
  const container = docker.getContainer(containerId);
  try {
    const archiveStream = await container.getArchive({ path: filePath });
    const chunks = [];
    for await (const chunk of archiveStream) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);

    const entries = [];
    await new Promise((resolve, reject) => {
      tar.t({
        onentry: (entry) => {
          let data = '';
          entry.on('data', (chunk) => { data += chunk.toString(); });
          entry.on('end', () => {
            entries.push({ path: entry.path, data });
          });
        },
        onend: resolve,
      }).end(buf);
    });

    const basename = filePath.split('/').pop();
    const entry = entries.find(e => e.path === basename || e.path === `./${basename}`);
    return entry ? entry.data : null;
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function writeFileToContainer(containerId, filePath, content) {
  const container = docker.getContainer(containerId);
  const basename = filePath.split('/').pop();
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));

  const chunks = [];
  const packStream = tar.pack();
  packStream.entry({ name: basename }, content);
  packStream.finalize();

  for await (const chunk of packStream) {
    chunks.push(chunk);
  }
  const tarBuf = Buffer.concat(chunks);

  await container.putArchive(tarBuf, { path: dir });
  return true;
}

async function execInContainer(containerId, command) {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: ['sh', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const output = Buffer.concat(chunks).toString('utf-8');

  const lines = output.split('\n').filter(l => l.trim());
  return lines;
}

module.exports = { readFileFromContainer, writeFileToContainer, execInContainer };
