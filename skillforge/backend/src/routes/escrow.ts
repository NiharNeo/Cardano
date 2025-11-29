import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { buildEscrowTransaction, getUTXOs, getEscrowValidatorHash } from '../services/cardano';
import { EscrowInitRequest, EscrowInitResponse, EscrowStatusResponse } from '../types';
import { randomUUID } from 'crypto';

const router = Router();

// POST /escrow/init - Initialize escrow transaction
router.post('/init', async (req: Request, res: Response) => {
  try {
    console.log('POST /escrow/init - Request received');
    const { learnerAddress, providerAddress, price, sessionId, stakeKey }: EscrowInitRequest = req.body;
    console.log('Escrow init params:', { learnerAddress, providerAddress, price, sessionId, stakeKey });

    if (!learnerAddress || !providerAddress || !price || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get session
    const sessionResult = await pool.query(
      `SELECT id FROM sessions WHERE id = $1::uuid`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionUuid = sessionResult.rows[0].id;

    // Get learner UTXOs
    const learnerUTXOs = await getUTXOs(learnerAddress);
    if (learnerUTXOs.length === 0) {
      return res.status(400).json({ error: 'No UTXOs found for learner address' });
    }

    // Build escrow transaction
    const priceLovelace = Math.floor(price * 1000000); // Convert ADA to Lovelace
    const { txBody, escrowAddress } = await buildEscrowTransaction(
      learnerAddress,
      providerAddress,
      priceLovelace,
      sessionId,
      learnerUTXOs
    );

    // Create escrow state in database
    const escrowId = randomUUID();

    await pool.query(
      `INSERT INTO escrow_state (session_id, utxo, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE SET
         utxo = EXCLUDED.utxo,
         status = EXCLUDED.status,
         updated_at = CURRENT_TIMESTAMP`,
      [sessionUuid, null, 'pending']
    );

    // Update session status to locked
    await pool.query(
      `UPDATE sessions SET status = 'active' WHERE id = $1`,
      [sessionUuid]
    );

    const response: EscrowInitResponse = {
      txBody,
      escrowAddress,
      escrowId
    };

    console.log('Escrow transaction built successfully');
    return res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in /escrow/init:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to initialize escrow', 
      message: error.message 
    });
  }
});

// POST /escrow/update - Update escrow state after transaction submission
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { sessionId, txId, utxo } = req.body;

    if (!sessionId || !txId) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, txId' });
    }

    // Update escrow state with transaction ID and UTXO
    await pool.query(
      `UPDATE escrow_state 
       SET utxo = $1, status = 'locked', updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $2::uuid`,
      [utxo || txId, sessionId]
    );

    // Update session status
    await pool.query(
      `UPDATE sessions SET status = 'active' WHERE id = $1::uuid`,
      [sessionId]
    );

    res.json({ success: true, message: 'Escrow state updated' });
  } catch (error: any) {
    console.error('Error updating escrow:', error);
    res.status(500).json({ error: 'Failed to update escrow', message: error.message });
  }
});

// POST /escrow/status - Check escrow status
router.post('/status', async (req: Request, res: Response) => {
  try {
    console.log('POST /escrow/status - Request received');
    const { sessionId } = req.body;
    console.log('Escrow status params:', { sessionId });

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Get session and escrow state
    const sessionResult = await pool.query(
      `SELECT s.*, e.utxo, e.status as escrow_status, e.updated_at
       FROM sessions s
       LEFT JOIN escrow_state e ON s.id = e.session_id
       WHERE s.id = $1::uuid`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const row = sessionResult.rows[0];

    // Map session status to escrow status response
    let status: 'locked' | 'in_session' | 'completed' | 'paid_out' = 'locked';
    
    if (row.status === 'paid') {
      status = 'paid_out';
    } else if (row.status === 'completed') {
      status = 'completed';
    } else if (row.status === 'active' && row.escrow_status === 'locked') {
      status = 'in_session';
    } else if (row.escrow_status === 'locked') {
      status = 'locked';
    }

    const response: EscrowStatusResponse = {
      status,
      txId: row.utxo || undefined,
      lockedAt: row.updated_at?.toISOString(),
      completedAt: row.status === 'completed' || row.status === 'paid' ? row.updated_at?.toISOString() : undefined
    };

    console.log('Escrow status:', response);
    return res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in /escrow/status:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get escrow status', 
      message: error.message 
    });
  }
});

export default router;
