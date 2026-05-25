/**
 * Mock WebSocket relay server for integration tests.
 * Fakes the easytyga relay protocol: auth-ok, request forwarding, etc.
 */

const { WebSocketServer } = require('ws');
const crypto = require('crypto');

class MockRelay {
  constructor(opts = {}) {
    this.port = 0; // assigned on listen
    this.authResponse = opts.authResponse || 'ok'; // 'ok' or 'fail'
    this.connections = [];
    this.authMessages = [];
    this.responses = new Map(); // id -> collected response parts
    this.wss = null;
    this._onAuth = opts.onAuth || null;
  }

  async start() {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: 0 }, () => {
        this.port = this.wss.address().port;
        resolve();
      });

      let connIndex = 0;
      this.wss.on('connection', (ws) => {
        const idx = connIndex++;
        this.connections.push({ ws, idx, authed: false });

        ws.on('message', (data) => {
          let msg;
          try { msg = JSON.parse(data); } catch { return; }

          if (msg.type === 'auth') {
            this.authMessages.push(msg);
            const conn = this.connections.find(c => c.ws === ws);
            if (conn) conn.authed = true;

            if (this._onAuth) {
              this._onAuth(ws, msg, idx);
              return;
            }

            if (this.authResponse === 'ok') {
              ws.send(JSON.stringify({
                type: 'auth-ok',
                publicUrl: `https://test-${idx}.easytyga.com`,
                apiKey: `test-key-${idx}`,
                creditBalance: 1000,
                hasCredits: true,
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'auth-fail',
                error: 'Test auth failure',
              }));
            }
          }

          // Collect response parts
          if (msg.type === 'response-start' || msg.type === 'response-data' || msg.type === 'response-end' || msg.type === 'response-error') {
            if (!this.responses.has(msg.id)) {
              this.responses.set(msg.id, []);
            }
            this.responses.get(msg.id).push(msg);
          }
        });
      });
    });
  }

  sendRequest(connIdx, request) {
    const id = request.id || crypto.randomBytes(8).toString('hex');
    const conn = this.connections[connIdx];
    if (!conn) throw new Error(`No connection at index ${connIdx}`);
    conn.ws.send(JSON.stringify({
      type: 'request',
      id,
      path: request.path || '/api/chat',
      method: request.method || 'POST',
      body: request.body ? Buffer.from(JSON.stringify(request.body)).toString('base64') : '',
    }));
    return id;
  }

  waitForResponse(id, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const parts = this.responses.get(id) || [];
        const ended = parts.some(p => p.type === 'response-end' || p.type === 'response-error');
        if (ended) return resolve(parts);
        if (Date.now() - start > timeout) return reject(new Error('Response timeout'));
        setTimeout(check, 50);
      };
      check();
    });
  }

  get url() {
    return `ws://localhost:${this.port}`;
  }

  async close() {
    if (this.wss) {
      for (const conn of this.connections) {
        try { conn.ws.close(); } catch {}
      }
      return new Promise((resolve) => {
        this.wss.close(resolve);
      });
    }
  }
}

module.exports = { MockRelay };
