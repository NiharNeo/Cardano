import React, { useState } from 'react';
import { useWallet, WalletName } from '../contexts/WalletContext';

export const WalletConnector: React.FC = () => {
  const { 
    wallet, 
    walletName, 
    address, 
    addresses,
    stakeKey,
    balance, 
    isConnected, 
    isConnecting, 
    availableWallets,
    connect, 
    disconnect 
  } = useWallet();
  
  const [error, setError] = useState<string | null>(null);

  // Get available wallet names
  const availableWalletNames: WalletName[] = [];
  if (availableWallets.eternl) availableWalletNames.push('eternl');
  if (availableWallets.lace) availableWalletNames.push('lace');
  if (availableWallets.nami) availableWalletNames.push('nami');

  const handleConnect = async (name: WalletName) => {
    if (!name) return;
    
    setError(null);
    try {
      await connect(name);
    } catch (error: any) {
      console.error(`Failed to connect to ${name}:`, error);
      setError(`Failed to connect to ${name}: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error: any) {
      console.error('Disconnect error:', error);
    }
  };

  // Helper to truncate address
  const truncateAddress = (addr: string | null, start = 12, end = 8): string => {
    if (!addr) return 'No address';
    if (addr.length <= start + end) return addr;
    return `${addr.slice(0, start)}...${addr.slice(-end)}`;
  };

  if (isConnected) {
    const paymentAddress = address || addresses?.change || addresses?.used?.[0] || null;
    const stakeAddress = stakeKey || addresses?.reward?.[0] || null;

    return (
      <div className="wallet-connector connected">
        <div className="wallet-info">
          <div className="wallet-badge">
            <span className="chip-dot" style={{ backgroundColor: '#10b981' }} />
            {walletName?.toUpperCase() || 'WALLET'}
          </div>
          
          <div className="wallet-details" style={{ marginTop: '0.75rem' }}>
            {/* Payment Address */}
            <div className="wallet-address-row">
              <span className="text-xs text-subtle" style={{ marginRight: '0.5rem' }}>Payment:</span>
              <span className="wallet-address mono text-xs" title={paymentAddress || undefined}>
                {truncateAddress(paymentAddress)}
              </span>
            </div>
            
            {/* Stake Address */}
            {stakeAddress && (
              <div className="wallet-address-row" style={{ marginTop: '0.5rem' }}>
                <span className="text-xs text-subtle" style={{ marginRight: '0.5rem' }}>Stake:</span>
                <span className="wallet-address mono text-xs" title={stakeAddress}>
                  {truncateAddress(stakeAddress)}
                </span>
              </div>
            )}
            
            {/* Balance */}
            {balance && (
              <div className="wallet-balance text-xs text-accent" style={{ marginTop: '0.5rem', fontWeight: '600' }}>
                {parseFloat(balance).toFixed(2)} ₳
              </div>
            )}
          </div>
        </div>
        <button 
          className="btn btn-ghost" 
          onClick={handleDisconnect} 
          disabled={isConnecting}
          style={{ marginLeft: 'auto' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Check if CIP-30 is available
  const hasCIP30 = typeof window !== 'undefined' && !!(window as any).cardano;
  const hasAnyWallet = availableWalletNames.length > 0;

  return (
    <div className="wallet-connector">
      <div className="wallet-connector-header">
        <span className="field-label">Connect Wallet</span>
        <span className="small-muted">CIP-30 compatible wallets</span>
      </div>

      {error && (
        <div className="error-message animate-fade-in" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <span className="error-icon">⚠</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {!hasCIP30 ? (
        <div className="wallet-empty-state">
          <p className="small-muted">
            CIP-30 not detected. Cardano wallet extensions are not available in this browser.
            Please ensure you're using a browser that supports Cardano wallet extensions.
          </p>
        </div>
      ) : !hasAnyWallet ? (
        <div className="wallet-empty-state">
          <p className="small-muted">
            No Cardano wallets detected. Please install{' '}
            <a href="https://www.lace.io/" target="_blank" rel="noopener noreferrer" className="link">
              Lace
            </a>
            ,{' '}
            <a href="https://eternl.io/" target="_blank" rel="noopener noreferrer" className="link">
              Eternl
            </a>
            , or{' '}
            <a href="https://namiwallet.io/" target="_blank" rel="noopener noreferrer" className="link">
              Nami
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="wallet-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          {availableWalletNames.map((name) => (
            <button
              key={name}
              className="btn btn-primary wallet-button"
              onClick={() => handleConnect(name)}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : `Connect ${name.charAt(0).toUpperCase() + name.slice(1)}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WalletConnector;

