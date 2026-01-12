#!/bin/bash
# Load environment variables for NetKnife deployment
# Tries to load from .env file, or sources from openarena project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENARENA_DIR="$SCRIPT_DIR/../../../../openarena-aws"

# Try to load from local .env file first
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        echo "✅ Loaded Cloudflare token from .env"
        export CLOUDFLARE_API_TOKEN
        return 0 2>/dev/null || exit 0
    fi
fi

# If not found, try to source from openarena project
if [ -f "$OPENARENA_DIR/.env" ]; then
    source "$OPENARENA_DIR/.env" 2>/dev/null
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        echo "✅ Loaded Cloudflare token from openarena project"
        export CLOUDFLARE_API_TOKEN
        return 0 2>/dev/null || exit 0
    fi
fi

# If still not found, check if already set in environment
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "✅ Cloudflare token already set in environment"
    return 0 2>/dev/null || exit 0
fi

echo "⚠️  CLOUDFLARE_API_TOKEN not found"
echo "   Create .env file or set environment variable"
return 1 2>/dev/null || exit 1
