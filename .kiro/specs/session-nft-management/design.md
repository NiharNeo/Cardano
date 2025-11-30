# Design Document

## Overview

The Session NFT Management System mints unique commemorative NFTs on the Cardano blockchain for completed SkillForge mentoring sessions. The system integrates a Plutus minting policy written in Aiken that enforces single-token minting, an IPFS-based metadata storage layer for decentralized content, and a backend service that constructs mint transactions and manages NFT state. Each NFT serves as an immutable proof of completion with rich metadata including session details, participant information, and timestamps.

## Architecture

### System Components

1. **Plutus Minting Policy (session_nft.ak)**
   - On-chain validation ensuring exactly one NFT per mint
   - Validates token quantity and policy uniqueness
   - Written in Aiken and compiled to Plutus V2

2. **Transaction Builder Service (transactionBuilder.ts)**
   - Constructs unsigned NFT mint transactions
   - Handles multi-asset value creation
   - Manages redeemer encoding for minting policy

3. **IPFS Integration Service**
   - Uploads NFT metadata JSON to IPFS
   - Uploads session images to IPFS
   - Returns content identifiers (CIDs) for immutable references

4. **NFT API Routes**
   - REST endpoints for minting and status queries
   - Database state management for minted NFTs
   - Integration with session and escrow systems

5. **Database Layer**
   - PostgreSQL table: nft_metadata
   - Tracks minting status, IPFS hashes, and metadata

### Data Flow

```
Learner Wallet (CIP-30)
    ↓ (1) Request NFT mint
Backend API (/nft/mint)
    ↓ (2) Verify session completed
Database (sessions, escrow_state)
    ↓ (3) Generate metadata
Metadata Builder
    ↓ (4) Upload to IPFS
IPFS Network
    ↓ (5) Return CID
Backend API
    ↓ (6) Build mint transaction
Transaction Builder
    ↓ (7) Return unsigned tx
Learner Wallet
    ↓ (8) Sign & submit
Cardano Blockchain
    ↓ (9) NFT minted to learner
Database (nft_metadata)
    ↓ (10) Update minted status
```

## Components and Interfaces

### Plutus Minting Policy Interface

**Redeemer Structure (NFTRedeemer)**
```aiken
pub type NFTRedeemer {
  Mint { session: ByteArray }  // Constructor index 0
}
```

**Validator Logic**
```aiken
mint(redeemer: NFTRedeemer, policy_id: PolicyId, tx: Transaction) {
  expect Mint { session: _ } = redeemer
  
  // Get all minted assets for this policy
  let minted_with_policy = tx.mint
    |> assets.tokens(policy_id)
    |> dict.to_pairs()
  
  // Ensure exactly one asset with quantity 1
  list.length(minted_with_policy) == 1 && {
    expect [Pair(_, quantity)] = minted_with_policy
    quantity == 1
  }
}
```

**Validation Rules**
- Exactly one asset name must be minted per transaction
- The minted quantity must equal 1
- The session identifier in redeemer can be any ByteArray

### Transaction Builder Interface

**buildNFTMintTx**
```typescript
Input: {
  sessionId: string,
  learnerAddress: string,
  learnerUTXOs: UTXO[],
  escrowUTXO?: string
}
Output: {
  txHex: string,
  policyId: string,
  assetName: string
}
```

**Implementation Details**
- Policy ID derived from script hash
- Asset name format: `SkillForge-Session-{sessionId}`
- Redeemer includes session ID as ByteArray
- Output includes minted NFT in multi-asset value
- Minimum UTXO amount: 2 ADA

### IPFS Integration Interface

**uploadMetadata**
```typescript
Input: {
  sessionId: string,
  skill: string,
  learnerAddress: string,
  providerAddress: string,
  duration: number,
  budget: number,
  completedAt: Date
}
Output: {
  metadataCID: string,
  metadataJSON: object
}
```

