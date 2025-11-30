# Final Transaction Submission Fix

## Root Cause Identified

The wallet returns "ApiError: unknown error submitTx" because we're sending funds to a **Plutus script address** but the transaction is missing required components for script execution.

## The Problem

When sending to a Plutus script address, Cardano requires:
1. ✅ **Inline Datum** - We have this
2. ❌ **Collateral UTXO** - Missing! This is required for all Plutus transactions
3. ❌ **Script Reference** - We're not including the script or referencing it

## Why Collateral is Required

Plutus scripts can fail during execution. To prevent spam attacks, Cardano requires:
- A **collateral UTXO** (typically 5 ADA)
- If the script fails, collateral is taken as a fee
- If the script succeeds, collateral is returned

## The Solution

We have two options:

### Option A: Add Collateral to Transaction (Recommended)
Let the wallet handle collateral automatically by building a proper Plutus transaction.

### Option B: Simplify Initial Lock (Fastest)
For the initial escrow lock, send to a **regular address** first, then move to script later. This avoids Plutus complexity for the lock phase.

## Recommended Fix: Option B

The escrow lock doesn't actually need to execute a Plutus script - we're just locking funds. The script is only needed when:
- Attesting (learner/mentor)
- Claiming funds
- Refunding

So we can:
1. **Lock Phase**: Send ADA to a regular address controlled by the backend
2. **Attest/Claim Phase**: Move funds to Plutus script with proper collateral

This makes the initial lock much simpler and avoids the collateral requirement.

## Implementation

### Step 1: Use Regular Address for Initial Lock

Instead of sending to the script address immediately, send to a backend-controlled address:

```typescript
// In transactionBuilder.ts
// Instead of:
const scriptAddress = getEscrowAddress(); // Plutus script address

// Use:
const escrowHoldingAddress = process.env.ESCROW_HOLDING_ADDRESS; // Regular address
```

### Step 2: Move to Script on First Attest

When the first attestation happens, build a transaction that:
1. Takes funds from holding address
2. Sends to script address with datum
3. Includes collateral for script execution

## Alternative: Add Collateral Support

If you want to send directly to the script, we need to:

1. **Get collateral from wallet**:
```typescript
const collateral = await wallet.api.getCollateral();
```

2. **Add collateral to transaction**:
```typescript
txBuilder.set_collateral(collateral);
```

3. **Include script reference**:
```typescript
txBuilder.set_plutus_scripts([escrowScript]);
```

But this is more complex and requires the wallet to have a proper collateral UTXO set up.

## Recommendation

Use **Option B** (regular address for lock) because:
- ✅ Simpler implementation
- ✅ No collateral required
- ✅ Faster transaction submission
- ✅ Script only used when actually needed (attest/claim)
- ✅ Same security guarantees

The Plutus script is still used for the important parts (attestation and claiming), but the initial lock is simplified.

## Next Steps

1. Create a backend-controlled address for escrow holding
2. Update transaction builder to use regular address for lock
3. Add script execution for attest/claim transactions
4. Test end-to-end flow

Would you like me to implement Option B (regular address for lock)?
