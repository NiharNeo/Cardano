import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { createSession, initEscrow } from '../services/api';
import type { ParsedIntent } from '../utils/intentParser';
import type { ScoredProvider } from './ProviderList';
import WalletBalanceDisplay from './WalletBalanceDisplay';

interface EscrowModalProps {
  provider: ScoredProvider | null;
  isOpen: boolean;
  onClose: () => void;
  onEscrowLocked: (txId: string, escrowId: string, sessionId: string) => void;
  intent: ParsedIntent | null;
}

export const EscrowModal: React.FC<EscrowModalProps> = ({
  provider,
  isOpen,
  onClose,
  onEscrowLocked,
  intent
}) => {
  const wallet = useWallet();
  const { lockState, resetEscrow } = wallet;
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !provider) return null;

  const handleLockEscrow = async () => {
    console.log('[EscrowModal] handleLockEscrow called', {
      isConnected: wallet.isConnected,
      hasAddress: !!wallet.address,
      hasIntent: !!intent,
      intentSkill: intent?.skill,
      fullIntent: intent
    });

    // Check wallet connection
    if (!wallet.isConnected || !wallet.address) {
      setError('Please connect your wallet to proceed');
      return;
    }

    // Check intent - allow if intent exists (skill can be null, we'll use a default)
    if (!intent) {
      setError('Please enter a skill request and match providers first');
      return;
    }

    // Use intent.skill or a default
    const skillToUse = intent.skill || 'General Mentoring';
    console.log('[EscrowModal] Using skill:', skillToUse);

    setIsLocking(true);
    setError(null);

    try {
      // Calculate escrow amount
      const durationHours = intent.durationMinutes ? intent.durationMinutes / 60 : 1;
      const amountAda = provider.hourlyRateAda * durationHours;

      // Step 1: Create session in backend
      console.log('[EscrowModal] Creating session with skill:', skillToUse);
      
      const sessionResponse = await createSession({
        learnerAddress: wallet.address,
        providerId: provider.id,
        skill: skillToUse,
        budget: intent.priceMax || undefined,
        duration: intent.durationMinutes || undefined,
        urgency: intent.urgency || undefined,
        stakeKey: wallet.stakeKey || undefined
      });

      // Step 2: Initialize escrow using wallet lockFunds function
      // Note: In production, providerAddress would come from provider's wallet
      // For now, we'll use a placeholder
      const providerAddress = wallet.paymentAddress || wallet.address || ''; // Placeholder - should be provider's address

      // Use wallet lockFunds function which handles signing and submission
      const lockResult = await wallet.lockFunds({
        sessionId: sessionResponse.sessionId,
        mentorAddress: providerAddress,
        price: amountAda,
        parsedIntent: intent
      });

      if (!lockResult.success || !lockResult.txHash) {
        throw new Error(lockResult.error || 'Failed to lock funds');
      }

      const txId = lockResult.txHash;

      // Step 5: Update escrow state in backend with transaction ID
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        await fetch(`${backendUrl}/escrow/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: sessionResponse.sessionId,
            txId,
            utxo: `${txId}#0` // Placeholder UTXO format
          })
        });
        console.log('[EscrowModal] Escrow state updated successfully');
      } catch (err) {
        console.error('[EscrowModal] Error updating escrow state:', err);
        // Don't throw - transaction was already submitted
      }

      // Step 6: Notify parent component
      onEscrowLocked(txId, 'escrow-id', sessionResponse.sessionId);
    } catch (err: any) {
      console.error('[EscrowModal] Error locking escrow:', err);
      const errorMessage = err.message || err.error || 'Failed to lock escrow. Please try again.';
      setError(errorMessage);
      
      // Show user-friendly error
      if (err.message?.includes('Wallet not connected')) {
        setError('Please connect your wallet to proceed');
      } else if (err.message?.includes('NO_UTXOS')) {
        setError('Insufficient funds. Please ensure your wallet has enough ADA.');
      } else {
        setError(errorMessage);
      }
      
      // Reset escrow state on error to allow retry
      if (lockState?.status === 'error') {
        setTimeout(() => {
          resetEscrow();
        }, 1000);
      }
    } finally {
      setIsLocking(false);
    }
  };

  // Ensure intent exists and has required fields
  const ready = wallet.isConnected && wallet.address && intent;
  const durationHours = intent?.durationMinutes ? intent.durationMinutes / 60 : 1;
  const totalAmount = provider.hourlyRateAda * durationHours;
  
  // Check if escrow is in progress (disable button if building, awaiting signature, or submitting)
  const isEscrowInProgress = lockState?.status === 'building_tx' || 
                             lockState?.status === 'awaiting_signature' || 
                             lockState?.status === 'submitting';
  
  // Allow retry if error state
  const canRetry = lockState?.status === 'error';
  
  console.log('[EscrowModal] Render state:', {
    ready,
    isConnected: wallet.isConnected,
    hasAddress: !!wallet.address,
    hasIntent: !!intent,
    intentSkill: intent?.skill,
    lockStateStatus: lockState?.status,
    isEscrowInProgress,
    canRetry
  });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <div className="stack-tight">
            <span className="modal-title">Initiate Cardano Escrow</span>
            <span className="small-muted">
              Lock funds in an escrow contract for your session with {provider.name}.
            </span>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="error-message animate-fade-in">
              <span className="error-icon">⚠</span>
              <span className="error-text">{error}</span>
            </div>
          )}

          <div className="status-strip">
            <span className="status-dot" />
            <span>
              Locking funds with <strong>{provider.name}</strong> at{' '}
              <strong>{provider.hourlyRateAda} ₳/hour</strong>.
            </span>
          </div>

          <div className="stack">
            <div className="stack-tight">
              <span className="field-label">Session Details</span>
              <div className="escrow-details">
                <div className="escrow-detail-row">
                  <span className="text-xs text-subtle">Duration:</span>
                  <span className="text-xs">{durationHours.toFixed(1)} hours</span>
                </div>
                <div className="escrow-detail-row">
                  <span className="text-xs text-subtle">Rate:</span>
                  <span className="text-xs">{provider.hourlyRateAda} ₳/hour</span>
                </div>
                <div className="escrow-detail-row">
                  <span className="text-xs text-subtle">Total Amount:</span>
                  <span className="text-xs text-accent font-weight-bold">{totalAmount.toFixed(2)} ₳</span>
                </div>
              </div>
            </div>

            <div className="stack-tight">
              <span className="field-label">What happens next</span>
              <ul className="text-xs text-subtle" style={{ paddingLeft: 16, margin: 0 }}>
                <li>Create session in database</li>
                <li>Backend builds escrow transaction with Plutus script</li>
                <li>Funds are locked in a script-controlled UTXO</li>
                <li>Transaction is signed and submitted to Cardano network</li>
                <li>Escrow status is monitored via UTXO watcher (polls every 5s)</li>
              </ul>
            </div>

            {!ready && (
              <div className="error-message">
                <span className="error-icon">⚠</span>
                <span className="error-text">
                  {!wallet.isConnected || !wallet.address
                    ? 'Please connect your wallet to proceed'
                    : !intent
                    ? 'Please enter a skill request and match providers first'
                    : 'Please ensure intent is parsed'}
                </span>
              </div>
            )}

            {wallet.isConnected && (
              <div className="mt-3">
                <WalletBalanceDisplay minAdaRequired={10} />
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={isLocking}>
            Cancel
          </button>
          {canRetry && resetEscrow ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                resetEscrow();
                setError(null);
                handleLockEscrow();
              }}
            >
              Retry Escrow
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={isLocking || !ready || isEscrowInProgress}
              onClick={handleLockEscrow}
            >
              {isLocking || isEscrowInProgress
                ? lockState?.status === 'building_tx'
                  ? 'Building transaction…'
                  : lockState?.status === 'awaiting_signature'
                  ? 'Awaiting signature…'
                  : lockState?.status === 'submitting'
                  ? 'Submitting…'
                  : 'Locking escrow…'
                : `Lock ${totalAmount.toFixed(2)} ₳ in escrow`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EscrowModal;
