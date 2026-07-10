# easytyga

**Your homelab AI, accessible from anywhere. One command.**

Expose your local Ollama, OpenClaw, vLLM, or any HTTP service to the internet with API key authentication. No port forwarding, no static IP, no nginx configs.

```bash
npx easytyga
```

```
  easytyga v3.0.0
  Tunnel your local AI to the web

  GPU:     NVIDIA GeForce RTX 4090
  Target:  http://localhost:11434

  Tunnel active

  Public URL:  https://relay.easytyga.com/t/abc123
  API Key:     et_a1b2c3d4e5f6...

  Credits:     50,000 requests remaining

  Manage your account: https://easytyga.com/account
  Press Ctrl+C to disconnect.
```

That's it. Your local AI is now accessible from anywhere, secured with an API key.

## The whole box, not just HTTP

easytyga turns a tunnel into full remote access to your GPU pod. Beyond HTTP, you can reach **raw TCP** ports - SSH into the machine, drive its Docker daemon, open Jupyter or TensorBoard, sync files, or hit a database - all over the same secured, API-key-authenticated tunnel, with no public IP.

Everything is default-deny: a port is only reachable if the pod explicitly allowed it, and the relay enforces the same allowlist independently.

```bash
# On the pod: allow SSH, Docker, and Jupyter
npx easytyga --stream-ports 22,2375 --jupyter

# On your machine: SSH in, or open Jupyter locally
npx easytyga connect mypod --port 22 --local 2222
npx easytyga connect mypod --jupyter --local 8888
```

## Multi-tunnel

Run multiple tunnels in a single process. Expose Ollama, vLLM, OpenClaw, or any mix of services at the same time, each with its own public URL and API key.

```bash
npx easytyga --tunnel ollama=http://localhost:11434 --tunnel vllm=http://localhost:8000
```

```
  easytyga v3.0.0 (2 tunnels)
  Tunnel your local AI to the web

  GPU:     NVIDIA GeForce RTX 4090

  Tunnels:
    ollama -> http://localhost:11434
    vllm -> http://localhost:8000

  [ollama] Tunnel active
  [ollama] Public URL:  https://relay.easytyga.com/t/abc123
  [ollama] API Key:     et_a1b2c3d4...

  [vllm] Tunnel active
  [vllm] Public URL:  https://relay.easytyga.com/t/def456
  [vllm] API Key:     et_e5f6g7h8...
```

Or use a config file for more control:

```bash
npx easytyga --config easytyga.config.json
```

```json
{
  "tunnels": [
    { "name": "ollama", "target": "http://localhost:11434" },
    { "name": "vllm", "target": "http://localhost:8000", "list": true },
    { "name": "openclaw", "target": "http://localhost:18789", "openclaw": true }
  ]
}
```

Each tunnel gets independent heartbeat, reconnection, and health checks. If one tunnel fails, the others keep running.

## Tunnel any HTTP service

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

## SSH, Docker, and databases over your tunnel

Beyond HTTP, easytyga tunnels **raw TCP** - so you can SSH into a remote box or reach its Docker socket over the same secured tunnel. This is ideal for GPU pods: expose port 22 and manage the machine from anywhere, no public IP required.

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

## Service presets

Common workflows get a single flag instead of a port number to remember. Presets are shorthand for `--stream-ports` on the pod and `connect --port` on your machine - the same default-deny allowlist, just less typing.

On the pod, expose services by name:

```bash
# Jupyter (8888), TensorBoard (6006), and Postgres (5432) in one line
npx easytyga --jupyter --tensorboard --db 5432
```

From your machine, reach one by name and get the exact command printed back for you:

```bash
npx easytyga connect mypod --jupyter --local 8888
#   Connect with:  open http://localhost:8888

npx easytyga connect mypod --db 5432 --local 5432

npx easytyga connect mypod --rsync --local 2222
#   Connect with:  rsync -e 'ssh -p 2222' <user>@localhost:/remote/path ./
```

| Preset | Port | Rides on |
|--------|------|----------|
| `--jupyter [port]` | 8888 | its own stream |
| `--tensorboard [port]` | 6006 | its own stream |
| `--docker` | 2375 | its own stream |
| `--db <port>` | your choice | its own stream |
| `--rsync` / `--scp` | 22 | the SSH stream |

A preset never widens access. It just adds its port to the same allowlist and entitlement checks as `--stream-ports`, so nothing is reachable unless the pod named it. An explicit `--port` always overrides the preset.

## Why?

Most local AI services have **no built-in authentication** and **no remote access**. If you want to use your GPU from your phone, office, or a cloud app, you need to cobble together nginx + Cloudflare tunnels + basic auth.

easytyga solves this in one command:
- **Secure tunnel** - no port forwarding, works behind any NAT/firewall
- **API key auth** - auto-generated, every request authenticated
- **Auto-detects your GPU** - knows what hardware you're running
- **Works with anything** - Ollama, OpenClaw, vLLM, LocalAI, ComfyUI, or any HTTP service

## easytyga vs ngrok

