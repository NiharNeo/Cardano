/**
 * WalletBalanceDisplay Component
 * Displays wallet balance (ADA + lovelace), UTxO count, and insufficient test ADA warning
 */

import React from 'react';
import { useWalletBalance } from '../cardano/useWalletBalance';

interface WalletBalanceDisplayProps {
  minAdaRequired?: number;
}

const WalletBalanceDisplay: React.FC<WalletBalanceDisplayProps> = ({
  minAdaRequired = 5
}) => {
  const { connected, loading, balanceLovelace, balanceAda, utxoCount, error, refresh } = useWalletBalance();

  const openFaucet = () => {
    window.open('https://docs.cardano.org/cardano-testnet/tools/faucet/', '_blank');
  };

  // Format lovelace for display (show last 6 digits)
  const formatLovelace = (lovelace: number): string => {
    const lovelaceStr = Math.floor(lovelace).toString();
    if (lovelaceStr.length <= 6) {
      return lovelaceStr;
    }
    return lovelaceStr.slice(-6);
  };

  // Format ADA for display
  const formatAda = (ada: number): string => {
    if (ada === 0) return '0';
    if (ada < 0.001) return '< 0.001';
    return ada.toFixed(3);
  };

  if (!connected) {
    return (
      <div className="wallet-balance-display">
        <span className="text-xs text-subtle">Connect wallet to see balance</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wallet-balance-display">
        <span className="text-xs text-subtle">Loading balance...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-balance-display">
        <span className="text-xs text-error">Error: {error}</span>
        <button
          className="btn btn-sm btn-ghost mt-1"
          onClick={refresh}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasInsufficientBalance = balanceAda < minAdaRequired;

  return (
    <div className="wallet-balance-display">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs">
          <span className="text-subtle">Balance: </span>
          <strong className="text-foreground">{formatAda(balanceAda)} ADA</strong>
          {balanceLovelace > 0 && (
            <span className="text-subtle ml-1">
              ({formatLovelace(balanceLovelace)} lovelace)
            </span>
          )}
        </div>
        <span className="text-xs text-subtle">|</span>
        <div className="text-xs">
          <span className="text-subtle">UTxOs: </span>
          <strong className="text-foreground">{utxoCount}</strong>
        </div>
      </div>

      {hasInsufficientBalance && (
        <div className="wallet-balance-warning mt-2 p-2 bg-warning/10 border border-warning/20 rounded">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-warning">⚠</span>
            <span className="text-xs text-warning">
              Insufficient test ADA. Please fund your wallet.
            </span>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={openFaucet}
            type="button"
          >
            Get Test ADA
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletBalanceDisplay;
