const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const net = require('net');
const { TunnelClient } = require('../../src/TunnelClient');
const { createLogger } = require('../../src/logger');
const { MockRelay } = require('./mock-relay');

// Minimal local TCP echo server standing in for sshd / dockerd / any service.
function startEchoServer() {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on('data', (chunk) => socket.write(chunk)); // echo
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function waitForAuth(client) {
  await new Promise((resolve) => {
    const check = () => (client.publicUrl ? resolve() : setTimeout(check, 25));
    check();
  });
}

describe('TunnelClient - raw-TCP streams (pod agent)', () => {
  let relay, echo;

  beforeEach(async () => {
    relay = new MockRelay();
    echo = await startEchoServer();
    await relay.start();
  });

  afterEach(async () => {
    await Promise.all([relay.close(), echo.close()]);
  });

  it('opens an allowed port, replies stream-ready, and round-trips bytes', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: 'http://localhost:1', // unused for stream test
      serverUrl: relay.url,
      key: 'k1',
      streamPorts: [echo.port],
      logger: createLogger('test', 1),
    });
    client.connect();
    await waitForAuth(client);

    const id = 'stream-1';
    relay.sendStreamFrame(0, { id, type: 'stream-open', port: echo.port });
    await relay.waitForStreamFrame(id, 'stream-ready');

    relay.sendStreamFrame(0, { id, type: 'stream-data', chunk: Buffer.from('ping').toString('base64') });
    const dataFrame = await relay.waitForStreamFrame(id, 'stream-data');
    assert.strictEqual(Buffer.from(dataFrame.chunk, 'base64').toString(), 'ping');

    client.stop();
  });

  it('rejects an unauthorized port before dialing (stream-error: unauthorized)', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: 'http://localhost:1',
      serverUrl: relay.url,
      key: 'k2',
      streamPorts: [22], // echo.port NOT allowed
      logger: createLogger('test', 1),
    });
    client.connect();
    await waitForAuth(client);

    const id = 'stream-2';
    relay.sendStreamFrame(0, { id, type: 'stream-open', port: echo.port });
    const err = await relay.waitForStreamFrame(id, 'stream-error');
    assert.strictEqual(err.error, 'unauthorized');
    // No stream-ready should ever be sent for a rejected open.
    assert.ok(!relay.streamFramesFor(id).some(f => f.type === 'stream-ready'));

    client.stop();
  });

  it('denies all stream-opens when no allowlist is configured', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: 'http://localhost:1',
      serverUrl: relay.url,
      key: 'k3',
      logger: createLogger('test', 1),
    });
    client.connect();
    await waitForAuth(client);

    const id = 'stream-3';
    relay.sendStreamFrame(0, { id, type: 'stream-open', port: echo.port });
    const err = await relay.waitForStreamFrame(id, 'stream-error');
    assert.strictEqual(err.error, 'unauthorized');

    client.stop();
  });

  it('reaps open stream sockets on stop()', async () => {
    const client = new TunnelClient({
      name: 'test',
      targetUrl: 'http://localhost:1',
      serverUrl: relay.url,
      key: 'k4',
      streamPorts: [echo.port],
      logger: createLogger('test', 1),
    });
    client.connect();
    await waitForAuth(client);

    const id = 'stream-4';
    relay.sendStreamFrame(0, { id, type: 'stream-open', port: echo.port });
    await relay.waitForStreamFrame(id, 'stream-ready');
    assert.ok(client.streamMux.has(id), 'stream should be registered');

    client.stop();
    assert.ok(!client.streamMux.has(id), 'stream should be reaped after stop');
  });
});
