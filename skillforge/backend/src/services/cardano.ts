import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const BLOCKFROST_BASE_URL = process.env.BLOCKFROST_BASE_URL || 'https://cardano-testnet.blockfrost.io/api/v0';
const NETWORK = process.env.CARDANO_NETWORK === 'mainnet' ? 1 : 0; // 0 = testnet, 1 = mainnet

// Load Aiken scripts (compiled to Plutus format)
const ESCROW_SCRIPT_PATH = process.env.ESCROW_SCRIPT_PATH || path.join(__dirname, '../contracts/escrow.plutus');
const NFT_POLICY_SCRIPT_PATH = process.env.NFT_POLICY_SCRIPT_PATH || path.join(__dirname, '../contracts/session_nft.plutus');

let escrowScript: Cardano.PlutusScript | null = null;
let nftPolicyScript: Cardano.MintingPolicy | null = null;

// Helper to load Aiken-compiled scripts
export const loadScript = (scriptPath: string): any => {
  try {
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    // Aiken outputs JSON format: { "type": "PlutusScriptV2", "description": "...", "cborHex": "..." }
    if (scriptContent.startsWith('{')) {
      return JSON.parse(scriptContent);
    }
    // Fallback: assume raw hex
    return { cborHex: scriptContent.trim() };
  } catch (error) {
    console.error(`Error loading script from ${scriptPath}:`, error);
    throw error;
  }
};

// Initialize scripts
export function initializeScripts() {
  try {
    if (fs.existsSync(ESCROW_SCRIPT_PATH)) {
      const escrowData = loadScript(ESCROW_SCRIPT_PATH);
      const scriptBytes = Buffer.from(escrowData.cborHex, 'hex');
      escrowScript = Cardano.PlutusScript.from_bytes(scriptBytes);
      const scriptHash = escrowScript.hash();
      console.log('✓ Aiken Escrow script loaded');
      console.log(`  Script hash: ${Buffer.from(scriptHash.to_bytes()).toString('hex')}`);
    } else {
      console.warn('⚠ Escrow script not found at:', ESCROW_SCRIPT_PATH);
      console.warn('  Run: cd contracts && ./build.sh');
    }
    
    if (fs.existsSync(NFT_POLICY_SCRIPT_PATH)) {
      const nftData = loadScript(NFT_POLICY_SCRIPT_PATH);
      const scriptBytes = Buffer.from(nftData.cborHex, 'hex');
      nftPolicyScript = Cardano.MintingPolicy.from_bytes(scriptBytes);
      const policyHash = nftPolicyScript.hash();
      console.log('✓ Aiken NFT minting policy loaded');
      console.log(`  Policy ID: ${Buffer.from(policyHash.to_bytes()).toString('hex')}`);
    } else {
      console.warn('⚠ NFT policy script not found at:', NFT_POLICY_SCRIPT_PATH);
      console.warn('  Run: cd contracts && ./build.sh');
    }
  } catch (error) {
    console.error('Error loading Aiken scripts:', error);
  }
}

// Get protocol parameters from Blockfrost
export async function getProtocolParameters(): Promise<any> {
  try {
    if (!BLOCKFROST_PROJECT_ID) {
      // Return default parameters if Blockfrost not configured
      return {
        min_fee_a: '44',
        min_fee_b: '155381',
        max_tx_size: '16384',
        key_deposit: '2000000',
        pool_deposit: '500000000',
        coins_per_utxo_word: '34482'
      };
    }

    const response = await axios.get(`${BLOCKFROST_BASE_URL}/epochs/latest/parameters`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching protocol parameters:', error);
    // Return default parameters if Blockfrost fails
    return {
      min_fee_a: '44',
      min_fee_b: '155381',
      max_tx_size: '16384',
      key_deposit: '2000000',
      pool_deposit: '500000000',
      coins_per_utxo_word: '34482'
    };
  }
}

// Get UTXOs for an address
export async function getUTXOs(address: string): Promise<any[]> {
  try {
    if (!BLOCKFROST_PROJECT_ID) {
      return [];
    }

    const response = await axios.get(`${BLOCKFROST_BASE_URL}/addresses/${address}/utxos`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching UTXOs:', error);
    return [];
  }
}

// Build escrow transaction (simplified - production should use proper UTXO selection)
export async function buildEscrowTransaction(
  learnerAddress: string,
  providerAddress: string,
  priceLovelace: number,
  sessionId: string,
  learnerUTXOs: any[]
): Promise<{ txBody: string; escrowAddress: string }> {
  if (!escrowScript) {
    throw new Error('Escrow script not loaded');
  }

  // Create escrow address from script
  const networkId = Cardano.NetworkId.new(NETWORK);
  const scriptHash = escrowScript.hash();
  const stakeCred = Cardano.StakeCredential.from_scripthash(scriptHash);
  const baseAddr = Cardano.BaseAddress.new(networkId, stakeCred, stakeCred);
  const escrowAddress = baseAddr.to_address();

  // Note: This is a simplified version
  // In production, you would:
  // 1. Properly select UTXOs
  // 2. Calculate fees accurately
  // 3. Build proper datum
  // 4. Handle change outputs

  // For now, return a placeholder transaction body
  // The actual transaction building should be done with proper UTXO selection
  const txBodyHex = 'placeholder_tx_body_hex'; // Replace with actual transaction building

  return {
    txBody: txBodyHex,
    escrowAddress: escrowAddress.to_bech32()
  };
}

// Build NFT minting transaction (simplified)
export async function buildNFTMintTransaction(
  sessionId: string,
  metadataCid: string,
  escrowUTXO: string,
  learnerAddress: string,
  learnerUTXOs: any[]
): Promise<{ txBody: string; policyId: string; assetName: string }> {
  if (!nftPolicyScript) {
    throw new Error('NFT policy script not loaded');
  }

  const policyId = Buffer.from(nftPolicyScript.hash().to_bytes()).toString('hex');
  const assetName = `SkillForge-Session-${sessionId}`;

  // Note: This is a simplified version
  // In production, you would:
  // 1. Properly build the minting transaction
  // 2. Include escrow UTXO as input
  // 3. Mint the NFT with correct token name
  // 4. Calculate fees accurately

  const txBodyHex = 'placeholder_mint_tx_body_hex'; // Replace with actual transaction building

  return {
    txBody: txBodyHex,
    policyId,
    assetName
  };
}

// Get escrow validator hash
export function getEscrowValidatorHash(): string | null {
  if (!escrowScript) {
    return null;
  }
  return Buffer.from(escrowScript.hash().to_bytes()).toString('hex');
}

// Get NFT policy ID
export function getNFTPolicyId(): string | null {
  if (!nftPolicyScript) {
    return null;
  }
  return Buffer.from(nftPolicyScript.hash().to_bytes()).toString('hex');
}
