const { describe, it } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { StreamMux, HIGH_WATER } = require('../../src/streams');

// Deterministic stand-ins so we can drive the exact code paths (backpressure,
// byte cap, idle timeout) without real sockets or a real relay.
class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.written = [];
    this.paused = false;
    this.destroyed = false;
    this.ended = false;
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  write(buf) { this.written.push(buf); return true; }
  destroy() { this.destroyed = true; this.emit('close'); }
  end() { this.ended = true; }
}

class FakeWs {
  constructor() {
    this.readyState = 1; // OPEN
    this.bufferedAmount = 0;
    this.sent = [];
  }
  send(str, cb) { this.sent.push(JSON.parse(str)); if (cb) cb(); }
}

const framesFor = (ws, id, type) => ws.sent.filter(f => f.id === id && f.type === type);

describe('StreamMux', () => {
  it('forwards socket data as a base64 stream-data frame', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const sock = new MockSocket();
    mux.register('s1', sock);

    sock.emit('data', Buffer.from('hello'));

    const [frame] = framesFor(ws, 's1', 'stream-data');
    assert.ok(frame, 'should emit a stream-data frame');
    assert.strictEqual(Buffer.from(frame.chunk, 'base64').toString(), 'hello');
  });

  it('writes inbound peer data to the local socket (decoded)', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const sock = new MockSocket();
    mux.register('s1', sock);

    mux.write('s1', Buffer.from('pong').toString('base64'));
    assert.strictEqual(Buffer.concat(sock.written).toString(), 'pong');
  });

  it('enforces the byte cap: stream-error + teardown once exceeded', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws, { byteCap: 4 });
    const sock = new MockSocket();
    mux.register('s1', sock);

    sock.emit('data', Buffer.from('12345')); // 5 bytes > cap 4

    const [err] = framesFor(ws, 's1', 'stream-error');
    assert.ok(err && /byte cap/.test(err.error));
    assert.strictEqual(sock.destroyed, true);
    assert.strictEqual(mux.has('s1'), false);
  });

  it('stays under the byte cap for allowed volume', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws, { byteCap: 10 });
    const sock = new MockSocket();
    mux.register('s1', sock);

    sock.emit('data', Buffer.from('123'));
    sock.emit('data', Buffer.from('456'));
    assert.strictEqual(framesFor(ws, 's1', 'stream-error').length, 0);
    assert.strictEqual(mux.has('s1'), true);
  });

  it('applies backpressure: pauses while WS buffer is full, resumes on drain', async () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const sock = new MockSocket();
    mux.register('s1', sock);

    ws.bufferedAmount = HIGH_WATER; // send buffer saturated
    sock.emit('data', Buffer.from('x'));
    assert.strictEqual(sock.paused, true, 'socket paused while buffer full');

    ws.bufferedAmount = 0; // drained
    await new Promise(r => setTimeout(r, 40));
    assert.strictEqual(sock.paused, false, 'socket resumed after drain');
  });

  it('tears down (no stream-data) when the WS is not open', () => {
    const ws = new FakeWs();
    ws.readyState = 3; // CLOSED
    const mux = new StreamMux(ws);
    const sock = new MockSocket();
    mux.register('s1', sock);

    sock.emit('data', Buffer.from('x'));
    assert.strictEqual(framesFor(ws, 's1', 'stream-data').length, 0);
    assert.strictEqual(mux.has('s1'), false);
  });

  it('idle timeout closes the stream with stream-error', async () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws, { idleMs: 20 });
    const sock = new MockSocket();
    mux.register('s1', sock);

    await new Promise(r => setTimeout(r, 40));
    const [err] = framesFor(ws, 's1', 'stream-error');
    assert.ok(err && /idle/.test(err.error));
    assert.strictEqual(sock.destroyed, true);
    assert.strictEqual(mux.has('s1'), false);
  });

  it('idle timer resets on activity', async () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws, { idleMs: 40 });
    const sock = new MockSocket();
    mux.register('s1', sock);

    // Keep it busy before the window elapses.
    await new Promise(r => setTimeout(r, 25));
    mux.write('s1', Buffer.from('ka').toString('base64'));
    await new Promise(r => setTimeout(r, 25));
    assert.strictEqual(framesFor(ws, 's1', 'stream-error').length, 0);
    assert.strictEqual(mux.has('s1'), true);
  });

  it('emits stream-close and tears down on socket end', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const sock = new MockSocket();
    mux.register('s1', sock);

    sock.emit('end');
    assert.strictEqual(framesFor(ws, 's1', 'stream-close').length, 1);
    assert.strictEqual(mux.has('s1'), false);
  });

  it('emits stream-error and tears down on socket error', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const sock = new MockSocket();
    mux.register('s1', sock);

    sock.emit('error', new Error('ECONNRESET'));
    const [err] = framesFor(ws, 's1', 'stream-error');
    assert.ok(err && /ECONNRESET/.test(err.error));
    assert.strictEqual(sock.destroyed, true);
    assert.strictEqual(mux.has('s1'), false);
  });

  it('peerClose ends the socket; peerError destroys it', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const a = new MockSocket();
    const b = new MockSocket();
    mux.register('a', a);
    mux.register('b', b);

    mux.peerClose('a');
    assert.strictEqual(a.ended, true);
    assert.strictEqual(mux.has('a'), false);

    mux.peerError('b');
    assert.strictEqual(b.destroyed, true);
    assert.strictEqual(mux.has('b'), false);
  });

  it('destroyAll reaps every registered stream', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    const socks = ['a', 'b', 'c'].map((id) => {
      const s = new MockSocket();
      mux.register(id, s);
      return s;
    });

    mux.destroyAll();
    assert.ok(socks.every(s => s.destroyed));
    assert.strictEqual(mux.streams.size, 0);
  });

  it('ignores writes to unknown stream ids', () => {
    const ws = new FakeWs();
    const mux = new StreamMux(ws);
    assert.doesNotThrow(() => mux.write('nope', Buffer.from('x').toString('base64')));
  });
});
