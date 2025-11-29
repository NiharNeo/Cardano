/**
 * Wallet Utilities for SkillForge
 * Helper functions for interacting with Cardano CIP-30 wallet APIs
 */

import type { WalletInfo } from '../contexts/WalletContext';

/**
 * Get the wallet API from wallet context
 * @param wallet - WalletInfo from WalletContext
 * @returns The CIP-30 wallet API or null if not connected
 */
export function getWalletApi(wallet: WalletInfo | null): any | null {
  if (!wallet?.api) {
    return null;
  }
  return wallet.api;
}

/**
 * Get wallet balance in lovelace using CIP-30 API
 * @param api - CIP-30 wallet API
 * @returns Balance in lovelace (BigInt or string)
 */
export async function getBalance(api: any): Promise<string> {
  if (!api) {
    throw new Error('Wallet API not available');
  }

  try {
    const balance = await api.getBalance();
    // CIP-30 returns balance as string or BigInt
    return typeof balance === 'string' ? balance : balance.toString();
  } catch (error: any) {
    console.error('[walletUtils] Error getting balance:', error);
    throw new Error(`Failed to get wallet balance: ${error.message}`);
  }
}

/**
 * Convert lovelace to ADA
 * @param lovelace - Amount in lovelace (string, number, or BigInt)
 * @returns Amount in ADA as a number
 */
export function lovelaceToAda(lovelace: string | number | bigint): number {
  const lovelaceNum = typeof lovelace === 'bigint' 
    ? Number(lovelace) 
    : typeof lovelace === 'string' 
    ? Number(lovelace) 
    : lovelace;
  
  if (isNaN(lovelaceNum)) {
    return 0;
  }
  
  return lovelaceNum / 1000000;
}

