const fs = require('fs');
const path = require('path');

const DEFAULT_GAME_ROOT = '/host-games';

function getGameRoot() {
  return process.env.GAME_CONFIG_ROOT || DEFAULT_GAME_ROOT;
}

/**
 * Get the config file path for a given container.
 * Uses GAME_CONFIG_ROOT / container-name / Saved/Config/WindowsServer/ServerSettings.ini.
 */
function getConfigFilePath(containerName) {
  return path.join(getGameRoot(), containerName, 'Saved', 'Config', 'WindowsServer', 'ServerSettings.ini');
}

/**
 * Parse an INI-style string into a JavaScript object.
 * Handles [Section] headers and key=value pairs.
 * Comments (lines starting with ; or #) are preserved.
 */
function parseIni(content) {
  const result = { _sections: {}, _comments: {} };
  let currentSection = null;
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      continue;
    }

    // Comment lines
    if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
      if (!result._comments[currentSection || '_root']) {
        result._comments[currentSection || '_root'] = [];
      }
      result._comments[currentSection || '_root'].push({ line: i, text: line });
      continue;
    }

    // Section headers
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result._sections[currentSection] = {};
      continue;
    }

    // Key=value pairs
    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      if (currentSection) {
        result._sections[currentSection][key] = value;
      } else {
        if (!result._root) result._root = {};
        result._root[key] = value;
      }
    }
  }

  return result;
}

/**
 * Serialize a JavaScript object back into INI format.
 * Expects the same structure produced by parseIni.
 */
function serializeIni(config) {
  const lines = [];

  // Root-level key=value pairs
  if (config._root) {
    const rootComments = config._comments && config._comments['_root'];
    if (rootComments) {
      rootComments.forEach((c) => lines.push(c.text));
    }
    for (const [key, value] of Object.entries(config._root)) {
      lines.push(`${key}=${value}`);
    }
    lines.push('');
  }

  // Sections
  if (config._sections) {
    for (const [sectionName, sectionData] of Object.entries(config._sections)) {
      lines.push(`[${sectionName}]`);

      // Section comments
      const sectionComments = config._comments && config._comments[sectionName];
      if (sectionComments) {
        sectionComments.forEach((c) => lines.push(c.text));
      }

      for (const [key, value] of Object.entries(sectionData)) {
        lines.push(`${key}=${value}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Read and parse the config file for a container.
 * Returns the parsed config object or throws an error.
 */
function readConfig(containerId) {
  const filePath = getConfigFilePath(containerId);

  if (!fs.existsSync(filePath)) {
    return { _sections: {}, _comments: {}, _root: {} };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseIni(content);
}

/**
 * Validate config data before writing.
 * Returns an object with { valid: boolean, errors: string[] }.
 */
function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('Config must be a non-null object');
    return { valid: false, errors };
  }

  // Validate sections if present
  if (config._sections && typeof config._sections !== 'object') {
    errors.push('_sections must be an object');
  }

  // Check for reasonable size (prevent abuse)
  const serialized = JSON.stringify(config);
  if (serialized.length > 1024 * 1024) {
    errors.push('Config data exceeds maximum size of 1MB');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Write a config object back to the config file for a container.
 * Merges with existing config to preserve comments and structure.
 */
function writeConfig(containerId, config) {
  const validation = validateConfig(config);
  if (!validation.valid) {
    const err = new Error(`Invalid config: ${validation.errors.join(', ')}`);
    err.code = 'EINVAL';
    throw err;
  }

  const filePath = getConfigFilePath(containerId);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If file exists, read and merge; otherwise write fresh
  let mergedConfig = config;
  if (fs.existsSync(filePath)) {
    const existing = readConfig(containerId);
    // Merge sections
    if (config._sections) {
      for (const [sectionName, sectionData] of Object.entries(config._sections)) {
        if (!existing._sections[sectionName]) {
          existing._sections[sectionName] = {};
        }
        Object.assign(existing._sections[sectionName], sectionData);
      }
    }
    // Merge root
    if (config._root) {
      if (!existing._root) existing._root = {};
      Object.assign(existing._root, config._root);
    }
    // Preserve comments from existing
    if (existing._comments) {
      if (!mergedConfig._comments) mergedConfig = { ...existing };
      mergedConfig._comments = existing._comments;
    }
    mergedConfig = existing;
  }

  const content = serializeIni(mergedConfig);
  fs.writeFileSync(filePath, content, 'utf-8');
  return mergedConfig;
}

/**
 * Read launch parameters from a companion .env or docker-compose override file.
 * Looks for a file named .env or docker-compose.override.yml next to the config.
 */
function readLaunchParams(containerId) {
  const configDir = path.dirname(getConfigFilePath(containerId));
  const envPath = path.join(configDir, '.env');
  const params = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        params[match[1].trim()] = match[2].trim();
      }
    }
  }

  return params;
}

/**
 * Write launch parameters to a companion .env file.
 */
function writeLaunchParams(containerId, params) {
  if (!params || typeof params !== 'object') {
    const err = new Error('Launch params must be a non-null object');
    err.code = 'EINVAL';
    throw err;
  }

  const configDir = path.dirname(getConfigFilePath(containerId));
  const envPath = path.join(configDir, '.env');

  const lines = Object.entries(params).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  return params;
}

module.exports = {
  parseIni,
  serializeIni,
  readConfig,
  writeConfig,
  validateConfig,
  readLaunchParams,
  writeLaunchParams,
  getConfigFilePath,
};
