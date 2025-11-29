#!/bin/bash

# Start local Cardano node for development

set -e

TESTNET_DIR="./local-testnet"
PORT=3001

echo "🌐 Starting local Cardano node..."

# Check if node is already running
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠ Node already running on port $PORT"
    exit 1
fi

# Start node in background
cardano-node run \
    --config "$TESTNET_DIR/genesis/genesis.json" \
    --topology "$TESTNET_DIR/genesis/topology.json" \
    --database-path "$TESTNET_DIR/db" \
    --socket-path "$TESTNET_DIR/node.socket" \
    --port $PORT \
    > "$TESTNET_DIR/node.log" 2>&1 &

NODE_PID=$!
echo $NODE_PID > "$TESTNET_DIR/node.pid"

echo "✓ Node started (PID: $NODE_PID)"
echo "  Socket: $TESTNET_DIR/node.socket"
echo "  Logs: $TESTNET_DIR/node.log"
echo ""
echo "To stop: kill $NODE_PID or ./scripts/stop-local-node.sh"

