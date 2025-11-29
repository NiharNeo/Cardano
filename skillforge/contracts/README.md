# SkillForge Aiken Contracts

This directory contains the Aiken smart contracts for SkillForge.

## Structure

```
contracts/
├── aiken.toml              # Aiken project configuration
├── validators/
│   └── escrow.ak           # Escrow validator
├── minting_policies/
│   └── session_nft.ak      # NFT minting policy
└── build.sh                # Build script
```

## Building Contracts

### Prerequisites

Install Aiken:
```bash
# macOS
brew install aiken-lang/aiken/aiken

# Or download from: https://github.com/aiken-lang/aiken/releases
```

### Build

```bash
cd contracts
./build.sh
```

This will:
1. Build all Aiken contracts
2. Export compiled `.plutus` files to `backend/contracts/`

## Contracts

### Escrow Validator

**Purpose**: Lock funds for a mentoring session

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

### Session NFT Minting Policy

**Purpose**: Mint unique NFT for each completed session

**Redeemer**:
- `Mint { session: ByteArray }`: Mint NFT for session

**Constraints**:
- Exactly 1 token minted
- Token name: `SkillForge-Session-{sessionId}`

## Usage

After building, the compiled scripts are available at:
- `backend/contracts/escrow.plutus`
- `backend/contracts/session_nft.plutus`

These are automatically loaded by the backend on startup.
