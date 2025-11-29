#!/bin/bash

# Setup local Cardano testnet for SkillForge development
# This script sets up a local cluster with unlimited ADA

set -e

echo "🚀 Setting up local Cardano testnet for SkillForge..."

# Check if cardano-node is installed
if ! command -v cardano-node &> /dev/null; then
    echo "❌ cardano-node not found. Please install Cardano node first."
    echo "   Visit: https://developers.cardano.org/docs/get-started/installing-cardano-node"
    exit 1
fi

# Create testnet directory
TESTNET_DIR="./local-testnet"
mkdir -p "$TESTNET_DIR"

# Generate test keys
echo "🔑 Generating test keys..."
mkdir -p "$TESTNET_DIR/keys"

# Generate payment keys
cardano-cli address key-gen \
    --verification-key-file "$TESTNET_DIR/keys/payment.vkey" \
    --signing-key-file "$TESTNET_DIR/keys/payment.skey"

# Generate stake keys
cardano-cli stake-address key-gen \
    --verification-key-file "$TESTNET_DIR/keys/stake.vkey" \
    --signing-key-file "$TESTNET_DIR/keys/stake.skey"

# Build address
cardano-cli address build \
    --payment-verification-key-file "$TESTNET_DIR/keys/payment.vkey" \
    --stake-verification-key-file "$TESTNET_DIR/keys/stake.vkey" \
    --testnet-magic 42 \
    --out-file "$TESTNET_DIR/keys/address.txt"

ADDRESS=$(cat "$TESTNET_DIR/keys/address.txt")
echo "✓ Generated address: $ADDRESS"

# Create genesis with unlimited ADA
echo "📜 Creating genesis configuration..."
mkdir -p "$TESTNET_DIR/genesis"

# Create minimal genesis file
cat > "$TESTNET_DIR/genesis/genesis.json" <<EOF
{
  "activeSlotsCoeff": 0.05,
  "protocolParams": {
    "protocolVersion": {
      "major": 2,
      "minor": 0
    },
    "decentralizationParam": 0,
    "maxBlockBodySize": 65536,
    "maxBlockHeaderSize": 1100,
    "maxTxSize": 16384,
    "minFeeA": 44,
    "minFeeB": 155381,
    "minUTxOValue": 1000000,
    "poolDeposit": 500000000,
    "keyDeposit": 2000000
  }
}
EOF

echo "✅ Local testnet setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Start local node: ./scripts/start-local-node.sh"
echo "2. Fund test address: ./scripts/fund-test-address.sh"
echo "3. Load Aiken contracts: cd contracts && ./build.sh"
echo ""
echo "💡 Your test address: $ADDRESS"