**uploadImage**
```typescript
Input: {
  imageBuffer: Buffer,
  fileName: string
}
Output: {
  imageCID: string
}
```

**Metadata Structure (CIP-25 Compliant)**
```json
{
  "721": {
    "{policyId}": {
      "{assetName}": {
        "name": "SkillForge Session Completion",
        "image": "ipfs://{imageCID}",
        "description": "Proof of completion for {skill} mentoring session",
        "attributes": {
          "Session ID": "{sessionId}",
          "Skill": "{skill}",
          "Duration": "{duration} minutes",
          "Budget": "{budget} ADA",
          "Learner": "{learnerAddress}",
          "Mentor": "{providerAddress}",
          "Completed": "{completedAt}"
        }
      }
    }
  }
}
```

### REST API Interface

**POST /nft/mint**
- Request: `{ sessionId, learnerAddress }`
- Response: `{ txHex, policyId, assetName, ipfsCid, imageCid, metadataUrl, imageUrl }`
- Validates session is completed or paid
- Checks NFT not already minted
- Generates and uploads metadata to IPFS
- Builds mint transaction
- Updates nft_metadata table

**GET /nft/status/:sessionId**
- Response: `{ minted, ipfsHash, imageCid, metadataJson, mintedAt }`
- Returns minting status for a session
- Includes IPFS references if minted

**POST /nft/metadata/:sessionId**
- Response: `{ metadataJson, ipfsUrl, imageUrl }`
- Returns metadata without minting
- Useful for preview before minting

## Data Models

### Database Schema

**nft_metadata table**
```sql
session_id: uuid PRIMARY KEY REFERENCES sessions(id)
ipfs_hash: text
image_cid: text
metadata_json: jsonb
minted: boolean DEFAULT false
minted_at: timestamp
```

**Indexes**
- `idx_nft_metadata_ipfs_hash` on ipfs_hash
- `idx_nft_metadata_image_cid` on image_cid
- `idx_nft_metadata_minted` on minted

### TypeScript Types

```typescript
interface NFTMintRequest {
  sessionId: string;
  learnerAddress: string;
}

interface NFTMintResponse {
  txBody: string;
  policyId: string;
  assetName: string;
  ipfsCid: string;
  imageCid?: string;
  metadataUrl: string;
  imageUrl?: string;
}

interface NFTMetadata {
  session_id: string;
  ipfs_hash: string | null;
  image_cid: string | null;
  metadata_json: any | null;
  minted: boolean;
  minted_at: Date | null;
}
```

### Cardano Serialization Library Types

**Asset Name Construction**
```typescript
// Format: SkillForge-Session-{sessionId}
const assetName = `SkillForge-Session-${sessionId}`;
const assetNameBytes = Buffer.from(assetName, 'utf8');
const assetNameCSL = Cardano.AssetName.new(assetNameBytes);
```

**Policy ID Derivation**
```typescript
// Load minting policy script
const policyScript = Cardano.PlutusScript.from_bytes(scriptBytes);

// Calculate policy ID from script hash
const policyId = Buffer.from(policyScript.hash().to_bytes()).toString('hex');
```

**Redeemer Construction (Aiken Format)**
```typescript
// Mint { session: ByteArray } is constructor 0 with one field
const sessionBytes = sessionIdToBytes(sessionId);
const redeemerFields = Cardano.PlutusList.new();
redeemerFields.add(Cardano.PlutusData.new_bytes(sessionBytes));

const redeemer = Cardano.PlutusData.new_constr_plutus_data(
  Cardano.ConstrPlutusData.new(
    Cardano.BigNum.from_str('0'),
    redeemerFields
  )
);
```

