# SkillForge Plutus V2 Contracts Summary

## Contracts Created

### 1. Escrow Contract (`Escrow.hs`)

**Purpose:** Manages escrow payments between learners and providers with dual attestation requirement.

**Key Features:**
- Parameters: `learnerPubKeyHash`, `providerPubKeyHash`, `price`, `sessionId`
- Allows learner to lock ADA in escrow
- Supports incremental attestations:
  - `AttestLearner` - Learner attests completion
  - `AttestProvider` - Provider attests completion
- `Complete` redeemer - Releases funds to provider when both have attested
- `Refund` redeemer - Returns funds to learner after 48 hours if not completed

**Datum Structure:**
```haskell
EscrowDatum {
  learnerAttestation :: Bool
  providerAttestation :: Bool
  lockedAt :: POSIXTime
}
```

**Redeemers:**
- `AttestLearner` (constructor 0)
- `AttestProvider` (constructor 1)
- `Complete` (constructor 2)
- `Refund` (constructor 3)

### 2. NFT Minting Policy (`NFTPolicy.hs`)

**Purpose:** Mints exactly 1 NFT per session when escrow is settled.

**Key Features:**
- Parameters: `escrowValidatorHash`, `sessionId`, `metadataHash`
- Token name format: `"SkillForge-Session-<sessionId>"`
- Only mintable when escrow UTXO is consumed (settled)
- Enforces exactly 1 token minted per sessionId
- Metadata hash stored in parameters

**Redeemer:**
- `Mint` (constructor 0)

## File Structure

```
contracts/
├── Escrow.hs              # Escrow contract implementation
├── NFTPolicy.hs          # NFT minting policy implementation
├── Compile.hs            # Compilation helper
├── Export.hs             # JSON export functionality
├── skillforge-contracts.cabal  # Cabal project file
├── cabal.project         # Cabal project configuration
├── README.md             # Detailed documentation
├── cardano-cli-examples.md  # Complete CLI usage examples
├── example-usage.sh      # Bash script with examples
├── example-plutus-json.json  # Example JSON structure
└── SUMMARY.md            # This file
```

## Compilation

### Prerequisites
1. Nix (for Plutus development environment)
2. Cabal and GHC
3. Plutus-apps v2.0.0+

### Steps

```bash
# Enter Plutus environment
nix-shell https://github.com/input-output-hk/plutus-apps/archive/v2.0.0.tar.gz

# Build contracts
cabal build

# Export to JSON
cabal run export-contracts
```

This generates:
- `escrow.plutus` - Binary Plutus script
- `escrow.plutus.json` - JSON representation
- `nft-policy.plutus` - Binary Plutus script
- `nft-policy.plutus.json` - JSON representation

## Usage Flow

### Escrow Flow

1. **Lock Funds**
   - Learner creates transaction locking ADA in escrow
   - Initial datum: both attestations = false
   - Transaction includes escrow script address

2. **Learner Attests**
   - Learner submits transaction with `AttestLearner` redeemer
   - Updates datum: `learnerAttestation = true`
   - Funds remain locked

3. **Provider Attests**
   - Provider submits transaction with `AttestProvider` redeemer
   - Updates datum: `providerAttestation = true`
   - Funds remain locked

4. **Complete Escrow**
   - Either party submits `Complete` redeemer
   - Validator checks both attestations are true
   - Funds released to provider

5. **Refund (Alternative)**
   - After 48 hours, learner can submit `Refund` redeemer
   - Funds returned to learner

### NFT Minting Flow

1. **Wait for Escrow Settlement**
   - Escrow must be completed (UTXO consumed)

2. **Mint NFT**
   - Build transaction consuming escrow UTXO
   - Mint exactly 1 token with name `SkillForge-Session-<sessionId>`
   - Policy validates escrow is settled

## JSON Structure Examples

### Escrow Datum (Initial)
```json
{
  "constructor": 0,
  "fields": [
    {"constructor": 0, "fields": []},  // learnerAttestation = false
    {"constructor": 0, "fields": []},  // providerAttestation = false
    {"int": 1704067200000}              // lockedAt timestamp
  ]
}
```

### Escrow Redeemer (Complete)
```json
{
  "constructor": 2,
  "fields": []
}
```

### NFT Policy Redeemer (Mint)
```json
{
  "constructor": 0,
  "fields": []
}
```

## Integration Notes

### Backend Integration

The backend should:

1. **Build Escrow Transaction:**
   ```haskell
   params = EscrowParams {
     learnerPubKeyHash = learnerPKH
     providerPubKeyHash = providerPKH
     price = 80000000
     sessionId = "session_123"
   }
   validator = validator params
   ```

2. **Monitor Attestations:**
   - Watch for datum updates
   - Track learner and provider attestations
   - Build completion transaction when both attested

3. **Mint NFT:**
   ```haskell
   policyParams = NFTPolicyParams {
     escrowValidatorHash = escrowHash
     sessionId = "session_123"
     metadataHash = ipfsCID
   }
   mintingPolicy = policy policyParams
   ```

### Frontend Integration

The frontend should:

1. Display escrow status (locked, learner attested, provider attested, completed)
2. Show countdown for 48-hour refund window
3. Allow learner/provider to submit attestations
4. Trigger NFT minting after escrow completion

## Security Considerations

1. **Time Validation:** 48-hour window strictly enforced
2. **Attestation Order:** Both parties must attest before completion
3. **Refund Window:** Only learner can refund, only after 48 hours
4. **NFT Uniqueness:** Policy ensures only 1 NFT per sessionId
5. **Escrow Dependency:** NFT can only mint when escrow UTXO is consumed

## Testing Checklist

- [ ] Lock funds in escrow
- [ ] Learner attests (datum updates correctly)
- [ ] Provider attests (datum updates correctly)
- [ ] Complete escrow (funds paid to provider)
- [ ] Refund after 48 hours (funds returned to learner)
- [ ] Refund before 48 hours (should fail)
- [ ] Complete without both attestations (should fail)
- [ ] Mint NFT with settled escrow (should succeed)
- [ ] Mint NFT without settled escrow (should fail)
- [ ] Mint multiple NFTs for same sessionId (should fail)

## Known Limitations

1. Time validation uses transaction valid range - ensure proper interval setup
2. Datum validation requires exact match - be careful with JSON encoding
3. Escrow settlement check requires escrow UTXO to be consumed in same transaction
4. Token name is built from sessionId - ensure sessionId is unique

## Next Steps

1. Compile contracts in Plutus environment
2. Test on testnet
3. Integrate with backend API
4. Update frontend to use real contracts
5. Deploy to mainnet

