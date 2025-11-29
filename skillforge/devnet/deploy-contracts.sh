#!/bin/bash

# Deploy Aiken contracts to local devnet

set -e

echo "📤 Deploying Aiken contracts to local devnet..."

# Check if contracts are built
if [ ! -f "../backend/contracts/escrow.plutus" ]; then
    echo "❌ Escrow contract not found. Building..."
    cd ../contracts/skillforge
    ./build.sh
    cd ../../devnet
fi

if [ ! -f "../backend/contracts/session_nft.plutus" ]; then
    echo "❌ NFT contract not found. Building..."
    cd ../contracts/skillforge
    ./build.sh
    cd ../../devnet
fi

echo "✓ Contracts found"
echo ""
echo "📝 Contract addresses:"
echo "   Escrow: $(cardano-cli address build --payment-script-file ../backend/contracts/escrow.plutus --testnet-magic 42 2>/dev/null || echo 'Calculate after deployment')"
echo "   NFT Policy: $(cardano-cli transaction policyid --script-file ../backend/contracts/session_nft.plutus 2>/dev/null || echo 'Calculate after deployment')"
echo ""
echo "✅ Contracts ready for deployment"
echo "   Use cardano-cli to submit transactions with these scripts"