**Multi-Asset Value Creation**
```typescript
// Create value with ADA + NFT
const outputValue = Cardano.Value.new(
  Cardano.BigNum.from_str('2000000') // 2 ADA minimum
);

// Add NFT to multi-asset
const multiAsset = Cardano.MultiAsset.new();
const assets = Cardano.Assets.new();
assets.insert(
  assetNameCSL,
  Cardano.BigNum.from_str('1') // Quantity 1
);
multiAsset.insert(
  Cardano.ScriptHash.from_bytes(Buffer.from(policyId, 'hex')),
  assets
);
outputValue.set_multiasset(multiAsset);
```

**Mint Operation**
```typescript
const mint = Cardano.Mint.new();
mint.set(
  Cardano.ScriptHash.from_bytes(Buffer.from(policyId, 'hex')),
  assetNameCSL,
  Cardano.Int.new_i32(1) // Mint 1 token
);
txBuilder.set_mint(mint);
```

### Session ID to ByteArray Conversion

```typescript
function sessionIdToBytes(sessionId: string): Uint8Array {
  // Remove dashes from UUID: "550e8400-e29b-41d4-a716-446655440000"
  // Becomes: "550e8400e29b41d4a716446655440000"
  const hex = sessionId.replace(/-/g, '');
  return Buffer.from(hex, 'hex');
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mint requires completed session

*For any* NFT mint request, the system SHALL only proceed if the session status is 'completed' or 'paid'.

**Validates: Requirements 1.1, 9.1**

### Property 2: Mint creates exactly one token

*For any* NFT mint transaction, the transaction SHALL mint exactly one asset with quantity 1 for the policy ID.

**Validates: Requirements 1.2, 2.1, 2.2**

### Property 3: Redeemer contains session ID

*For any* NFT mint transaction, the redeemer SHALL be a PlutusData constructor with index 0 containing the session ID as a ByteArray field.

**Validates: Requirements 1.3, 5.2**

### Property 4: NFT sent to learner

*For any* NFT mint transaction, the output containing the minted NFT SHALL be sent to the learner's address.

**Validates: Requirements 1.4**

### Property 5: Database updated after mint

*For any* successful NFT mint, querying the nft_metadata table SHALL return minted=true and a non-null minted_at timestamp.

**Validates: Requirements 1.5**

### Property 6: Validator rejects multiple assets

*For any* mint transaction attempting to mint more than one asset name for the policy, the validator SHALL reject the transaction.

**Validates: Requirements 2.3**

### Property 7: Validator rejects wrong quantity

*For any* mint transaction with quantity other than 1, the validator SHALL reject the transaction.

**Validates: Requirements 2.4**

### Property 8: Validator accepts valid ByteArray

*For any* redeemer with a valid ByteArray session field, the validator SHALL accept the transaction (assuming other conditions are met).

**Validates: Requirements 2.5**

### Property 9: Metadata contains all required fields

*For any* generated NFT metadata, the JSON SHALL include session ID, skill, learner address, provider address, duration, budget, and completion timestamp.

**Validates: Requirements 3.1**

### Property 10: Metadata conforms to CIP-25

*For any* generated NFT metadata, the JSON structure SHALL have a top-level "721" key containing policy ID and asset name nested objects.

**Validates: Requirements 3.2**

### Property 11: IPFS upload returns CID

*For any* metadata upload to IPFS, the system SHALL receive and return a valid content identifier (CID).

**Validates: Requirements 3.3**

### Property 12: Image included when available

*For any* NFT mint with an available image, the metadata SHALL include an "image" field with the IPFS CID reference.

**Validates: Requirements 3.4**

### Property 13: Metadata stored in database

*For any* NFT mint, the nft_metadata table SHALL contain the IPFS hash, image CID (if applicable), and metadata JSON.

**Validates: Requirements 3.5**

### Property 14: Asset name follows format

*For any* session ID, the generated asset name SHALL match the pattern 'SkillForge-Session-{sessionId}'.

**Validates: Requirements 4.1**

### Property 15: Session ID converts correctly

*For any* UUID session ID, converting to bytes SHALL produce a 16-byte array after removing dashes and converting from hex.

**Validates: Requirements 4.2**

### Property 16: Asset name encoded as UTF-8

*For any* asset name string, the encoded bytes SHALL be valid UTF-8 representation.

**Validates: Requirements 4.3**

### Property 17: Policy ID derived from script hash

*For any* minting policy script, the policy ID SHALL equal the hex-encoded hash of the script bytes.

**Validates: Requirements 4.4**

### Property 18: Response includes policy ID and asset name

*For any* NFT mint response, both policyId and assetName fields SHALL be present and non-empty.

**Validates: Requirements 4.5**

### Property 19: Minting script loaded successfully

*For any* NFT mint operation, the minting policy script SHALL be loaded and non-null before constructing the transaction.

**Validates: Requirements 5.1**

### Property 20: Mint operation specifies correct parameters

*For any* mint transaction, the mint operation SHALL specify the policy ID, asset name, and quantity of 1.

**Validates: Requirements 5.3**

### Property 21: Output includes NFT with minimum ADA

*For any* mint transaction output, the value SHALL include the minted NFT in a multi-asset structure and at least 2 ADA (2,000,000 Lovelace).

**Validates: Requirements 5.4**

### Property 22: Transaction builder returns complete response

*For any* successful mint transaction build, the response SHALL include txHex, policyId, assetName, and IPFS metadata URLs.

**Validates: Requirements 5.5**

### Property 23: Status query returns minted flag

*For any* NFT status query, the response SHALL include a boolean minted field.

**Validates: Requirements 6.1**

### Property 24: Minted NFT status includes all fields

*For any* minted NFT status query, the response SHALL include ipfsHash, imageCid, metadataJson, and mintedAt.

**Validates: Requirements 6.2**

### Property 25: Unminted NFT status has null IPFS fields

*For any* unminted NFT status query, the response SHALL have minted=false and null values for ipfsHash, imageCid, and mintedAt.

**Validates: Requirements 6.3**

### Property 26: Metadata CID associated on-chain

*For any* minted NFT, the on-chain transaction SHALL reference the metadata CID in the token metadata.

**Validates: Requirements 7.2**

### Property 27: IPFS URLs constructed correctly

*For any* stored IPFS CID, the constructed gateway URL SHALL follow the format 'https://ipfs.io/ipfs/{CID}'.

**Validates: Requirements 7.3**

### Property 28: Image referenced by CID in metadata

*For any* NFT with an image, the metadata JSON SHALL contain an "image" field with value 'ipfs://{imageCID}'.

**Validates: Requirements 7.4**

### Property 29: Metadata query returns hash and JSON

*For any* metadata query for a minted NFT, the response SHALL include both the IPFS hash string and the full metadata JSON object.

**Validates: Requirements 7.5**

### Property 30: Duplicate check queries database

*For any* NFT mint request, the system SHALL query the nft_metadata table to check if minted=true for the session.

**Validates: Requirements 8.1**

### Property 31: Minted flag updated atomically

*For any* successful mint transaction submission, the database update setting minted=true SHALL occur atomically.

**Validates: Requirements 8.3**

### Property 32: Failed mint preserves status

*For any* failed mint transaction, the minted flag in the database SHALL remain false.

**Validates: Requirements 8.5**

### Property 33: Completed sessions can mint

*For any* session with status 'completed', the system SHALL allow NFT minting regardless of escrow settlement status.

**Validates: Requirements 9.3**

### Property 34: Minting proceeds when conditions met

*For any* session with status 'completed' or 'paid' and no existing minted NFT, the system SHALL proceed with building the mint transaction.

**Validates: Requirements 9.4**

### Property 35: Minting preserves session status

*For any* successful NFT mint, the session status and escrow status SHALL remain unchanged.

**Validates: Requirements 9.5**

## Error Handling

### Transaction Building Errors

1. **Minting Policy Not Loaded**
   - Error: "NFT policy script not loaded"
   - Cause: Plutus script file missing or invalid
   - Recovery: Check contracts directory and rebuild Aiken contracts

2. **Invalid Session ID Format**
   - Error: "Invalid session ID format"
   - HTTP Status: 400
   - Cause: Session ID is not a valid UUID
   - Recovery: Provide valid UUID format

3. **Insufficient UTXOs**
   - Error: "No UTXOs found for learner address"
   - HTTP Status: 400
   - Cause: Learner has no UTXOs or insufficient funds
   - Recovery: Ensure learner has at least 3 ADA for minting

### Validation Errors

1. **Session Not Found**
   - Error: "Session not found"
   - HTTP Status: 404
   - Cause: Invalid session ID
   - Recovery: Verify session exists

2. **Session Not Completed**
   - Error: "Session not yet completed"
   - HTTP Status: 400
   - Cause: Session status is 'initiated' or 'active'
   - Recovery: Wait for session completion

3. **NFT Already Minted**
   - Error: "NFT already minted for this session"
   - HTTP Status: 400
   - Cause: Duplicate mint attempt
   - Recovery: Query existing NFT status

4. **Missing Required Fields**
   - Error: "Missing required fields: {fields}"
   - HTTP Status: 400
   - Cause: Request missing sessionId or learnerAddress
   - Recovery: Include all required fields

### IPFS Errors

1. **Metadata Upload Failed**
   - Error: "Failed to upload metadata to IPFS"
   - HTTP Status: 500
   - Cause: IPFS service unavailable or network error
   - Recovery: Retry upload or check IPFS service status

2. **Image Upload Failed**
   - Error: "Failed to upload image to IPFS"
   - HTTP Status: 500
   - Cause: IPFS service unavailable or invalid image
   - Recovery: Retry upload or verify image format

3. **Invalid CID**
   - Error: "Invalid IPFS CID returned"
   - HTTP Status: 500
   - Cause: IPFS returned malformed CID
   - Recovery: Retry upload

### Database Errors

1. **Database Query Failed**
   - HTTP Status: 500
   - Cause: Database connection or query error
   - Recovery: Check database connectivity and logs

2. **Concurrent Mint Conflict**
   - Error: "NFT mint already in progress"
   - HTTP Status: 409
   - Cause: Concurrent mint requests for same session
   - Recovery: Wait and retry or check mint status

### On-Chain Validation Errors

1. **Multiple Assets Minted**
   - Cause: Transaction attempts to mint more than one asset
   - Result: Validator rejects transaction
   - Recovery: Ensure mint operation specifies exactly one asset

2. **Wrong Quantity**
   - Cause: Transaction mints quantity other than 1
   - Result: Validator rejects transaction
   - Recovery: Set mint quantity to exactly 1

3. **Invalid Redeemer**
   - Cause: Redeemer missing session field or wrong format
   - Result: Validator rejects transaction
   - Recovery: Verify redeemer construction matches Aiken format

## Testing Strategy

### Unit Testing

**Transaction Builder Tests**
- Test asset name generation with various session IDs
- Test session ID to ByteArray conversion
- Test policy ID derivation from script hash
- Test redeemer construction with Mint variant
- Test multi-asset value creation with NFT
- Test mint operation with correct parameters
- Test minimum UTXO calculation

**Metadata Generation Tests**
- Test CIP-25 JSON structure generation
- Test metadata includes all required fields
- Test image CID inclusion when available
- Test metadata without image
- Test special characters in skill names
- Test various date formats for completion timestamp

**API Endpoint Tests**
- Test /nft/mint with valid session
- Test /nft/mint with incomplete session (should fail)
- Test /nft/mint with already minted NFT (should fail)
- Test /nft/mint with missing fields (should fail)
- Test /nft/status for minted NFT
- Test /nft/status for unminted NFT
- Test /nft/status for non-existent session (should return 404)
- Test /nft/metadata preview

**Database Integration Tests**
- Test nft_metadata record creation
- Test minted flag update
- Test duplicate mint prevention
- Test concurrent mint attempts
- Test transaction rollback on errors

### Property-Based Testing

The system will use **fast-check** (JavaScript/TypeScript property-based testing library) to verify correctness properties. Each property test will run a minimum of 100 iterations with randomly generated inputs.

**Property Test Structure**
```typescript
import fc from 'fast-check';

