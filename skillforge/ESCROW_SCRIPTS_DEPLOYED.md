# Escrow Scripts Deployed Successfully

## Date: November 30, 2025

## Issue
The backend was throwing "Escrow script not loaded" error because the compiled Plutus scripts were missing from the `skillforge/backend/contracts/` directory.

## Root Cause
The Aiken contracts were compiled and stored in `skillforge/contracts/skillforge/plutus.json`, but the backend expected individual `.plutus` files in `skillforge/backend/contracts/`.

## Solution
Created the required `.plutus` files by extracting the compiled code from `plutus.json`:

### Files Created:

1. **skillforge/backend/contracts/escrow.plutus**
   - Contains the compiled escrow validator
   - Script hash: `0b3dfaaaff7ceab43fc85c9fc3a36df4e873376e8e51996b6b15bfc7`
   - Compiled code from `escrow.escrow.spend` validator

2. **skillforge/backend/contracts/session_nft.plutus**
   - Contains the compiled NFT minting policy
   - Policy ID: `51029c9af654abe16777a98154a33c60a2229c3993a02632809fc4b6`
   - Compiled code from `session_nft.session_nft.mint` validator

## File Format

Each `.plutus` file follows this structure:
```json
{
  "type": "PlutusScriptV2",
  "description": "Script description",
  "cborHex": "compiled_script_hex"
}
```

## Verification

After creating the files and restarting the backend, the logs show:

```
✓ Aiken Escrow script loaded
  Script hash: 0b3dfaaaff7ceab43fc85c9fc3a36df4e873376e8e51996b6b15bfc7
✓ Aiken NFT minting policy loaded
  Policy ID: 51029c9af654abe16777a98154a33c60a2229c3993a02632809fc4b6
```

## Script Details

### Escrow Validator
- **Purpose**: Manages escrow funds with learner/mentor attestations
- **Redeemers**:
  - `AttestByLearner` (index 0)
  - `AttestByMentor` (index 1)
  - `ClaimFunds` (index 2)
  - `Refund` (index 3)
- **Datum**: Contains learner, mentor, price, session ID, attestation flags, and receiver address

### NFT Minting Policy
- **Purpose**: Mints unique session completion NFTs
- **Redeemer**: `Mint { session: ByteArray }` (index 0)
- **Validation**: Ensures exactly one token with quantity 1 is minted

## Status: ✅ DEPLOYED

Both Plutus scripts are now successfully loaded and ready for use. The escrow initialization can now proceed with building transactions.

## Next Steps

1. ✅ Scripts loaded
2. ✅ Address extraction fixed
3. ✅ Frontend parameters fixed
4. 🔄 Ready to test escrow initialization end-to-end

## Related Files
- Source: `skillforge/contracts/validators/escrow.ak`
- Source: `skillforge/contracts/validators/session_nft.ak`
- Compiled: `skillforge/contracts/skillforge/plutus.json`
- Deployed: `skillforge/backend/contracts/escrow.plutus`
- Deployed: `skillforge/backend/contracts/session_nft.plutus`
- Loader: `skillforge/backend/src/services/transactionBuilder.ts`
