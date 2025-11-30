# Wallet Connection Fix Summary

## Issues Fixed

### 1. Hardcoded Wallet Address
**Problem**: The wallet context was forcing a hardcoded address instead of fetching the actual wallet address from the connected wallet.

**Location**: `skillforge/frontend/src/contexts/WalletContext.tsx` (lines ~247-260)

**Fix**: Replaced the hardcoded address logic with proper CIP-30 wallet API calls:
- `api.getUsedAddresses()` - Get used addresses from wallet
- `api.getChangeAddress()` - Get change address from wallet  
- `api.getRewardAddresses()` - Get stake/reward addresses from wallet

### 2. Missing Backend Endpoint
**Problem**: The frontend was trying to fetch UTXOs from `/utxos/:address` endpoint which didn't exist in the backend.

**Location**: `skillforge/backend/src/index.ts`

**Fix**: Added new endpoint:
```typescript
GET /utxos/:address - Get UTXOs for an address via Blockfrost
```

## Changes Made

### Frontend Changes
**File**: `skillforge/frontend/src/contexts/WalletContext.tsx`

1. Removed hardcoded `DEFAULT_RECEIVING_ADDRESS` logic
2. Added proper wallet address fetching using CIP-30 API
3. Improved error handling for address retrieval
4. Added stake key extraction from reward addresses

### Backend Changes
**File**: `skillforge/backend/src/index.ts`

1. Added `/utxos/:address` endpoint that:
   - Accepts a Cardano address as parameter
   - Fetches UTXOs from Blockfrost API
   - Returns UTXOs in a standardized format
   - Handles errors gracefully

## How to Test

### 1. Start the Application
Both servers are already running:
- **Backend**: http://localhost:3000 ✅
- **Frontend**: http://localhost:5173 ✅

### 2. Test Wallet Connection

1. **Open the app**: Navigate to http://localhost:5173 in your browser

2. **Install a Cardano Wallet** (if not already installed):
   - [Lace](https://www.lace.io/)
   - [Eternl](https://eternl.io/)
   - [Nami](https://namiwallet.io/)

3. **Switch to Preprod Testnet**:
   - Open your wallet extension
   - Go to Settings → Network
   - Select "Preprod Testnet"

4. **Connect Wallet**:
   - Click "Connect Lace" (or your preferred wallet)
   - Approve the connection in the wallet popup
   - You should see:
     - ✅ Wallet name badge (e.g., "LACE")
     - ✅ Payment address (truncated)
     - ✅ Stake address (if available)
     - ✅ Balance in ADA

### 3. Verify Wallet Data

Check the browser console (F12) for logs:
```
[Wallet] Attempting to connect to lace...
[Wallet] lace wallet enabled successfully
✅ [Wallet] Connected to PREPROD Testnet (Network ID: 0)
[Wallet] Payment address: addr_test1...
[Wallet] Stake address: stake_test1...
✅ [Wallet] Successfully connected to lace
```

### 4. Test Balance Fetching

The wallet should automatically fetch and display your balance:
- Balance updates every 10 seconds
- Uses backend `/utxos/:address` endpoint
- Sums lovelace from all UTXOs

### 5. Test Provider Matching

1. Enter a skill request: "I need help with JavaScript, budget 50 ADA"
2. Click "Match providers"
3. You should see ranked providers
4. With wallet connected, you can click "Start escrow" on a provider

## Expected Behavior

### ✅ Successful Connection
- Wallet badge shows connected wallet name
- Payment address is displayed (truncated)
- Balance shows in ADA (e.g., "10.50 ₳")
- Network indicator shows "PREPROD"

### ⚠️ Common Issues

**Issue**: "Wallet is not on PREPRODUCTION TESTNET"
- **Solution**: Switch your wallet to Preprod testnet in wallet settings

**Issue**: Balance shows "0.00 ₳" but you have funds
- **Solution**: 
  1. Disconnect and reconnect wallet
  2. Check that you're on Preprod testnet
  3. Verify address in wallet matches displayed address

**Issue**: "No Cardano wallets detected"
- **Solution**: Install a CIP-30 compatible wallet extension and refresh the page

## API Endpoints

### Backend Endpoints
- `GET /` - Health check
- `GET /utxos/:address` - Get UTXOs for address (NEW)
- `POST /match` - Match providers
- `POST /escrow/init` - Initialize escrow
- `POST /nft/mint` - Mint NFT
- `GET /contracts/info` - Get contract information

### Frontend Environment
- `VITE_BACKEND_URL=http://localhost:3000`

## Technical Details

### Wallet Address Hierarchy
1. **Payment Address** (Primary): Used for transactions
   - Fetched from `api.getUsedAddresses()[0]` or `api.getChangeAddress()`
   - Format: `addr_test1...` (Preprod) or `addr1...` (Mainnet)

2. **Stake Address**: Used for rewards and delegation
   - Fetched from `api.getRewardAddresses()[0]`
   - Format: `stake_test1...` (Preprod) or `stake1...` (Mainnet)

### Balance Calculation
1. Fetch UTXOs from backend: `GET /utxos/:address`
2. Parse each UTXO's amount (Blockfrost format)
3. Sum all lovelace values
4. Convert to ADA: `lovelace / 1,000,000`

### Network Detection
- Network ID 0 = Preprod Testnet ✅
- Network ID 1 = Mainnet ❌ (not supported)
- SkillForge requires Preprod for testing

## Next Steps

1. **Test with Real Wallet**: Connect your Preprod wallet and verify all data displays correctly
2. **Test Escrow Flow**: Try initiating an escrow transaction (requires Preprod ADA)
3. **Test NFT Minting**: Complete a session and mint an NFT

## Troubleshooting

### Enable Debug Logging
Open browser console (F12) and filter by:
- `[Wallet]` - Wallet connection logs
- `[Cardano]` - Backend Cardano service logs
- `[App]` - Frontend application logs

### Check Backend Logs
Backend terminal shows:
- Wallet address requests
- UTXO fetches
- Blockfrost API calls

### Verify Blockfrost API
Your Blockfrost API key is configured:
```
BLOCKFROST_PROJECT_ID=preprod4wlBWuYUQUVi55ADtHbrMRBQ0mLXxYHx
```

Test it directly:
```bash
curl -H "project_id: preprod4wlBWuYUQUVi55ADtHbrMRBQ0mLXxYHx" \
  https://cardano-preprod.blockfrost.io/api/v0/health
```

## Status

✅ **Backend**: Running on port 3000
✅ **Frontend**: Running on port 5173  
✅ **Database**: Connected (PostgreSQL)
✅ **Blockfrost**: Connected to Preprod
✅ **Wallet Integration**: Fixed and ready to test

The wallet connection issue has been resolved. You can now connect your Cardano wallet and it will properly fetch your address, balance, and UTXOs from the Preprod testnet.
