# SkillForge Testing Guide

## Quick Start

### 1. Verify Services are Running

Check that both services are running:

```bash
# Check backend
curl http://localhost:3000/

# Check frontend (open in browser)
open http://localhost:5173
```

Expected responses:
- Backend: JSON with `"status": "ok"`
- Frontend: SkillForge web interface

## Wallet Connection Testing

### Prerequisites
1. Install a Cardano wallet extension:
   - [Lace](https://www.lace.io/) (Recommended)
   - [Eternl](https://eternl.io/)
   - [Nami](https://namiwallet.io/)

2. Switch wallet to **Preprod Testnet**:
   - Open wallet extension
   - Settings → Network → Preprod

3. Get Preprod test ADA:
   - Visit [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnet/tools/faucet/)
   - Enter your Preprod address
   - Request test ADA

### Test Wallet Connection

1. **Open SkillForge**: http://localhost:5173

2. **Connect Wallet**:
   - Click "Connect Lace" (or your wallet)
   - Approve connection in wallet popup
   - Wait for connection to complete

3. **Verify Connection**:
   - ✅ Wallet badge shows (e.g., "LACE")
   - ✅ Payment address displayed
   - ✅ Balance shows in ADA
   - ✅ Network shows "PREPROD"

4. **Check Browser Console** (F12):
   ```
   [Wallet] Attempting to connect to lace...
   [Wallet] lace wallet enabled successfully
   ✅ [Wallet] Connected to PREPROD Testnet (Network ID: 0)
   [Wallet] Payment address: addr_test1...
   ✅ [Wallet] Successfully connected to lace
   ```

### Troubleshooting Wallet Issues

**Problem**: "Wallet is not on PREPRODUCTION TESTNET"
```
Solution: Switch wallet to Preprod in wallet settings
```

**Problem**: Balance shows 0 but you have funds
```
Solution: 
1. Disconnect wallet
2. Reconnect wallet
3. Check wallet is on Preprod
4. Verify address matches
```

**Problem**: "No Cardano wallets detected"
```
Solution:
1. Install wallet extension
2. Refresh browser page
3. Check wallet is enabled
```

## Backend API Testing

### Test Provider Matching

```bash
curl -X POST http://localhost:3000/match \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "javascript",
    "budget": 50
  }' | python3 -m json.tool
```

Expected: List of providers with scores

### Test UTXO Fetching

```bash
# Replace with your Preprod address
curl "http://localhost:3000/utxos/addr_test1..." | python3 -m json.tool
```

Expected: List of UTXOs for the address

### Test Contract Info

```bash
curl http://localhost:3000/contracts/info | python3 -m json.tool
```

Expected: Contract information (hashes may be null if scripts not compiled)

## Frontend Flow Testing

### 1. Intent Parsing

1. Enter text: "I need help with JavaScript, budget 50 ADA"
2. Click "Match providers"
3. Verify:
   - ✅ Intent chips show parsed data
   - ✅ Providers list appears
   - ✅ Providers are ranked by score

### 2. Provider Selection

1. Connect wallet (if not connected)
2. Click "Start escrow" on a provider
3. Verify:
   - ✅ Escrow modal opens
   - ✅ Provider details shown
   - ✅ Price calculated correctly

### 3. Escrow Flow (Requires Preprod ADA)

1. In escrow modal, click "Lock Funds"
2. Approve transaction in wallet
3. Wait for confirmation
4. Verify:
   - ✅ Transaction hash displayed
   - ✅ Escrow status updates
   - ✅ Progress indicator shows "Funds Locked"

### 4. Session Attestation

1. After escrow locked, click "Attest as Learner"
2. Approve transaction in wallet
3. Click "Attest as Provider" (for testing)
4. Verify:
   - ✅ Both attestations recorded
   - ✅ "Ready to mint NFT" message shows

### 5. NFT Minting

1. Click "Mint NFT" button
2. Approve transaction in wallet
3. Wait for confirmation
4. Verify:
   - ✅ NFT metadata displayed
   - ✅ IPFS CID shown
   - ✅ Transaction hash displayed

## Database Testing

### Check Database Connection

```bash
cd skillforge/backend
node -e "
const { pool } = require('./dist/config/database');
pool.query('SELECT NOW()').then(r => {
  console.log('✅ Database connected:', r.rows[0].now);
  process.exit(0);
}).catch(e => {
  console.error('❌ Database error:', e.message);
  process.exit(1);
});
"
```

### Check Sample Data

```bash
cd skillforge/backend
node -e "
const { pool } = require('./dist/config/database');
pool.query('SELECT * FROM providers').then(r => {
  console.log('Providers:', r.rows.length);
  r.rows.forEach(p => console.log('-', p.name));
  process.exit(0);
});
"
```

## Blockfrost API Testing

### Test API Key

```bash
curl -H "project_id: preprod4wlBWuYUQUVi55ADtHbrMRBQ0mLXxYHx" \
  https://cardano-preprod.blockfrost.io/api/v0/health
```

Expected: `{"is_healthy":true}`

### Test Network Info

```bash
curl -H "project_id: preprod4wlBWuYUQUVi55ADtHbrMRBQ0mLXxYHx" \
  https://cardano-preprod.blockfrost.io/api/v0/network
```

Expected: Network statistics (supply, stake, etc.)

### Test Address UTXOs

```bash
# Replace with your Preprod address
curl -H "project_id: preprod4wlBWuYUQUVi55ADtHbrMRBQ0mLXxYHx" \
  "https://cardano-preprod.blockfrost.io/api/v0/addresses/addr_test1.../utxos"
```

Expected: List of UTXOs

## Performance Testing

### Backend Response Times

```bash
# Test match endpoint
time curl -X POST http://localhost:3000/match \
  -H "Content-Type: application/json" \
  -d '{"skill":"javascript","budget":50}' \
  -o /dev/null -s
```

Expected: < 500ms

### Frontend Load Time

1. Open browser DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Check:
   - ✅ Initial load < 2s
   - ✅ No failed requests
   - ✅ All assets loaded

## Integration Testing

### Full Flow Test (Manual)

1. **Start**: Open http://localhost:5173
2. **Connect**: Connect Preprod wallet
3. **Search**: Enter "I need JavaScript help, 50 ADA budget"
4. **Match**: Click "Match providers"
5. **Select**: Click "Start escrow" on top provider
6. **Lock**: Lock funds in escrow (requires ADA)
7. **Attest**: Both parties attest
8. **Mint**: Mint session NFT
9. **Verify**: Check NFT metadata and IPFS CID

### Expected Results

- ✅ All steps complete without errors
- ✅ Transaction hashes are valid
- ✅ NFT metadata is correct
- ✅ IPFS CID is accessible

## Automated Testing

### Run Backend Tests (if available)

```bash
cd skillforge/backend
npm test
```

### Run Frontend Tests (if available)

```bash
cd skillforge/frontend
npm test
```

## Monitoring

### Watch Backend Logs

```bash
# Backend logs show:
# - API requests
# - Database queries
# - Blockfrost calls
# - Transaction status
```

### Watch Frontend Console

```bash
# Browser console shows:
# - Wallet connection status
# - API calls
# - State changes
# - Errors
```

## Common Test Scenarios

### Scenario 1: New User Flow
1. No wallet connected
2. Search for providers
3. Try to select provider → Error: "Connect wallet"
4. Connect wallet
5. Select provider → Success

### Scenario 2: Insufficient Balance
1. Connect wallet with < 5 ADA
2. Try to lock escrow → Error: "Insufficient balance"

### Scenario 3: Wrong Network
1. Connect wallet on Mainnet
2. See warning: "Switch to Preprod"
3. Switch to Preprod
4. Reconnect wallet → Success

### Scenario 4: Multiple Wallets
1. Connect Lace
2. Disconnect
3. Connect Eternl
4. Verify different address shown

## Success Criteria

### ✅ Wallet Connection
- [x] Wallet detects available extensions
- [x] Connection succeeds on Preprod
- [x] Address fetched correctly
- [x] Balance displays accurately
- [x] Network validation works

### ✅ Provider Matching
- [x] Intent parsing works
- [x] Backend returns providers
- [x] Scoring algorithm ranks correctly
- [x] UI displays results

### ✅ Escrow Flow
- [x] Modal opens with correct data
- [x] Transaction builds successfully
- [x] Wallet signs transaction
- [x] Status updates correctly

### ✅ NFT Minting
- [x] Metadata generates correctly
- [x] IPFS upload works
- [x] Transaction submits
- [x] NFT displays in UI

## Debugging Tips

### Enable Verbose Logging

**Frontend** (browser console):
```javascript
localStorage.setItem('debug', 'wallet:*');
```

**Backend** (environment):
```bash
DEBUG=* npm run dev
```

### Check Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Check:
   - Request URLs
   - Response status
   - Response data

### Inspect Wallet State

**Browser console**:
```javascript
// Check if wallet is available
console.log(window.cardano);

// Check available wallets
console.log(Object.keys(window.cardano || {}));
```

## Getting Help

### Check Logs
1. Backend terminal: API and database logs
2. Browser console: Frontend and wallet logs
3. Network tab: API requests and responses

### Common Log Messages

**Success**:
```
✅ [Wallet] Successfully connected to lace
✅ Database connected successfully
✅ [Wallet] Fixed collateral verified
```

**Warnings**:
```
⚠️ Collateral UTxO not available
⚠️ Wallet is NOT on Preprod testnet
```

**Errors**:
```
❌ [Wallet] Connection error
❌ Failed to fetch providers
❌ Transaction failed
```

## Next Steps

After successful testing:
1. ✅ Wallet connection works
2. ✅ Provider matching works
3. ✅ Backend API responds
4. ✅ Database queries work
5. ✅ Blockfrost integration works

You're ready to:
- Test full escrow flow with real Preprod ADA
- Mint session NFTs
- Explore advanced features
- Deploy to production (with mainnet configuration)

## Support

For issues:
1. Check this testing guide
2. Review `WALLET_FIX_SUMMARY.md`
3. Check browser console logs
4. Check backend terminal logs
5. Verify Blockfrost API key is valid
