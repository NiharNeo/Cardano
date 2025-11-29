# Aiken Smart Contract Integration Guide

## Overview

The SkillForge dApp has been upgraded from Plutus V2 Haskell to **Aiken smart contracts**. This document describes the complete integration and how to build, deploy, and use the contracts.

## Project Structure

```
skillforge/
├── contracts/
│   └── skillforge/
│       ├── aiken.toml              # Aiken project configuration
│       ├── build.sh                 # Build script
│       ├── validators/
│       │   └── escrow.ak           # Escrow validator contract
│       └── minting_policies/
│           └── session_nft.ak      # NFT minting policy
├── backend/
│   ├── contracts/                  # Compiled scripts (generated)
│   │   ├── escrow.plutus
│   │   └── session_nft.plutus
│   └── src/
│       ├── services/
│       │   ├── cardano.ts          # Script loading & Cardano utilities
│       │   └── transactionBuilder.ts  # Transaction building with Aiken scripts
│       └── utils/
│           ├── loadScript.ts       # Script loader utility
│           └── datumBuilder.ts     # Datum/redeemer builders
└── frontend/
    └── src/
        └── components/
            └── AikenInfo.tsx       # UI component showing contract hashes
```

## Contracts

### 1. Escrow Validator (`validators/escrow.ak`)

**Purpose**: Manages ADA escrow with dual attestation and timed refunds.

**Datum Structure**:
```aiken
datum EscrowDatum {
  learner : ByteArray          # Learner's public key hash
  mentor  : ByteArray          # Mentor's public key hash
  price   : Int                # Price in Lovelace
  session : ByteArray          # Session ID (UUID as bytes)
  learner_attested : Bool      # Learner attestation status
  mentor_attested  : Bool      # Mentor attestation status
}
```

**Redeemer Actions**:
- `AttestByLearner` (index 0): Learner attests session completion
- `AttestByMentor` (index 1): Mentor attests session completion
- `ClaimFunds` (index 2): Mentor claims funds after both attest
- `Refund` (index 3): Learner refunds if timeout reached

**Logic**:
- Attest actions can only be called once per party
- Claim requires both attestations and mentor signature
- Refund available after validity interval expires

### 2. NFT Minting Policy (`minting_policies/session_nft.ak`)

**Purpose**: Mints exactly one NFT per completed session.

**Redeemer Structure**:
```aiken
redeemer MintRedeemer {
  Mint { session : ByteArray }
}
```

**Logic**:
- Ensures exactly one token is minted per transaction
- Session ID is embedded in the redeemer

## Building Contracts

### Prerequisites

1. **Install Aiken**:
   ```bash
   # macOS
   brew install aiken-lang/aiken/aiken
   
   # Or download from: https://github.com/aiken-lang/aiken/releases
   ```

2. **Verify installation**:
   ```bash
   aiken --version
   ```

### Build Process

1. **Navigate to contracts directory**:
   ```bash
   cd skillforge/contracts/skillforge
   ```

2. **Run build script**:
   ```bash
   ./build.sh
   ```

   This will:
   - Run `aiken build` to compile contracts
   - Copy compiled `.plutus` files to `backend/contracts/`
   - Display script hashes

3. **Verify output**:
   ```bash
   ls -la ../../backend/contracts/*.plutus
   ```

   You should see:
   - `escrow.plutus`
   - `session_nft.plutus`

## Backend Integration

### Script Loading

Scripts are automatically loaded when the backend starts:

```typescript
// backend/src/services/cardano.ts
initializeScripts(); // Called in index.ts
```

**Script Paths** (configurable via environment variables):
- `ESCROW_SCRIPT_PATH` (default: `backend/contracts/escrow.plutus`)
- `NFT_POLICY_SCRIPT_PATH` (default: `backend/contracts/session_nft.plutus`)

### Transaction Building

The backend uses `transactionBuilder.ts` to build transactions with Aiken scripts:

#### Escrow Init Transaction

```typescript
const { txHex, scriptAddress, datum } = await buildEscrowInitTx({
  learnerAddress: string,
  mentorAddress: string,
  learnerPubKeyHash: string,  // Hex-encoded
  mentorPubKeyHash: string,  // Hex-encoded
  priceLovelace: number,
  sessionId: string,         // UUID
  learnerUTXOs: any[]
});
```

**Datum Encoding**:
- Aiken records are compiled as constructor 0 with fields in order
- Bools are encoded as constructors: `false = 0`, `true = 1`
- ByteArrays are hex-encoded strings converted to bytes

#### Escrow Attest Transaction

```typescript
const { txHex } = await buildEscrowAttestTx({
  scriptUTXO: string,        // Format: "txHash#index"
  redeemerType: 'AttestByLearner' | 'AttestByMentor',
  signerAddress: string,
  signerUTXOs: any[]
});
```

