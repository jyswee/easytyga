/**
 * Mock HTTP server that fakes Ollama endpoints for integration tests.
 */

const http = require('http');

class MockTarget {
  constructor() {
    this.port = 0;
    this.server = null;
    this.requestLog = [];
  }

  async start() {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          this.requestLog.push({ method: req.method, url: req.url, body });

          if (req.url === '/api/version') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ version: '0.0.0-mock' }));
            return;
          }

          if (req.url === '/api/tags') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              models: [{ name: 'mock-model' }, { name: 'mock-model-2' }],
            }));
            return;
          }

          if (req.url === '/api/chat') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              message: { role: 'assistant', content: 'hello from mock' },
            }));
            return;
          }

          // Default: echo back
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ echo: true, path: req.url, method: req.method }));
        });
      });

      this.server.listen(0, () => {
        this.port = this.server.address().port;
        resolve();
      });
    });
  }

  get url() {
    return `http://localhost:${this.port}`;
  }

  async close() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

module.exports = { MockTarget };
