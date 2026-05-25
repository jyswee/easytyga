#!/usr/bin/env node
/**
 * easytyga v2 - Tunnel your local AI to the internet. Secure. One command.
 *
 * Usage:
 *   npx easytyga                                          # Free tunnel (Ollama default)
 *   npx easytyga --target http://...:8080                 # Custom local endpoint
 *   npx easytyga --openclaw                               # Tunnel OpenClaw gateway
 *   npx easytyga --tunnel ollama=http://localhost:11434   # Multi-tunnel mode
 *   npx easytyga --config easytyga.config.json            # Config file mode
 *   npx easytyga --list                                   # List GPU on marketplace
 *   npx easytyga --memory                                 # Add persistent memory
 *   npx easytyga --key et_abc123...                       # Use existing key
 */

const { TunnelManager } = require('../dist/TunnelManager');
const { detectGpu } = require('../dist/detect');
const { resolveTunnels, hasFlag } = require('../dist/config');

const args = process.argv.slice(2);

if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
  console.log(`
  easytyga - Tunnel your local AI to the internet

  Usage:
    npx easytyga                           Free tunnel with API key auth
    npx easytyga --list                    List your GPU on the marketplace
    npx easytyga --memory                  Add persistent conversation memory
    npx easytyga --key et_...              Use existing key

  Multi-tunnel:
    npx easytyga --tunnel ollama=http://localhost:11434 --tunnel vllm=http://localhost:8000
    npx easytyga --config easytyga.config.json

  Options:
    --target <url>      Local endpoint (default: http://localhost:11434)
    --server <url>      Relay server (default: wss://easytyga.com/ws)
    --key <key>         Connection key
    --list              Register on the GPU marketplace
    --memory            Enable persistent memory
    --openclaw [port]   OpenClaw gateway mode (default port: 18789)
    --tunnel name=url   Add a named tunnel (repeatable)
    --config <path>     Load tunnel config from JSON file
    --help              Show this help

  Examples:
    npx easytyga                                          Tunnel local Ollama
    npx easytyga --target http://...:8080                 Tunnel any HTTP service
    npx easytyga --list --memory                          Marketplace + memory
    npx easytyga --openclaw                               Tunnel OpenClaw gateway
    npx easytyga --openclaw 19000                         OpenClaw on custom port
    npx easytyga --tunnel ollama=http://localhost:11434 --tunnel vllm=http://localhost:8000
    npx easytyga --config tunnels.json                    Multi-tunnel from config

  Config file format (easytyga.config.json):
    {
      "server": "wss://easytyga.com/ws",
      "tunnels": [
        { "name": "ollama", "target": "http://localhost:11434" },
        { "name": "vllm", "target": "http://localhost:8000", "list": true }
      ]
    }

  https://easytyga.com
  `);
  process.exit(0);
}

// -- Main --
(async () => {
  const config = resolveTunnels(args);
  const multiMode = config.tunnels.length > 1;

  console.log('');
  console.log(`  easytyga v2.0.0${multiMode ? ` (${config.tunnels.length} tunnels)` : ''}`);
  console.log('  Tunnel your local AI to the web');
  console.log('');

  const gpu = await detectGpu();
  if (gpu) console.log(`  GPU:     ${gpu}`);
  console.log(`  Relay:   ${config.server || 'wss://easytyga.com/ws'}`);

  if (multiMode) {
    console.log('');
    console.log('  Tunnels:');
    for (const t of config.tunnels) {
      const flags = [
        t.list ? 'list' : '',
        t.memory ? 'memory' : '',
        t.openclaw ? 'openclaw' : '',
      ].filter(Boolean).join(', ');
      console.log(`    ${t.name} -> ${t.target}${flags ? ` (${flags})` : ''}`);
    }
  } else {
    console.log(`  Target:  ${config.tunnels[0].target}`);
    if (config.tunnels[0].openclaw) console.log('  Service: OpenClaw gateway');
    if (config.tunnels[0].list) console.log('  Mode:    Marketplace');
    if (config.tunnels[0].memory) console.log('  Memory:  Enabled');
  }
  console.log('');

  try {
    const manager = new TunnelManager({
      serverUrl: config.server || 'wss://easytyga.com/ws',
      gpu,
    });

    for (const t of config.tunnels) {
      manager.addTunnel(t);
    }

    await manager.startAll();
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
})();