// Example property test
fc.assert(
  fc.property(
    fc.uuid(), // session ID
    fc.string(), // learner address
    fc.array(fc.record({ /* UTXO structure */ })), // UTXOs
    async (sessionId, learnerAddr, utxos) => {
      // Test property implementation
      const result = await buildNFTMintTx({
        sessionId,
        learnerAddress: learnerAddr,
        learnerUTXOs: utxos
      });
      expect(result.policyId).toBeDefined();
      expect(result.assetName).toMatch(/^SkillForge-Session-/);
    }
  ),
  { numRuns: 100 }
);
```

**Generators**
- Valid UUIDs for session IDs
- Bech32 addresses (testnet and mainnet)
- UTXO arrays with varying quantities and amounts
- Session metadata with different skills, durations, budgets
- Session statuses ('initiated', 'active', 'completed', 'paid')
- IPFS CIDs (valid base58 strings)
- Metadata JSON structures
- Image buffers and file names

**Property Test Coverage**
- Properties 1-35 will each have a dedicated property-based test
- Each test will be tagged with: `**Feature: session-nft-management, Property {N}: {description}**`
- Tests will validate both success cases and expected failures
- Edge cases (duplicate mints, incomplete sessions) will be handled by generators

### Integration Testing

**End-to-End NFT Minting Flow**
1. Complete a mentoring session
2. Settle escrow payment
3. Request NFT mint
4. Verify metadata uploaded to IPFS
5. Submit mint transaction to blockchain
6. Verify NFT appears in learner's wallet
7. Verify database reflects minted status
8. Query NFT metadata from IPFS

**Duplicate Prevention Flow**
1. Mint NFT for a session
2. Attempt to mint again (should fail)
3. Verify only one NFT exists
4. Verify database shows minted=true

**Error Scenarios**
1. Attempt mint for incomplete session (should fail with 400)
2. Attempt mint with invalid session ID (should fail with 404)
3. Attempt mint with insufficient funds (should fail)
4. Test IPFS upload failure handling
5. Test database constraint violations

### Smart Contract Testing

**Aiken Unit Tests**
- Test minting exactly one token (should succeed)
- Test minting multiple tokens (should fail)
- Test minting quantity 0 (should fail)
- Test minting quantity 2 (should fail)
- Test with various session ID ByteArrays (should succeed)
- Test with empty redeemer (should fail)

**Plutus Minting Policy Tests**
- Deploy policy to testnet
- Submit mint transaction with valid parameters
- Verify token appears on-chain
- Attempt invalid mints and verify rejection
- Test policy ID derivation
- Verify script execution costs

### IPFS Integration Testing

**Metadata Upload Tests**
- Upload valid CIP-25 metadata
- Verify CID is returned
- Retrieve metadata from IPFS gateway
- Verify content matches uploaded data
- Test with large metadata (>1MB)
- Test with special characters

**Image Upload Tests**
- Upload various image formats (PNG, JPG, SVG)
- Verify image CID is returned
- Retrieve image from IPFS gateway
- Test with large images (>10MB)
- Test with invalid image data (should fail)

### Test Execution Strategy

1. **Development**: Run unit tests and property tests on every code change
2. **Pre-commit**: Run full test suite including integration tests
3. **CI/CD**: Run all tests plus smart contract tests on testnet
4. **Pre-deployment**: Run end-to-end tests with real IPFS and testnet
5. **Monitoring**: Track mint success rates and IPFS availability in production
