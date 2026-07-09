const { describe, it } = require('node:test');
const assert = require('node:assert');
const { StreamClient } = require('../../src/StreamClient');
const { createLogger } = require('../../src/logger');

// _connectHint() is a pure formatter for the "Connect with: ..." line, so it can
// be exercised without dialing the relay. It prefers the explicit preset label,
// then falls back to well-known remote ports.
function hintFor({ preset, remotePort, localPort }) {
  const c = new StreamClient({
    serverUrl: 'wss://x/ws',
    key: 'k',
    remotePort,
    localPort,
    preset,
    logger: createLogger('connect', 0),
  });
  return c._connectHint();
}

describe('StreamClient._connectHint', () => {
  it('rsync preset prints an rsync-over-ssh command on the local port', () => {
    assert.strictEqual(
      hintFor({ preset: 'rsync', remotePort: 22, localPort: 2222 }),
      "rsync -e 'ssh -p 2222' <user>@localhost:/remote/path ./"
    );
  });

  it('scp preset prints an scp command on the local port', () => {
    assert.strictEqual(
      hintFor({ preset: 'scp', remotePort: 22, localPort: 2222 }),
      'scp -P 2222 <user>@localhost:/remote/file ./'
    );
  });

  it('jupyter preset prints a browser URL', () => {
    assert.strictEqual(
      hintFor({ preset: 'jupyter', remotePort: 8888, localPort: 8888 }),
      'open http://localhost:8888'
    );
  });

  it('tensorboard preset prints a browser URL', () => {
    assert.strictEqual(
      hintFor({ preset: 'tensorboard', remotePort: 6006, localPort: 6006 }),
      'open http://localhost:6006'
    );
  });

  it('docker preset prints a DOCKER_HOST command', () => {
    assert.strictEqual(
      hintFor({ preset: 'docker', remotePort: 2375, localPort: 2375 }),
      'DOCKER_HOST=tcp://localhost:2375 docker ps'
    );
  });

  it('db preset gives no hint (driver-specific)', () => {
    assert.strictEqual(hintFor({ preset: 'db', remotePort: 5432, localPort: 5432 }), null);
  });

  it('falls back to ssh for a bare --port 22', () => {
    assert.strictEqual(
      hintFor({ preset: null, remotePort: 22, localPort: 2222 }),
      'ssh <user>@localhost -p 2222'
    );
  });

  it('falls back to docker for bare ports 2375/2376', () => {
    assert.strictEqual(
      hintFor({ preset: null, remotePort: 2375, localPort: 2375 }),
      'DOCKER_HOST=tcp://localhost:2375 docker ps'
    );
    assert.strictEqual(
      hintFor({ preset: null, remotePort: 2376, localPort: 2376 }),
      'DOCKER_HOST=tcp://localhost:2376 docker ps'
    );
  });

  it('gives no hint for an unknown bare port', () => {
    assert.strictEqual(hintFor({ preset: null, remotePort: 9999, localPort: 9999 }), null);
  });
});
