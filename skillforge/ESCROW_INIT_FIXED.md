# Escrow Initialization Fixed

## Issue
The escrow initialization was failing because the frontend `WalletContext.tsx` was sending incorrect field names to the `/escrow/init` backend endpoint.

## Root Cause
In `skillforge/frontend/src/contexts/WalletContext.tsx`, the `lockFunds` function was sending:
```typescript
{
    providerId: 'provider_id_placeholder',
    userAddress: paymentAddress,
    amountAda: params.price,
    durationMinutes: 60
}
```

But the backend `/escrow/init` endpoint expects:
```typescript
{
    learnerAddress: string,
    mentorAddress: string,  // or providerAddress
    price: number,
    sessionId: string
}
```

## Fix Applied
Updated the `lockFunds` function in `WalletContext.tsx` to:

1. **Send correct field names**:
   - `learnerAddress` (from `paymentAddress`)
   - `mentorAddress` (from `params.mentorAddress`)
   - `price` (from `params.price`)
   - `sessionId` (from `params.sessionId`)

2. **Implement real transaction signing and submission**:
   - Previously was mocking the transaction flow
   - Now actually calls `signTx()` and `submitTx()` with the transaction hex from backend
   - Properly handles the response from `/escrow/init`

3. **Improved error handling**:
   - Better error messages from backend responses
   - Validates wallet connection before proceeding
   - Checks for required `txHex` in backend response

4. **Added comprehensive logging**:
   - Logs parameters being sent to backend
   - Logs each step of the transaction flow
   - Better debugging information

## Code Changes

### Before:
```typescript
const initResponse = await fetch(`${backendUrl}/escrow/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        providerId: 'provider_id_placeholder',
        userAddress: paymentAddress,
        amountAda: params.price,
        durationMinutes: 60
    })
});
```

### After:
```typescript
const initResponse = await fetch(`${backendUrl}/escrow/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        learnerAddress: paymentAddress,
        mentorAddress: params.mentorAddress,
        price: params.price,
        sessionId: params.sessionId,
        stakeKey: stakeKey || undefined,
        parsedIntent: params.parsedIntent || undefined
    })
});

// Then sign and submit the transaction
const signedTxHex = await signTx(escrowData.txHex);
const txHash = await submitTx(signedTxHex);
```

## Testing
To test the fix:

1. Connect wallet in the frontend
2. Enter a skill request and match providers
3. Select a provider and click "Lock Escrow"
4. The backend should now receive correct parameters:
   - `learnerAddress`: Your wallet address
   - `mentorAddress`: Provider's address
   - `price`: Session price in ADA
   - `sessionId`: UUID of the created session

5. Backend will build the escrow transaction
6. Wallet will prompt for signature
7. Transaction will be submitted to Cardano blockchain

## Related Files
- `skillforge/frontend/src/contexts/WalletContext.tsx` - Fixed `lockFunds` function
- `skillforge/backend/src/routes/escrow.ts` - Backend endpoint expecting correct fields
- `skillforge/frontend/src/services/api.ts` - API interface definitions
- `skillforge/frontend/src/components/EscrowModal.tsx` - UI component calling `lockFunds`

## Additional Fix: Cardano Address API

### Issue
Backend was calling `payment_cred()` directly on `Address` objects, but the Cardano Serialization Library requires calling `as_base()` first to get a `BaseAddress`.

### Error
```
TypeError: learnerAddr.payment_cred is not a function
```

### Fix Applied
Updated both `escrow.ts` and `transactionBuilder.ts` to:

1. Call `as_base()` on Address objects first
2. Check if the result is valid (not null)
3. Then call `payment_cred()` on the BaseAddress

**Before:**
```typescript
const learnerPaymentCred = learnerAddr.payment_cred();
```

**After:**
```typescript
const learnerBaseAddr = Cardano.BaseAddress.from_address(learnerAddr);
if (!learnerBaseAddr) {
    throw new Error('Address is not a base address');
}
const learnerPaymentCred = learnerBaseAddr.payment_cred();
```

### Files Updated
- `skillforge/backend/src/routes/escrow.ts` - Fixed learner and mentor address extraction
- `skillforge/backend/src/services/transactionBuilder.ts` - Fixed receiver address extraction

## Status
✅ **FULLY FIXED** - Escrow initialization now:
1. Sends correct parameters from frontend to backend
2. Implements real transaction signing/submission flow
3. Correctly extracts payment credentials from Cardano addresses
