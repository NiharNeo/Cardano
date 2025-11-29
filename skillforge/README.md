## SkillForge – Cardano Hackathon Demo

SkillForge is a small end-to-end prototype that showcases:

- **Voice / text intent capture**
- **Rule-based intent parsing**
- **Provider matching and scoring**
- **Escrow-style UX simulation**
- **IPFS-ready Skill NFT metadata generation**
- **Template Cardano mint transaction builder + backend integration points**

The project is split into a **React + TypeScript frontend (Vite)** and a minimal **Express backend**.

---

### Project layout

- `frontend/` – Vite + React + TypeScript app
  - `src/components/VoiceInput.tsx` – Web Speech API + text fallback
  - `src/utils/intentParser.ts` – rule-based intent parser
  - `src/data/providers.json` – sample provider dataset
  - `src/components/ProviderList.tsx` – provider ranking UI
  - `src/components/EscrowModal.tsx` – escrow lock simulation (fake TX ID)
  - `src/components/NFTCard.tsx` – IPFS-ready NFT metadata visualizer
  - `src/cardano/buildMintTx.ts` – unsigned mint transaction builder (CBOR hex)
  - `src/App.tsx` – full flow wiring
- `server/`
  - `server.js` – Express server with `/protocol-params` and `/utxos/:address`

---

### Prerequisites

- Node.js 18+ (recommended)
- npm 9+ (or compatible)

---

### Frontend – run the SkillForge demo

```bash
cd skillforge/frontend
npm install
npm run dev
```

Then open the printed URL (usually `http://localhost:5173`) in a modern browser.

**What you can try:**

- Click **“Speak intent”** and say something like:
  - `I need a Cardano smart contract mentor for 1 hour, under 80 ADA.`
- Or type the same into the intent box and click **“Match providers”**.
- Review the **parsed intent** chips and top **provider matches**.
- Click **“Start escrow”** on a provider to open the escrow modal and generate a **fake TX ID**.
- Click **“Complete service & mint NFT”** to generate an **IPFS-ready NFT JSON** in the right-hand card.

> Note: Voice input depends on the browser’s Web Speech API. If unsupported (or blocked), the UI falls back cleanly to text input.

---

### Backend – Express + Blockfrost template

The backend is optional for the UI demo but provided as a template for a real Cardano integration.

```bash
cd skillforge/server
npm install
```

Create a `.env` file in `server/`:

```env
BLOCKFROST_PROJECT_ID=your_blockfrost_key_here
# Optional: override URL if using testnet / custom env
# BLOCKFROST_BASE_URL=https://cardano-preprod.blockfrost.io/api/v0
PORT=4000
```

Run the server:

```bash
cd skillforge/server
npm start
```

The server exposes:

- `GET /protocol-params` – protocol parameters (calls Blockfrost when configured, otherwise returns a stub aligned with `buildMintTx.ts` placeholders)
- `GET /utxos/:address` – UTXO set for a given address (Blockfrost-compatible shape)

You would typically:

1. **Fetch protocol params + UTXOs** from this backend.
2. Pass them into `buildMintTxUnsignedCborHex` in `src/cardano/buildMintTx.ts`.
3. Hand the resulting CBOR hex to a Cardano wallet (CIP-30) for signing and submission.

---

### Cardano mint transaction builder (frontend)

`src/cardano/buildMintTx.ts` exports:

- `buildMintTxUnsignedCborHex(args)`:
  - **Inputs:**
    - `userAddressBech32` – user wallet address in bech32
    - `utxos` – UTXO set (Blockfrost format, e.g. from `/utxos/:address`)
    - `metadataCid` – IPFS CID for the NFT metadata JSON
    - `policyIdHex` – minting policy ID (hex)
    - `assetName` – asset name to mint (e.g. `SkillForgeSession001`)
  - **Output:**
    - Hex-encoded CBOR of an **unsigned Cardano transaction** that mints exactly one NFT and
      attaches 721 metadata with the IPFS CID.

Inline comments indicate where **real protocol parameters** should be wired in using data from
`/protocol-params`.

---

### Notes & extension ideas

- The demo keeps everything **in-memory** – no real ADA moves, and no wallet connection.
- To turn this into a full dapp you could:
  - Wire the frontend to the backend endpoints for real protocol params / UTXOs.
  - Pin the generated NFT metadata to IPFS (e.g. via a pinning service).
  - Use a Cardano wallet (CIP-30 API) to sign & submit the CBOR tx produced by `buildMintTx`.
  - Replace the static provider dataset with a database or on-chain registry.


