# Wallet Connection Diagnostic Checklist

## ✅ Code Verification (Already Done)

```bash
# Verified: hexToBech32 function exists at line 103
# Verified: Function is called at lines 377, 385, 397
# Verified: Imports are correct (CardanoWasm, Buffer)
```

## 🔍 Step-by-Step Diagnosis

### Step 1: Hard Refresh Browser
**Action**: Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)

**Why**: Browser might be caching old JavaScript code

**Check**: After refresh, open Console (F12) and type:
```javascript
typeof Buffer
```
**Expected**: Should return `"function"`
**If not**: Browser still has old code cached

---

### Step 2: Connect Wallet
**Action**: Click "Connect Lace" (or your wallet)

**Check Console For**:
```
[Wallet] Attempting to connect to lace...
```

**If you don't see this**: Wallet extension not detected

---

### Step 3: Check Address Format
**Look for this log**:
```
[Wallet] Used addresses: [...]
```

**✅ CORRECT** (bech32 format):
```
[Wallet] Used addresses: ["addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer..."]
```

**❌ WRONG** (hex format):
```
[Wallet] Used addresses: ["0075babb5e72beccf61636e95085c23aa93737d89ad59fdf1858bdb7de..."]
```

**If WRONG**: Conversion function not being called

---

### Step 4: Check Payment Address
**Look for this log**:
```
[Wallet] Payment address: ...
```

**✅ CORRECT**:
```
[Wallet] Payment address: addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer...
```

**❌ WRONG**:
```
[Wallet] Payment address: 0075babb5e72beccf61636e95085c23aa93737d89ad59fdf1858bdb7de...
```

---

### Step 5: Check Balance Fetch
**Look for this log**:
```
Using payment address for balance: ...
```

**✅ CORRECT**:
```
Using payment address for balance: addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer...
```

**Then should see**:
```
[Wallet] Calculated balance from backend UTXOs: 10.50
[Wallet] UTXO count: 3
```

---

### Step 6: Check Network Tab
**Action**: 
1. Open DevTools (F12)
2. Go to "Network" tab
3. Filter by "Fetch/XHR"
4. Look for request to `/utxos/...`

**✅ CORRECT URL**:
```
http://localhost:3000/utxos/addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer...
```

**❌ WRONG URL**:
```
http://localhost:3000/utxos/0075babb5e72beccf61636e95085c23aa93737d89ad59fdf1858bdb7de...
```

**Check Response**:
- Status: 200 OK
- Body: `{"success": true, "utxos": [...], "count": 3}`

---

## 🐛 If Still Not Working

### Test 1: Check if CardanoWasm is loaded

In browser console:
```javascript
typeof CardanoWasm
```

**Expected**: `"object"`
**If undefined**: Library not loading

---

### Test 2: Manually test conversion

In browser console:
```javascript
// Test hex to bech32 conversion
const testHex = "0075babb5e72beccf61636e95085c23aa93737d89ad59fdf1858bdb7de4c11b7e8577a9fcd22c5a53a7cdf46e6ea9bddc2cf504575001a5f88";
const addressBytes = Buffer.from(testHex, 'hex');
const address = CardanoWasm.Address.from_bytes(addressBytes);
const bech32 = address.to_bech32();
console.log(bech32);
```

**Expected**: Should print `addr_test1...`
**If error**: Library not working properly

---

### Test 3: Check backend directly

In terminal:
```bash
# Test with a known Preprod address
curl "http://localhost:3000/utxos/addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp"
```

**Expected**:
```json
{
  "success": true,
  "address": "addr_test1...",
  "utxos": [],
  "count": 0
}
```

**If error**: Backend issue

---

## 📊 Diagnosis Results

Fill this out based on what you see:

```
[ ] Step 1: Hard refresh done
[ ] Step 2: Wallet connected
[ ] Step 3: Address format is bech32 (addr_test1...)
[ ] Step 4: Payment address is bech32
[ ] Step 5: Balance fetch uses bech32 address
[ ] Step 6: Network request uses bech32 URL
```

## 🎯 Common Issues

### Issue 1: Browser Cache
**Symptom**: Still seeing hex addresses
**Solution**: 
1. Close browser completely
2. Reopen browser
3. Go to http://localhost:5173
4. Hard refresh (Cmd+Shift+R)

### Issue 2: Wallet Not on Preprod
**Symptom**: Error "Wallet is not on PREPRODUCTION TESTNET"
**Solution**: 
1. Open wallet extension
2. Settings → Network
3. Select "Preprod"
4. Reconnect wallet

### Issue 3: No UTXOs
**Symptom**: Balance shows 0, UTXO count is 0
**Solution**: 
1. Get Preprod test ADA from faucet
2. Wait for transaction to confirm
3. Refresh balance

### Issue 4: Library Not Loading
**Symptom**: `typeof CardanoWasm` returns "undefined"
**Solution**:
1. Check browser console for import errors
2. Try different browser
3. Clear all browser data

---

## 🔧 Emergency Reset

If nothing works:

```bash
# Stop frontend
# (Already done via Kiro)

# Clear node_modules and reinstall
cd skillforge/frontend
rm -rf node_modules
npm install

# Restart frontend
npm run dev
```

Then:
1. Close browser completely
2. Reopen browser
3. Go to http://localhost:5173
4. Connect wallet

---

## 📝 Report Template

If still not working, provide this info:

```
Browser: [Chrome/Firefox/Brave/etc]
Wallet: [Lace/Eternl/Nami]
Network: [Preprod/Mainnet]

Console Logs:
[Paste the wallet connection logs here]

Address Format Seen:
[addr_test1... or 0075babb...]

Network Request URL:
[/utxos/addr_test1... or /utxos/0075babb...]

Backend Response:
[Paste response here]

typeof Buffer: [function/undefined]
typeof CardanoWasm: [object/undefined]
```

---

## ✅ Success Indicators

When everything works, you'll see:

1. **Console**: `[Wallet] Used addresses: ["addr_test1..."]`
2. **Console**: `[Wallet] Payment address: addr_test1...`
3. **Console**: `[Wallet] Calculated balance from backend UTXOs: 10.50`
4. **Network Tab**: Request to `/utxos/addr_test1...`
5. **UI**: Balance displays (e.g., "10.50 ₳")
6. **UI**: Address shows (truncated bech32)

All addresses should start with `addr_test1` (Preprod) or `addr1` (Mainnet).
NEVER hex format like `0075babb...`
