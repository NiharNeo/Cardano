import React from 'react';
import { useWallet } from '../contexts/WalletContext';

export type EscrowStep = 'idle' | 'fundsLocked' | 'sessionActive' | 'nftMinted';

interface EscrowProgressProps {
  currentStep: EscrowStep;
  txId?: string | null;
  learnerAttested?: boolean;
  providerAttested?: boolean;
  onAttest?: (isLearner: boolean) => void;
  isAttesting?: boolean;
  isWalletConnected?: boolean;
}

export const EscrowProgress: React.FC<EscrowProgressProps> = ({ 
  currentStep, 
  txId,
  learnerAttested = false,
  providerAttested = false,
  onAttest,
  isAttesting = false,
  isWalletConnected = false
}) => {
  const wallet = useWallet();
  const { lockState, resetEscrow } = wallet;
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
      
      {/* Show lock state status */}
      {lockState && lockState.status !== 'idle' && (
        <div className="escrow-lock-status mt-3">
          <div className="text-xs text-subtle">
            Status: {lockState.status}
            {lockState.error && (
              <span className="text-red-500 ml-2">Error: {lockState.error}</span>
            )}
            {lockState.txHash && (
              <span className="mono ml-2">TX: {lockState.txHash.slice(0, 8)}...</span>
            )}
          </div>
        </div>
      )}
      
      {/* Attestation buttons - only show after funds are locked */}
      {currentStep === 'fundsLocked' && onAttest && (
        <div className="escrow-attestation mt-4">
          <div className="flex gap-2">
            <button
              className="btn btn-sm"
              disabled={learnerAttested || isAttesting || !isWalletConnected}
              onClick={() => onAttest(true)}
            >
              {learnerAttested ? '✓ Learner Attested' : 'Attest as Learner'}
            </button>
            <button
              className="btn btn-sm"
              disabled={providerAttested || isAttesting || !isWalletConnected}
              onClick={() => onAttest(false)}
            >
              {providerAttested ? '✓ Provider Attested' : 'Attest as Provider'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscrowProgress;

