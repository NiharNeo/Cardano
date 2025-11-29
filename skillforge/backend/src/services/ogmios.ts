/**
 * Ogmios client for local devnet
 * Provides chain queries and transaction building
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OGMIOS_URL = process.env.OGMIOS_URL || 'http://localhost:1337';
const NETWORK = process.env.NETWORK || 'preprod';
const DEVNET_MAGIC = parseInt(process.env.DEVNET_MAGIC || '1');

/**
 * Query current tip (latest block)
 */
export async function queryTip(): Promise<any> {
  try {
    const response = await axios.post(OGMIOS_URL, {
      jsonrpc: '2.0',
      method: 'queryNetwork/tip',
      id: 1
    });
    return response.data.result;
  } catch (error) {
    console.error('[Ogmios] Error querying tip:', error);
    throw error;
  }
}

/**
 * Get protocol parameters
 */
export async function getProtocolParameters(): Promise<any> {
  try {
    const response = await axios.post(OGMIOS_URL, {
      jsonrpc: '2.0',
      method: 'queryNetwork/protocolParameters',
      id: 1
    });
    return response.data.result;
  } catch (error) {
    console.error('[Ogmios] Error getting protocol parameters:', error);
    // Return default parameters for local devnet
    return {
      minFeeA: '44',
      minFeeB: '155381',
      maxTxSize: '16384',
      keyDeposit: '2000000',
      poolDeposit: '500000000',
      coinsPerUtxoWord: '34482'
    };
  }
}

/**
 * Get UTXOs for an address via Ogmios
 */
export async function getUTXOs(address: string): Promise<any[]> {
  try {
    const response = await axios.post(OGMIOS_URL, {
      jsonrpc: '2.0',
      method: 'queryUtxo',
      params: {
        addresses: [address]
      },
      id: 1
    });

    const utxos = response.data.result || [];
    // Convert Ogmios format to standard format
    return Object.entries(utxos).map(([utxo, value]: [string, any]) => ({
      tx_hash: utxo.split('#')[0],
      output_index: parseInt(utxo.split('#')[1]),
      amount: [
        {
          unit: 'lovelace',
          quantity: value.value.coins || '0'
        }
      ],
      address: address
    }));
  } catch (error) {
    console.error('[Ogmios] Error getting UTXOs:', error);
    return [];
  }
}

/**
 * Submit transaction via Ogmios
 */
export async function submitTransaction(txHex: string): Promise<string> {
  try {
    const response = await axios.post(OGMIOS_URL, {
      jsonrpc: '2.0',
      method: 'submitTransaction',
      params: {
        transaction: txHex
      },
      id: 1
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'Transaction submission failed');
    }

    return response.data.result.transaction.id;
  } catch (error: any) {
    console.error('[Ogmios] Error submitting transaction:', error);
    throw error;
  }
}



