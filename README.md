# easytyga

**Your homelab AI, accessible from anywhere. One command.**

Expose your local Ollama, OpenClaw, vLLM, or any HTTP service to the internet with API key authentication. No port forwarding, no static IP, no nginx configs.

```bash
npx easytyga
```

```
  easytyga v2.0.0
  Tunnel your local AI to the web

  GPU:     NVIDIA GeForce RTX 4090
  Target:  http://localhost:11434
  Relay:   wss://easytyga.com/ws

  Tunnel active

  Public URL:  https://easytyga.com/t/abc123
  API Key:     et_a1b2c3d4e5f6...

  Credits:     50,000 requests remaining

  Manage your account: https://easytyga.com/account
  Press Ctrl+C to disconnect.
```

That's it. Your local AI is now accessible from anywhere, secured with an API key.

## What's new in v2

**Multi-tunnel support** - run multiple tunnels in a single process. Expose Ollama, vLLM, OpenClaw, or any mix of services at the same time, each with its own public URL and API key.

```bash
npx easytyga --tunnel ollama=http://localhost:11434 --tunnel vllm=http://localhost:8000
```

```
  easytyga v2.0.0 (2 tunnels)
  Tunnel your local AI to the web

  GPU:     NVIDIA GeForce RTX 4090
  Relay:   wss://easytyga.com/ws

  Tunnels:
    ollama -> http://localhost:11434
    vllm -> http://localhost:8000

  [ollama] Tunnel active
  [ollama] Public URL:  https://easytyga.com/t/abc123
  [ollama] API Key:     et_a1b2c3d4...

  [vllm] Tunnel active
  [vllm] Public URL:  https://easytyga.com/t/def456
  [vllm] API Key:     et_e5f6g7h8...
```

Or use a config file for more control:

```bash
npx easytyga --config easytyga.config.json
```

```json
{
  "server": "wss://easytyga.com/ws",
  "tunnels": [
    { "name": "ollama", "target": "http://localhost:11434" },
    { "name": "vllm", "target": "http://localhost:8000", "list": true },
    { "name": "openclaw", "target": "http://localhost:18789", "openclaw": true }
  ]
}
```

Each tunnel gets independent heartbeat, reconnection, and health checks. If one tunnel fails, the others keep running.

## Tunnel any HTTP service (v2.1)

easytyga isn't just for AI. Point it at **any local HTTP service** - a dev server, webhook receiver, dashboard, home automation UI - and get a public, API-key-protected URL in seconds.

```bash
# Auto-detect: if the target isn't Ollama, it's tunnelled as a plain HTTP service
npx easytyga --target http://localhost:3000

# Force generic mode explicitly
npx easytyga --raw --target http://localhost:3000

# Service still starting up? Retry the target check for up to 120s
npx easytyga --raw --target http://localhost:3000 --wait-target 120
```

Request headers and content types are passed through untouched, so JSON APIs, HTML pages, form posts, and binary responses all work.

## Why?

Most local AI services have **no built-in authentication** and **no remote access**. If you want to use your GPU from your phone, office, or a cloud app, you need to cobble together nginx + Cloudflare tunnels + basic auth.

easytyga solves this in one command:
- **Secure tunnel** - no port forwarding, works behind any NAT/firewall
- **API key auth** - auto-generated, every request authenticated
- **Auto-detects your GPU** - knows what hardware you're running
- **Works with anything** - Ollama, OpenClaw, vLLM, LocalAI, ComfyUI, or any HTTP service

## Usage

```bash
# Tunnel local Ollama (default port 11434)
npx easytyga

# Multiple tunnels at once
npx easytyga --tunnel ollama=http://localhost:11434 --tunnel vllm=http://localhost:8000

# From a config file
npx easytyga --config easytyga.config.json

# Tunnel your OpenClaw AI assistant gateway
npx easytyga --openclaw

# OpenClaw on a custom port
npx easytyga --openclaw 19000

# Tunnel a different service
npx easytyga --target http://localhost:8080

# Tunnel any non-AI HTTP service (generic mode)
npx easytyga --raw --target http://localhost:3000

# Wait for a slow-starting service before tunnelling
npx easytyga --wait-target 60

# Use a specific key
npx easytyga --key et_abc123...
```

