/**
 * useWalletBalance Hook
 * React hook for checking wallet balance and UTxO availability
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';

export interface WalletBalanceInfo {
  balance: number;
  hasUtxos: boolean;
  utxoCount: number;
}

export interface BalanceCheckResult {
  sufficient: boolean;
  balance: number;
  required: number;
}

export const MIN_ADA_REQUIREMENTS = {
  MATCH: 1,
  ESCROW_LOCK: 5,
  NFT_MINT: 3
};

export interface UseWalletBalanceResult {
  balanceInfo: WalletBalanceInfo | null;
  isLoading: boolean;
  error: string | null;
  checkSufficientAda: (minAmount: number) => Promise<BalanceCheckResult>;
  hasEnoughForMatch: boolean;
  hasEnoughForEscrow: boolean;
  hasEnoughForNFT: boolean;
  hasUtxos: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to monitor wallet balance and UTxO availability
 */
export function useWalletBalance(minAdaRequired?: number): UseWalletBalanceResult {
  const wallet = useWallet();
  const [balanceInfo, setBalanceInfo] = useState<WalletBalanceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    if (!wallet.isConnected) {
      setBalanceInfo(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use MeshSDK-based wallet context
      const balanceStr = await wallet.getBalance();
      const balance = parseFloat(balanceStr || '0');
      const utxoCount = wallet.utxoCount || 0;

      setBalanceInfo({
        balance,
        hasUtxos: utxoCount > 0,
        utxoCount
      });
    } catch (err: any) {
      console.error('[useWalletBalance] Error loading balance:', err);
      setError(err.message || 'Failed to load wallet balance');
      setBalanceInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [wallet]);

  // Load balance on mount and when wallet changes
  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // Auto-refresh balance periodically
  useEffect(() => {
    if (!wallet.isConnected) return;

    const interval = setInterval(() => {
      loadBalance();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [wallet.isConnected, loadBalance]);

  const checkSufficientAda = useCallback(
    async (minAmount: number): Promise<BalanceCheckResult> => {
      const balanceStr = await wallet.getBalance();
      const balance = parseFloat(balanceStr || '0');
      return {
        sufficient: balance >= minAmount,
        balance,
        required: minAmount
      };
    },
    [wallet]
  );

  const hasEnoughForMatch = balanceInfo ? balanceInfo.hasUtxos : false;
  const hasEnoughForEscrow = balanceInfo
    ? balanceInfo.balance >= MIN_ADA_REQUIREMENTS.ESCROW_LOCK && balanceInfo.hasUtxos
    : false;
  const hasEnoughForNFT = balanceInfo
    ? balanceInfo.balance >= MIN_ADA_REQUIREMENTS.NFT_MINT && balanceInfo.hasUtxos
    : false;
  const hasUtxosValue = balanceInfo?.hasUtxos || false;

  return {
    balanceInfo,
    isLoading,
    error,
    checkSufficientAda,
    hasEnoughForMatch,
    hasEnoughForEscrow,
    hasEnoughForNFT,
    hasUtxos: hasUtxosValue,
    refresh: loadBalance
  };
}
