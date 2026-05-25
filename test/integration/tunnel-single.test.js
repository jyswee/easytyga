const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { TunnelClient } = require('../../src/TunnelClient');
const { createLogger } = require('../../src/logger');
const { MockRelay } = require('./mock-relay');
const { MockTarget } = require('./mock-target');

describe('TunnelClient - single tunnel', () => {
  let relay, target;

  beforeEach(async () => {
    relay = new MockRelay();
    target = new MockTarget();
    await Promise.all([relay.start(), target.start()]);
  });

  afterEach(async () => {
    await Promise.all([relay.close(), target.close()]);
  });

  it('connects to relay and receives auth-ok', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: target.url,
      serverUrl: relay.url,
      key: 'test-key-1',
      logger: createLogger('test', 1),
    });

    await client.start();

    // Wait for auth-ok
    await new Promise((resolve) => {
      const check = () => {
        if (client.publicUrl) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    assert.ok(client.publicUrl.includes('easytyga.com'));
    assert.ok(client.apiKey.startsWith('test-key-'));
    assert.strictEqual(relay.authMessages.length, 1);
    assert.strictEqual(relay.authMessages[0].key, 'test-key-1');

    client.stop();
  });

  it('forwards a request from relay to target', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: target.url,
      serverUrl: relay.url,
      key: 'test-key-2',
      logger: createLogger('test', 1),
    });

    await client.start();
    await new Promise((resolve) => {
      const check = () => {
        if (client.publicUrl) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    // Send a request through the relay
    const reqId = relay.sendRequest(0, {
      path: '/api/chat',
      method: 'POST',
      body: { model: 'mock-model', messages: [] },
    });

    // Wait for response
    const parts = await relay.waitForResponse(reqId);
    const start = parts.find(p => p.type === 'response-start');
    const end = parts.find(p => p.type === 'response-end');

    assert.ok(start, 'should have response-start');
    assert.strictEqual(start.status, 200);
    assert.ok(end, 'should have response-end');

    // Verify target received the request
    const targetReq = target.requestLog.find(r => r.url === '/api/chat');
    assert.ok(targetReq, 'target should have received /api/chat');

    client.stop();
  });

  it('handles auth-fail via callback', async () => {
    const failRelay = new MockRelay({ authResponse: 'fail' });
    await failRelay.start();

    let failCalled = false;
    let failError = '';

    const client = new TunnelClient({
      name: 'test',
      targetUrl: target.url,
      serverUrl: failRelay.url,
      key: 'bad-key',
      logger: createLogger('test', 1),
      onAuthFail: (tunnel, error) => {
        failCalled = true;
        failError = error;
      },
    });

    await client.start();

    // Wait for auth-fail callback
    await new Promise((resolve) => {
      const check = () => {
        if (failCalled) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    assert.strictEqual(failCalled, true);
    assert.strictEqual(failError, 'Test auth failure');

    client.stop();
    await failRelay.close();
  });

  it('stop() prevents reconnection', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: target.url,
      serverUrl: relay.url,
      key: 'test-key-3',
      logger: createLogger('test', 1),
    });

    await client.start();
    await new Promise((resolve) => {
      const check = () => {
        if (client.publicUrl) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    client.stop();
    assert.strictEqual(client.stopped, true);

    // Close relay and verify no reconnect attempt
    await relay.close();
    await new Promise((r) => setTimeout(r, 500));
    // If reconnect was attempted, it would throw since relay is closed
    // The fact we get here without error means stop() worked
  });

  it('increments request count', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: target.url,
      serverUrl: relay.url,
      key: 'test-key-4',
      logger: createLogger('test', 1),
    });

    await client.start();
    await new Promise((resolve) => {
      const check = () => {
        if (client.publicUrl) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    assert.strictEqual(client.requestCount, 0);

    const id1 = relay.sendRequest(0, { path: '/api/version', method: 'GET' });
    await relay.waitForResponse(id1);

    const id2 = relay.sendRequest(0, { path: '/api/tags', method: 'GET' });
    await relay.waitForResponse(id2);

    assert.strictEqual(client.requestCount, 2);

    client.stop();
  });
});
