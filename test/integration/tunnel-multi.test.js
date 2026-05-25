const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { TunnelManager } = require('../../src/TunnelManager');
const { MockRelay } = require('./mock-relay');
const { MockTarget } = require('./mock-target');

describe('TunnelManager - multi-tunnel', () => {
  let relay, target1, target2;

  beforeEach(async () => {
    relay = new MockRelay();
    target1 = new MockTarget();
    target2 = new MockTarget();
    await Promise.all([relay.start(), target1.start(), target2.start()]);
  });

  afterEach(async () => {
    await Promise.all([relay.close(), target1.close(), target2.close()]);
  });

  it('starts 2 tunnels, both connect and auth', async () => {
    const manager = new TunnelManager({ serverUrl: relay.url });

    manager.addTunnel({ name: 'ollama', target: target1.url });
    manager.addTunnel({ name: 'vllm', target: target2.url });

    await manager.startAll();

    // Wait for both to auth
    await new Promise((resolve) => {
      const check = () => {
        if (relay.authMessages.length >= 2) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    assert.strictEqual(relay.authMessages.length, 2);
    assert.strictEqual(relay.connections.length, 2);

    // Both should have public URLs
    const clients = Array.from(manager.clients.values());
    await new Promise((resolve) => {
      const check = () => {
        if (clients.every(c => c.publicUrl)) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    assert.ok(clients[0].publicUrl);
    assert.ok(clients[1].publicUrl);
    assert.notStrictEqual(clients[0].publicUrl, clients[1].publicUrl);

    // Stop all
    for (const c of clients) c.stop();
  });

  it('routes requests to correct targets', async () => {
    const manager = new TunnelManager({ serverUrl: relay.url });

    manager.addTunnel({ name: 'ollama', target: target1.url });
    manager.addTunnel({ name: 'vllm', target: target2.url });

    await manager.startAll();

    // Wait for both authed
    const clients = Array.from(manager.clients.values());
    await new Promise((resolve) => {
      const check = () => {
        if (clients.every(c => c.publicUrl)) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    // Send request to first tunnel (connection index 0)
    const id1 = relay.sendRequest(0, { path: '/api/chat', method: 'POST', body: { from: 'tunnel-0' } });
    await relay.waitForResponse(id1);

    // Send request to second tunnel (connection index 1)
    const id2 = relay.sendRequest(1, { path: '/api/tags', method: 'GET' });
    await relay.waitForResponse(id2);

    // Verify target1 got the chat request
    assert.ok(target1.requestLog.some(r => r.url === '/api/chat'));
    // Verify target2 got the tags request
    assert.ok(target2.requestLog.some(r => r.url === '/api/tags'));

    for (const c of clients) c.stop();
  });

  it('one tunnel auth-fail does not kill the other', async () => {
    let authCount = 0;
    const customRelay = new MockRelay({
      onAuth: (ws, msg, idx) => {
        authCount++;
        if (idx === 0) {
          // First tunnel succeeds
          ws.send(JSON.stringify({
            type: 'auth-ok',
            publicUrl: 'https://ok.easytyga.com',
            apiKey: 'ok-key',
            creditBalance: 100,
            hasCredits: true,
          }));
        } else {
          // Second tunnel fails
          ws.send(JSON.stringify({
            type: 'auth-fail',
            error: 'Bad key',
          }));
        }
      },
    });
    await customRelay.start();

    const manager = new TunnelManager({ serverUrl: customRelay.url });
    manager.addTunnel({ name: 'good', target: target1.url });
    manager.addTunnel({ name: 'bad', target: target2.url });

    await manager.startAll();

    // Wait for both auth attempts
    await new Promise((resolve) => {
      const check = () => {
        if (authCount >= 2) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    // Good tunnel should be connected
    const clients = Array.from(manager.clients.values());
    await new Promise((resolve) => {
      const check = () => {
        if (clients[0].publicUrl) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    assert.ok(clients[0].publicUrl, 'good tunnel should have publicUrl');

    for (const c of clients) c.stop();
    await customRelay.close();
  });
});
