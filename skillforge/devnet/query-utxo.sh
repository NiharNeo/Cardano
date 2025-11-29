#!/bin/bash

# Query UTXOs for an address in local devnet
set -e

if [ -z "$1" ]; then
    echo "Usage: ./query-utxo.sh <address>"
    echo "Example: ./query-utxo.sh addr_test1..."
    exit 1
fi

ADDRESS=$1

echo "🔍 Querying UTXOs for: $ADDRESS"
echo ""

# Check if node is running
if ! docker exec skillforge-node-1 cardano-cli query tip --testnet-magic 42 --socket-path /data/node.socket &>/dev/null; then
    echo "❌ Cardano node not running. Start with: docker-compose up -d"
    exit 1
fi

# Query UTXOs
docker exec skillforge-node-1 cardano-cli query utxo \
    --address "$ADDRESS" \
    --testnet-magic 42 \
    --socket-path /data/node.socket

echo ""
echo "💡 To fund this address, run: ./faucet.sh $ADDRESS"
