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
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory storage for escrow status (in production, use a database)
const escrowStore = new Map();

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const BLOCKFROST_BASE_URL =
  process.env.BLOCKFROST_BASE_URL || 'https://cardano-preprod.blockfrost.io/api/v0';

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
    // Mock data for the specific test address
    if (address === 'addr_test1qp6m4w67w2lveaskxm54ppwz825nwd7cnt2elhcctz7m0hjvzxm7s4m6nlxj93d98f7d73hxa2damsk02pzh2qq6t7yqcycgx0') {
      return res.json([
        {
          "tx_hash": "d8216e3defbdc23d45fa27a33bb869bff12616a1475178abf76c2ee24323effb",
          "output_index": 4,
          "amount": [{ "unit": "lovelace", "quantity": "5000000" }],
          "block": "mock_block",
          "data_hash": null
        },
        {
          "tx_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "output_index": 0,
          "amount": [{ "unit": "lovelace", "quantity": "995000000" }],
          "block": "mock_block",
          "data_hash": null
        }
      ]);
    }

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
    const staticProviders = require('../frontend/src/data/providers.json');

    // Load dynamic tutors
    let dynamicTutors = [];
    try {
      const fs = require('fs');
      const path = require('path');
      const tutorsPath = path.join(__dirname, 'tutors.json');
      if (fs.existsSync(tutorsPath)) {
        const data = fs.readFileSync(tutorsPath, 'utf8');
        dynamicTutors = JSON.parse(data);
      }
    } catch (err) {
      console.error('Error loading dynamic tutors:', err.message);
    }

    // Merge providers (dynamic tutors take precedence or append)
    // For now, we'll just append them. 
    // Map dynamic tutor structure to provider structure if needed.
    const formattedDynamicTutors = dynamicTutors.map(t => ({
      id: t.id,
      name: t.name,
      skills: t.skills,
      rating: 5.0, // Default for new tutors
      cost_per_hour: t.rateADA,
      availability: t.availability.map(a => `${a.day} ${a.from}-${a.to}`),
      timezone: 'UTC', // Default
      bio: t.bio
    }));

    const providers = [...staticProviders, ...formattedDynamicTutors];

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
        // Handle both string and number types for cost
        const rate = Number(p.cost_per_hour || p.hourlyRateAda || 0);
        if (rate <= priceMax) {
          const budgetHeadroom = priceMax - rate;
          const budgetScore = Math.max(0, Math.min(25, 25 - budgetHeadroom * 0.3));
          score += 25 + budgetScore * 0.4;
          reasons.push(`Within budget (${rate} ₳ ≤ ${priceMax} ₳)`);
        } else {
          score -= 10;
          reasons.push(`Above budget (${rate} ₳ > ${priceMax} ₳)`);
        }
      }

      // Rating
      const rating = Number(p.rating || 0);
      const ratingScore = (rating / 5) * 20;
      score += ratingScore;
      reasons.push(`Strong rating (${rating.toFixed(1)}★)`);

      // Availability
      // Simple check for now
      if (p.availability && p.availability.some(a => a.toLowerCase().includes('today') || a.toLowerCase().includes('monday'))) { // Mock logic
        // In a real app, parse the availability objects against current date
      }

      // Just give some points if they have availability listed
      if (p.availability && p.availability.length > 0) {
        score += 5;
        reasons.push('Has availability');
      }

      // Urgency boost
      if (urgency === 'high') {
        score += 5;
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

// In-memory storage for sessions
const sessionStore = new Map();

// POST /session/create - Create a new session
app.post('/session/create', (req, res) => {
  try {
    const { learnerAddress, providerId, skill, budget, duration, urgency, stakeKey } = req.body;

    if (!learnerAddress || !providerId || !skill) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sessionId = uuidv4();
    const session = {
      sessionId,
      learnerAddress,
      providerId,
      skill,
      budget,
      duration,
      urgency,
      stakeKey,
      status: 'created',
      createdAt: new Date().toISOString()
    };

    sessionStore.set(sessionId, session);
    console.log(`[Session] Created session ${sessionId}`);

    res.json({ sessionId });
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// --- TUTOR MANAGEMENT ENDPOINTS ---

const fs = require('fs');
const path = require('path');
const TUTORS_FILE = path.join(__dirname, 'tutors.json');

// Helper to read tutors
function readTutors() {
  if (!fs.existsSync(TUTORS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TUTORS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Helper to save tutors
function saveTutors(tutors) {
  fs.writeFileSync(TUTORS_FILE, JSON.stringify(tutors, null, 2));
}

// POST /tutors - Create or Update Tutor
app.post('/tutors', (req, res) => {
  try {
    const { id, name, bio, skills, rateADA, minDuration, maxDuration, availability, walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Use wallet address as ID if not provided, or generate one
    const tutorId = id || walletAddress;

    const tutors = readTutors();
    const existingIndex = tutors.findIndex(t => t.id === tutorId || t.walletAddress === walletAddress);

    const newTutor = {
      id: tutorId,
      name,
      bio,
      skills: skills || [],
      rateADA: Number(rateADA),
      minDuration: Number(minDuration),
      maxDuration: Number(maxDuration),
      availability: availability || [],
      walletAddress,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Update
      tutors[existingIndex] = { ...tutors[existingIndex], ...newTutor };
    } else {
      // Create
      tutors.push({ ...newTutor, createdAt: new Date().toISOString() });
    }

    saveTutors(tutors);
    res.json({ success: true, tutor: newTutor });
  } catch (err) {
    console.error('Error saving tutor:', err);
    res.status(500).json({ error: 'Failed to save tutor profile' });
  }
});

// GET /tutors/:id - Get Tutor Profile
app.get('/tutors/:id', (req, res) => {
  const tutors = readTutors();
  const tutor = tutors.find(t => t.id === req.params.id || t.walletAddress === req.params.id);

  if (!tutor) {
    return res.status(404).json({ error: 'Tutor not found' });
  }

  res.json(tutor);
});

// POST /tutors/:id/skills - Update Skills
app.post('/tutors/:id/skills', (req, res) => {
  const { skills } = req.body;
  const tutors = readTutors();
  const index = tutors.findIndex(t => t.id === req.params.id || t.walletAddress === req.params.id);

  if (index === -1) return res.status(404).json({ error: 'Tutor not found' });

  tutors[index].skills = skills;
  saveTutors(tutors);
  res.json({ success: true, skills: tutors[index].skills });
});

// POST /tutors/:id/availability - Update Availability
app.post('/tutors/:id/availability', (req, res) => {
  const { availability } = req.body;
  const tutors = readTutors();
  const index = tutors.findIndex(t => t.id === req.params.id || t.walletAddress === req.params.id);

  if (index === -1) return res.status(404).json({ error: 'Tutor not found' });

  tutors[index].availability = availability;
  saveTutors(tutors);
  res.json({ success: true, availability: tutors[index].availability });
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

// Fixed Receiver Address for Settlement
const RECEIVER_ADDRESS = "addr1q8uqg3e28e3nd7ndxzjryywu4cu5lssvxmlyvnlldr832rlk7lkzl8ry4r5dknr8jeu7xwyhvecusldvw4huenhssxeswf7vdy";

// POST /settleSession - Settle escrow and release funds to receiver
app.post('/settleSession', async (req, res) => {
  try {
    const { escrowId } = req.body;

    if (!escrowId) {
      return res.status(400).json({ error: 'Escrow ID is required' });
    }

    const escrow = escrowStore.get(escrowId);
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // In a real app, we would verify that both parties have attested.
    // For this mock, we assume the frontend calls this only when ready.

    // Update status
    escrow.status = 'settled';
    escrow.settledAt = new Date().toISOString();

    // Build mock settlement transaction
    // This simulates a transaction that spends the escrow UTXO and sends funds to RECEIVER_ADDRESS
    const settlementTxCbor = 'placeholder_settlement_tx_cbor';
    const txHash = `settle_tx_${uuidv4().slice(0, 8)}`;

    res.json({
      success: true,
      txHash,
      receiverAddress: RECEIVER_ADDRESS,
      amountLovelace: escrow.amountLovelace,
      settledAt: escrow.settledAt
    });
  } catch (err) {
    console.error('Error in /settleSession:', err.message);
    res.status(500).json({ error: 'Failed to settle session' });
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

    // Metadata should include the receiver address
    const metadata = {
      name: assetName,
      image: `ipfs://${metadataCid}`,
      description: `SkillForge Session: ${skill}`,
      attributes: {
        providerId,
        rating,
        durationMinutes,
        sent_to: RECEIVER_ADDRESS // Added requirement
      }
    };

    res.json({
      mintTxCbor,
      policyId,
      assetName,
      metadata, // Return metadata for verification
      txHash: null // Will be set after transaction is submitted
    });
  } catch (err) {
    console.error('Error in /nft/mint:', err.message);
    res.status(500).json({ error: 'Failed to mint NFT' });
  }
});

// GET /contracts/info - Get contract hashes
app.get('/contracts/info', (_req, res) => {
  res.json({
    contracts: 'SkillForge',
    version: '1.0.0',
    escrowValidatorHash: 'placeholder_escrow_hash',
    nftPolicyId: 'placeholder_policy_id'
  });
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


