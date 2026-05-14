#!/usr/bin/env node
/**
 * easytyga - Tunnel your local AI to the internet. Secure. One command.
 *
 * Usage:
 *   npx easytyga                              # Free tunnel with auto-generated auth
 *   npx easytyga --openclaw                   # Tunnel OpenClaw AI assistant gateway
 *   npx easytyga --target http://...:8080     # Custom local endpoint
 *   npx easytyga --list                       # List your GPU on the marketplace
 *   npx easytyga --memory                     # Add persistent memory
 *   npx easytyga --key et_abc123...           # Use existing key
 */

const { createTunnel } = require('../dist/tunnel');
const { detectGpu } = require('../dist/detect');

// -- CLI args --
const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
function hasFlag(name) {
  return args.includes('--' + name);
}
function getOptionalArg(name, fallback) {
  const idx = args.indexOf('--' + name);
  if (idx < 0) return undefined;
  const next = args[idx + 1];
  if (next && !next.startsWith('--')) return next;
  return fallback;
}

if (hasFlag('help') || hasFlag('h')) {
  console.log(`
  easytyga - Tunnel your local AI to the internet

  Usage:
    npx easytyga                           Free tunnel with API key auth
    npx easytyga --list                    List your GPU on the marketplace
    npx easytyga --memory                  Add persistent conversation memory
    npx easytyga --key et_...              Use existing key

  Options:
    --target <url>    Local endpoint (default: http://localhost:11434)
    --server <url>    Relay server (default: wss://easytyga.com/ws)
    --key <key>       Connection key
    --list            Register on the GPU marketplace
    --memory          Enable persistent memory
    --openclaw [port] OpenClaw gateway mode (default port: 18789)
    --help            Show this help

  Examples:
    npx easytyga                           Tunnel local Ollama
    npx easytyga --target http://...:8080  Tunnel any HTTP service
    npx easytyga --list --memory           Marketplace + persistent memory
    npx easytyga --openclaw                Tunnel local OpenClaw gateway
    npx easytyga --openclaw 19000          OpenClaw on custom port

  https://easytyga.com
  `);
  process.exit(0);
}

const openclawPort = getOptionalArg('openclaw', '18789');
const openclawMode = openclawPort !== undefined;
const openclawDefault = openclawMode ? `http://localhost:${openclawPort}` : '';
const targetUrl = (getArg('target', '') || getArg('ollama', '') || openclawDefault || 'http://localhost:11434').replace(/\/$/, '');
const serverUrl = getArg('server', 'wss://easytyga.com/ws');
const key = getArg('key', '') || process.env.EASYTYGA_KEY || '';
const listMode = hasFlag('list');
const memoryMode = hasFlag('memory');

// -- Main --
(async () => {
  console.log('');
  if (openclawMode) {
    console.log('  easytyga v1.1.0 + OpenClaw');
    console.log('  Tunnel your AI assistant gateway to the web');
  } else {
    console.log('  easytyga v1.1.0');
    console.log('  Tunnel your local AI to the web');
  }
  console.log('');

  const gpu = await detectGpu();
  if (gpu) console.log(`  GPU:     ${gpu}`);
  console.log(`  Target:  ${targetUrl}`);
  console.log(`  Relay:   ${serverUrl}`);
  if (openclawMode) console.log('  Service: OpenClaw gateway');
  if (listMode) console.log('  Mode:    Marketplace');
  if (memoryMode) console.log('  Memory:  Enabled');
  console.log('');

  try {
    await createTunnel({
      ollamaUrl: targetUrl,
      serverUrl,
      key,
      listMode,
      memoryMode,
      openclawMode,
      gpu,
    });
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
})();
