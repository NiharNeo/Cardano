import React from 'react';

export type EscrowStep = 'idle' | 'fundsLocked' | 'sessionActive' | 'nftMinted';

interface EscrowProgressProps {
  currentStep: EscrowStep;
  txId?: string | null;
}

export const EscrowProgress: React.FC<EscrowProgressProps> = ({ currentStep, txId }) => {
  const steps: Array<{ key: EscrowStep; label: string; description: string }> = [
    {
      key: 'fundsLocked',
      label: 'Step 1: Funds Locked',
      description: 'Escrow transaction confirmed on-chain'
    },
    {
      key: 'sessionActive',
      label: 'Step 2: Session Active',
      description: 'Mentoring session in progress'
    },
    {
      key: 'nftMinted',
      label: 'Step 3: NFT Minted',
      description: 'Session attestation NFT created'
    }
  ];

  const getStepIndex = (step: EscrowStep): number => {
    if (step === 'idle') return -1;
    if (step === 'fundsLocked') return 0;
    if (step === 'sessionActive') return 1;
    if (step === 'nftMinted') return 2;
    return -1;
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="escrow-progress">
      <div className="escrow-progress-header">
        <span className="field-label">Escrow Progress</span>
        {txId && (
          <span className="text-xs text-subtle mono">
            TX: {txId.slice(0, 8)}...
          </span>
        )}
      </div>
      <div className="escrow-steps">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.key}
              className={`escrow-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div className="escrow-step-indicator">
                {isCompleted ? (
                  <span className="escrow-step-check">✓</span>
                ) : (
                  <span className="escrow-step-number">{index + 1}</span>
                )}
              </div>
              <div className="escrow-step-content">
                <div className="escrow-step-label">{step.label}</div>
                <div className="escrow-step-description">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      {currentStep === 'idle' && (
        <div className="escrow-idle-message">
          <span className="text-xs text-subtle">
            Waiting for you to choose a mentor from the matches.
          </span>
        </div>
      )}
    </div>
  );
};

export default EscrowProgress;

