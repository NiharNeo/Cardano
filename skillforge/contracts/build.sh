#!/bin/bash

# Build Aiken contracts and export to backend
set -e

echo "🔨 Building Aiken contracts..."

# Check if aiken is installed
if ! command -v aiken &> /dev/null; then
    echo "❌ Aiken not found. Installing..."
    curl -L https://github.com/aiken-lang/aiken/releases/latest/download/aiken-x86_64-apple-darwin.tar.gz | tar -xz
    chmod +x aiken
    export PATH=$PATH:$(pwd)
fi

# Build contracts
echo "📦 Building contracts..."
aiken build

# Create backend contracts directory if it doesn't exist
mkdir -p ../backend/contracts

# Export compiled scripts
echo "📤 Exporting compiled scripts..."

# Export escrow validator
if [ -f "build/validators/escrow.plutus" ]; then
    cp build/validators/escrow.plutus ../backend/contracts/escrow.plutus
    echo "✓ Escrow validator exported"
else
    echo "⚠ Escrow validator not found in build output"
fi

# Export NFT minting policy
if [ -f "build/minting_policies/session_nft.plutus" ]; then
    cp build/minting_policies/session_nft.plutus ../backend/contracts/session_nft.plutus
    echo "✓ NFT minting policy exported"
else
    echo "⚠ NFT minting policy not found in build output"
fi

echo "✅ Build complete!"

