# Cardano CLI Usage Examples for SkillForge Contracts

This document provides complete `cardano-cli` examples for using the Escrow and NFT contracts.

## Prerequisites

1. Install `cardano-cli` (Cardano Node v8.0.0+)
2. Have testnet or mainnet access
3. Have payment keys for learner and provider
4. Compiled contract files: `escrow.plutus` and `nft-policy.plutus`

## Setup

```bash
# Set network (testnet example)
NETWORK="--testnet-magic 1"

# Or for mainnet
# NETWORK="--mainnet"

# Set session parameters
SESSION_ID="session_123"
PRICE_LOVELACE=80000000  # 80 ADA
```

## 1. Escrow Contract

### Step 1: Get Script Address and Hash

```bash
# Get the escrow script address
cardano-cli address build \
  --payment-script-file escrow.plutus \
  $NETWORK \
  --out-file escrow.addr

ESCROW_ADDR=$(cat escrow.addr)
echo "Escrow Address: $ESCROW_ADDR"

# Get the validator hash
ESCROW_VALIDATOR_HASH=$(cardano-cli address key-hash --payment-script-file escrow.plutus)
echo "Escrow Validator Hash: $ESCROW_VALIDATOR_HASH"
```

### Step 2: Create Initial Datum

```bash
# Get current time in milliseconds (POSIXTime)
LOCKED_AT=$(date +%s)000

# Create initial datum JSON
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
```

### Step 3: Lock Funds in Escrow

```bash
# Query learner UTXO
cardano-cli query utxo \
  --address $(cat learner.addr) \
  $NETWORK

# Set variables (replace with actual values)
LEARNER_UTXO="<txhash>#<index>"
LEARNER_ADDR=$(cat learner.addr)

# Build transaction
cardano-cli transaction build \
  $NETWORK \
  --tx-in $LEARNER_UTXO \
  --tx-out $ESCROW_ADDR+$PRICE_LOVELACE \
  --tx-out-datum-embed-file escrow-datum-initial.json \
  --change-address $LEARNER_ADDR \
  --out-file tx-lock.raw

# Calculate fee
cardano-cli transaction calculate-min-fee \
  --tx-body-file tx-lock.raw \
  --tx-in-count 1 \
  --tx-out-count 2 \
  --witness-count 1 \
  $NETWORK \
  --protocol-params-file protocol.json

# Sign transaction
cardano-cli transaction sign \
  --tx-body-file tx-lock.raw \
  --signing-key-file learner.skey \
  $NETWORK \
  --out-file tx-lock.signed

# Submit transaction
cardano-cli transaction submit \
  --tx-file tx-lock.signed \
  $NETWORK

# Wait for confirmation
cardano-cli query utxo \
  --address $ESCROW_ADDR \
  $NETWORK
```

### Step 4: Learner Attests Completion

```bash
# Query escrow UTXO
ESCROW_UTXO="<txhash>#<index>"

# Create updated datum with learner attestation
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

# Create redeemer for learner attestation
cat > redeemer-learner-attest.json <<EOF
{
  "constructor": 0,
  "fields": []
}
EOF

# Build transaction
cardano-cli transaction build \
  $NETWORK \
  --tx-in $ESCROW_UTXO \
  --tx-in-script-file escrow.plutus \
  --tx-in-datum-file escrow-datum-initial.json \
  --tx-in-redeemer-file redeemer-learner-attest.json \
  --tx-out $ESCROW_ADDR+$PRICE_LOVELACE \
  --tx-out-datum-embed-file escrow-datum-learner-attest.json \
  --change-address $LEARNER_ADDR \
  --out-file tx-learner-attest.raw

# Sign and submit
cardano-cli transaction sign \
  --tx-body-file tx-learner-attest.raw \
  --signing-key-file learner.skey \
  $NETWORK \
  --out-file tx-learner-attest.signed

cardano-cli transaction submit \
  --tx-file tx-learner-attest.signed \
  $NETWORK
```

### Step 5: Provider Attests Completion

```bash
# Create final datum with both attestations
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

# Create redeemer for provider attestation
cat > redeemer-provider-attest.json <<EOF
{
  "constructor": 1,
  "fields": []
}
EOF

# Build transaction
cardano-cli transaction build \
  $NETWORK \
  --tx-in $ESCROW_UTXO \
  --tx-in-script-file escrow.plutus \
  --tx-in-datum-file escrow-datum-learner-attest.json \
  --tx-in-redeemer-file redeemer-provider-attest.json \
  --tx-out $(cat provider.addr)+$PRICE_LOVELACE \
  --change-address $(cat provider.addr) \
  --out-file tx-provider-attest.raw

# Sign with provider key
cardano-cli transaction sign \
  --tx-body-file tx-provider-attest.raw \
  --signing-key-file provider.skey \
  $NETWORK \
  --out-file tx-provider-attest.signed

cardano-cli transaction submit \
  --tx-file tx-provider-attest.signed \
  $NETWORK
```

### Step 6: Complete Escrow (Both Attested)

```bash
# Create redeemer for completion
cat > redeemer-complete.json <<EOF
{
  "constructor": 2,
  "fields": []
}
EOF

# Build completion transaction
cardano-cli transaction build \
  $NETWORK \
  --tx-in $ESCROW_UTXO \
  --tx-in-script-file escrow.plutus \
  --tx-in-datum-file escrow-datum-final.json \
  --tx-in-redeemer-file redeemer-complete.json \
  --tx-out $(cat provider.addr)+$PRICE_LOVELACE \
  --change-address $(cat provider.addr) \
  --out-file tx-complete.raw

# Sign with both keys
cardano-cli transaction sign \
  --tx-body-file tx-complete.raw \
  --signing-key-file learner.skey \
  --signing-key-file provider.skey \
  $NETWORK \
  --out-file tx-complete.signed

cardano-cli transaction submit \
  --tx-file tx-complete.signed \
  $NETWORK
```

