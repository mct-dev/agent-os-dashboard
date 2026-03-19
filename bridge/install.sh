#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

# Generate a random API key
API_KEY=$(openssl rand -hex 32)

# Write .env
cat > .env <<EOF
BRIDGE_API_KEY=${API_KEY}
PORT=4242
EOF

echo ""
echo "✅ Bridge installed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Your BRIDGE_API_KEY:"
echo "  ${API_KEY}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Start the bridge:  npm start"
echo "  2. Expose via Tailscale:  tailscale serve --bg http://127.0.0.1:4242"
echo "  3. Add the bridge URL and API key in Agent OS Dashboard → Settings"
echo ""
