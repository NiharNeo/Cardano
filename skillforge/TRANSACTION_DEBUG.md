# Transaction Submission Debug Guide

## Current Issue

Transaction builds successfully but fails on submission with "unknown error submitTx".

## Debugging Steps

### 1. Check Browser Console

Open browser console (F12) and look for detailed error:

```javascript
[Wallet] submitTx error: <detailed error here>
[Wallet] Error details: { message, info, code, stack }
```

### 2. Common Plutus Script Issues

When sending to a Plutus script address, you need:

- ✅ **Inline Datum** - We have this
- ❌ **Collateral UTXO** - Wallet needs to provide this
- ❌ **Script Reference** - Or include script in transaction
- ❌ **Execution Units** - For script execution

### 3. Possible Solutions

#### Option A: Add Collateral (Recommended)
The wallet should automatically add collateral, but we can verify:

```typescript
// Check if wallet has collateral
const collateral = await wallet.api.getCollateral();
console.log('Collateral:', collateral);
```

#### Option B: Simplify Transaction
Instead of sending directly to script, send to a regular address first, then move to script later.

#### Option C: Use Reference Script
Deploy the script on-chain and reference it instead of including it.

## What to Check

1. **Browser Console Error** - Most important! Share the full error message
2. **Transaction Size** - Is it too large?
3. **Collateral** - Does wallet have 5 ADA collateral UTXO?
4. **Network** - Is wallet on Preprod testnet?

## Next Steps

Please share the **exact error message** from the browser console, and I'll provide a targeted fix.
