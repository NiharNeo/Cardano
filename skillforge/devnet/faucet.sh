#!/bin/bash

# Local faucet for SkillForge devnet - Sends 5000 ADA instantly
set -e

if [ -z "$1" ]; then
    echo "Usage: ./faucet.sh <address>"
    echo "Example: ./faucet.sh addr_test1..."
    exit 1
fi

ADDRESS=$1
AMOUNT=5000000000  # 5000 ADA in Lovelace
FAUCET_ADDR=$(cat keys/payment.addr 2>/dev/null || echo "")

if [ -z "$FAUCET_ADDR" ]; then
    echo "❌ Faucet address not found. Run ./setup-devnet.sh first."
    exit 1
fi

echo "💰 Funding address: $ADDRESS"
echo "   Amount: 5000 ADA"

# Check if node is running
if ! docker exec skillforge-node-1 cardano-cli query tip --testnet-magic 42 --socket-path /data/node.socket &>/dev/null; then
    echo "❌ Cardano node not running. Start with: docker-compose up -d"
    exit 1
fi

# Get faucet UTXOs
echo "🔍 Querying faucet UTXOs..."
UTXOS=$(docker exec skillforge-node-1 cardano-cli query utxo \
    --address "$FAUCET_ADDR" \
    --testnet-magic 42 \
    --socket-path /data/node.socket \
    --out-file /dev/stdout 2>/dev/null | jq -r 'to_entries | map(select(.value.value.lovelace > 1000000)) | .[0] | "\(.key)"' || echo "")

if [ -z "$UTXOS" ]; then
    echo "⚠️  No UTXOs found in faucet. Using genesis UTXO..."
    # Use genesis UTXO
    GENESIS_TX=$(cat genesis/utxo-keys/utxo1.vkey 2>/dev/null | head -1 || echo "genesis-tx")
    UTXOS="${GENESIS_TX}#0"
fi

# Build transaction
echo "📝 Building transaction..."
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

docker exec skillforge-node-1 cardano-cli transaction build \
    --testnet-magic 42 \
    --socket-path /data/node.socket \
    --tx-in "$UTXOS" \
    --tx-out "$ADDRESS+$AMOUNT" \
    --change-address "$FAUCET_ADDR" \
    --out-file "$TMP_DIR/tx.unsigned" 2>&1 || {
    echo "❌ Transaction build failed. Using simple transaction..."
    # Fallback: create raw transaction
    docker exec skillforge-node-1 cardano-cli transaction build-raw \
        --tx-in "$UTXOS" \
        --tx-out "$ADDRESS+$AMOUNT" \
        --tx-out "$FAUCET_ADDR+0" \
        --fee 0 \
        --out-file "$TMP_DIR/tx.unsigned" 2>&1 || {
        echo "❌ Failed to build transaction"
        exit 1
    }
}

# Sign transaction
echo "✍️  Signing transaction..."
docker exec skillforge-node-1 cardano-cli transaction sign \
    --testnet-magic 42 \
    --socket-path /data/node.socket \
    --tx-body-file "$TMP_DIR/tx.unsigned" \
    --signing-key-file /keys/payment.skey \
    --out-file "$TMP_DIR/tx.signed" 2>&1 || {
    echo "❌ Transaction signing failed"
    exit 1
}

# Submit transaction
echo "📤 Submitting transaction..."
TX_HASH=$(docker exec skillforge-node-1 cardano-cli transaction submit \
    --testnet-magic 42 \
    --socket-path /data/node.socket \
    --tx-file "$TMP_DIR/tx.signed" 2>&1 && \
    docker exec skillforge-node-1 cardano-cli transaction txid \
    --tx-file "$TMP_DIR/tx.signed" 2>&1 || echo "")

if [ -n "$TX_HASH" ]; then
    echo "✅ Transaction submitted successfully!"
    echo "   TX Hash: $TX_HASH"
    echo "   Amount: 5000 ADA"
    echo "   To: $ADDRESS"
else
    echo "⚠️  Transaction may have been submitted. Check with: ./query-utxo.sh $ADDRESS"
fi

rm -rf "$TMP_DIR"
