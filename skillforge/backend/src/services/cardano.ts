import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { getUTXOs as getOgmiosUTXOs, getProtocolParameters as getOgmiosProtocolParameters } from './ogmios';
import { getUTXOs as getKupoUTXOs } from './kupo';

dotenv.config();

const NETWORK_MODE = process.env.NETWORK || 'preprod';
const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
// Default to Preprod testnet Blockfrost endpoint
const BLOCKFROST_BASE_URL = process.env.BLOCKFROST_BASE_URL || 'https://cardano-preprod.blockfrost.io/api/v0';
const NETWORK = NETWORK_MODE === 'local' ? 0 : (process.env.CARDANO_NETWORK === 'mainnet' ? 1 : 0); // 0 = testnet/local, 1 = mainnet
const USE_LOCAL = NETWORK_MODE === 'local';

// Controlled Stake Key Configuration
// Bech32: stake_test1upxprdlg2aaflnfzckjn5lxlgmnw4x7act84q3t4qqd9lzqjtjam3
// HEX: e04c11b7e8577a9fcd22c5a53a7cdf46e6ea9bddc2cf504575001a5f88
export const CONTROLLED_STAKE_KEY_BECH32 = process.env.CONTROLLED_STAKE_KEY || 'stake_test1upxprdlg2aaflnfzckjn5lxlgmnw4x7act84q3t4qqd9lzqjtjam3';
export const CONTROLLED_STAKE_KEY_HEX = process.env.CONTROLLED_STAKE_KEY_HEX || 'e04c11b7e8577a9fcd22c5a53a7cdf46e6ea9bddc2cf504575001a5f88';

// Account State Key Configuration
// Same stake key used for account state management
export const ACCOUNT_STATE_KEY_BECH32 = process.env.ACCOUNT_STATE_KEY || 'stake_test1upxprdlg2aaflnfzckjn5lxlgmnw4x7act84q3t4qqd9lzqjtjam3';
export const ACCOUNT_STATE_KEY_HEX = process.env.ACCOUNT_STATE_KEY_HEX || 'e04c11b7e8577a9fcd22c5a53a7cdf46e6ea9bddc2cf504575001a5f88';

// Load Aiken scripts (compiled to Plutus format)
const ESCROW_SCRIPT_PATH = process.env.ESCROW_SCRIPT_PATH || path.join(__dirname, '../contracts/escrow.plutus');
const NFT_POLICY_SCRIPT_PATH = process.env.NFT_POLICY_SCRIPT_PATH || path.join(__dirname, '../contracts/session_nft.plutus');

let escrowScript: Cardano.PlutusScript | null = null;
let nftPolicyScript: Cardano.PlutusScript | null = null; // Aiken compiles minting policies as PlutusScript

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
      nftPolicyScript = Cardano.PlutusScript.from_bytes(scriptBytes); // Aiken compiles as PlutusScript
      const policyHash = nftPolicyScript.hash();
      console.log('✓ Aiken NFT minting policy loaded');
      console.log(`  Policy ID: ${Buffer.from(policyHash.to_bytes()).toString('hex')}`);
    } else {
      console.warn('⚠ NFT policy script not found at:', NFT_POLICY_SCRIPT_PATH);
      console.warn('  Run: cd contracts/skillforge && ./build.sh');
    }
  } catch (error) {
    console.error('Error loading Aiken scripts:', error);
  }
}

