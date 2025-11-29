# Aiken Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Aiken

```bash
# macOS
brew install aiken-lang/aiken/aiken

# Or download from: https://github.com/aiken-lang/aiken/releases
```

### 2. Build Contracts

```bash
cd skillforge/contracts
chmod +x build.sh
./build.sh
```

### 3. Verify Build

Check that scripts were exported:
```bash
ls -la ../backend/contracts/*.plutus
```

You should see:
- `escrow.plutus`
- `session_nft.plutus`

### 4. Start Backend

```bash
cd ../backend
npm run dev
```

Look for these messages:
```
✓ Aiken Escrow script loaded
  Script hash: <hash>
✓ Aiken NFT minting policy loaded
  Policy ID: <policy_id>
```

### 5. Start Frontend

```bash
cd ../frontend
npm run dev
```

Open http://localhost:5173 and check the "⚡ Aiken Contracts" panel.

## ✅ Verification

### Check Contract Info API

```bash
curl http://localhost:3000/contracts/info
```

Should return:
```json
{
  "success": true,
  "data": {
    "contracts": "Aiken",
    "version": "1.0.0",
    "escrowValidatorHash": "...",
    "nftPolicyId": "..."
  }
}
```

### Check Frontend

1. Open http://localhost:5173
2. Look for "⚡ Aiken Contracts" panel
3. Click to expand and see script hashes

## 🔧 Troubleshooting

### "Aiken not found"

Install Aiken:
```bash
brew install aiken-lang/aiken/aiken
```

### "Script not found"

Build contracts:
```bash
cd contracts && ./build.sh
```

### "Script hash is null"

1. Rebuild contracts
2. Restart backend
3. Check backend logs for errors

## 📚 Next Steps

- Read `AIKEN_INTEGRATION.md` for full documentation
- Set up local testnet: `./scripts/setup-local-testnet.sh`
- Deploy to preprod: See deployment section in `AIKEN_INTEGRATION.md`

