# Escrow Address Extraction - Final Fix

## Date: November 30, 2025

## Problem
The Cardano Serialization Library for Node.js doesn't have an `as_base()` method on the `Address` class. The correct method is `BaseAddress.from_address()`.

## Errors Encountered

### First Error:
```
TypeError: learnerAddr.payment_cred is not a function
```
**Cause:** Tried to call `payment_cred()` directly on `Address` object.

### Second Error:
```
TypeError: learnerAddr.as_base is not a function
```
**Cause:** Tried to use `as_base()` method which doesn't exist in the Node.js version of the library.

## Correct Solution

Use `Cardano.BaseAddress.from_address()` static method to convert an `Address` to a `BaseAddress`.

### Correct Code Pattern:

```typescript
// 1. Parse the bech32 address
const address = Cardano.Address.from_bech32(addressString);

// 2. Convert to BaseAddress using static method
const baseAddress = Cardano.BaseAddress.from_address(address);

// 3. Check if conversion succeeded
if (!baseAddress) {
    throw new Error('Address is not a base address');
}

// 4. Now you can access payment_cred()
const paymentCred = baseAddress.payment_cred();
const pubKeyHash = paymentCred.to_keyhash()?.to_bytes();
```

## Files Fixed

### 1. skillforge/backend/src/routes/escrow.ts

**Location:** Lines 105-130

**Fixed Code:**
```typescript
try {
  learnerAddr = Cardano.Address.from_bech32(learnerAddress);
  mentorAddr = Cardano.Address.from_bech32(finalMentorAddress);
} catch (addrError: any) {
  console.error('[ESCROW INIT] Invalid address format:', addrError);
  return res.status(400).json({ success: false, error: 'Invalid address format' });
}

// Get payment credential (pub key hash)
// Use BaseAddress.from_address() to convert Address to BaseAddress
const learnerBaseAddr = Cardano.BaseAddress.from_address(learnerAddr);
const mentorBaseAddr = Cardano.BaseAddress.from_address(mentorAddr);

if (!learnerBaseAddr || !mentorBaseAddr) {
  console.error('[ESCROW INIT] Addresses are not base addresses');
  return res.status(400).json({ success: false, error: 'Addresses must be base addresses (not enterprise or pointer addresses)' });
}

const learnerPaymentCred = learnerBaseAddr.payment_cred();
const mentorPaymentCred = mentorBaseAddr.payment_cred();

const learnerPubKeyHash = learnerPaymentCred.to_keyhash()?.to_bytes();
const mentorPubKeyHash = mentorPaymentCred.to_keyhash()?.to_bytes();

if (!learnerPubKeyHash || !mentorPubKeyHash) {
  console.error('[ESCROW INIT] Could not extract public key hashes');
  return res.status(400).json({ success: false, error: 'Could not extract public key hashes from addresses' });
}
```

### 2. skillforge/backend/src/services/transactionBuilder.ts

**Location:** Lines 100-115

**Fixed Code:**
```typescript
const escrowAddress = getEscrowAddress();
const scriptAddress = escrowAddress.to_bech32();

// Extract receiver payment key hash from fixed address
const receiverAddr = addressFromBech32(RECEIVER_ADDRESS);
const receiverBaseAddr = Cardano.BaseAddress.from_address(receiverAddr);

if (!receiverBaseAddr) {
  throw new Error('Receiver address is not a base address');
}

const receiverPaymentCred = receiverBaseAddr.payment_cred();
const receiverPubKeyHash = receiverPaymentCred.to_keyhash();

if (!receiverPubKeyHash) {
  throw new Error('Could not extract receiver public key hash');
}
```

## Key Differences Between Browser and Node.js Libraries

| Feature | Browser (@emurgo/cardano-serialization-lib-browser) | Node.js (@emurgo/cardano-serialization-lib-nodejs) |
|---------|---------------------------------------------------|--------------------------------------------------|
| Convert to BaseAddress | `address.as_base()` | `BaseAddress.from_address(address)` |
| Method Type | Instance method | Static method |
| Return Type | `BaseAddress \| undefined` | `BaseAddress \| undefined` |

## Testing

After applying this fix:

1. ✅ Backend starts without errors
2. ✅ Address parsing works correctly
3. ✅ Public key hash extraction succeeds
4. ✅ Escrow initialization can proceed

## Status: ✅ RESOLVED

The correct API method `BaseAddress.from_address()` is now being used in both files. The escrow initialization should now work properly.

## Related Issues
- Initial issue: Wrong parameters from frontend
- Second issue: Incorrect API usage (`payment_cred()` directly on Address)
- Third issue: Incorrect API usage (`as_base()` doesn't exist)
- **Final solution:** Use `BaseAddress.from_address()` static method

## Next Steps
Test the escrow initialization flow end-to-end with a real wallet connection.
