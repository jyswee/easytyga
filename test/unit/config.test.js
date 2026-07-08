const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig, resolveTunnels, resolveConnect, parsePorts } = require('../../src/config');

describe('loadConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easytyga-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads valid config', () => {
    const configPath = path.join(tmpDir, 'test.json');
    fs.writeFileSync(configPath, JSON.stringify({
      server: 'wss://example.com/ws',
      tunnels: [
        { name: 'ollama', target: 'http://localhost:11434' },
        { name: 'vllm', target: 'http://localhost:8000' },
      ],
    }));

    const config = loadConfig(configPath);
    assert.strictEqual(config.tunnels.length, 2);
    assert.strictEqual(config.tunnels[0].name, 'ollama');
    assert.strictEqual(config.tunnels[1].target, 'http://localhost:8000');
  });

  it('throws on missing file', () => {
    assert.throws(() => loadConfig('/nonexistent/path.json'), /Cannot read config file/);
  });

  it('throws on invalid JSON', () => {
    const configPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(configPath, '{ not valid json }}}');
    assert.throws(() => loadConfig(configPath), /Invalid JSON/);
  });

  it('throws on missing tunnels array', () => {
    const configPath = path.join(tmpDir, 'no-tunnels.json');
    fs.writeFileSync(configPath, JSON.stringify({ server: 'wss://x' }));
    assert.throws(() => loadConfig(configPath), /non-empty "tunnels" array/);
  });

  it('throws on empty tunnels array', () => {
    const configPath = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(configPath, JSON.stringify({ tunnels: [] }));
    assert.throws(() => loadConfig(configPath), /non-empty "tunnels" array/);
  });

  it('throws on missing target', () => {
    const configPath = path.join(tmpDir, 'no-target.json');
    fs.writeFileSync(configPath, JSON.stringify({ tunnels: [{ name: 'x' }] }));
    assert.throws(() => loadConfig(configPath), /missing "target"/);
  });

  it('throws on duplicate names', () => {
    const configPath = path.join(tmpDir, 'dupes.json');
    fs.writeFileSync(configPath, JSON.stringify({
      tunnels: [
        { name: 'same', target: 'http://a' },
        { name: 'same', target: 'http://b' },
      ],
    }));
    assert.throws(() => loadConfig(configPath), /Duplicate tunnel name/);
  });

  it('auto-generates names when missing', () => {
    const configPath = path.join(tmpDir, 'nonames.json');
    fs.writeFileSync(configPath, JSON.stringify({
      tunnels: [
        { target: 'http://a' },
        { target: 'http://b' },
      ],
    }));

    const config = loadConfig(configPath);
    assert.strictEqual(config.tunnels[0].name, 'tunnel-0');
    assert.strictEqual(config.tunnels[1].name, 'tunnel-1');
  });

  it('strips trailing slash from target', () => {
    const configPath = path.join(tmpDir, 'slash.json');
    fs.writeFileSync(configPath, JSON.stringify({
      tunnels: [{ target: 'http://localhost:11434/' }],
    }));

    const config = loadConfig(configPath);
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:11434');
  });
});

