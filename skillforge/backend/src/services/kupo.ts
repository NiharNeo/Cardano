/**
 * Kupo client for local devnet
 * Provides UTxO indexing and queries
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const KUPO_URL = process.env.KUPO_URL || 'http://localhost:1442';

/**
 * Get UTXOs for an address via Kupo
 */
export async function getUTXOs(address: string): Promise<any[]> {
  try {
    const response = await axios.get(`${KUPO_URL}/matches/${address}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Convert Kupo format to standard format
    return response.data.map((utxo: any) => ({
      tx_hash: utxo.transaction_id,
      output_index: utxo.output_index,
      amount: [
        {
          unit: 'lovelace',
          quantity: utxo.value?.coins || '0'
        }
      ],
      address: address
    }));
  } catch (error: any) {
    if (error.response?.status === 404) {
      return []; // No UTXOs found
    }
    console.error('[Kupo] Error getting UTXOs:', error);
    return [];
  }
}

/**
 * Get UTXO by transaction hash and index
 */
export async function getUTXO(txHash: string, index: number): Promise<any | null> {
  try {
    const response = await axios.get(`${KUPO_URL}/matches/${txHash}#${index}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.data.length === 0) {
      return null;
    }
    
    const utxo = response.data[0];
    return {
      tx_hash: utxo.transaction_id,
      output_index: utxo.output_index,
      amount: [
        {
          unit: 'lovelace',
          quantity: utxo.value?.coins || '0'
        }
      ]
    };
  } catch (error) {
    console.error('[Kupo] Error getting UTXO:', error);
    return null;
  }
}

/**
 * Check if Kupo is synced
 */
export async function isSynced(): Promise<boolean> {
  try {
    const response = await axios.get(`${KUPO_URL}/health`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    return response.data.status === 'ready';
  } catch (error) {
    return false;
  }
}



