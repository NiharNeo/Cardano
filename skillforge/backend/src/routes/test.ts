import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { buildEscrowInitTx, buildEscrowAttestTx, buildEscrowClaimTx, buildNFTMintTx } from '../services/transactionBuilder';
import { uploadMetadata, uploadImage } from '../services/ipfs';
import { getUTXOs } from '../services/cardano';
import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import { randomUUID } from 'crypto';

const router = Router();

// POST /test/run-e2e - Run end-to-end test flow
router.post('/run-e2e', async (req: Request, res: Response) => {
  try {
    console.log('POST /test/run-e2e - Running E2E test...');

    // Step 1: Generate test keys (simulated - in real test would use cardano-cli)
    const learnerAddress = req.body.learnerAddress || 'addr_test1...'; // Would be generated
    const mentorAddress = req.body.mentorAddress || 'addr_test1...'; // Would be generated
    const learnerPubKeyHash = req.body.learnerPubKeyHash || 'abc123...';
    const mentorPubKeyHash = req.body.mentorPubKeyHash || 'def456...';

    // Step 2: Fund addresses (simulated - in real test would use genesis UTXO)
    console.log('✓ Test addresses funded (simulated)');

    // Step 3: Create test session
    const sessionId = randomUUID();
    const testProviderId = randomUUID();
    
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,
      [learnerAddress]
    );
    const learnerId = userResult.rows[0]?.id || randomUUID();

    // Create test session
    await pool.query(
      `INSERT INTO sessions (id, learner_id, provider_id, skill, budget, duration, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, learnerId, testProviderId, 'Test Skill', 100, 60, 'initiated']
    );

    // Step 4: Lock funds in escrow
    const learnerUTXOs = await getUTXOs(learnerAddress);
    if (learnerUTXOs.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No UTXOs found for learner address. Fund the address first.' 
      });
    }

    const { txHex: escrowLockTx, scriptAddress } = await buildEscrowInitTx({
      learnerAddress,
      mentorAddress,
      learnerPubKeyHash,
      mentorPubKeyHash,
      priceLovelace: 100000000, // 100 ADA
      sessionId,
      learnerUTXOs
    });

    // Store escrow state
    await pool.query(
      `INSERT INTO escrow_state (session_id, utxo, status)
       VALUES ($1, $2, $3)`,
      [sessionId, `${scriptAddress}#0`, 'locked']
    );

    // Step 5: Attest learner
    const scriptUTXO = `${scriptAddress}#0`; // Would be actual UTXO from submitted tx
    const { txHex: attestLearnerTx } = await buildEscrowAttestTx({
      scriptUTXO,
      redeemerType: 'AttestByLearner',
      signerAddress: learnerAddress,
      signerUTXOs: learnerUTXOs
    });

    // Step 6: Attest mentor
    const mentorUTXOs = await getUTXOs(mentorAddress);
    const { txHex: attestMentorTx } = await buildEscrowAttestTx({
      scriptUTXO,
      redeemerType: 'AttestByMentor',
      signerAddress: mentorAddress,
      signerUTXOs: mentorUTXOs.length > 0 ? mentorUTXOs : learnerUTXOs // Fallback
    });

    // Step 7: Claim funds
    const { txHex: claimTx } = await buildEscrowClaimTx({
      scriptUTXO,
      mentorAddress,
      mentorUTXOs: mentorUTXOs.length > 0 ? mentorUTXOs : learnerUTXOs
    });

    // Step 8: Mint NFT
    // Upload metadata to IPFS
    const metadata = {
      name: `SkillForge Session - Test`,
      description: 'E2E test session NFT',
      image: 'ipfs://test-image-cid',
      attributes: [
        { trait_type: 'skill', value: 'Test Skill' },
        { trait_type: 'session_id', value: sessionId }
      ]
    };

    const nftCid = await uploadMetadata(metadata);
    const imageCid = null; // Would upload image if provided

    // Build mint transaction
    const { txHex: mintNftTx, policyId, assetName } = await buildNFTMintTx({
      sessionId,
      learnerAddress,
      learnerUTXOs,
      escrowUTXO: scriptUTXO
    });

    // Store NFT metadata
    await pool.query(
      `INSERT INTO nft_metadata (session_id, ipfs_hash, image_cid, metadata_json, minted, minted_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, nftCid, imageCid, JSON.stringify(metadata), false, null]
    );

    // Update session status
    await pool.query(
      `UPDATE sessions SET status = 'completed' WHERE id = $1`,
      [sessionId]
    );

    console.log('✓ E2E test completed successfully');

    return res.json({
      success: true,
      data: {
        escrowLockTx,
        attestLearnerTx,
        attestMentorTx,
        claimTx,
        mintNftTx,
        nftCid,
        sessionId,
        scriptAddress,
        policyId,
        assetName
      }
    });
  } catch (error: any) {
    console.error('Error in E2E test:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'E2E test failed',
      message: error.message
    });
  }
});

export default router;



