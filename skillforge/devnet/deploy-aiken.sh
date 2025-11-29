#!/bin/bash

# Deploy Aiken contracts to local devnet
set -e

echo "📤 Deploying Aiken contracts to local devnet..."

# Check if Aiken is installed
if ! command -v aiken &> /dev/null; then
    echo "❌ Aiken not found. Please install:"
    echo "   brew install aiken-lang/aiken/aiken"
    echo "   Or: https://github.com/aiken-lang/aiken/releases"
    exit 1
fi

# Navigate to contracts directory
CONTRACTS_DIR="../contracts/skillforge"
if [ ! -d "$CONTRACTS_DIR" ]; then
    echo "❌ Contracts directory not found: $CONTRACTS_DIR"
    exit 1
fi

cd "$CONTRACTS_DIR"

# Build contracts
echo "🔨 Building Aiken contracts..."
aiken build

if [ $? -ne 0 ]; then
    echo "❌ Aiken build failed"
    exit 1
fi

# Get validator hash
echo "🔍 Getting escrow validator hash..."
ESCROW_HASH=$(aiken blueprint hash escrow 2>/dev/null || echo "")

if [ -z "$ESCROW_HASH" ]; then
    echo "⚠️  Could not get escrow hash via blueprint, using script hash..."
    # Fallback: use cardano-cli
    if [ -f "../../backend/contracts/escrow.plutus" ]; then
        ESCROW_HASH=$(cardano-cli transaction policyid --script-file ../../backend/contracts/escrow.plutus 2>/dev/null || echo "")
    fi
fi

# Get script address
echo "📍 Getting escrow script address..."
ESCROW_ADDRESS=$(aiken blueprint address escrow --testnet-magic 42 2>/dev/null || echo "")

if [ -z "$ESCROW_ADDRESS" ]; then
    echo "⚠️  Could not get address via blueprint, building manually..."
    # Fallback: build address from script
    if [ -f "../../backend/contracts/escrow.plutus" ]; then
        ESCROW_ADDRESS=$(cardano-cli address build \
            --payment-script-file ../../backend/contracts/escrow.plutus \
            --testnet-magic 42 2>/dev/null || echo "")
    fi
fi

# Get NFT policy ID
echo "🔍 Getting NFT policy ID..."
NFT_POLICY_ID=$(aiken blueprint hash session_nft 2>/dev/null || echo "")

if [ -z "$NFT_POLICY_ID" ]; then
    if [ -f "../../backend/contracts/session_nft.plutus" ]; then
        NFT_POLICY_ID=$(cardano-cli transaction policyid --script-file ../../backend/contracts/session_nft.plutus 2>/dev/null || echo "")
    fi
fi

# Save addresses
mkdir -p ../../backend/contracts
echo "$ESCROW_ADDRESS" > ../../backend/contracts/escrow.address
echo "$NFT_POLICY_ID" > ../../backend/contracts/nft.policy

echo "✅ Contracts deployed"
echo ""
echo "📝 Contract addresses:"
echo "   Escrow: $ESCROW_ADDRESS"
echo "   NFT Policy: $NFT_POLICY_ID"
echo ""
echo "💾 Saved to:"
echo "   backend/contracts/escrow.address"
echo "   backend/contracts/nft.policy"

cd - > /dev/null



