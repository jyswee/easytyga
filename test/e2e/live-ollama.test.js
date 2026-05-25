const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { TunnelClient } = require('../../src/TunnelClient');
const { TunnelManager } = require('../../src/TunnelManager');
const { createLogger } = require('../../src/logger');

// Check if Ollama is reachable before running tests
async function isOllamaRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/api/version', { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

describe('Live E2E - Ollama + real relay', { skip: false }, () => {
  let ollamaAvailable = false;

  before(async () => {
    ollamaAvailable = await isOllamaRunning();
    if (!ollamaAvailable) {
      console.log('  Skipping E2E tests: Ollama not running on localhost:11434');
    }
  });

  it('single tunnel connects and gets publicUrl', { timeout: 15000 }, async (t) => {
    if (!ollamaAvailable) return t.skip('Ollama not available');

    const client = new TunnelClient({
      name: 'e2e-single',
      targetUrl: 'http://localhost:11434',
      serverUrl: 'wss://easytyga.com/ws',
      logger: createLogger('e2e', 1),
    });

    await client.start();

    // Wait for auth-ok (up to 10s)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
      const check = () => {
        if (client.publicUrl) {
          clearTimeout(timeout);
          return resolve();
        }
        setTimeout(check, 100);
      };
      check();
    });

    assert.ok(client.publicUrl, 'should have a public URL');
    assert.ok(client.apiKey, 'should have an API key');
    console.log(`    Public URL: ${client.publicUrl}`);
    console.log(`    API Key: ${client.apiKey}`);

    client.stop();
  });

  it('multi-tunnel: 2 tunnels to same Ollama get different URLs', { timeout: 15000 }, async (t) => {
    if (!ollamaAvailable) return t.skip('Ollama not available');

    const manager = new TunnelManager({
      serverUrl: 'wss://easytyga.com/ws',
    });

    manager.addTunnel({ name: 'tunnel-a', target: 'http://localhost:11434' });
    manager.addTunnel({ name: 'tunnel-b', target: 'http://localhost:11434' });

    await manager.startAll();

    const clients = Array.from(manager.clients.values());

    // Wait for both auth-ok
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
      const check = () => {
        if (clients.every(c => c.publicUrl)) {
          clearTimeout(timeout);
          return resolve();
        }
        setTimeout(check, 100);
      };
      check();
    });

    assert.ok(clients[0].publicUrl);
    assert.ok(clients[1].publicUrl);
    assert.notStrictEqual(clients[0].publicUrl, clients[1].publicUrl);
    console.log(`    Tunnel A: ${clients[0].publicUrl}`);
    console.log(`    Tunnel B: ${clients[1].publicUrl}`);

    for (const c of clients) c.stop();
  });
});
