/**
 * Wallet Balance Utilities for SkillForge
 * Handles ADA balance checking, UTxO queries, and sufficient funds validation
 */

import type { WalletInfo } from '../contexts/WalletContext';

export interface WalletBalanceInfo {
  balance: number; // ADA amount
  balanceLovelace: number; // Lovelace amount
  utxoCount: number;
  hasUtxos: boolean;
}

export interface BalanceCheckResult {
  sufficient: boolean;
  balance: number;
  required: number;
  shortfall: number;
}

/**
 * Get wallet balance in ADA using CIP-30 API
 */
export async function getWalletBalance(wallet: WalletInfo | null): Promise<number> {
  if (!wallet?.api) {
    throw new Error('Wallet not connected');
  }

  try {
    // CIP-30 getBalance() returns balance in Lovelace
    const balanceLovelace = await wallet.api.getBalance();
    const balanceAda = Number(balanceLovelace) / 1000000; // Convert Lovelace to ADA
    return balanceAda;
  } catch (error: any) {
    console.error('[WalletBalance] Error getting balance:', error);
    throw new Error(`Failed to get wallet balance: ${error.message}`);
  }
}

/**
 * Get UTxOs using CIP-30 API
 */
export async function getUtxos(wallet: WalletInfo | null): Promise<any[]> {
  if (!wallet?.api) {
    throw new Error('Wallet not connected');
  }

  try {
    // CIP-30 getUtxos() returns UTxOs
    const utxos = await wallet.api.getUtxos();
    return utxos || [];
  } catch (error: any) {
    console.error('[WalletBalance] Error getting UTXOs:', error);
    throw new Error(`Failed to get UTXOs: ${error.message}`);
  }
}

/**
 * Get complete wallet balance information
 */
export async function getWalletBalanceInfo(wallet: WalletInfo | null): Promise<WalletBalanceInfo> {
  if (!wallet?.api) {
    return {
      balance: 0,
      balanceLovelace: 0,
      utxoCount: 0,
      hasUtxos: false
    };
  }

  try {
    const balanceLovelace = await wallet.api.getBalance();
    const balanceAda = Number(balanceLovelace) / 1000000;
    const utxos = await wallet.api.getUtxos();
    const utxoCount = utxos?.length || 0;

    return {
      balance: balanceAda,
      balanceLovelace: Number(balanceLovelace),
      utxoCount,
      hasUtxos: utxoCount > 0
    };
  } catch (error: any) {
    console.error('[WalletBalance] Error getting balance info:', error);
    return {
      balance: 0,
      balanceLovelace: 0,
      utxoCount: 0,
      hasUtxos: false
    };
  }
}

/**
 * Check if wallet has enough ADA for a transaction
 */
export async function hasEnoughADA(
  wallet: WalletInfo | null,
  minAmountAda: number
): Promise<BalanceCheckResult> {
  if (!wallet?.api) {
    return {
      sufficient: false,
      balance: 0,
      required: minAmountAda,
      shortfall: minAmountAda
    };
  }

  try {
    const balance = await getWalletBalance(wallet);
    const sufficient = balance >= minAmountAda;
    const shortfall = sufficient ? 0 : minAmountAda - balance;

    return {
      sufficient,
      balance,
      required: minAmountAda,
      shortfall
    };
  } catch (error: any) {
    console.error('[WalletBalance] Error checking sufficient ADA:', error);
    return {
      sufficient: false,
      balance: 0,
      required: minAmountAda,
      shortfall: minAmountAda
    };
  }
}

/**
 * Get minimum ADA required for different operations
 */
export const MIN_ADA_REQUIREMENTS = {
  MATCH_PROVIDERS: 0, // No ADA needed for matching
  ESCROW_LOCK: 10, // Minimum 10 ADA for escrow (includes fees)
  NFT_MINT: 5, // Minimum 5 ADA for NFT minting (includes fees)
  TRANSACTION: 2 // Minimum 2 ADA for any transaction (fees + min UTxO)
} as const;

/**
 * Check if wallet has UTXOs
 */
export async function hasUtxos(wallet: WalletInfo | null): Promise<boolean> {
  if (!wallet?.api) {
    return false;
  }

  try {
    const utxos = await getUtxos(wallet);
    return utxos.length > 0;
  } catch (error) {
    console.error('[WalletBalance] Error checking UTXOs:', error);
    return false;
  }
}

/**
 * Format ADA amount for display
 */
export function formatAda(amount: number): string {
  if (amount === 0) return '0';
  if (amount < 0.001) return '< 0.001';
  return amount.toFixed(3);
}

/**
 * Format Lovelace to ADA
 */
export function lovelaceToAda(lovelace: number | string): number {
  return Number(lovelace) / 1000000;
}

/**
 * Format ADA to Lovelace
 */
export function adaToLovelace(ada: number): number {
  return Math.floor(ada * 1000000);
}



