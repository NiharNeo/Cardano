# SkillForge Local Devnet - Complete Setup Guide

## 🎯 Overview

Complete Cardano local development network for SkillForge with:
- ✅ Infinite ADA (no faucet required)
- ✅ Instant transaction confirmations
- ✅ Aiken contract support
- ✅ CIP-30 wallet emulator support
- ✅ Full SkillForge flow without testnet

## 📁 Directory Structure

```
devnet/
├── configs/          # Node configuration files
├── keys/             # Payment and stake keys
├── genesis/          # Genesis configuration
├── data/             # Node data (auto-generated)
├── docker-compose.yml
├── setup-devnet.sh
├── faucet.sh
├── query-utxo.sh
├── restart.sh
├── deploy-aiken.sh
└── faucet-server.js
```

## 🚀 Quick Start

### 1. Setup Devnet

```bash
cd skillforge/devnet
chmod +x *.sh
./setup-devnet.sh
```

This creates:
- Genesis with 1,000,000,000 ADA
- Payment keys funded with 500,000 ADA
- Node configuration files

### 2. Start Services

```bash
docker-compose up -d
```

Starts:
- 3 Cardano nodes (ports 3001, 3002, 3003)
- Ogmios server (port 1337)
- Kupo indexer (port 1442)
- Faucet server (port 8090)

### 3. Wait for Sync

```bash
# Check node status
docker-compose logs -f cardano-node-1

# Check if synced
docker exec skillforge-node-1 cardano-cli query tip \
  --testnet-magic 42 \
  --socket-path /data/node.socket
```

### 4. Deploy Aiken Contracts

```bash
./deploy-aiken.sh
```

This will:
- Build Aiken contracts
- Get validator hashes
- Generate script addresses
- Save to `backend/contracts/escrow.address` and `backend/contracts/nft.policy`

### 5. Configure Backend

Create `backend/.env.local`:

```env
NETWORK=local
OGMIOS_URL=http://localhost:1337
KUPO_URL=http://localhost:1442
DEVNET_MAGIC=42
FAUCET_URL=http://localhost:8090
```

### 6. Configure Frontend

Create `frontend/.env.development`:

```env
VITE_NETWORK=local
VITE_DEVNET_MAGIC=42
VITE_OGMIOS=http://localhost:1337
VITE_KUPO=http://localhost:1442
VITE_FAUCET=http://localhost:8090
VITE_BACKEND_URL=http://localhost:3000
VITE_LOCAL_WALLET_MODE=true
```

### 7. Fund Your Address

```bash
# Using script
./faucet.sh addr_test1...

# Or using HTTP API
curl -X POST http://localhost:8090/fund \
  -H "Content-Type: application/json" \
  -d '{"address": "addr_test1..."}'
```

### 8. Start Backend & Frontend

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

## 🧪 Testing

### Test Devnet Status

```bash
curl http://localhost:3000/devnet/test
```

Returns:
- Test wallet address
- UTXOs
- Contract hashes
- Service URLs

### Full Flow Test

1. Open http://localhost:5173
2. Connect wallet (Lace Emulator or Flint devmode)
3. Fund address: `./faucet.sh <your-address>`
4. Enter skill request
5. Match providers
6. Lock funds (escrow)
7. Attest learner + mentor
8. Claim funds
9. Mint NFT

## 📋 Services

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Ogmios | 1337 | http://localhost:1337 | Chain queries & tx building |
| Kupo | 1442 | http://localhost:1442 | UTxO indexing |
| Faucet | 8090 | http://localhost:8090 | Infinite ADA funding |
| Node 1 | 3001 | - | Cardano node |

## 🔧 Scripts

### setup-devnet.sh
- Generates genesis
- Creates keys
- Funds payment address
- Creates node configs

### faucet.sh
- Funds any address with 5000 ADA
- Uses local node
- Returns transaction hash

### query-utxo.sh
- Queries UTXOs for an address
- Uses local node

### restart.sh
- Restarts all services
- Preserves data

### deploy-aiken.sh
- Builds Aiken contracts
- Gets validator hashes
- Generates script addresses

## 🛠️ Troubleshooting

### Nodes not starting

```bash
# Check logs
docker-compose logs cardano-node-1

# Check if ports are available
lsof -i :3001,3002,3003,1337,1442,8090

# Restart
./restart.sh
```

### Kupo not syncing

```bash
# Check Kupo status
curl http://localhost:1442/health

# Check Kupo logs
docker-compose logs kupo

# Restart Kupo
docker-compose restart kupo
```

### Faucet not working

```bash
# Check faucet logs
docker-compose logs faucet

# Test faucet API
curl http://localhost:8090/health

# Check if keys exist
ls -la keys/payment.*
```

### Backend can't connect

```bash
# Check if services are running
docker-compose ps

# Test Ogmios
curl -X POST http://localhost:1337 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"queryNetwork/tip","id":1}'

# Test Kupo
curl http://localhost:1442/health
```

## 📝 Notes

- All transactions confirm instantly (no epoch waiting)
- Infinite ADA available via faucet
- Aiken contracts work exactly like preprod
- CIP-30 wallets connect via emulator/devmode
- No real testnet or faucet required
- All data is local (reset by deleting `data/` directory)

## 🎯 Complete Flow

1. ✅ Setup devnet: `./setup-devnet.sh`
2. ✅ Start services: `docker-compose up -d`
3. ✅ Deploy contracts: `./deploy-aiken.sh`
4. ✅ Configure backend: Create `.env.local`
5. ✅ Configure frontend: Create `.env.development`
6. ✅ Start backend: `npm run dev`
7. ✅ Start frontend: `npm run dev`
8. ✅ Connect wallet
9. ✅ Fund address: `./faucet.sh <address>`
10. ✅ Run complete SkillForge flow!

## 🚀 Status

**COMPLETE** - Local devnet is fully functional:
- ✅ Docker Compose setup
- ✅ Genesis generation
- ✅ Key generation
- ✅ Ogmios integration
- ✅ Kupo integration
- ✅ Faucet server
- ✅ Aiken deployment
- ✅ Backend integration
- ✅ Frontend integration
- ✅ End-to-end test endpoint

The SkillForge local devnet is ready to use!



