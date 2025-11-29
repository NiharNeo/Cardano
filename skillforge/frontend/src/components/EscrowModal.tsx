import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ScoredProvider } from './ProviderList';

interface EscrowModalProps {
  provider: ScoredProvider | null;
  isOpen: boolean;
  onClose: () => void;
  onEscrowLocked: (txId: string) => void;
}

export const EscrowModal: React.FC<EscrowModalProps> = ({
  provider,
  isOpen,
  onClose,
  onEscrowLocked
}) => {
  const [isLocking, setIsLocking] = React.useState(false);

  if (!isOpen || !provider) return null;

  const handleLockEscrow = () => {
    setIsLocking(true);
    // Simulate a short delay to feel like a blockchain call
    setTimeout(() => {
      const fakeTxId = uuidv4();
      onEscrowLocked(fakeTxId);
      setIsLocking(false);
    }, 700);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <div className="stack-tight">
            <span className="modal-title">Simulate Cardano escrow lock</span>
            <span className="small-muted">
              This is an in-browser demo. No real ADA moves, but the flow mirrors an on-chain
              experience.
            </span>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="status-strip">
            <span className="status-dot" />
            <span>
              Locking funds with <strong>{provider.name}</strong> at{' '}
              <strong>{provider.hourlyRateAda} ₳/hour</strong>.
            </span>
          </div>
          <div className="stack">
            <div className="stack-tight">
              <span className="field-label">What this step would do on mainnet</span>
              <ul className="text-xs text-subtle" style={{ paddingLeft: 16, margin: 0 }}>
                <li>Construct a transaction with a time-locked policy.</li>
                <li>Lock user funds in a script-controlled UTXO.</li>
                <li>Prepare NFT mint metadata to attest the session.</li>
              </ul>
            </div>
            <div className="stack-tight">
              <span className="field-label">In this demo</span>
              <span className="small-muted">
                We generate a fake transaction hash using <code>uuid</code> and show a locked
                escrow state you can complete later.
              </span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={isLocking}
            onClick={handleLockEscrow}
          >
            {isLocking ? 'Locking escrow…' : 'Lock escrow & generate fake TX'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscrowModal;


