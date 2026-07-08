const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const net = require('net');
const { StreamClient } = require('../../src/StreamClient');
const { createLogger } = require('../../src/logger');
const { MockRelay } = require('./mock-relay');

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

describe('StreamClient - raw-TCP renter', () => {
  let relay;

  beforeEach(async () => {
    relay = new MockRelay({ echoStreams: true });
    await relay.start();
  });

  afterEach(async () => {
    await relay.close();
  });

  it('listens locally and round-trips bytes through the relay to the pod', async () => {
    const localPort = await freePort();
    const client = new StreamClient({
      serverUrl: relay.url,
      key: 'renter-key',
      tunnel: 'mypod',
      remotePort: 22,
      localPort,
      logger: createLogger('connect', 1),
    });
    await client.start();

    // Relay should have seen a stream-client auth carrying the target port.
    assert.strictEqual(relay.authMessages[0].role, 'stream-client');
    assert.strictEqual(relay.authMessages[0].port, 22);

    // Connect a local TCP client (stand-in for ssh) and echo a payload.
    const echoed = await new Promise((resolve, reject) => {
      const sock = net.connect(localPort, '127.0.0.1', () => sock.write('hello-pod'));
      sock.on('data', (chunk) => { resolve(chunk.toString()); sock.end(); });
      sock.on('error', reject);
      setTimeout(() => reject(new Error('no echo received')), 3000);
    });

    assert.strictEqual(echoed, 'hello-pod');
    client.stop();
  });

  it('requires --port and --local', async () => {
    const c1 = new StreamClient({ serverUrl: relay.url, key: 'k', localPort: 2222, logger: createLogger('connect', 1) });
    await assert.rejects(() => c1.start(), /--port/);

    const c2 = new StreamClient({ serverUrl: relay.url, key: 'k', remotePort: 22, logger: createLogger('connect', 1) });
    await assert.rejects(() => c2.start(), /--local/);
  });
});
