const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createLogger } = require('../../src/logger');

describe('createLogger', () => {
  it('single tunnel: no prefix in log output', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));

    const log = createLogger('default', 1);
    log.log('hello');

    console.log = origLog;
    assert.strictEqual(logs[0], '  hello');
  });

  it('multi tunnel: adds [name] prefix', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));

    const log = createLogger('ollama', 3);
    log.log('hello');

    console.log = origLog;
    assert.strictEqual(logs[0], '  [ollama] hello');
  });

  it('single tunnel: error uses console.error', () => {
    const errs = [];
    const origErr = console.error;
    console.error = (...a) => errs.push(a.join(' '));

    const log = createLogger('default', 1);
    log.error('bad thing');

    console.error = origErr;
    assert.strictEqual(errs[0], '  bad thing');
  });

  it('multi tunnel: error has prefix', () => {
    const errs = [];
    const origErr = console.error;
    console.error = (...a) => errs.push(a.join(' '));

    const log = createLogger('vllm', 2);
    log.error('bad thing');

    console.error = origErr;
    assert.strictEqual(errs[0], '  [vllm] bad thing');
  });

  it('single tunnel: request uses \\r (carriage return)', () => {
    const writes = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (s) => { writes.push(s); return true; };

    const log = createLogger('default', 1);
    log.request(5);

    process.stdout.write = origWrite;
    assert.strictEqual(writes[0], '\r  Requests forwarded: 5');
  });

  it('multi tunnel: request uses newline with prefix', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));

    const log = createLogger('ollama', 2);
    log.request(3);

    console.log = origLog;
    assert.strictEqual(logs[0], '  [ollama] Requests forwarded: 3');
  });
});
