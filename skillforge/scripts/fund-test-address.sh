#!/bin/bash

# Fund a test address with unlimited ADA (for local testnet)

set -e

if [ -z "$1" ]; then
    echo "Usage: ./fund-test-address.sh <address> [amount_in_ada]"
    echo "Example: ./fund-test-address.sh addr_test1... 1000"
    exit 1
fi

ADDRESS=$1
AMOUNT=${2:-1000000}  # Default: 1,000,000 ADA

echo "💰 Funding address: $ADDRESS"
echo "   Amount: $AMOUNT ADA"

# In a real local testnet, you would create a genesis UTXO
# For now, this is a placeholder that shows the command structure

echo "⚠ This is a placeholder script."
echo "   In a real local testnet setup, you would:"
echo "   1. Create genesis UTXO with cardano-cli"
echo "   2. Submit transaction to local node"
echo ""
echo "   For development, use cardano-cli transaction build with:"
echo "   --testnet-magic 42"
echo "   --tx-in <genesis-utxo>"
echo "   --tx-out \"$ADDRESS+$((AMOUNT * 1000000))\""

