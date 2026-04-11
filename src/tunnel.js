/**
 * Core tunnel client - connects to a WebSocket relay server and forwards requests.
 * Handles auth, request forwarding, streaming, and auto-reconnect.
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');

// ── Protocol helpers ──

function decodeBody(b64) {
  return b64 ? Buffer.from(b64, 'base64') : Buffer.alloc(0);
}

function encodeBody(buf) {
  return buf && buf.length > 0 ? Buffer.from(buf).toString('base64') : '';
}

function wsSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch {}
}

// ── Verify Ollama is reachable ──

async function checkOllama(ollamaUrl) {
  return new Promise((resolve) => {
    const url = new URL('/api/version', ollamaUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.version || true);
        } catch {
          resolve(true);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ── Get available models ──

async function getModels(ollamaUrl) {
  return new Promise((resolve) => {
    const url = new URL('/api/tags', ollamaUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve((data.models || []).map(m => m.name));
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ── Forward a request to local Ollama ──

function forwardToOllama(ws, msg, ollamaUrl) {
  const url = new URL(msg.path, ollamaUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const body = decodeBody(msg.body);

  const reqOpts = {
    method: msg.method || 'POST',
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      ...(body.length > 0 ? { 'Content-Length': body.length } : {}),
    },
    timeout: 120000,
  };

  const req = transport.request(reqOpts, (res) => {
    const headers = {};
    for (const [k, v] of Object.entries(res.headers)) {
      if (k.toLowerCase() !== 'transfer-encoding') headers[k] = v;
    }
    wsSend(ws, { id: msg.id, type: 'response-start', status: res.statusCode, headers });

    res.on('data', (chunk) => {
      wsSend(ws, { id: msg.id, type: 'response-data', chunk: encodeBody(chunk) });
    });

    res.on('end', () => {
      wsSend(ws, { id: msg.id, type: 'response-end' });
    });
  });

  req.on('error', (err) => {
    wsSend(ws, { id: msg.id, type: 'response-error', error: err.message });
  });

  req.on('timeout', () => {
    req.destroy();
    wsSend(ws, { id: msg.id, type: 'response-error', error: 'Request timed out' });
  });

  if (body.length > 0) req.write(body);
  req.end();
}

// ── Main tunnel function ──

async function createTunnel(opts) {
  const { ollamaUrl, serverUrl, key, listMode, memoryMode, gpu } = opts;

  // Check Ollama
  const version = await checkOllama(ollamaUrl);
  if (!version) {
    throw new Error(`Cannot reach Ollama at ${ollamaUrl}\nMake sure Ollama is running: ollama serve`);
  }
  console.log(`  Ollama ${typeof version === 'string' ? `v${version}` : ''} reachable`);

  // Get models
  const models = await getModels(ollamaUrl);
  if (models.length > 0) {
    console.log(`  Models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? ` (+${models.length - 5} more)` : ''}`);
  }

  // Generate a tunnel key if none provided
  const tunnelKey = key || `ot_${crypto.randomBytes(16).toString('hex')}`;
  const isAnonymous = !key;

  console.log('');

  // Connect with auto-reconnect
  let reconnectDelay = 2000;
  const MAX_RECONNECT = 30000;
  let requestCount = 0;

  function connect() {
    const ws = new WebSocket(serverUrl);

    ws.on('open', () => {
      wsSend(ws, {
        type: 'auth',
        key: tunnelKey,
        anonymous: isAnonymous,
        gpu: gpu || undefined,
        models: models,
        list: listMode || false,
        memory: memoryMode || false,
      });
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'auth-ok') {
        reconnectDelay = 2000;
        console.log('  ┌─────────────────────────────────────┐');
        console.log('  │  Tunnel active                      │');
        console.log('  └─────────────────────────────────────┘');
        if (msg.publicUrl) {
          console.log('');
          console.log(`  Public URL:  ${msg.publicUrl}`);
        }
        if (msg.apiKey) {
          console.log(`  API Key:     ${msg.apiKey}`);
        }
        if (msg.listingTitle) {
          console.log(`  Listing:     ${msg.listingTitle}`);
        }
        if (listMode) {
          console.log('');
          console.log('  Your GPU is listed on the marketplace.');
          console.log('  Renters can find and use your GPU now.');
        }
        if (memoryMode) {
          console.log('');
          console.log('  Persistent memory enabled.');
          console.log('  Conversations persist across sessions.');
        }
        console.log('');
        console.log('  Press Ctrl+C to disconnect.');
        console.log('');
        return;
      }

      if (msg.type === 'auth-fail') {
        console.error(`  Authentication failed: ${msg.error}`);
        if (isAnonymous) {
          console.error('  The relay server may not support anonymous tunnels.');
          console.error('  Get a key at https://easytyga.com');
        }
        process.exit(1);
      }

      if (msg.type === 'request' && msg.id) {
        requestCount++;
        process.stdout.write(`\r  Requests forwarded: ${requestCount}`);
        forwardToOllama(ws, msg, ollamaUrl);
        return;
      }
    });

    ws.on('close', () => {
      console.log(`\n  Disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT);
    });

    ws.on('error', (err) => {
      if (err.code !== 'ECONNREFUSED') {
        console.error(`  WebSocket error: ${err.message}`);
      }
    });
  }

  connect();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n  Tunnel closed. Goodbye!');
    if (listMode) console.log('  Your listing has been set to offline.');
    process.exit(0);
  });
  process.on('SIGTERM', () => { process.exit(0); });
}

module.exports = { createTunnel, checkOllama, getModels };