// Get protocol parameters from Ogmios (local) or Blockfrost (preprod/mainnet)
export async function getProtocolParameters(): Promise<any> {
  try {
    if (USE_LOCAL) {
      console.log('[Cardano] Using Ogmios for protocol parameters (local devnet)');
      return await getOgmiosProtocolParameters();
    }

    if (!BLOCKFROST_PROJECT_ID) {
      // Return default parameters if Blockfrost not configured
      console.log('[Cardano] Using default protocol parameters');
      return {
        min_fee_a: '44',
        min_fee_b: '155381',
        max_tx_size: '16384',
        key_deposit: '2000000',
        pool_deposit: '500000000',
        coins_per_utxo_word: '34482'
      };
    }

    console.log('[Cardano] Using Blockfrost for protocol parameters');
    const response = await axios.get(`${BLOCKFROST_BASE_URL}/epochs/latest/parameters`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });
    return response.data;
  } catch (error) {
    console.error('[Cardano] Error fetching protocol parameters:', error);
    // Return default parameters if fetch fails
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

// Simple in-memory cache for UTXOs (10 second TTL)
const utxoCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

// Get UTXOs for an address via Kupo (local) or Blockfrost (preprod/mainnet)
export async function getUTXOs(address: string): Promise<any[]> {
  try {
    // Check cache first
    const cached = utxoCache.get(address);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Cardano] Returning cached UTXOs for:', address);
      return cached.data;
    }

    if (USE_LOCAL) {
      console.log('[Cardano] Using Kupo for UTXOs (local devnet):', address);
      // Try Kupo first, fallback to Ogmios
      const kupoUTXOs = await getKupoUTXOs(address);
      if (kupoUTXOs.length > 0) {
        return kupoUTXOs;
      }
      // Fallback to Ogmios
      console.log('[Cardano] Kupo returned no UTXOs, trying Ogmios...');
      return await getOgmiosUTXOs(address);
    }

    if (!BLOCKFROST_PROJECT_ID) {
      console.warn('[Cardano] No Blockfrost configured, returning empty UTXOs');
      return [];
    }

    console.log('[Cardano] Fetching UTXOs from Blockfrost:', address);
    const response = await axios.get(`${BLOCKFROST_BASE_URL}/addresses/${address}/utxos`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });
    
    // Cache the result
    utxoCache.set(address, {
      data: response.data,
      timestamp: Date.now()
    });
    
    return response.data;
  } catch (error: any) {
    console.error('[Cardano] Error fetching UTXOs:', error.message);
    
    // If Blockfrost is blocking us, return cached data if available (even if expired)
    const cached = utxoCache.get(address);
    if (cached && error.response?.status === 403) {
      console.warn('[Cardano] Blockfrost blocked request, returning stale cache');
      return cached.data;
    }
    
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
  const scriptHash = escrowScript.hash();
  const stakeCred = Cardano.StakeCredential.from_scripthash(scriptHash);
  const baseAddr = Cardano.BaseAddress.new(NETWORK, stakeCred, stakeCred);
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
  // For minting policies, the hash is the policy ID
  return Buffer.from(nftPolicyScript.hash().to_bytes()).toString('hex');
}

// Get controlled stake key information
export function getControlledStakeKey(): { bech32: string; hex: string } {
  return {
    bech32: CONTROLLED_STAKE_KEY_BECH32,
    hex: CONTROLLED_STAKE_KEY_HEX
  };
}

// Get account state key information
export function getAccountStateKey(): { bech32: string; hex: string } {
  return {
    bech32: ACCOUNT_STATE_KEY_BECH32,
    hex: ACCOUNT_STATE_KEY_HEX
  };
}

// Transaction hash for tracking (example transaction)
export const TRACKED_TX_HASH = process.env.TRACKED_TX_HASH || '103fead5c7e852a1544c4fc1dbc869fabd9364b512f84493b8116f6a0d6ca5a8';

/**
 * Check transaction status via Blockfrost
 * @param txHash Transaction hash to check
 * @returns Transaction status information
 */
export async function getTransactionStatus(txHash: string): Promise<{
  confirmed: boolean;
  block?: string;
  blockHeight?: number;
  slot?: number;
  error?: string;
}> {
  if (!BLOCKFROST_PROJECT_ID) {
    return {
      confirmed: false,
      error: 'Blockfrost not configured'
    };
  }

  try {
    const response = await axios.get(`${BLOCKFROST_BASE_URL}/txs/${txHash}`, {
      headers: {
        project_id: BLOCKFROST_PROJECT_ID
      }
    });

    const txData = response.data;
    
    return {
      confirmed: !!txData.block,
      block: txData.block || undefined,
      blockHeight: txData.block_height || undefined,
      slot: txData.slot || undefined
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        confirmed: false,
        error: 'Transaction not found'
      };
    }
    
    console.error('[Cardano] Error checking transaction status:', error);
    return {
      confirmed: false,
      error: error.message || 'Failed to check transaction status'
    };
  }
}
