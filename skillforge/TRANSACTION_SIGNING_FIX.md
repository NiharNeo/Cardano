# Transaction Signing Fix - CIP-30 Compliance

## Problem
The "unknown error submitTx" was occurring because we were incorrectly handling the CIP-30 wallet signing flow.

## Root Cause
According to CIP-30 (Cardano Wallet Connector Standard):
1. `wallet.api.signTx(txCbor, partialSign)` expects a **full transaction CBOR** (not just the body)
2. It returns a **witness set CBOR** (not a signed transaction)
3. We must manually assemble the final signed transaction by combining the original transaction body with the returned witness set

## Previous (Incorrect) Implementation
```typescript
// ❌ WRONG: Assumed signTx returns a signed transaction
const signedTxHex = await signTx(txHex);
const txHash = await submitTx(signedTxHex);
```

## Fixed Implementation
```typescript
// ✅ CORRECT: signTx returns witness set, we assemble the final transaction
const witnessSetHex = await wallet.api.signTx(txHex, false);

// Parse the original transaction and witness set
const transaction = CardanoWasm.Transaction.from_bytes(Buffer.from(txHex, 'hex'));
const witnessSet = CardanoWasm.TransactionWitnessSet.from_bytes(Buffer.from(witnessSetHex, 'hex'));

// Assemble the final signed transaction
const signedTx = CardanoWasm.Transaction.new(
    transaction.body(),
    witnessSet,
    transaction.auxiliary_data()
);

const signedTxHex = Buffer.from(signedTx.to_bytes()).toString('hex');
const txHash = await submitTx(signedTxHex);
```

## Changes Made

### 1. Backend (`transactionBuilder.ts`)
- ✅ Already correctly building full transaction with empty witness set
- ✅ Added logging to show transaction hex preview

### 2. Frontend (`WalletContext.tsx`)
- ✅ Fixed `lockFunds` to properly assemble signed transaction from witness set
- ✅ Updated `signTx` to use `partialSign=false` for regular transactions
- ✅ Added proper CIP-30 compliant transaction assembly

## Testing
1. Connect wallet (Lace/Eternl/Nami on Preprod testnet)
2. Initiate escrow lock
3. Sign transaction in wallet
4. Transaction should now submit successfully without "unknown error"

## References
- [CIP-30 Specification](https://cips.cardano.org/cips/cip30/)
- [Cardano Serialization Lib](https://github.com/Emurgo/cardano-serialization-lib)
