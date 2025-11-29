import React, { useState, useEffect } from 'react';

interface AikenInfoProps {
  escrowHash?: string | null;
  nftPolicyId?: string | null;
}

export const AikenInfo: React.FC<AikenInfoProps> = ({ escrowHash, nftPolicyId }) => {
  const [expanded, setExpanded] = useState(false);
  const isLocalMode = import.meta.env.VITE_NETWORK === 'local' || import.meta.env.VITE_LOCAL_WALLET_MODE === 'true';

  if (!escrowHash && !nftPolicyId) {
    return null;
  }

  return (
    <div className="aiken-info" style={{
      marginTop: '1rem',
      padding: '0.75rem',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '8px'
    }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}>
            ⚡ Aiken Contracts
          </span>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            (v1.0.0)
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {isLocalMode && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem',
          backgroundColor: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '6px',
          fontSize: '0.75rem'
        }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
            🚀 LOCAL DEVNET — INFINITE ADA
          </div>
          <div style={{ color: '#78350f', fontSize: '0.7rem' }}>
            Running on local Cardano network. All transactions confirm instantly. Use faucet to fund addresses.
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem' }}>
          {escrowHash && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ color: '#9ca3af', marginBottom: '0.25rem' }}>Escrow Validator Hash:</div>
              <code style={{ 
                display: 'block',
                padding: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.7rem'
              }}>
                {escrowHash}
              </code>
            </div>
          )}

          {nftPolicyId && (
            <div>
              <div style={{ color: '#9ca3af', marginBottom: '0.25rem' }}>NFT Policy ID:</div>
              <code style={{ 
                display: 'block',
                padding: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.7rem'
              }}>
                {nftPolicyId}
              </code>
            </div>
          )}

          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
              Built with Aiken • Contracts compiled to Plutus V2
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AikenInfo;

