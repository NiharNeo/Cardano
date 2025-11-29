# Aiken Deployment Guide

## Preprod Deployment

### 1. Build Contracts

```bash
cd contracts
aiken build
```

### 2. Export Scripts

```bash
cp build/validators/escrow.plutus ../backend/contracts/
cp build/minting_policies/session_nft.plutus ../backend/contracts/
```

### 3. Configure Environment

Create/update `backend/.env`:

```env
CARDANO_NETWORK=preprod
BLOCKFROST_PROJECT_ID=your_preprod_project_id
BLOCKFROST_BASE_URL=https://cardano-preprod.blockfrost.io/api/v0
```

### 4. Deploy Backend

```bash
cd backend
npm install
npm run build
npm start
```

### 5. Verify Deployment

```bash
curl https://your-backend-url/contracts/info
```

Should return contract hashes.

## Mainnet Deployment

**⚠️ WARNING**: Only deploy to mainnet after thorough testing on preprod.

### 1. Update Environment

```env
CARDANO_NETWORK=mainnet
BLOCKFROST_PROJECT_ID=your_mainnet_project_id
BLOCKFROST_BASE_URL=https://cardano-mainnet.blockfrost.io/api/v0
```

### 2. Rebuild Contracts

```bash
cd contracts
aiken build
```

### 3. Verify Scripts

Double-check script hashes match preprod:
- Escrow validator hash
- NFT policy ID

### 4. Deploy

```bash
cd backend
npm run build
npm start
```

## Script Verification

### Get Script Hash

```bash
cardano-cli transaction policyid \
  --script-file contracts/escrow.plutus
```

### Verify Policy ID

```bash
cardano-cli transaction policyid \
  --script-file contracts/session_nft.plutus
```

## Testing Checklist

- [ ] Contracts build successfully
- [ ] Scripts exported to backend/contracts/
- [ ] Backend loads scripts on startup
- [ ] Script hashes match expected values
- [ ] Frontend displays contract info
- [ ] Escrow transactions work
- [ ] NFT minting works
- [ ] All tests pass

