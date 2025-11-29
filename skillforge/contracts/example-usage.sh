#!/bin/bash

# SkillForge Contract Usage Examples
# This script demonstrates how to use the Escrow and NFT contracts with cardano-cli

set -e

# Configuration
NETWORK="--testnet-magic 1"
SESSION_ID="session_123"
PRICE_LOVELACE=80000000  # 80 ADA

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== SkillForge Contract Usage Examples ===${NC}\n"

# Step 1: Get script addresses
echo -e "${YELLOW}Step 1: Getting script addresses${NC}"
ESCROW_ADDR=$(cardano-cli address build \
  --payment-script-file escrow.plutus \
  $NETWORK \
  --out-file /dev/stdout)

POLICY_ID=$(cardano-cli transaction policyid --script-file nft-policy.plutus)

echo "Escrow Address: $ESCROW_ADDR"
echo "NFT Policy ID: $POLICY_ID"

# Step 2: Create initial escrow datum
echo -e "\n${YELLOW}Step 2: Creating initial escrow datum${NC}"
LOCKED_AT=$(date +%s)000  # Current time in milliseconds
cat > escrow-datum-initial.json <<EOF
{
  "constructor": 0,
  "fields": [
    {
      "constructor": 0,
      "fields": []
    },
    {
      "constructor": 0,
      "fields": []
    },
    {
      "int": $LOCKED_AT
    }
  ]
}
EOF
echo "Created escrow-datum-initial.json"

# Step 3: Lock funds in escrow
echo -e "\n${YELLOW}Step 3: Locking funds in escrow${NC}"
echo "Example command:"
cat <<EOF
cardano-cli transaction build \\
  $NETWORK \\
  --tx-in <learner-utxo> \\
  --tx-out $ESCROW_ADDR+$PRICE_LOVELACE \\
  --tx-out-datum-embed-file escrow-datum-initial.json \\
  --change-address <learner-address> \\
  --out-file tx-lock.raw

cardano-cli transaction sign \\
  --tx-body-file tx-lock.raw \\
  --signing-key-file learner.skey \\
  $NETWORK \\
  --out-file tx-lock.signed

cardano-cli transaction submit \\
  --tx-file tx-lock.signed \\
  $NETWORK
EOF

# Step 4: Learner attests
echo -e "\n${YELLOW}Step 4: Learner attests completion${NC}"
cat > escrow-datum-learner-attest.json <<EOF
{
  "constructor": 0,
  "fields": [
    {
      "constructor": 1,
      "fields": []
    },
    {
      "constructor": 0,
      "fields": []
    },
    {
      "int": $LOCKED_AT
    }
  ]
}
EOF
echo "Created escrow-datum-learner-attest.json"
echo "Example command:"
cat <<EOF
cardano-cli transaction build \\
  $NETWORK \\
  --tx-in <escrow-utxo> \\
  --tx-in-script-file escrow.plutus \\
  --tx-in-datum-file escrow-datum-initial.json \\
  --tx-in-redeemer-value '{"constructor": 0, "fields": []}' \\
  --tx-out $ESCROW_ADDR+$PRICE_LOVELACE \\
  --tx-out-datum-embed-file escrow-datum-learner-attest.json \\
  --change-address <learner-address> \\
  --out-file tx-learner-attest.raw
EOF

# Step 5: Provider attests and receives payment
echo -e "\n${YELLOW}Step 5: Provider attests and receives payment${NC}"
cat > escrow-datum-final.json <<EOF
{
  "constructor": 0,
  "fields": [
    {
      "constructor": 1,
      "fields": []
    },
    {
      "constructor": 1,
      "fields": []
    },
    {
      "int": $LOCKED_AT
    }
  ]
}
EOF
echo "Created escrow-datum-final.json"
echo "Example command:"
cat <<EOF
cardano-cli transaction build \\
  $NETWORK \\
  --tx-in <escrow-utxo> \\
  --tx-in-script-file escrow.plutus \\
  --tx-in-datum-file escrow-datum-learner-attest.json \\
  --tx-in-redeemer-value '{"constructor": 0, "fields": []}' \\
  --tx-out <provider-address>+$PRICE_LOVELACE \\
  --change-address <provider-address> \\
  --out-file tx-complete.raw
EOF

# Step 6: Mint NFT
echo -e "\n${YELLOW}Step 6: Minting NFT${NC}"
TOKEN_NAME="SkillForge-Session-${SESSION_ID}"
TOKEN_NAME_HEX=$(echo -n "$TOKEN_NAME" | xxd -p | tr -d '\n')
echo "Token Name: $TOKEN_NAME"
echo "Token Name (Hex): $TOKEN_NAME_HEX"
echo "Example command:"
cat <<EOF
cardano-cli transaction build \\
  $NETWORK \\
  --tx-in <learner-utxo> \\
  --tx-in <escrow-utxo> \\
  --tx-in-script-file escrow.plutus \\
  --tx-in-datum-file escrow-datum-final.json \\
  --tx-in-redeemer-value '{"constructor": 0, "fields": []}' \\
  --mint "1 $POLICY_ID.$TOKEN_NAME_HEX" \\
  --mint-script-file nft-policy.plutus \\
  --mint-redeemer-value '{"constructor": 0, "fields": []}' \\
  --tx-out <learner-address>+2000000+"1 $POLICY_ID.$TOKEN_NAME_HEX" \\
  --change-address <learner-address> \\
  --out-file tx-mint.raw
EOF

# Step 7: Refund (after 48 hours)
echo -e "\n${YELLOW}Step 7: Refund (after 48 hours)${NC}"
REFUND_DEADLINE=$(($(date +%s) + 172800))  # 48 hours from now
echo "Refund deadline: $REFUND_DEADLINE"
echo "Example command:"
cat <<EOF
cardano-cli transaction build \\
  $NETWORK \\
  --tx-in <escrow-utxo> \\
  --tx-in-script-file escrow.plutus \\
  --tx-in-datum-file escrow-datum-initial.json \\
  --tx-in-redeemer-value '{"constructor": 1, "fields": []}' \\
  --tx-out <learner-address>+$PRICE_LOVELACE \\
  --change-address <learner-address> \\
  --invalid-hereafter $REFUND_DEADLINE \\
  --out-file tx-refund.raw
EOF

echo -e "\n${GREEN}=== Examples complete ===${NC}"
echo "Note: Replace placeholder values (<learner-utxo>, <learner-address>, etc.) with actual values"