describe('resolveTunnels', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easytyga-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('--tunnel name=url parses correctly', () => {
    const config = resolveTunnels(['--tunnel', 'ollama=http://localhost:11434'], tmpDir);
    assert.strictEqual(config.tunnels.length, 1);
    assert.strictEqual(config.tunnels[0].name, 'ollama');
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:11434');
  });

  it('--tunnel url (no name) gets auto-name', () => {
    const config = resolveTunnels(['--tunnel', 'http://localhost:8000'], tmpDir);
    assert.strictEqual(config.tunnels[0].name, 'tunnel-0');
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:8000');
  });

  it('multiple --tunnel args produce correct array', () => {
    const config = resolveTunnels([
      '--tunnel', 'ollama=http://localhost:11434',
      '--tunnel', 'vllm=http://localhost:8000',
    ], tmpDir);
    assert.strictEqual(config.tunnels.length, 2);
    assert.strictEqual(config.tunnels[0].name, 'ollama');
    assert.strictEqual(config.tunnels[1].name, 'vllm');
  });

  it('--config loads from file', () => {
    const configPath = path.join(tmpDir, 'my.json');
    fs.writeFileSync(configPath, JSON.stringify({
      tunnels: [{ name: 'x', target: 'http://a' }],
    }));
    const config = resolveTunnels(['--config', configPath], tmpDir);
    assert.strictEqual(config.tunnels[0].name, 'x');
  });

  it('auto-detects easytyga.config.json in cwd', () => {
    const configPath = path.join(tmpDir, 'easytyga.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      tunnels: [{ name: 'auto', target: 'http://auto' }],
    }));
    const config = resolveTunnels([], tmpDir);
    assert.strictEqual(config.tunnels[0].name, 'auto');
  });

  it('default (no args, no config file) produces single tunnel to localhost:11434', () => {
    const config = resolveTunnels([], tmpDir);
    assert.strictEqual(config.tunnels.length, 1);
    assert.strictEqual(config.tunnels[0].name, 'default');
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:11434');
  });

  it('--target overrides default', () => {
    const config = resolveTunnels(['--target', 'http://localhost:9999'], tmpDir);
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:9999');
  });

  it('--openclaw sets flag and default port', () => {
    const config = resolveTunnels(['--openclaw'], tmpDir);
    assert.strictEqual(config.tunnels[0].openclaw, true);
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:18789');
  });

  it('--openclaw with custom port', () => {
    const config = resolveTunnels(['--openclaw', '19000'], tmpDir);
    assert.strictEqual(config.tunnels[0].target, 'http://localhost:19000');
  });

  it('--list and --memory flags propagate', () => {
    const config = resolveTunnels(['--list', '--memory'], tmpDir);
    assert.strictEqual(config.tunnels[0].list, true);
    assert.strictEqual(config.tunnels[0].memory, true);
  });

  it('--server overrides default relay', () => {
    const config = resolveTunnels(['--server', 'wss://custom.com/ws'], tmpDir);
    assert.strictEqual(config.server, 'wss://custom.com/ws');
  });

  it('--tunnel takes priority over --config', () => {
    const configPath = path.join(tmpDir, 'easytyga.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      tunnels: [{ name: 'fromfile', target: 'http://file' }],
    }));
    const config = resolveTunnels(['--tunnel', 'cli=http://cli'], tmpDir);
    assert.strictEqual(config.tunnels[0].name, 'cli');
  });

  it('--stream-ports parses into a number allowlist on the tunnel', () => {
    const config = resolveTunnels(['--stream-ports', '22,2375'], tmpDir);
    assert.deepStrictEqual(config.tunnels[0].streamPorts, [22, 2375]);
  });

  it('no --stream-ports means an empty (deny-all) allowlist', () => {
    const config = resolveTunnels([], tmpDir);
    assert.deepStrictEqual(config.tunnels[0].streamPorts, []);
  });
});

describe('parsePorts', () => {
  it('parses, trims, de-dupes, and drops invalid ports', () => {
    assert.deepStrictEqual(parsePorts('22, 2375 ,22,0,70000,abc'), [22, 2375]);
  });
  it('returns [] for empty input', () => {
    assert.deepStrictEqual(parsePorts(''), []);
  });
});

describe('resolveConnect', () => {
  it('parses tunnel name, remote --port and local --local', () => {
    const cfg = resolveConnect(['connect', 'mypod', '--port', '22', '--local', '2222']);
    assert.strictEqual(cfg.tunnel, 'mypod');
    assert.strictEqual(cfg.remotePort, 22);
    assert.strictEqual(cfg.localPort, 2222);
  });

  it('--docker defaults the remote port to 2375', () => {
    const cfg = resolveConnect(['connect', 'mypod', '--docker', '--local', '2375']);
    assert.strictEqual(cfg.remotePort, 2375);
  });

  it('defaults the tunnel name to "default" when omitted', () => {
    const cfg = resolveConnect(['connect', '--port', '22', '--local', '2222']);
    assert.strictEqual(cfg.tunnel, 'default');
  });

  it('--key and --server flags propagate', () => {
    const cfg = resolveConnect(['connect', 'p', '--port', '22', '--local', '2222', '--key', 'et_abc', '--server', 'wss://x/ws']);
    assert.strictEqual(cfg.key, 'et_abc');
    assert.strictEqual(cfg.server, 'wss://x/ws');
  });
});