ngrok is a great general-purpose tunnel. easytyga is built specifically for self-hosted AI and GPU boxes. The tunnel is full, authenticated access to the whole machine (SSH, Docker, Jupyter, databases), so a lot works differently out of the box.

| | easytyga | ngrok (Free) |
|---|---|---|
| API key auth on every endpoint | Yes, auto-generated, always on | HTTP/HTTPS only (not TCP); auth is opt-in |
| Raw TCP (SSH / Docker) | Yes, included, default-deny allowlist | Requires credit-card verification |
| Service presets (Jupyter, TensorBoard, DB) | One-flag shortcuts built in | Manual port config |
| The whole box, not just HTTP | SSH + Docker + notebooks in one tunnel | Per-endpoint agents, paid TCP |
| Session length | Unlimited | 2 hour cap |
| Interstitial warning page | None | Shown to all visitors |
| GPU + model detection | Built in (NVIDIA, AMD, Apple Silicon) | No |
| Multi-tunnel in one process | Yes, one WebSocket per tunnel | One agent per endpoint |
| AI-native modes | `--openclaw`, Ollama/vLLM auto-detect | Generic HTTP only |
| Pricing model | Credits, one-time, never expire | Monthly subscription |
| Entry cost | $1 one-time activation (1,000 requests) | Free tier, then monthly plans |

Numbers reflect ngrok's published Free plan as of 2026. See [ngrok.com/pricing](https://ngrok.com/pricing) for their current terms.

If you need a mature API gateway with global edge, load balancing, and Kubernetes ingress, use ngrok. If you want your whole GPU box online in one command - HTTP, SSH, Docker, and notebooks, all authenticated, with no time limits - use easytyga.

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
| `--jupyter [port]` | Preset: expose Jupyter (default port `8888`) |
| `--tensorboard [port]` | Preset: expose TensorBoard (default port `6006`) |
| `--db <port>` | Preset: expose a database port (e.g. `5432`) |
| `--server <url>` | Relay server URL |
| `--key <key>` | Connection key |
| `--list` | Advertise this tunnel to gpusmarket.com |
| `--memory` | Enable persistent conversation memory |
| `--help` | Show help |

### `connect` subcommand

Reach a remote pod's raw-TCP port from your machine: `npx easytyga connect <tunnel> [options]`

| Flag | Description |
|------|-------------|
| `--port <n>` | Remote port on the pod to reach (e.g. `22`) |
| `--local <n>` | Local port to listen on (e.g. `2222`) |
| `--docker` | Preset for the Docker daemon port (`2375`) |
| `--jupyter [port]` | Preset for Jupyter (default `8888`) |
| `--tensorboard [port]` | Preset for TensorBoard (default `6006`) |
| `--db <port>` | Preset for a database port (e.g. `5432`) |
| `--rsync` / `--scp` | Preset for file transfer over the SSH stream (`22`) |
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
- **Service presets** - `--jupyter`, `--tensorboard`, `--db`, `--rsync`/`--scp` are one-flag shortcuts over raw TCP, still default-deny
- **Wait for target** - `--wait-target` retries at startup instead of failing while your service boots

## Credits

A one-time $1 activates your tunnel key and includes 1,000 requests (about 1,000 Ollama prompts). It is a spam-buster to keep the shared relay clean, not a profit centre. Beyond that, credit packs remove the rate limit and never expire.

- **Starter** - 10,000 requests for $4.99
- **Popular** - 50,000 requests for $14.99
- **Pro** - 200,000 requests for $29.99

Buy credits at [easytyga.com/credits](https://easytyga.com/credits). Manage your account at [easytyga.com/account](https://easytyga.com/account).

## Integrations

- **[OpenClaw](https://openclaw.ai)** - Tunnel your personal AI assistant gateway to the internet for WhatsApp, Telegram, Slack, Discord, Signal, and 20+ channels (`--openclaw`)
- **[gpusmarket.com](https://gpusmarket.com)** - A peer-to-peer GPU rental marketplace built on easytyga. Advertise a tunnel to it with `--list`
- **[agenticmemory.ai](https://agenticmemory.ai)** - Add persistent conversation memory to your AI (`--memory`)

See [easytyga.com](https://easytyga.com) for documentation.

## License

MIT

---

## Trademarks

"easytyga" and the easytyga logo are trademarks of Tyga.Cloud Ltd. easytyga is a division of Tyga.Cloud Ltd. The name and branding may not be used in derivative works without written permission.

This software is provided under the MIT license - you are free to use, modify, and distribute the code, but the easytyga name, branding, and relay infrastructure remain the property of Tyga.Cloud Ltd.

Ollama is a trademark of Ollama, Inc. OpenClaw is a trademark of OpenClaw contributors. vLLM is a trademark of vLLM contributors. NVIDIA, GeForce, and RTX are trademarks of NVIDIA Corporation. AMD and Radeon are trademarks of AMD. Apple and Apple Silicon are trademarks of Apple Inc. All other trademarks are the property of their respective owners. This project is not affiliated with or endorsed by any of these companies.

---

A [Tyga.Cloud Ltd](https://easytyga.com) product. Built by [jyswee](https://github.com/jyswee).