### Step 7: Refund (After 48 Hours)

```bash
# Calculate deadline (48 hours from lock time)
REFUND_DEADLINE=$(($LOCKED_AT / 1000 + 172800))  # 48 hours in seconds

# Create refund redeemer
cat > redeemer-refund.json <<EOF
{
  "constructor": 3,
  "fields": []
}
EOF

# Build refund transaction
cardano-cli transaction build \
  $NETWORK \
  --tx-in $ESCROW_UTXO \
  --tx-in-script-file escrow.plutus \
  --tx-in-datum-file escrow-datum-initial.json \
  --tx-in-redeemer-file redeemer-refund.json \
  --tx-out $LEARNER_ADDR+$PRICE_LOVELACE \
  --change-address $LEARNER_ADDR \
  --invalid-hereafter $REFUND_DEADLINE \
  --out-file tx-refund.raw

# Sign with learner key
cardano-cli transaction sign \
  --tx-body-file tx-refund.raw \
  --signing-key-file learner.skey \
  $NETWORK \
  --out-file tx-refund.signed

cardano-cli transaction submit \
  --tx-file tx-refund.signed \
  $NETWORK
```

## 2. NFT Minting Policy

### Step 1: Get Policy ID

```bash
# Get the policy ID
POLICY_ID=$(cardano-cli transaction policyid --script-file nft-policy.plutus)
echo "NFT Policy ID: $POLICY_ID"
```

### Step 2: Prepare Token Name

```bash
# Create token name
TOKEN_NAME="SkillForge-Session-${SESSION_ID}"

# Convert to hex for cardano-cli
TOKEN_NAME_HEX=$(echo -n "$TOKEN_NAME" | xxd -p | tr -d '\n')
echo "Token Name: $TOKEN_NAME"
echo "Token Name (Hex): $TOKEN_NAME_HEX"
```

### Step 3: Mint NFT (After Escrow is Settled)

```bash
# Query UTXOs
LEARNER_UTXO="<learner-txhash>#<index>"
ESCROW_UTXO="<escrow-txhash>#<index>"  # Must be the settled escrow UTXO

# Create minting redeemer
cat > redeemer-mint.json <<EOF
{
  "constructor": 0,
  "fields": []
}
EOF

# Build minting transaction
cardano-cli transaction build \
  $NETWORK \
  --tx-in $LEARNER_UTXO \
  --tx-in $ESCROW_UTXO \
  --tx-in-script-file escrow.plutus \
  --tx-in-datum-file escrow-datum-final.json \
  --tx-in-redeemer-file redeemer-complete.json \
  --mint "1 $POLICY_ID.$TOKEN_NAME_HEX" \
  --mint-script-file nft-policy.plutus \
  --mint-redeemer-file redeemer-mint.json \
  --tx-out $LEARNER_ADDR+2000000+"1 $POLICY_ID.$TOKEN_NAME_HEX" \
  --change-address $LEARNER_ADDR \
  --out-file tx-mint.raw

# Sign transaction
cardano-cli transaction sign \
  --tx-body-file tx-mint.raw \
  --signing-key-file learner.skey \
  $NETWORK \
  --out-file tx-mint.signed

# Submit transaction
cardano-cli transaction submit \
  --tx-file tx-mint.signed \
  $NETWORK
```

### Step 4: Verify NFT

```bash
# Query learner address to see the NFT
cardano-cli query utxo \
  --address $LEARNER_ADDR \
  $NETWORK

# Should show output with the NFT:
# <txhash>#<index> + 2000000 + 1 <POLICY_ID>.<TOKEN_NAME_HEX>
```

## Complete Workflow Example

```bash
#!/bin/bash
# Complete SkillForge workflow

NETWORK="--testnet-magic 1"
SESSION_ID="session_123"
PRICE_LOVELACE=80000000

# 1. Lock funds
echo "Step 1: Locking funds in escrow..."
# ... (use Step 3 commands)

# 2. Learner attests
echo "Step 2: Learner attesting..."
# ... (use Step 4 commands)

# 3. Provider attests
echo "Step 3: Provider attesting..."
# ... (use Step 5 commands)

# 4. Complete escrow
echo "Step 4: Completing escrow..."
# ... (use Step 6 commands)

# 5. Mint NFT
echo "Step 5: Minting NFT..."
# ... (use Step 3 of NFT section)

echo "Workflow complete!"
```

## Troubleshooting

### Common Issues

1. **"Script execution failed"**
   - Check that datum matches exactly
   - Verify redeemer is correct
   - Ensure time constraints are met

2. **"UTxO not found"**
   - Wait for transaction confirmation
   - Check address matches

3. **"Insufficient funds"**
   - Account for transaction fees
   - Ensure UTXO has enough ADA

4. **"Time range invalid"**
   - Check `--invalid-hereafter` value
   - Ensure 48 hours have passed for refund

## Notes

- All timestamps are in POSIXTime (milliseconds)
- 48 hours = 172,800,000 milliseconds
- Always check UTXO status before building transactions
- Transaction fees are typically 0.17-0.2 ADA
- NFT minting requires minimum 2 ADA in output

