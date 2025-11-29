# SkillForge Local Devnet

Complete Cardano local development network for SkillForge with infinite ADA and instant confirmations.

## 🚀 Quick Start

### 1. Setup Devnet

```bash
cd devnet
./setup-devnet.sh
```

This will:
- Generate genesis configuration
- Create payment and stake keys
- Fund payment address with 500,000 ADA
- Create node configuration files

### 2. Start Services

```bash
docker-compose up -d
```

Starts:
- 3 Cardano nodes
- Ogmios server (port 1337)
- Kupo indexer (port 1442)
- Faucet server (port 8090)

### 3. Wait for Sync

```bash
# Check node status
docker-compose logs -f cardano-node-1

# Check if synced
docker exec skillforge-node-1 cardano-cli query tip --testnet-magic 42 --socket-path /data/node.socket
```

### 4. Deploy Aiken Contracts

```bash
./deploy-aiken.sh
```

This will:
- Build Aiken contracts
- Get validator hashes
- Generate script addresses
- Save to `backend/contracts/`

### 5. Fund Your Address

```bash
# Fund any address with 5000 ADA
./faucet.sh addr_test1...

# Or use the HTTP API
curl -X POST http://localhost:8090/fund \
  -H "Content-Type: application/json" \
  -d '{"address": "addr_test1..."}'
```

### 6. Query UTXOs

```bash
./query-utxo.sh addr_test1...
```

## 📋 Services

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Ogmios | 1337 | http://localhost:1337 | Chain queries & tx building |
| Kupo | 1442 | http://localhost:1442 | UTxO indexing |
| Faucet | 8090 | http://localhost:8090 | Infinite ADA funding |
| Node 1 | 3001 | - | Cardano node |

## 🔧 Configuration

### Backend

Create `backend/.env.local`:

```env
NETWORK=local
OGMIOS_URL=http://localhost:1337
KUPO_URL=http://localhost:1442
DEVNET_MAGIC=42
```

### Frontend

Create `frontend/.env.development`:

```env
VITE_NETWORK=local
VITE_DEVNET_MAGIC=42
VITE_OGMIOS=http://localhost:1337
VITE_KUPO=http://localhost:1442
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

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Connect wallet (Lace Emulator or Flint devmode)
4. Fund address: `./faucet.sh <your-address>`
5. Run complete SkillForge flow

## 🔑 Key Files

- `keys/payment.addr` - Faucet address (funded with 500,000 ADA)
- `keys/payment.skey` - Faucet signing key
- `genesis/` - Genesis configuration
- `configs/` - Node configuration files

## 🛠️ Troubleshooting

### Nodes not starting

```bash
# Check logs
docker-compose logs cardano-node-1

# Restart
./restart.sh
```

### Kupo not syncing

```bash
# Check Kupo status
curl http://localhost:1442/health

# Restart Kupo
docker-compose restart kupo
```

### Faucet not working

```bash
# Check faucet logs
docker-compose logs faucet

# Test faucet API
curl http://localhost:8090/health
```

## 📝 Notes

- All transactions confirm instantly (no waiting for epochs)
- Infinite ADA available via faucet
- Aiken contracts work exactly like preprod
- CIP-30 wallets connect via emulator/devmode
- No real testnet or faucet required

## 🎯 Next Steps

1. Build Aiken contracts: `cd ../contracts/skillforge && aiken build`
2. Deploy contracts: `./deploy-aiken.sh`
3. Start backend: `cd ../backend && npm run dev`
4. Start frontend: `cd ../frontend && npm run dev`
5. Test full flow!



