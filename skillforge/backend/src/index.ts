import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeScripts } from './services/cardano';
import { pool } from './config/database';
import matchRouter from './routes/match';
import escrowRouter from './routes/escrow';
import sessionRouter from './routes/session';
import nftRouter from './routes/nft';

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
    
    res.json({
      success: true,
      data: {
        contracts: 'Aiken',
        version: '1.0.0',
        escrowValidatorHash: escrowHash,
        nftPolicyId: nftPolicyId
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

// Routes
app.use('/match', matchRouter);
app.use('/escrow', escrowRouter);
app.use('/session', sessionRouter);
app.use('/nft', nftRouter);

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
});

export default app;

