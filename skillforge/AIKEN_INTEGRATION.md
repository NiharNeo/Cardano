# Aiken Integration Guide

## Overview

SkillForge has been upgraded to use **Aiken smart contracts** instead of Plutus V2 Haskell. Aiken provides a more modern, developer-friendly syntax while compiling to the same Plutus V2 format.

## Project Structure

```
skillforge/
├── contracts/                    # Aiken contracts
│   ├── aiken.toml               # Aiken project config
│   ├── validators/
│   │   └── escrow.ak            # Escrow validator
│   ├── minting_policies/
│   │   └── session_nft.ak      # NFT minting policy
│   └── build.sh                # Build script
├── backend/
│   ├── contracts/               # Compiled Plutus scripts (generated)
│   │   ├── escrow.plutus
│   │   └── session_nft.plutus
│   └── src/
│       ├── services/
│       │   └── cardano.ts       # Updated to load Aiken scripts
│       └── utils/
│           └── datumBuilder.ts  # Helper for datum/redeemer JSON
└── scripts/                     # Local testnet scripts
    ├── setup-local-testnet.sh
    ├── start-local-node.sh
    └── fund-test-address.sh
```

## Building Aiken Contracts

### Prerequisites

Install Aiken:
```bash
# macOS
brew install aiken-lang/aiken/aiken

# Or download from:
# https://github.com/aiken-lang/aiken/releases
```

### Build

```bash
cd contracts
chmod +x build.sh
./build.sh
```

This will:
1. Build all Aiken contracts
2. Export compiled `.plutus` files to `backend/contracts/`

## Contracts

### Escrow Validator

**File**: `contracts/validators/escrow.ak`

**Purpose**: Lock funds for mentoring sessions with dual attestation

**Datum**:
- `learner`: ByteArray (learner's public key hash)
- `mentor`: ByteArray (mentor's public key hash)
- `price`: Int (price in Lovelace)
- `session`: ByteArray (session ID)
- `learner_attested`: Bool
- `mentor_attested`: Bool

**Redeemers**:
- `AttestByLearner`: Learner attests session completion
- `AttestByMentor`: Mentor attests session completion
- `ClaimFunds`: Mentor claims funds (requires both attestations)
- `Refund`: Learner refunds after timeout

### NFT Minting Policy

**File**: `contracts/minting_policies/session_nft.ak`

**Purpose**: Mint unique NFT for each completed session

**Redeemer**:
- `Mint { session: ByteArray }`: Mint NFT for session

**Constraints**:
- Exactly 1 token minted per transaction
- Token name: `SkillForge-Session-{sessionId}`

## Backend Integration

### Loading Scripts

The backend automatically loads Aiken-compiled scripts on startup:

```typescript
// backend/src/services/cardano.ts
export function initializeScripts() {
  // Loads escrow.plutus and session_nft.plutus
  // Logs script hashes for verification
}
```

### Building Transactions

Use `datumBuilder.ts` helpers to build datum and redeemer JSON:

```typescript
import { buildEscrowDatum, buildEscrowRedeemer } from '../utils/datumBuilder';

const datum = buildEscrowDatum({
  learnerPubKeyHash: '...',
  mentorPubKeyHash: '...',
  priceLovelace: 100000000,
  sessionId: '...'
});

const redeemer = buildEscrowRedeemer('AttestByLearner');
```

## Local Testnet Setup

### Quick Start

```bash
# 1. Setup testnet
./scripts/setup-local-testnet.sh

# 2. Start local node
./scripts/start-local-node.sh

# 3. Fund test address
./scripts/fund-test-address.sh <address> 1000

# 4. Build contracts
cd contracts && ./build.sh
```

### Manual Setup

1. **Generate test keys**:
   ```bash
   cardano-cli address key-gen \
     --verification-key-file keys/payment.vkey \
     --signing-key-file keys/payment.skey
   ```

2. **Create address**:
   ```bash
   cardano-cli address build \
     --payment-verification-key-file keys/payment.vkey \
     --testnet-magic 42 \
     --out-file address.txt
   ```

3. **Fund address** (in local testnet, create genesis UTXO)

## Frontend Integration

### Aiken Info Component

The frontend displays Aiken contract information:

- **Escrow Validator Hash**: Shows the script hash
- **NFT Policy ID**: Shows the minting policy ID
- **Version**: Shows Aiken version

Access via: `GET /contracts/info`

## Deployment to Preprod

### 1. Build Contracts

```bash
cd contracts
aiken build
```

### 2. Export Scripts

```bash
cp build/validators/escrow.plutus ../backend/contracts/
cp build/minting_policies/session_nft.plutus ../backend/contracts/
```

### 3. Deploy to Preprod

```bash
# Set environment variables
export CARDANO_NETWORK=preprod
export BLOCKFROST_PROJECT_ID=your_preprod_key

# Start backend
cd backend
npm run dev
```

### 4. Verify Scripts

Check backend logs for:
```
✓ Aiken Escrow script loaded
  Script hash: <hash>
✓ Aiken NFT minting policy loaded
  Policy ID: <policy_id>
```

## Helper Scripts

### Generate Datum JSON

```typescript
import { buildEscrowDatum } from './utils/datumBuilder';

const datum = buildEscrowDatum({
  learnerPubKeyHash: 'abc123...',
  mentorPubKeyHash: 'def456...',
  priceLovelace: 100000000,
  sessionId: 'session-uuid'
});

console.log(JSON.stringify(datum, null, 2));
```

### Generate Redeemer JSON

```typescript
import { buildEscrowRedeemer } from './utils/datumBuilder';

const redeemer = buildEscrowRedeemer('ClaimFunds');
console.log(JSON.stringify(redeemer, null, 2));
```

## Troubleshooting

### Scripts Not Found

**Error**: `⚠ Escrow script not found`

**Solution**:
```bash
cd contracts
./build.sh
```

### Build Fails

**Error**: `aiken: command not found`

**Solution**: Install Aiken:
```bash
brew install aiken-lang/aiken/aiken
```

### Script Hash Mismatch

**Error**: Script hash doesn't match expected value

**Solution**: Rebuild contracts and restart backend:
```bash
cd contracts && ./build.sh
# Restart backend
```

## API Endpoints

### GET /contracts/info

Returns Aiken contract information:

```json
{
  "success": true,
  "data": {
    "contracts": "Aiken",
    "version": "1.0.0",
    "escrowValidatorHash": "abc123...",
    "nftPolicyId": "def456..."
  }
}
```

## Migration from Plutus

If migrating from Plutus V2 Haskell:

1. **Contracts**: Replace `.hs` files with `.ak` files
2. **Build**: Use `aiken build` instead of `cabal build`
3. **Scripts**: Same `.plutus` format (compatible)
4. **Backend**: No changes needed (loads same format)

## Resources

- [Aiken Documentation](https://aiken-lang.org/)
- [Aiken GitHub](https://github.com/aiken-lang/aiken)
- [Cardano Serialization Library](https://github.com/Emurgo/cardano-serialization-lib)

