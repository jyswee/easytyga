#!/usr/bin/env node
/**
 * easytyga - Tunnel your local AI to the internet. Secure. One command.
 *
 * Usage:
 *   npx easytyga                              # Free tunnel with auto-generated auth
 *   npx easytyga --target http://...:11434     # Custom local endpoint
 *   npx easytyga --list                        # List your GPU on the marketplace
 *   npx easytyga --memory                      # Add persistent memory
 *   npx easytyga --key et_abc123...            # Use existing key
 */

const { createTunnel } = require('../src/tunnel');
const { detectGpu } = require('../src/detect');

// -- CLI args --
const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
function hasFlag(name) {
  return args.includes('--' + name);
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
    --help            Show this help

  Examples:
    npx easytyga                           Tunnel local Ollama
    npx easytyga --target http://...:8080  Tunnel any HTTP service
    npx easytyga --list --memory           Marketplace + persistent memory

  https://easytyga.com
  `);
  process.exit(0);
}

const targetUrl = (getArg('target', '') || getArg('ollama', '') || 'http://localhost:11434').replace(/\/$/, '');
const serverUrl = getArg('server', 'wss://easytyga.com/ws');
const key = getArg('key', '') || process.env.EASYTYGA_KEY || '';
const listMode = hasFlag('list');
const memoryMode = hasFlag('memory');

// -- Main --
(async () => {
  console.log('');
  console.log('  easytyga v1.0.2');
  console.log('  Tunnel your local AI to the web');
  console.log('');

  const gpu = await detectGpu();
  if (gpu) console.log(`  GPU:     ${gpu}`);
  console.log(`  Target:  ${targetUrl}`);
  console.log(`  Relay:   ${serverUrl}`);
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
      gpu,
    });
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
})();
