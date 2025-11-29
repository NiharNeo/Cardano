// Minimal Express backend template for SkillForge.
// Exposes:
// - GET /protocol-params      → protocol parameters for building Cardano txs
// - GET /utxos/:address       → UTXO set for a given address (via Blockfrost)
//
// This file is intentionally lightweight and suitable as a starting point
// for a full Cardano backend. Make sure to set BLOCKFROST_PROJECT_ID in
// your environment before running in a real project.

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const BLOCKFROST_BASE_URL =
  process.env.BLOCKFROST_BASE_URL || 'https://cardano-mainnet.blockfrost.io/api/v0';

if (!BLOCKFROST_PROJECT_ID) {
  // This warning keeps things hackathon-friendly: you can still run the server
  // and see the stub responses even without a real Blockfrost key.
  // eslint-disable-next-line no-console
  console.warn(
    'Warning: BLOCKFROST_PROJECT_ID is not set. Real Cardano queries will not work until you configure it.'
  );
}

// GET /protocol-params
// In a production environment you would proxy to Blockfrost's
// /epochs/latest/parameters endpoint or your own Cardano node.
app.get('/protocol-params', async (_req, res) => {
  if (!BLOCKFROST_PROJECT_ID) {
    return res.json({
      from: 'stub',
      // A tiny subset of protocol fields that mirror the placeholders used in buildMintTx.ts
      linearFee: {
        min_fee_a: '44',
        min_fee_b: '155381'
      },
      coins_per_utxo_word: '34482',
      pool_deposit: '500000000',
      key_deposit: '2000000'
    });
  }

  try {
    const response = await axios.get(`${BLOCKFROST_BASE_URL}/epochs/latest/parameters`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });
    return res.json(response.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching protocol params from Blockfrost:', err.message);
    return res.status(500).json({ error: 'Failed to fetch protocol params from Blockfrost' });
  }
});

// GET /utxos/:address
// Returns the UTXO set for the given address in a Blockfrost-compatible shape.
app.get('/utxos/:address', async (req, res) => {
  const { address } = req.params;
  if (!BLOCKFROST_PROJECT_ID) {
    return res.json({
      from: 'stub',
      address,
      utxos: []
    });
  }

  try {
    const response = await axios.get(`${BLOCKFROST_BASE_URL}/addresses/${address}/utxos`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });
    return res.json(response.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching UTXOs from Blockfrost:', err.message);
    return res.status(500).json({ error: 'Failed to fetch UTXOs from Blockfrost' });
  }
});

app.get('/', (_req, res) => {
  res.json({
    name: 'SkillForge backend',
    status: 'ok',
    endpoints: ['/protocol-params', '/utxos/:address']
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SkillForge backend listening on http://localhost:${port}`);
});


