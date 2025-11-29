#!/bin/bash

# Build Aiken contracts and export to backend
set -e

echo "🔨 Building SkillForge Aiken contracts..."

# Check if aiken is installed
if ! command -v aiken &> /dev/null; then
    echo "❌ Aiken not found. Please install:"
    echo "   brew install aiken-lang/aiken/aiken"
    echo "   Or: https://github.com/aiken-lang/aiken/releases"
    exit 1
fi

# Build contracts
echo "📦 Building contracts..."
aiken build

# Create backend contracts directory if it doesn't exist
mkdir -p ../../../backend/contracts

# Export compiled scripts
echo "📤 Exporting compiled scripts..."

# Export escrow validator
if [ -f "build/validators/escrow.plutus" ]; then
    cp build/validators/escrow.plutus ../../../backend/contracts/escrow.plutus
    echo "✓ Escrow validator exported to backend/contracts/escrow.plutus"
else
    echo "⚠ Escrow validator not found in build output"
    echo "   Build path: build/validators/escrow.plutus"
fi

# Export NFT minting policy
if [ -f "build/minting_policies/session_nft.plutus" ]; then
    cp build/minting_policies/session_nft.plutus ../../../backend/contracts/session_nft.plutus
    echo "✓ NFT minting policy exported to backend/contracts/session_nft.plutus"
else
    echo "⚠ NFT minting policy not found in build output"
    echo "   Build path: build/minting_policies/session_nft.plutus"
fi

echo "✅ Build complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Verify scripts: ls -la ../../../backend/contracts/*.plutus"
echo "   2. Start backend: cd ../../../backend && npm run dev"



