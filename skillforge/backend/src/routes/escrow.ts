import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { getUTXOs } from '../services/cardano';
import { 
  buildEscrowInitTx, 
  buildEscrowAttestTx, 
  buildEscrowClaimTx, 
  buildEscrowRefundTx 
} from '../services/transactionBuilder';
import { EscrowInitRequest, EscrowInitResponse, EscrowStatusResponse } from '../types';
import { randomUUID } from 'crypto';
import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';

const router = Router();

// POST /escrow/init - Initialize escrow transaction
router.post('/init', async (req: Request, res: Response) => {
  try {
    console.log('[ESCROW INIT] Request received');
    console.log('[ESCROW INIT] Request Body:', JSON.stringify(req.body, null, 2));
    
    const { learnerAddress, providerAddress, mentorAddress, price, sessionId, stakeKey, parsedIntent }: EscrowInitRequest = req.body;
    
    // Support both providerAddress and mentorAddress
    const finalMentorAddress = mentorAddress || providerAddress;
    
    console.log('[ESCROW INIT] Params:', {
      learnerAddress,
      mentorAddress: finalMentorAddress,
      price,
      sessionId,
      hasStakeKey: !!stakeKey,
      hasParsedIntent: !!parsedIntent
    });

    // Validate all required fields
    if (!learnerAddress) {
      console.error('[ESCROW INIT] Validation failed: learnerAddress missing');
      return res.status(400).json({ success: false, error: 'Invalid escrow parameters: learnerAddress is required' });
    }
    
    if (!finalMentorAddress) {
      console.error('[ESCROW INIT] Validation failed: mentorAddress/providerAddress missing');
      return res.status(400).json({ success: false, error: 'Invalid escrow parameters: mentorAddress is required' });
    }
    
    if (!price || price <= 0) {
      console.error('[ESCROW INIT] Validation failed: price invalid', price);
      return res.status(400).json({ success: false, error: 'Invalid escrow parameters: price must be greater than 0' });
    }
    
    if (!sessionId) {
      console.error('[ESCROW INIT] Validation failed: sessionId missing');
      return res.status(400).json({ success: false, error: 'Invalid escrow parameters: sessionId is required' });
    }

    // Get session
    console.log('[ESCROW INIT] Checking session exists:', sessionId);
    const sessionResult = await pool.query(
      `SELECT id FROM sessions WHERE id = $1::uuid`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      console.error('[ESCROW INIT] Session not found:', sessionId);
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const sessionUuid = sessionResult.rows[0].id;
    console.log('[ESCROW INIT] Session found:', sessionUuid);

    // Get learner UTXOs
    console.log('[ESCROW INIT] Fetching UTXOs for learner:', learnerAddress);
    const learnerUTXOs = await getUTXOs(learnerAddress);
    console.log('[ESCROW INIT] Found UTXOs:', learnerUTXOs.length);
    
    if (learnerUTXOs.length === 0) {
      console.error('[ESCROW INIT] No UTXOs found for learner address');
      return res.status(400).json({ success: false, error: 'NO_UTXOS', message: 'No UTXOs found for learner address' });
    }

    // Extract public key hashes from addresses
    console.log('[ESCROW INIT] Extracting public key hashes from addresses');
    let learnerAddr: Cardano.Address;
    let mentorAddr: Cardano.Address;
    
    try {
      learnerAddr = Cardano.Address.from_bech32(learnerAddress);
      mentorAddr = Cardano.Address.from_bech32(finalMentorAddress);
    } catch (addrError: any) {
      console.error('[ESCROW INIT] Invalid address format:', addrError);
      return res.status(400).json({ success: false, error: 'Invalid address format' });
    }
    
    // Get payment credential (pub key hash)
    const learnerPaymentCred = learnerAddr.payment_cred();
    const mentorPaymentCred = mentorAddr.payment_cred();
    
    const learnerPubKeyHash = learnerPaymentCred.to_keyhash()?.to_bytes();
    const mentorPubKeyHash = mentorPaymentCred.to_keyhash()?.to_bytes();
    
    if (!learnerPubKeyHash || !mentorPubKeyHash) {
      console.error('[ESCROW INIT] Could not extract public key hashes');
      return res.status(400).json({ success: false, error: 'Could not extract public key hashes from addresses' });
    }

    console.log('[ESCROW INIT] Public key hashes extracted successfully');

    // Build escrow transaction using new transaction builder
    console.log('[ESCROW INIT] Building escrow transaction');
    const priceLovelace = Math.floor(price * 1000000); // Convert ADA to Lovelace
    console.log('[ESCROW INIT] Price in Lovelace:', priceLovelace);
    
    let txHex: string;
    let scriptAddress: string;
    let datum: any;
    
    try {
      const result = await buildEscrowInitTx({
        learnerAddress,
        mentorAddress: finalMentorAddress,
        learnerPubKeyHash: Buffer.from(learnerPubKeyHash).toString('hex'),
        mentorPubKeyHash: Buffer.from(mentorPubKeyHash).toString('hex'),
        priceLovelace,
        sessionId,
        learnerUTXOs
      });
      
      txHex = result.txHex;
      scriptAddress = result.scriptAddress;
      datum = result.datum;
      
      if (!txHex) {
        throw new Error('Transaction builder did not return txHex');
      }
      
      console.log('[ESCROW INIT] Transaction built successfully');
      console.log('[ESCROW INIT] Script address:', scriptAddress);
      console.log('[ESCROW INIT] Datum:', JSON.stringify(datum, null, 2));
    } catch (buildError: any) {
      console.error('[ESCROW INIT ERROR]', buildError);
      console.error('[ESCROW INIT ERROR] Stack:', buildError.stack);
      return res.status(500).json({ 
        success: false,
        error: buildError.message || 'ESCROW_INIT_FAILED',
        message: buildError.message || 'Failed to build escrow transaction'
      });
    }

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
      txBody: txHex,
      escrowAddress: scriptAddress,
      escrowId
    };

    console.log('[ESCROW INIT] Escrow transaction built successfully');
    console.log('[ESCROW INIT] Returning response with txHex:', txHex ? 'present' : 'missing');
    
    // Ensure we always return a valid response
    if (!txHex || !scriptAddress) {
      console.error('[ESCROW INIT ERROR] Missing required fields in response');
      return res.status(500).json({ 
        success: false,
        error: 'ESCROW_INIT_FAILED',
        message: 'Transaction build completed but required fields are missing'
      });
    }
    
    return res.json({ 
      success: true, 
      data: { 
        txHex,
        scriptAddress,
        escrowAddress: scriptAddress,
        escrowId: sessionUuid,
        datum 
      } 
    });
  } catch (error: any) {
    console.error('[ESCROW INIT ERROR]', error);
    console.error('[ESCROW INIT ERROR] Stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'ESCROW_INIT_FAILED',
      message: error.message || 'Failed to initialize escrow'
    });
  }
});

