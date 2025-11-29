import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { getUTXOs } from '../services/cardano';
import { buildNFTMintTx } from '../services/transactionBuilder';
import { uploadMetadata, uploadImage, getIPFSUrl } from '../services/ipfs';
import { NFTMintRequest, NFTMintResponse } from '../types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG images are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST /nft/mint - Generate NFT metadata, upload to IPFS, and build minting transaction
router.post('/mint', upload.single('eventCardImage'), async (req: Request, res: Response) => {
  try {
    console.log('[NFT MINT] Request received');
    console.log('[NFT MINT] Request body:', JSON.stringify(req.body, null, 2));
    
    const { sessionId, stakeKey }: NFTMintRequest = req.body;
    const eventCardImage = req.file;
    console.log('[NFT MINT] Params:', { sessionId, hasImage: !!eventCardImage, hasStakeKey: !!stakeKey });

    if (!sessionId) {
      console.error('[NFT MINT] Validation failed: sessionId missing');
      return res.status(400).json({ success: false, error: 'Missing sessionId' });
    }

    // Get session details
    const sessionResult = await pool.query(
      `SELECT s.*, p.name as provider_name, u.wallet_address as learner_address
       FROM sessions s
       JOIN providers p ON s.provider_id = p.id
       JOIN users u ON s.learner_id = u.id
       WHERE s.id = $1::uuid`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Verify session is completed
    if (session.status !== 'completed' && session.status !== 'paid') {
      return res.status(400).json({ error: 'Session must be completed before minting NFT' });
    }

    // Get escrow state
    const escrowResult = await pool.query(
      `SELECT utxo, status FROM escrow_state WHERE session_id = $1`,
      [session.id]
    );

    if (escrowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Escrow state not found' });
    }

    const escrow = escrowResult.rows[0];

    if (!escrow.utxo) {
      return res.status(400).json({ error: 'Escrow UTXO not found' });
    }

    let imageCid: string | null = null;
    let imageUrl: string | null = null;

    // Step 9: Upload image if provided
    if (eventCardImage) {
      try {
        imageCid = await uploadImage(eventCardImage.path, `skillforge-session-${session.id}.png`);
        imageUrl = getIPFSUrl(imageCid);
        console.log(`✓ Image uploaded to IPFS: ${imageCid}`);
        
        // Clean up uploaded file
        fs.unlinkSync(eventCardImage.path);
      } catch (error: any) {
        console.error('Error uploading image:', error);
        // Continue without image if upload fails
      }
    }

    // Generate NFT metadata
    const metadata = {
      "721": {
        "policy_id_placeholder": {
          [`SkillForge Session – ${session.skill} with ${session.provider_name}`]: {
            name: `SkillForge Session – ${session.skill} with ${session.provider_name}`,
            description: 'Proof-of-session NFT minted by SkillForge to attest a mentoring or build session on Cardano.',
            image: imageCid ? `ipfs://${imageCid}` : 'ipfs://<image-cid-placeholder>',
            provider: session.provider_name,
            skill: session.skill,
            rating: 5, // Default rating, could be from session
            sessionDate: session.created_at,
            attributes: [
              { trait_type: 'provider', value: session.provider_name },
              { trait_type: 'skill', value: session.skill },
              { trait_type: 'rating', value: 5 },
              { trait_type: 'session_date', value: session.created_at },
              { trait_type: 'budget', value: session.budget },
              { trait_type: 'duration_minutes', value: session.duration }
            ]
          }
        }
      }
    };

    // Step 9: Upload metadata to IPFS
    const metadataCid = await uploadMetadata(metadata);
    const metadataUrl = getIPFSUrl(metadataCid);
    console.log(`✓ Metadata uploaded to IPFS: ${metadataCid}`);

    // Get learner UTXOs
    const learnerUTXOs = await getUTXOs(session.learner_address);
    if (learnerUTXOs.length === 0) {
      return res.status(400).json({ error: 'No UTXOs found for learner address' });
    }

    // Step 8: Build minting transaction using NFT minting policy
    console.log('[NFT MINT] Building mint transaction');
    console.log('[NFT MINT] Session ID:', session.id);
    console.log('[NFT MINT] Learner address:', session.learner_address);
    console.log('[NFT MINT] Escrow UTXO:', escrow.utxo);
    
    let txHex: string;
    let policyId: string;
    let assetName: string;
    
    try {
      const mintResult = await buildNFTMintTx({
        sessionId: session.id,
        learnerAddress: session.learner_address,
        learnerUTXOs,
        escrowUTXO: escrow.utxo
      });
      
      txHex = mintResult.txHex;
      policyId = mintResult.policyId;
      assetName = mintResult.assetName;
      
      if (!txHex) {
        throw new Error('Transaction builder did not return txHex');
      }
      
      console.log('[NFT MINT] Transaction built successfully');
      console.log('[NFT MINT] Policy ID:', policyId);
      console.log('[NFT MINT] Asset name:', assetName);
    } catch (buildError: any) {
      console.error('[NFT MINT] Transaction build failed:', buildError);
      console.error('[NFT MINT] Build error stack:', buildError.stack);
      return res.status(500).json({
        success: false,
        error: 'Failed to build NFT mint transaction',
        message: buildError.message
      });
    }

    // Step 10: Store NFT metadata in database with both CIDs
    await pool.query(
      `INSERT INTO nft_metadata (session_id, ipfs_hash, image_cid, metadata_json, minted, minted_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id) DO UPDATE SET
         ipfs_hash = EXCLUDED.ipfs_hash,
         image_cid = EXCLUDED.image_cid,
         metadata_json = EXCLUDED.metadata_json,
         minted = false,
         minted_at = NULL`,
      [session.id, metadataCid, imageCid, JSON.stringify(metadata), false, null]
    );

    const response: NFTMintResponse = {
      txBody: txHex,
      policyId,
      assetName,
      ipfsCid: metadataCid,
      imageCid: imageCid || undefined,
      metadataUrl,
      imageUrl: imageUrl || undefined
    };

    console.log('NFT mint transaction built successfully');
    return res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in /nft/mint:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to mint NFT', 
      message: error.message 
    });
  }
});

// POST /nft/update - Update NFT as minted after transaction submission
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { sessionId, txHash } = req.body;

    if (!sessionId || !txHash) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, txHash' });
    }

    // Update NFT metadata as minted
    await pool.query(
      `UPDATE nft_metadata 
       SET minted = true, minted_at = CURRENT_TIMESTAMP
       WHERE session_id = $1::uuid`,
      [sessionId]
    );

    // Update session status to paid
    await pool.query(
      `UPDATE sessions SET status = 'paid' WHERE id = $1::uuid`,
      [sessionId]
    );

    res.json({ success: true, message: 'NFT marked as minted' });
  } catch (error: any) {
    console.error('Error updating NFT:', error);
    res.status(500).json({ error: 'Failed to update NFT', message: error.message });
  }
});

export default router;
