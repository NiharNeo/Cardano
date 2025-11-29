# SkillForge End-to-End Integration Guide

This document describes the complete end-to-end flow connecting frontend, backend, and Cardano smart contracts.

## Complete Flow

### 1. Describe Skill (Text/Voice)
- User enters text or uses voice input
- Frontend: `VoiceInput` component captures input
- **Output**: Raw text string

### 2. Parse Intent
- Frontend: `parseIntent()` utility function
- Extracts: `skill`, `duration`, `budget`, `urgency`
- **Output**: `ParsedIntent` object

### 3. Match Providers (Database)
- Frontend: Calls `POST /match` API
- Backend: Queries PostgreSQL `providers` table
- Backend: Scores providers based on criteria
- **Output**: Ranked list of providers with scores

### 4. Select Mentor
- User clicks "Select Mentor" on provider card
- Frontend: Opens `EscrowModal`
- **Output**: Selected provider

### 5. Lock Funds → Plutus Escrow
- Frontend: Calls `POST /session/create` to create session
- Backend: Creates session in database
- Frontend: Calls `POST /escrow/init`
- Backend: Builds escrow transaction using Plutus script
- Frontend: Signs transaction via CIP-30 wallet
- Frontend: Submits transaction to Cardano network
- Frontend: Calls `POST /escrow/update` with transaction ID
- Backend: Updates escrow state in database
- **Output**: Escrow locked, funds in script-controlled UTXO

### 6. Session Active
- Frontend: Polls `POST /escrow/status` every 5 seconds
- Backend: Checks escrow UTXO status
- **Output**: Session status = 'active'

### 7. Submit Both Attestations
- Learner clicks "Attest as Learner"
- Frontend: Calls `POST /session/attest` with learner wallet
- Backend: Updates session, checks if both attested
- Provider clicks "Attest as Provider"
- Frontend: Calls `POST /session/attest` with provider wallet
- Backend: Updates session status to 'completed'
- **Output**: Both parties attested, session ready for NFT minting

### 8. Mint NFT → Minting Policy
- User clicks "Mint NFT" (optionally uploads image)
- Frontend: Calls `POST /nft/mint` with sessionId and optional image
- Backend: Generates NFT metadata JSON
- Backend: Uploads metadata to IPFS via Pinata → gets metadata CID
- Backend: Uploads image to IPFS via Pinata → gets image CID (if provided)
- Backend: Builds minting transaction using NFT minting policy
- Frontend: Signs transaction via CIP-30 wallet
- Frontend: Submits transaction to Cardano network
- Frontend: Calls `POST /nft/update` with transaction hash
- Backend: Updates NFT metadata as minted in database
- **Output**: NFT minted on-chain, metadata and image on IPFS

### 9. Store Real Metadata on IPFS
- Backend: `uploadMetadata()` function uploads JSON to Pinata
- Backend: `uploadImage()` function uploads PNG to Pinata
- Both CIDs stored in `nft_metadata` table
- **Output**: Permanent IPFS storage with CIDs

### 10. Update Database
- Session status → 'paid'
- NFT metadata → `minted = true`, `minted_at = timestamp`
- Escrow state → 'completed'
- **Output**: All data persisted in PostgreSQL

### 11. Show NFT in Frontend
- Frontend: Displays NFT in `NFTMetadataViewer` component
- Shows: Image (if uploaded), metadata JSON, IPFS links
- User can download JSON metadata
- **Output**: Complete NFT display with IPFS links

## API Endpoints

### Frontend → Backend

1. **POST /match**
   - Input: `{ skill, duration, budget, urgency }`
   - Output: `{ providers[], summary }`

2. **POST /session/create**
   - Input: `{ learnerAddress, providerId, skill, budget, duration, urgency }`
   - Output: `{ sessionId }`

3. **POST /escrow/init**
   - Input: `{ learnerAddress, providerAddress, price, sessionId }`
   - Output: `{ txBody, escrowAddress, escrowId }`

4. **POST /escrow/update**
   - Input: `{ sessionId, txId, utxo }`
   - Output: `{ success }`

5. **POST /escrow/status**
   - Input: `{ sessionId }`
   - Output: `{ status, txId, lockedAt, completedAt }`

6. **POST /session/attest**
   - Input: `{ sessionId, wallet }`
   - Output: `{ success, bothAttested, message }`

7. **POST /nft/mint**
   - Input: `FormData { sessionId, eventCardImage? }`
   - Output: `{ txBody, policyId, assetName, ipfsCid, imageCid, metadataUrl, imageUrl }`

8. **POST /nft/update**
   - Input: `{ sessionId, txHash }`
   - Output: `{ success }`

## Database Flow

```
users (wallet_address)
  ↓
sessions (learner_id, provider_id, skill, budget, duration, status)
  ↓
escrow_state (session_id, utxo, status)
  ↓
nft_metadata (session_id, ipfs_hash, image_cid, metadata_json, minted)
```

## Transaction Flow

### Escrow Transaction
1. Backend builds unsigned transaction with Plutus script
2. Frontend signs with CIP-30 wallet
3. Frontend submits to Cardano network
4. Transaction ID stored in `escrow_state.utxo`

### NFT Minting Transaction
1. Backend uploads metadata and image to IPFS
2. Backend builds minting transaction with NFT policy
3. Frontend signs with CIP-30 wallet
4. Frontend submits to Cardano network
5. Transaction hash stored in `nft_metadata` (via update endpoint)

## Production Checklist

### Frontend
- [x] Wallet connection (CIP-30)
- [x] Intent parsing
- [x] Provider matching UI
- [x] Escrow transaction signing
- [x] Attestation UI
- [x] NFT minting UI
- [x] NFT display component
- [x] Error handling
- [x] Loading states
- [x] Transaction status polling

### Backend
- [x] Provider matching (PostgreSQL)
- [x] Session creation
- [x] Escrow transaction building
- [x] Escrow status polling
- [x] Attestation handling
- [x] NFT metadata generation
- [x] IPFS upload (Pinata)
- [x] NFT minting transaction building
- [x] Database updates

### Smart Contracts
- [x] Escrow contract (Plutus V2)
- [x] NFT minting policy (Plutus V2)
- [ ] Contract compilation and deployment
- [ ] Integration with transaction building

### Infrastructure
- [ ] PostgreSQL database setup
- [ ] Pinata API keys configured
- [ ] Blockfrost API key configured
- [ ] Plutus scripts compiled
- [ ] Environment variables set
- [ ] CORS configured
- [ ] Error logging
- [ ] Transaction monitoring

## Testing the Flow

1. **Start Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Connect Wallet**
   - Install Lace/Eternl/Nami
   - Click "Connect Wallet" in frontend
   - Select wallet

4. **Test Flow**
   - Enter: "I need a Cardano smart contract mentor for 1 hour, under 80 ADA"
   - Review parsed intent
   - Select a provider
   - Lock funds in escrow
   - Submit attestations
   - Mint NFT
   - View NFT with IPFS links

## Troubleshooting

- **Wallet not connecting**: Check browser console, ensure wallet extension is installed
- **No providers found**: Check database has provider data, verify query
- **Transaction fails**: Check wallet has enough ADA, verify network (testnet/mainnet)
- **IPFS upload fails**: Verify Pinata API keys in `.env`
- **Escrow status not updating**: Check polling interval, verify backend is running