// POST /escrow/attest-learner - Learner attests session completion
router.post('/attest-learner', async (req: Request, res: Response) => {
  try {
    console.log('POST /escrow/attest-learner - Request received');
    const { sessionId, scriptUTXO, learnerAddress } = req.body;
    
    if (!sessionId || !scriptUTXO || !learnerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const learnerUTXOs = await getUTXOs(learnerAddress);
    if (learnerUTXOs.length === 0) {
      return res.status(400).json({ error: 'No UTXOs found for learner address' });
    }

    const { txHex } = await buildEscrowAttestTx({
      scriptUTXO,
      redeemerType: 'AttestByLearner',
      signerAddress: learnerAddress,
      signerUTXOs: learnerUTXOs
    });

    return res.json({ success: true, data: { txHex } });
  } catch (error: any) {
    console.error('Error in /escrow/attest-learner:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to build attest transaction', 
      message: error.message 
    });
  }
});

// POST /escrow/attest-mentor - Mentor attests session completion
router.post('/attest-mentor', async (req: Request, res: Response) => {
  try {
    console.log('POST /escrow/attest-mentor - Request received');
    const { sessionId, scriptUTXO, mentorAddress } = req.body;
    
    if (!sessionId || !scriptUTXO || !mentorAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mentorUTXOs = await getUTXOs(mentorAddress);
    if (mentorUTXOs.length === 0) {
      return res.status(400).json({ error: 'No UTXOs found for mentor address' });
    }

    const { txHex } = await buildEscrowAttestTx({
      scriptUTXO,
      redeemerType: 'AttestByMentor',
      signerAddress: mentorAddress,
      signerUTXOs: mentorUTXOs
    });

    return res.json({ success: true, data: { txHex } });
  } catch (error: any) {
    console.error('Error in /escrow/attest-mentor:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to build attest transaction', 
      message: error.message 
    });
  }
});

// POST /escrow/claim - Mentor claims funds after both attestations
router.post('/claim', async (req: Request, res: Response) => {
  try {
    console.log('POST /escrow/claim - Request received');
    const { sessionId, scriptUTXO, mentorAddress } = req.body;
    
    if (!sessionId || !scriptUTXO || !mentorAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mentorUTXOs = await getUTXOs(mentorAddress);
    if (mentorUTXOs.length === 0) {
      return res.status(400).json({ error: 'No UTXOs found for mentor address' });
    }

    const { txHex } = await buildEscrowClaimTx({
      scriptUTXO,
      mentorAddress,
      mentorUTXOs
    });

    return res.json({ success: true, data: { txHex } });
  } catch (error: any) {
    console.error('Error in /escrow/claim:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to build claim transaction', 
      message: error.message 
    });
  }
});

// POST /escrow/refund - Learner refunds after timeout
router.post('/refund', async (req: Request, res: Response) => {
  try {
    console.log('POST /escrow/refund - Request received');
    const { sessionId, scriptUTXO, learnerAddress } = req.body;
    
    if (!sessionId || !scriptUTXO || !learnerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const learnerUTXOs = await getUTXOs(learnerAddress);
    if (learnerUTXOs.length === 0) {
      return res.status(400).json({ error: 'No UTXOs found for learner address' });
    }

    const { txHex } = await buildEscrowRefundTx({
      scriptUTXO,
      learnerAddress,
      learnerUTXOs
    });

    return res.json({ success: true, data: { txHex } });
  } catch (error: any) {
    console.error('Error in /escrow/refund:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to build refund transaction', 
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
