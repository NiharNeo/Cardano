# SkillForge Backend Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Database**
   ```bash
   createdb skillforge
   psql skillforge < migrations/001_create_users.sql
   psql skillforge < migrations/002_create_providers.sql
   psql skillforge < migrations/003_create_sessions.sql
   psql skillforge < migrations/004_create_escrow_state.sql
   psql skillforge < migrations/005_create_nft_metadata.sql
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Server**
   ```bash
   npm run dev
   ```

## Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/skillforge

# Cardano
CARDANO_NETWORK=testnet
BLOCKFROST_PROJECT_ID=your_key_here

# IPFS
PINATA_API_KEY=your_key_here
PINATA_SECRET_KEY=your_secret_here

# Scripts (paths to compiled .plutus files)
ESCROW_SCRIPT_PATH=../contracts/escrow.plutus
NFT_POLICY_SCRIPT_PATH=../contracts/nft-policy.plutus
```

## Database Schema

- **users** - User accounts linked to wallet addresses
- **providers** - Provider profiles with skills and rates
- **sessions** - Learning sessions between learners and providers
- **escrow_state** - Escrow transaction state tracking
- **nft_metadata** - NFT metadata and IPFS CIDs

## API Testing

Use curl or Postman to test endpoints:

```bash
# Match providers
curl -X POST http://localhost:4000/match \
  -H "Content-Type: application/json" \
  -d '{"skill": "cardano", "budget": 80, "duration": 60}'

# Initialize escrow
curl -X POST http://localhost:4000/escrow/init \
  -H "Content-Type: application/json" \
  -d '{
    "learnerAddress": "addr1...",
    "providerAddress": "addr1...",
    "price": 80,
    "sessionId": "session_123"
  }'
```

## Production Deployment

1. Build TypeScript:
   ```bash
   npm run build
   ```

2. Set `NODE_ENV=production` in environment

3. Use process manager (PM2, systemd, etc.)

4. Set up database connection pooling

5. Configure CORS for production domain

