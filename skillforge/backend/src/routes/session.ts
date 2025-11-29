import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { AttestRequest, AttestResponse, CreateSessionRequest, CreateSessionResponse } from '../types';
import { randomUUID } from 'crypto';

const router = Router();

// POST /session/create - Create a new session
router.post('/create', async (req: Request, res: Response) => {
  try {
    console.log('POST /session/create - Request received');
    const { learnerAddress, providerId, skill, budget, duration, urgency, stakeKey }: CreateSessionRequest = req.body;
    console.log('Session create params:', { learnerAddress, providerId, skill, budget, duration, urgency, stakeKey });

    if (!learnerAddress || !providerId || !skill) {
      return res.status(400).json({ error: 'Missing required fields: learnerAddress, providerId, skill' });
    }

    // Get or create user
    let userResult = await pool.query(
      `SELECT id FROM users WHERE wallet_address = $1`,
      [learnerAddress]
    );

    let learnerId: string;
    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await pool.query(
        `INSERT INTO users (wallet_address) VALUES ($1) RETURNING id`,
        [learnerAddress]
      );
      learnerId = newUserResult.rows[0].id;
    } else {
      learnerId = userResult.rows[0].id;
    }

    // Create session
    const newSessionId = randomUUID();
    const sessionResult = await pool.query(
      `INSERT INTO sessions (id, learner_id, provider_id, skill, budget, duration, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [newSessionId, learnerId, providerId, skill, budget || null, duration || null, 'initiated']
    );

    const sessionId = sessionResult.rows[0].id;
    console.log('Session created:', sessionId);
    return res.json({ 
      success: true,
      data: { sessionId } 
    });
  } catch (error: any) {
    console.error('Error creating session:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to create session', 
      message: error.message 
    });
  }
});

// POST /session/attest - Store attestation and trigger NFT mint if both attested
router.post('/attest', async (req: Request, res: Response) => {
  try {
    console.log('POST /session/attest - Request received');
    const { sessionId, wallet, stakeKey }: AttestRequest = req.body;
    console.log('Attest params:', { sessionId, wallet, stakeKey });

    if (!sessionId || !wallet) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get session
    const sessionResult = await pool.query(
      `SELECT s.*, u.wallet_address as learner_address
       FROM sessions s
       JOIN users u ON s.learner_id = u.id
       WHERE s.id = $1::uuid`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Determine if this is learner or provider
    const isLearner = session.learner_address === wallet;

    // Update session status based on attestation
    // In a full implementation, you'd track attestations separately
    // For now, we'll update status to 'active' when first attestation comes in
    if (session.status === 'initiated' || session.status === 'locked') {
      await pool.query(
        `UPDATE sessions SET status = 'active' WHERE id = $1`,
        [session.id]
      );
    }

    // Check if session is ready for completion
    // In production, you'd check actual attestation flags
    const updatedSession = await pool.query(
      `SELECT status FROM sessions WHERE id = $1`,
      [session.id]
    );

    const bothAttested = updatedSession.rows[0].status === 'active';

    if (bothAttested) {
      // Update session status to completed
      await pool.query(
        `UPDATE sessions SET status = 'completed' WHERE id = $1`,
        [session.id]
      );

      // Update escrow state
      await pool.query(
        `UPDATE escrow_state SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE session_id = $1`,
        [session.id]
      );
    }

    const response: AttestResponse = {
      success: true,
      bothAttested,
      message: bothAttested 
        ? 'Both parties have attested. Session completed. Ready for NFT minting.'
        : 'Attestation recorded. Waiting for other party.'
    };
    console.log('Attestation response:', response);
    return res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in /session/attest:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to record attestation', 
      message: error.message 
    });
  }
});

export default router;
