# Agent OS Bridge

Local bridge server that executes Claude Code and Codex sessions on your machine. The Vercel-hosted dashboard communicates with this bridge over Tailscale.

## Requirements

- Node 18+
- `claude` CLI: `npm install -g @anthropic-ai/claude-code`
- Tailscale installed and authenticated

## Quick Setup

```bash
cd bridge
./install.sh
```

## Manual Setup

### 1. Install dependencies

```bash
cd bridge
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and set BRIDGE_API_KEY to a strong random key
```

### 3. Run

```bash
npm start
```

The bridge starts on port 4242 by default.

### 4. Expose via Tailscale

```bash
tailscale serve --bg http://127.0.0.1:4242
```

Your bridge URL will be: `https://<machine-name>.<tailnet>.ts.net`

## Auto-start with launchd (macOS)

Create `~/Library/LaunchAgents/ai.agentos.bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.agentos.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>--import</string>
        <string>tsx</string>
        <string>src/index.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/agent-os-dashboard/bridge</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/agentos-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/agentos-bridge.err</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/ai.agentos.bridge.plist
```

## API Endpoints

All endpoints require `x-api-key` header (except `/api/health`).

- `GET /api/health` — Health check
- `POST /api/runs` — Create and start a new run
- `GET /api/runs` — List runs
- `GET /api/runs/:id` — Get run status
- `GET /api/runs/:id/log` — Get run log (NDJSON)
- `POST /api/runs/:id/cancel` — Cancel a running process
- `GET /api/models` — List available models
