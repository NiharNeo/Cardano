import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeScripts, getControlledStakeKey, getAccountStateKey, getTransactionStatus, TRACKED_TX_HASH } from './services/cardano';
import { pool } from './config/database';
import matchRouter from './routes/match';
import escrowRouter from './routes/escrow';
import sessionRouter from './routes/session';
import nftRouter from './routes/nft';
import testRouter from './routes/test';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS MUST run before all routes
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Initialize Cardano scripts
initializeScripts();

// Health check
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'SkillForge Backend API',
    status: 'ok',
    version: '1.0.0',
    contracts: 'Aiken',
    endpoints: [
      'POST /match',
      'POST /session/create',
      'POST /escrow/init',
      'POST /escrow/update',
      'POST /escrow/status',
      'POST /session/attest',
      'POST /nft/mint',
      'POST /nft/update',
      'POST /register-wallet',
      'GET /contracts/info'
    ]
  });
});

// GET /contracts/info - Get Aiken contract information
app.get('/contracts/info', (req: Request, res: Response) => {
  try {
    const { getEscrowValidatorHash, getNFTPolicyId } = require('./services/cardano');
    const escrowHash = getEscrowValidatorHash();
    const nftPolicyId = getNFTPolicyId();
    const isLocal = process.env.NETWORK === 'local';
    
    // Try to read script addresses from files
    let escrowAddress = null;
    let nftPolicyAddress = null;
    
    try {
      const fs = require('fs');
      const path = require('path');
      const escrowAddrPath = path.join(__dirname, '../contracts/escrow.address');
      const nftPolicyPath = path.join(__dirname, '../contracts/nft.policy');
      
      if (fs.existsSync(escrowAddrPath)) {
        escrowAddress = fs.readFileSync(escrowAddrPath, 'utf8').trim();
      }
      if (fs.existsSync(nftPolicyPath)) {
        nftPolicyAddress = fs.readFileSync(nftPolicyPath, 'utf8').trim();
      }
    } catch (fileError) {
      // Ignore file read errors
    }
    
    res.json({
      success: true,
      data: {
        contracts: 'Aiken',
        version: '1.0.0',
        network: isLocal ? 'local' : 'preprod',
        escrowValidatorHash: escrowHash,
        nftPolicyId: nftPolicyId,
        escrowAddress: escrowAddress,
        nftPolicyAddress: nftPolicyAddress
      }
    });
  } catch (error: any) {
    console.error('Error getting contract info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract info',
      message: error.message
    });
  }
});

// GET /devnet/test - End-to-end test for local devnet
app.get('/devnet/test', async (req: Request, res: Response) => {
  try {
    console.log('[DEVNET TEST] Running end-to-end test...');
    
    const isLocal = process.env.NETWORK === 'local';
    if (!isLocal) {
      return res.status(400).json({
        success: false,
        error: 'This endpoint is only available in local devnet mode'
      });
    }

    // Get test wallet address from devnet keys
    const fs = require('fs');
    const path = require('path');
    const paymentAddrPath = path.join(__dirname, '../../devnet/keys/payment.addr');
    
    let testAddress = null;
    if (fs.existsSync(paymentAddrPath)) {
      testAddress = fs.readFileSync(paymentAddrPath, 'utf8').trim();
    }

    // Get UTXOs
    const { getUTXOs } = require('./services/cardano');
    const utxos = testAddress ? await getUTXOs(testAddress) : [];

    // Get contract info
    const { getEscrowValidatorHash, getNFTPolicyId } = require('./services/cardano');
    const escrowHash = getEscrowValidatorHash();
    const nftPolicyId = getNFTPolicyId();

    res.json({
      success: true,
      data: {
        network: 'local',
        testnetMagic: 42,
        testAddress: testAddress,
        utxos: utxos,
        utxoCount: utxos.length,
        totalLovelace: utxos.reduce((sum: number, utxo: any) => 
          sum + parseInt(utxo.amount[0]?.quantity || '0'), 0
        ),
        escrowValidatorHash: escrowHash,
        nftPolicyId: nftPolicyId,
        services: {
          ogmios: process.env.OGMIOS_URL || 'http://localhost:1337',
          kupo: process.env.KUPO_URL || 'http://localhost:1442',
          faucet: process.env.FAUCET_URL || 'http://localhost:8090'
        },
        message: 'Local devnet is ready! You can now test the full SkillForge flow.'
      }
    });
  } catch (error: any) {
    console.error('[DEVNET TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Devnet test failed',
      message: error.message
    });
  }
});

