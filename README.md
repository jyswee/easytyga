# easytyga

**Your homelab AI, accessible from anywhere. One command.**

Expose your local Ollama, OpenClaw, vLLM, or any HTTP service to the internet with API key authentication. No port forwarding, no static IP, no nginx configs.

```bash
npx easytyga
```

```
  easytyga v2.3.0
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
  easytyga v2.3.0 (2 tunnels)
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

## SSH and Docker over your tunnel (v2.3)

Beyond HTTP, easytyga can now tunnel **raw TCP** - so you can SSH into a remote box or reach its Docker socket over the same secured tunnel. This is ideal for GPU pods: expose port 22 and manage the machine from anywhere, no public IP required.

There are two sides.

**On the remote machine (the pod)**, list the local ports you want to allow. This is an explicit allowlist - nothing is reachable unless you name it here:

```bash
# Allow SSH (22) and the Docker daemon (2375)
npx easytyga --stream-ports 22,2375
```

**On your machine (the renter)**, open a local port that forwards to the pod:

```bash
# Forward local 2222 -> pod's port 22, then SSH in
npx easytyga connect mypod --port 22 --local 2222
ssh user@localhost -p 2222
```

```bash
# Reach the pod's Docker daemon on a local port
npx easytyga connect mypod --docker --local 2375
DOCKER_HOST=tcp://localhost:2375 docker ps
```

`mypod` is the tunnel name (the same key the pod connected with). Ports are default-deny end to end: the connection is refused unless the port is in the pod's `--stream-ports` allowlist, and the relay enforces the same allowlist independently.

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

# Expose raw TCP ports (SSH, Docker) on the remote machine
npx easytyga --stream-ports 22,2375

# Reach a remote pod's port from your machine
npx easytyga connect mypod --port 22 --local 2222
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
| `--eager` | Register the tunnel immediately, probe the target lazily |
| `--stream-ports <list>` | Allow raw-TCP streams to these local ports (e.g. `22,2375`) |
| `--server <url>` | Relay server URL |
| `--key <key>` | Connection key |
| `--list` | Register on the GPU marketplace |
| `--memory` | Enable persistent conversation memory |
| `--help` | Show help |

### `connect` subcommand

Reach a remote pod's raw-TCP port from your machine: `npx easytyga connect <tunnel> [options]`

| Flag | Description |
|------|-------------|
| `--port <n>` | Remote port on the pod to reach (e.g. `22`) |
| `--local <n>` | Local port to listen on (e.g. `2222`) |
| `--docker` | Shortcut for the Docker daemon port (`2375`) |
| `--bind <host>` | Local interface to bind (default: `127.0.0.1`) |
| `--key <key>` | Tunnel key |

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
- **Raw TCP (SSH / Docker)** - `--stream-ports` exposes local ports over the tunnel; `connect` forwards them to your machine, default-deny by allowlist
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
