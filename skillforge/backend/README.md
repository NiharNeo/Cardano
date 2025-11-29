# SkillForge Backend API

Node.js + Express + TypeScript backend for SkillForge with PostgreSQL, Cardano integration, and IPFS.

## Features

- **Provider Matching** - Query and rank providers based on skill, budget, and duration
- **Escrow Management** - Initialize and track escrow transactions
- **Session Attestation** - Record learner and provider attestations
- **NFT Minting** - Generate metadata, upload to IPFS (Pinata), and build minting transactions
- **PostgreSQL Database** - Persistent storage for all data
- **Cardano Integration** - Build transactions using cardano-serialization-lib
- **IPFS Upload** - Upload NFT metadata and images to Pinata

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Cardano Plutus scripts (compiled)
- Blockfrost API key (optional, for on-chain queries)
- Pinata API keys (for IPFS uploads)

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
psql -d skillforge -f migrations/001_create_users.sql
psql -d skillforge -f migrations/002_create_providers.sql
psql -d skillforge -f migrations/003_create_sessions.sql
psql -d skillforge -f migrations/004_create_escrow_state.sql
psql -d skillforge -f migrations/005_create_nft_metadata.sql
```

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `BLOCKFROST_PROJECT_ID` - Blockfrost API key
- `PINATA_API_KEY` - Pinata API key
- `PINATA_SECRET_KEY` - Pinata secret key
- `ESCROW_SCRIPT_PATH` - Path to compiled escrow.plutus
- `NFT_POLICY_SCRIPT_PATH` - Path to compiled nft-policy.plutus

## API Endpoints

### POST /match

Match providers based on criteria.

**Request:**
```json
{
  "skill": "cardano",
  "duration": 60,
  "budget": 80,
  "urgency": "medium"
}
```

**Response:**
```json
{
  "providers": [...],
  "summary": "Parsed intent → skill ≈ \"cardano\" • budget ≤ 80 ₳"
}
```

### POST /escrow/init

Initialize escrow transaction.

**Request:**
```json
{
  "learnerAddress": "addr1...",
  "providerAddress": "addr1...",
  "price": 80,
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "txBody": "hex_string",
  "escrowAddress": "addr1...",
  "escrowId": "uuid"
}
```

### POST /escrow/status

Check escrow status.

**Request:**
```json
{
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "status": "locked",
  "txId": "tx_hash",
  "lockedAt": "2024-01-01T00:00:00Z"
}
```

### POST /session/attest

Record attestation.

**Request:**
```json
{
  "sessionId": "uuid",
  "wallet": "addr1..."
}
```

**Response:**
```json
{
  "success": true,
  "bothAttested": false,
  "message": "Attestation recorded. Waiting for other party."
}
```

### POST /nft/mint

Mint NFT for completed session. Supports image upload via multipart/form-data.

**Request (multipart/form-data):**
- `sessionId` (string) - Session UUID
- `eventCardImage` (file, optional) - PNG image file

**Response:**
```json
{
  "txBody": "hex_string",
  "policyId": "policy_id_hex",
  "assetName": "SkillForge-Session-uuid",
  "ipfsCid": "Qm...",
  "imageCid": "Qm...",
  "metadataUrl": "https://gateway.pinata.cloud/ipfs/Qm...",
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm..."
}
```

## IPFS Functions

### uploadMetadata(metadata: any)

Uploads JSON metadata to IPFS via Pinata and returns the CID.

```typescript
import { uploadMetadata } from './services/ipfs';

const metadata = { name: 'NFT', description: '...' };
const cid = await uploadMetadata(metadata);
```

### uploadImage(imagePath: string | Buffer, fileName?: string)

Uploads PNG image to IPFS via Pinata and returns the CID.

```typescript
import { uploadImage } from './services/ipfs';

// From file path
const cid = await uploadImage('./path/to/image.png', 'image.png');

// From Buffer
const buffer = fs.readFileSync('./path/to/image.png');
const cid = await uploadImage(buffer, 'image.png');
```

## Database Schema

### nft_metadata

Stores NFT metadata with both metadata and image CIDs:

- `session_id` (uuid, PK) - References sessions.id
- `ipfs_hash` (text) - CID of metadata JSON
- `image_cid` (text) - CID of image (if uploaded)
- `metadata_json` (jsonb) - Full metadata object
- `minted` (boolean) - Whether NFT has been minted
- `minted_at` (timestamp) - When NFT was minted

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts       # PostgreSQL connection
│   ├── routes/
│   │   ├── match.ts          # Provider matching
│   │   ├── escrow.ts         # Escrow management
│   │   ├── session.ts        # Session attestation
│   │   └── nft.ts            # NFT minting
│   ├── services/
│   │   ├── cardano.ts        # Cardano transaction building
│   │   └── ipfs.ts           # IPFS upload (Pinata)
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── index.ts              # Express app
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_providers.sql
│   ├── 003_create_sessions.sql
│   ├── 004_create_escrow_state.sql
│   └── 005_create_nft_metadata.sql
├── uploads/                  # Temporary image uploads (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Notes

- Cardano transaction building is simplified - production should use proper UTXO selection and fee calculation
- IPFS uploads require Pinata API keys
- Database migrations should be run before starting the server
- Plutus scripts must be compiled before use
- Uploaded images are automatically cleaned up after IPFS upload
- Image upload is optional - NFT can be minted without image