// Routes
app.use('/match', matchRouter);
app.use('/escrow', escrowRouter);
app.use('/session', sessionRouter);
app.use('/nft', nftRouter);
app.use('/test', testRouter);

// GET /utxos/:address - Get UTXOs for an address
app.get('/utxos/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    // Get UTXOs from Cardano service
    const { getUTXOs } = require('./services/cardano');
    const utxos = await getUTXOs(address);
    
    return res.json({
      success: true,
      address,
      utxos: utxos || [],
      count: utxos?.length || 0
    });
  } catch (error: any) {
    console.error('Error fetching UTXOs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch UTXOs',
      message: error.message
    });
  }
});

// GET /tx/status/:txHash - Check transaction status
app.get('/tx/status/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    
    if (!txHash || txHash.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction hash format'
      });
    }

    const status = await getTransactionStatus(txHash);
    
    return res.json({
      success: true,
      txHash,
      ...status
    });
  } catch (error: any) {
    console.error('Error checking transaction status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check transaction status',
      message: error.message
    });
  }
});

// POST /register-wallet - Register wallet stake key
app.post('/register-wallet', async (req: Request, res: Response) => {
  try {
    console.log('POST /register-wallet - Request received');
    const { stakeKey, address } = req.body;
    console.log('Register wallet params:', { stakeKey, address });

    if (!stakeKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing stakeKey' 
      });
    }

    // Get or create user by address
    let userResult = await pool.query(
      `SELECT id FROM users WHERE wallet_address = $1`,
      [address || null]
    );

    let userId: string;
    if (userResult.rows.length === 0 && address) {
      // Create new user
      const newUserResult = await pool.query(
        `INSERT INTO users (wallet_address) VALUES ($1) RETURNING id`,
        [address]
      );
      userId = newUserResult.rows[0].id;
    } else if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    } else {
      // No address provided, just register stake key
      userId = null as any;
    }

    // Store stake key (you might want to add a stake_key column to users table)
    // For now, we'll just log it
    console.log('Stake key registered:', { userId, stakeKey, address });

    return res.json({ 
      success: true,
      message: 'Wallet registered successfully',
      stakeKey 
    });
  } catch (error: any) {
    console.error('Error registering wallet:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to register wallet', 
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  
  // Handle multer errors
  if (err.message === 'Only PNG images are allowed') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only PNG images are allowed'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SkillForge Backend API running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  console.log(`🌐 Network: PREPROD Testnet`);
  console.log(`🔗 Blockfrost: https://cardano-preprod.blockfrost.io/api/v0`);
  
  // Log controlled stake key information
  const controlledStakeKey = getControlledStakeKey();
  console.log(`🔑 Controlled Stake Key (Bech32): ${controlledStakeKey.bech32}`);
  console.log(`🔑 Controlled Stake Key (HEX): ${controlledStakeKey.hex}`);
  
  // Log account state key information
  const accountStateKey = getAccountStateKey();
  console.log(`🔐 Account State Key (Bech32): ${accountStateKey.bech32}`);
  console.log(`🔐 Account State Key (HEX): ${accountStateKey.hex}`);
  
  // Log tracked transaction hash
  console.log(`📝 Tracked Transaction Hash: ${TRACKED_TX_HASH}`);
  
  // Check tracked transaction status on startup
  if (TRACKED_TX_HASH && TRACKED_TX_HASH !== '103fead5c7e852a1544c4fc1dbc869fabd9364b512f84493b8116f6a0d6ca5a8') {
    getTransactionStatus(TRACKED_TX_HASH).then(status => {
      if (status.confirmed) {
        console.log(`✅ Tracked transaction confirmed in block: ${status.block}`);
      } else {
        console.log(`⏳ Tracked transaction pending: ${status.error || 'Not yet confirmed'}`);
      }
    }).catch(err => {
      console.warn(`⚠️ Could not check tracked transaction status: ${err.message}`);
    });
  }
});

export default app;