## Options

| Flag | Description |
|------|-------------|
| `--target <url>` | Local endpoint (default: `http://localhost:11434`) |
| `--tunnel name=url` | Add a named tunnel (repeatable for multi-tunnel) |
| `--config <path>` | Load tunnel config from JSON file |
| `--openclaw [port]` | OpenClaw gateway mode (default port: `18789`) |
| `--raw` | Generic HTTP mode - tunnel any local service |
| `--wait-target <sec>` | Retry the target check for up to `<sec>` seconds at startup |
| `--server <url>` | Relay server URL |
| `--key <key>` | Connection key |
| `--list` | Register on the GPU marketplace |
| `--memory` | Enable persistent conversation memory |
| `--help` | Show help |

## How it works

1. easytyga connects to the relay server via WebSocket (one connection per tunnel)
2. The relay assigns each tunnel a public URL with API key auth
3. Incoming requests are forwarded through the tunnel to your local service
4. Responses stream back to the caller

Your IP stays private. No ports to open. Works from any network.

## Features

- **Multi-tunnel** - run multiple services in one process, each with its own URL
- **Config file support** - define tunnels in `easytyga.config.json`
- **One command** - `npx easytyga`, no install needed
- **API key auth** - every tunnel gets a unique key, no anonymous access
- **GPU detection** - auto-detects NVIDIA, AMD, and Apple Silicon
- **Model detection** - discovers installed Ollama models automatically
- **OpenClaw support** - native `--openclaw` flag for AI assistant gateways
- **Auto-reconnect** - exponential backoff, set and forget
- **Client-side heartbeat** - detects dead connections within 30s, auto-reconnects when relay restarts
- **Streaming** - full support for streaming responses (chat, generate)
- **Any HTTP service** - not locked to Ollama; `--raw` tunnels anything with full header passthrough
- **Wait for target** - `--wait-target` retries at startup instead of failing while your service boots

## Credits

easytyga is free to use. The free tier gives you 100 requests/hour. Buy credits to remove the rate limit - credits never expire.

- **Starter** - 10,000 requests for $4.99
- **Popular** - 50,000 requests for $14.99
- **Pro** - 200,000 requests for $29.99

Buy credits at [easytyga.com/credits](https://easytyga.com/credits). Manage your account at [easytyga.com/account](https://easytyga.com/account).

## Integrations

- **[OpenClaw](https://openclaw.ai)** - Tunnel your personal AI assistant gateway to the internet for WhatsApp, Telegram, Slack, Discord, Signal, and 20+ channels (`--openclaw`)
- **[gpusmarket.com](https://gpusmarket.com)** - List your GPU on the peer-to-peer rental marketplace and earn money (`--list`)
- **[agenticmemory.ai](https://agenticmemory.ai)** - Add persistent conversation memory to your AI (`--memory`)

See [easytyga.com](https://easytyga.com) for documentation.

## License

MIT

---

## Trademarks

"easytyga" and the easytyga logo are trademarks of Joe Wee. The name and branding may not be used in derivative works without written permission.

This software is provided under the MIT license - you are free to use, modify, and distribute the code, but the easytyga name, branding, and relay infrastructure remain the property of the author.

Ollama is a trademark of Ollama, Inc. OpenClaw is a trademark of OpenClaw contributors. vLLM is a trademark of vLLM contributors. NVIDIA, GeForce, and RTX are trademarks of NVIDIA Corporation. AMD and Radeon are trademarks of AMD. Apple and Apple Silicon are trademarks of Apple Inc. All other trademarks are the property of their respective owners. This project is not affiliated with or endorsed by any of these companies.

---

Built by [Joe Wee](https://github.com/jyswee)
