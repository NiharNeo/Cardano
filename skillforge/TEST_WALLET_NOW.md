# Test Wallet Connection NOW

## Quick Test Steps

### 1. Clear Browser Cache (IMPORTANT!)
The browser might be caching the old code. Do this first:

**Chrome/Brave**:
1. Open http://localhost:5173
2. Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows/Linux)
3. This does a hard refresh and clears cache

**Or manually**:
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### 2. Open Browser Console
1. Press F12 to open DevTools
2. Go to "Console" tab
3. Keep it open to see logs

### 3. Connect Wallet

1. Make sure your wallet is on **Preprod Testnet**
2. Click "Connect Lace" (or your wallet)
3. Approve the connection

### 4. Watch Console Logs

You should see these logs in order:

```
[Wallet] Attempting to connect to lace...
[Wallet] lace wallet enabled successfully
✅ [Wallet] Connected to PREPROD Testnet (Network ID: 0)
[Wallet] Used addresses: ["addr_test1..."]
[Wallet] Change address: addr_test1...
[Wallet] Reward addresses: ["stake_test1..."]
[Wallet] Payment address: addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer...
[Wallet] Stake address: stake_test1upxprdlg2aaflnfzckjn5lxlgmnw4x7act84q3t4qqd9lzqjtjam3
✅ [Wallet] Successfully connected to lace
Using payment address for balance: addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer...
[Wallet] Calculated balance from backend UTXOs: 10.50
[Wallet] UTXO count: 3
```

### 5. Check Display

You should see on the page:
- ✅ Wallet badge (e.g., "LACE")
- ✅ Payment address starting with `addr_test1...`
- ✅ Balance in ADA (e.g., "10.50 ₳")
- ✅ Green dot indicator

## If Balance Still Shows 0

### Check 1: Address Format
In console, look for the payment address log. It should be:
- ✅ GOOD: `addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer...`
- ❌ BAD: `0075babb5e72beccf61636e95085c23aa93737d89ad59fdf1858bdb7de...`

If you see the hex format (BAD), the conversion isn't working.

### Check 2: Backend Request
In console, look for network requests:
1. Go to "Network" tab in DevTools
2. Filter by "Fetch/XHR"
3. Look for request to `/utxos/addr_test1...`
4. Click on it and check:
   - Request URL should have `addr_test1...` (bech32)
   - Response should have `"success": true`
   - Response should have `"utxos": [...]` array

### Check 3: Backend Logs
In the backend terminal, you should see:
```
[2025-11-30T...] GET /utxos/addr_test1...
[Cardano] Using Blockfrost for UTXOs: addr_test1...
```

If you see hex address in backend logs, the problem is in the frontend.

### Check 4: Test Backend Directly

Open a new terminal and run:
```bash
# Replace with YOUR actual address from the console logs
curl "http://localhost:3000/utxos/addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp"
```

You should get:
```json
{
  "success": true,
  "address": "addr_test1...",
  "utxos": [...],
  "count": 3
}
```

## Troubleshooting

### "Nope Gone again"

This usually means:
1. **Browser cache** - Do hard refresh (Cmd+Shift+R)
2. **Old code loaded** - Check console for hex addresses
3. **Frontend not restarted** - Already done ✅

### Verify Code is Loaded

In browser console, type:
```javascript
// Check if Buffer is available
typeof Buffer

// Should return: "function"
```

If it returns "undefined", the imports aren't loading.

### Force Reload Everything

1. Stop frontend: Already done ✅
2. Clear browser cache completely
3. Close browser tab
4. Open new tab to http://localhost:5173
5. Try connecting wallet again

## What Should Work

After hard refresh and reconnecting wallet:

1. **Address Conversion**: Hex → Bech32 ✅
2. **UTXO Fetching**: Backend queries Blockfrost ✅
3. **Balance Display**: Shows in ADA ✅

## Current Status

✅ Backend running: http://localhost:3000
✅ Frontend running: http://localhost:5173
✅ Code has hex→bech32 conversion
✅ Backend has /utxos endpoint

## Next Action

1. **Hard refresh browser** (Cmd+Shift+R)
2. **Connect wallet**
3. **Check console logs**
4. **Report what you see**

If you still see hex addresses in console logs after hard refresh, let me know and I'll investigate further.

## Debug Commands

### Check if frontend has latest code:
```bash
cd skillforge/frontend
grep -n "hexToBech32" src/contexts/WalletContext.tsx
```

Should show line numbers where the function is defined and used.

### Check backend endpoint:
```bash
curl http://localhost:3000/utxos/addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp
```

Should return JSON with success: true.

## Expected Console Output

When everything works, you'll see:
```
[Wallet] Used addresses: ["addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp"]
```

NOT:
```
[Wallet] Used addresses: ["0075babb5e72beccf61636e95085c23aa93737d89ad59fdf1858bdb7de4c11b7e8577a9fcd22c5a53a7cdf46e6ea9bddc2cf504575001a5f88"]
```

The first one (starting with `addr_test1`) means conversion is working!