**Redeemer Encoding**:
- Enum variants use constructor indices:
  - `AttestByLearner` = 0
  - `AttestByMentor` = 1
  - `ClaimFunds` = 2
  - `Refund` = 3

#### NFT Mint Transaction

```typescript
const { txHex, policyId, assetName } = await buildNFTMintTx({
  sessionId: string,
  learnerAddress: string,
  learnerUTXOs: any[],
  escrowUTXO?: string
});
```

**Redeemer Encoding**:
- `Mint { session }` is constructor 0 with one field (session bytes)

## API Endpoints

### POST /escrow/init

Builds escrow initialization transaction.

**Request**:
```json
{
  "learnerAddress": "addr_test1...",
  "mentorAddress": "addr_test1...",
  "price": 10.5,
  "sessionId": "uuid-here",
  "stakeKey": "stake1..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "txBody": "hex-encoded-transaction",
    "escrowAddress": "addr_test1...",
    "datum": { ... }
  }
}
```

### POST /nft/mint

Builds NFT minting transaction.

**Request** (multipart/form-data):
- `sessionId`: string
- `eventCardImage`: File (optional PNG)

**Response**:
```json
{
  "success": true,
  "data": {
    "txBody": "hex-encoded-transaction",
    "policyId": "hex-policy-id",
    "assetName": "SkillForge-Session-{sessionId}",
    "ipfsCid": "Qm...",
    "imageCid": "Qm...",
    "metadataUrl": "https://gateway.pinata.cloud/ipfs/...",
    "imageUrl": "https://gateway.pinata.cloud/ipfs/..."
  }
}
```

## Frontend Integration

The frontend displays contract information via the `AikenInfo` component:

```tsx
<AikenInfo 
  escrowValidatorHash={wallet.escrowState?.scriptAddress || getEscrowValidatorHash()}
  nftPolicyId={getNFTPolicyId()}
/>
```

## Testing

### Local Devnet

1. **Start local Cardano cluster** (see `devnet/` directory):
   ```bash
   cd skillforge/devnet
   docker-compose up -d
   ```

2. **Build and deploy contracts**:
   ```bash
   cd ../contracts/skillforge
   ./build.sh
   cd ../../devnet
   ./deploy-contracts.sh
   ```

3. **Start backend** (configured for local network):
   ```bash
   cd ../../backend
   NETWORK=local npm run dev
   ```

### Preprod Testnet

1. **Configure environment**:
   ```bash
   # backend/.env
   CARDANO_NETWORK=testnet
   BLOCKFROST_PROJECT_ID=your_preprod_project_id
   BLOCKFROST_BASE_URL=https://cardano-preprod.blockfrost.io/api/v0
   ```

2. **Build contracts**:
   ```bash
   cd contracts/skillforge
   ./build.sh
   ```

3. **Deploy to preprod**:
   ```bash
   # Use cardano-cli to submit transactions
   cardano-cli transaction submit \
     --testnet-magic 1 \
     --tx-file escrow-init.signed
   ```

## Troubleshooting

### Script Not Found

**Error**: `⚠ Escrow script not found at: ...`

**Solution**:
1. Run `./build.sh` in `contracts/skillforge/`
2. Verify files exist: `ls -la backend/contracts/*.plutus`
3. Check `ESCROW_SCRIPT_PATH` environment variable

### Invalid Datum/Redeemer

**Error**: Transaction fails with "Invalid datum" or "Invalid redeemer"

**Solution**:
1. Verify datum structure matches Aiken record order
2. Check redeemer constructor indices match enum order
3. Ensure ByteArrays are correctly hex-encoded

### Transaction Building Fails

**Error**: `TransactionBuilder.new()` throws error

**Solution**:
1. Check protocol parameters are correctly formatted
2. Verify UTXO format matches expected structure
3. Ensure sufficient funds for fees and min UTXO

## Next Steps

1. **Complete Protocol Parameters Integration**: Convert Blockfrost/Ogmios protocol parameters to CSL format
2. **Add UTXO Selection Algorithm**: Implement proper UTXO selection for optimal fee calculation
3. **Add Collateral Handling**: Implement collateral UTXO selection for Plutus transactions
4. **Add Transaction Validation**: Validate transactions before submission
5. **Add Error Recovery**: Implement retry logic for failed transactions

## References

- [Aiken Documentation](https://aiken-lang.org/)
- [Cardano Serialization Library](https://github.com/Emurgo/cardano-serialization-lib)
- [Plutus Data Formats](https://plutus.readthedocs.io/en/latest/plutus/how-to-write-plutus-apps/Plutus-transactions.html)
