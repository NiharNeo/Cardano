/**
 * useWalletBalance Hook
 * React hook that automatically polls wallet balance every 5 seconds
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';

export interface UseWalletBalanceResult {
  connected: boolean;
  loading: boolean;
  balanceLovelace: number;
  balanceAda: number;
  utxoCount: number;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to monitor wallet balance with automatic polling every 5 seconds
 * @returns Wallet balance information and refresh function
 */
export function useWalletBalance(): UseWalletBalanceResult {
  const wallet = useWallet();
  const [balanceLovelace, setBalanceLovelace] = useState<number>(0);
  const [balanceAda, setBalanceAda] = useState<number>(0);
  const [utxoCount, setUtxoCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!wallet.isConnected) {
      setBalanceLovelace(0);
      setBalanceAda(0);
      setUtxoCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use wallet context's getBalance which now uses MeshSDK
      const balanceStr = await wallet.getBalance();
      const balanceAdaValue = parseFloat(balanceStr || '0');
      const balanceLov = Math.floor(balanceAdaValue * 1000000);

      setBalanceLovelace(balanceLov);
      setBalanceAda(balanceAdaValue);
      setUtxoCount(wallet.utxoCount || 0);

      console.log('[useWalletBalance] Balance:', balanceAdaValue, 'ADA');
    } catch (err: any) {
      console.error('[useWalletBalance] Error fetching balance:', err);
      setError(err.message || 'Failed to fetch wallet balance');
      setBalanceLovelace(0);
      setBalanceAda(0);
      setUtxoCount(0);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  // Initial fetch
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Auto-poll every 5 seconds when connected
  useEffect(() => {
    if (!wallet.isConnected) {
      return;
    }

    const interval = setInterval(() => {
      fetchBalance();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [wallet.isConnected, fetchBalance]);

  return {
    connected: wallet.isConnected,
    loading,
    balanceLovelace,
    balanceAda,
    utxoCount,
    error,
    refresh: fetchBalance
  };
}
