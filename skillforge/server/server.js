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
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory storage for escrow status (in production, use a database)
const escrowStore = new Map();

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

// POST /match - Provider matching endpoint
// In production, this would use ML models or advanced scoring algorithms
app.post('/match', async (req, res) => {
  try {
    const { skill, priceMax, durationMinutes, urgency } = req.body;

    // Import providers data (in production, fetch from database)
    const providers = require('../frontend/src/data/providers.json');

    // Simple scoring algorithm (can be enhanced)
    const scored = providers.map((p) => {
      let score = 0;
      const reasons = [];

      // Skill match
      if (skill) {
        const lowerSkill = skill.toLowerCase();
        const matches = p.skills.filter(
          (s) => lowerSkill.includes(s.toLowerCase()) || s.toLowerCase().includes(lowerSkill)
        );
        if (matches.length > 0) {
          score += 45;
          reasons.push(`Skill match: ${matches.join(', ')}`);
        }
      }

      // Price fit
      if (priceMax != null) {
        if (p.hourlyRateAda <= priceMax) {
          const budgetHeadroom = priceMax - p.hourlyRateAda;
          const budgetScore = Math.max(0, Math.min(25, 25 - budgetHeadroom * 0.3));
          score += 25 + budgetScore * 0.4;
          reasons.push(`Within budget (${p.hourlyRateAda} ₳ ≤ ${priceMax} ₳)`);
        } else {
          score -= 10;
          reasons.push(`Above budget (${p.hourlyRateAda} ₳ > ${priceMax} ₳)`);
        }
      }

      // Rating
      const ratingScore = (p.rating / 5) * 20;
      score += ratingScore;
      reasons.push(`Strong rating (${p.rating.toFixed(1)}★)`);

      // Availability
      if (p.availability.includes('today')) {
        score += 8;
        reasons.push('Available today');
      } else if (p.availability.includes('this week')) {
        score += 4;
        reasons.push('Available this week');
      }

      // Urgency boost
      if (urgency === 'high' && p.availability.includes('today')) {
        score += 5;
        reasons.push('Urgent request - available today');
      }

      return {
        ...p,
        score: Math.max(0, Math.min(100, score)),
        reasons
      };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);

    const summaryParts = [];
    if (skill) summaryParts.push(`skill ≈ "${skill}"`);
    if (priceMax != null) summaryParts.push(`budget ≤ ${priceMax} ₳`);
    if (durationMinutes != null) summaryParts.push(`duration ≈ ${durationMinutes} min`);
    if (urgency) summaryParts.push(`urgency: ${urgency}`);

    res.json({
      providers: sorted,
      summary: `Parsed intent → ${summaryParts.join(' • ')}`
    });
  } catch (err) {
    console.error('Error in /match:', err.message);
    res.status(500).json({ error: 'Failed to match providers' });
  }
});

// POST /escrow/init - Initialize escrow transaction
// In production, this would build a real Cardano transaction with escrow script
app.post('/escrow/init', async (req, res) => {
  try {
    const { providerId, userAddress, amountAda, durationMinutes } = req.body;

    if (!providerId || !userAddress || !amountAda) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const escrowId = uuidv4();
    const amountLovelace = Math.floor(amountAda * 1000000);

    // Store escrow state
    escrowStore.set(escrowId, {
      id: escrowId,
      providerId,
      userAddress,
      amountAda,
      amountLovelace,
      durationMinutes,
      status: 'pending',
      txId: null,
      lockedAt: null,
      createdAt: new Date().toISOString()
    });

    // In production, build actual Cardano transaction here
    // For now, return a placeholder CBOR hex
    // This would use @emurgo/cardano-serialization-lib or similar
    const escrowTxCbor = 'placeholder_cbor_hex'; // Replace with actual transaction building

    // In production, escrow address would be derived from the script
    const escrowAddress = 'addr1...'; // Replace with actual escrow script address

    res.json({
      escrowId,
      escrowTxCbor,
      escrowAddress
    });
  } catch (err) {
    console.error('Error in /escrow/init:', err.message);
    res.status(500).json({ error: 'Failed to initialize escrow' });
  }
});

// GET /escrow/:id/status - Check escrow status (UTXO watcher)
app.get('/escrow/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const escrow = escrowStore.get(id);

    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // In production, check actual UTXO on-chain
    // For now, simulate status progression
    let status = escrow.status;
    if (escrow.txId && escrow.status === 'pending') {
      status = 'locked';
      escrow.status = 'locked';
      escrow.lockedAt = escrow.lockedAt || new Date().toISOString();
    }

    res.json({
      status,
      txId: escrow.txId,
      lockedAt: escrow.lockedAt,
      completedAt: escrow.completedAt || null
    });
  } catch (err) {
    console.error('Error in /escrow/:id/status:', err.message);
    res.status(500).json({ error: 'Failed to get escrow status' });
  }
});

// POST /nft/mint - Mint NFT with policy script
// In production, this would build a real Cardano mint transaction
app.post('/nft/mint', async (req, res) => {
  try {
    const { escrowId, providerId, skill, rating, sessionDate, durationMinutes, budget, urgency, metadataCid } = req.body;

    if (!escrowId || !providerId || !skill || !metadataCid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const escrow = escrowStore.get(escrowId);
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Update escrow status
    escrow.status = 'completed';
    escrow.completedAt = new Date().toISOString();

    // In production, build actual Cardano mint transaction here
    // This would use @emurgo/cardano-serialization-lib or similar
    const mintTxCbor = 'placeholder_mint_cbor_hex'; // Replace with actual transaction building
    const policyId = 'policy_id_hex'; // Replace with actual policy ID
    const assetName = `SkillForgeSession${escrowId.slice(0, 8)}`;

    res.json({
      mintTxCbor,
      policyId,
      assetName,
      txHash: null // Will be set after transaction is submitted
    });
  } catch (err) {
    console.error('Error in /nft/mint:', err.message);
    res.status(500).json({ error: 'Failed to mint NFT' });
  }
});

app.get('/', (_req, res) => {
  res.json({
    name: 'SkillForge backend',
    status: 'ok',
    endpoints: [
      '/protocol-params',
      '/utxos/:address',
      'POST /match',
      'POST /escrow/init',
      'GET /escrow/:id/status',
      'POST /nft/mint'
    ]
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SkillForge backend listening on http://localhost:${port}`);
});


