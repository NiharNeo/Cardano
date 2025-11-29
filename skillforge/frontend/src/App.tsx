import React from 'react';
import VoiceInput from './components/VoiceInput';
import ProviderList, { Provider, ScoredProvider } from './components/ProviderList';
import EscrowModal from './components/EscrowModal';
import EscrowProgress, { EscrowStep } from './components/EscrowProgress';
import ParsedIntentCard from './components/ParsedIntentCard';
import RequestHistory from './components/RequestHistory';
import NFTMetadataViewer from './components/NFTMetadataViewer';
import WalletConnector from './components/WalletConnector';
import AikenInfo from './components/AikenInfo';
import { useWallet } from './contexts/WalletContext';
import type { SkillNftMetadata } from './components/NFTCard';
import { parseIntent, ParsedIntent } from './utils/intentParser';
import { matchProviders, getEscrowStatus, attestSession, mintNFT, getContractInfo } from './services/api';

type IntentHistoryItem = {
  utterance: string;
  parsed: ParsedIntent;
  summary: string;
  at: string;
};

type AppError = {
  type: 'empty_input' | 'invalid_duration' | 'invalid_budget' | 'no_match' | 'wallet_required' | null;
  message: string;
};

const App: React.FC = () => {
  const wallet = useWallet();
  const [intent, setIntent] = React.useState<ParsedIntent | null>(null);
  const [matches, setMatches] = React.useState<ScoredProvider[]>([]);
  const [summary, setSummary] = React.useState('');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [escrowStep, setEscrowStep] = React.useState<EscrowStep>('idle');
  const [selectedProvider, setSelectedProvider] = React.useState<ScoredProvider | null>(null);
  const [escrowTxId, setEscrowTxId] = React.useState<string | null>(null);
  const [nftMetadata, setNftMetadata] = React.useState<SkillNftMetadata | null>(null);
  const [nftCid, setNftCid] = React.useState<string | null>(null);
  const [nftImageCid, setNftImageCid] = React.useState<string | null>(null);
  const [intentHistory, setIntentHistory] = React.useState<IntentHistoryItem[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isMatching, setIsMatching] = React.useState(false);
  const [isMinting, setIsMinting] = React.useState(false);
  const [isAttesting, setIsAttesting] = React.useState(false);
  const [error, setError] = React.useState<AppError>({ type: null, message: '' });
  const [learnerAttested, setLearnerAttested] = React.useState(false);
  const [providerAttested, setProviderAttested] = React.useState(false);
  const [escrowHash, setEscrowHash] = React.useState<string | null>(null);
  const [nftPolicyId, setNftPolicyId] = React.useState<string | null>(null);

  // Load Aiken contract info on mount
  React.useEffect(() => {
    const loadContractInfo = async () => {
      try {
        const info = await getContractInfo();
        setEscrowHash(info.escrowValidatorHash);
        setNftPolicyId(info.nftPolicyId);
      } catch (error) {
        console.error('Error loading contract info:', error);
      }
    };
    loadContractInfo();
  }, []);

  // Poll escrow status when session exists
  React.useEffect(() => {
    if (!sessionId) return;

    const pollEscrowStatus = async () => {
      try {
        const status = await getEscrowStatus({ sessionId });

        if (status.status === 'locked') {
          setEscrowStep('fundsLocked');
          if (status.txId) {
            setEscrowTxId(status.txId);
          }
        } else if (status.status === 'in_session') {
          setEscrowStep('sessionActive');
        } else if (status.status === 'completed' || status.status === 'paid_out') {
          setEscrowStep('nftMinted');
        }
      } catch (error) {
        console.error('Error polling escrow status:', error);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollEscrowStatus, 5000);
    pollEscrowStatus(); // Initial poll

    return () => clearInterval(interval);
  }, [sessionId]);

  const validateIntent = (parsed: ParsedIntent, utterance: string): AppError | null => {
    if (!utterance.trim()) {
      return { type: 'empty_input', message: 'Please enter a request. Try describing the skill, budget, or duration you need.' };
    }

    if (parsed.durationMinutes != null && (parsed.durationMinutes <= 0 || parsed.durationMinutes > 1440)) {
      return { type: 'invalid_duration', message: 'Duration must be between 1 minute and 24 hours.' };
    }

    if (parsed.priceMax != null && (parsed.priceMax <= 0 || parsed.priceMax > 10000)) {
      return { type: 'invalid_budget', message: 'Budget must be between 1 and 10,000 ADA.' };
    }

    return null;
  };

  // Step 1-3: Parse intent and match providers
  const handleIntentSubmit = React.useCallback(
    async (utterance: string) => {
      // Always return valid JSX - never throw
      try {
        setError({ type: null, message: '' });
        setIsParsing(true);

        const parsed = parseIntent(utterance);
        console.log('[App] Parsed intent:', parsed);
        
        // Set intent immediately after parsing
        setIntent(parsed);
        
        const validationError = validateIntent(parsed, utterance);

        if (validationError) {
          setError(validationError);
          setIsParsing(false);
          return;
        }

        setIsParsing(false);
        setIsMatching(true);

        // Step 3: Match providers via backend
        console.log('[App] Calling matchProviders API...', {
          skill: parsed.skill,
          budget: parsed.priceMax,
          duration: parsed.durationMinutes,
          urgency: parsed.urgency,
          stakeKey: wallet.stakeKey
        });

        const matchResponse = await matchProviders({
          skill: parsed.skill || undefined,
          budget: parsed.priceMax || undefined,
          duration: parsed.durationMinutes || undefined,
          urgency: parsed.urgency || undefined,
          stakeKey: wallet.stakeKey || undefined
        });

        console.log('[App] Match response received:', matchResponse);

        // Safe check for response
        if (!matchResponse) {
          throw new Error('No response from backend');
        }

        // Ensure providers is an array
        const providers = Array.isArray(matchResponse.providers) ? matchResponse.providers : [];
        
        if (providers.length === 0 || (providers[0]?.score || 0) < 20) {
          setError({
            type: 'no_match',
            message: 'No suitable providers found. Try adjusting your skill, budget, or duration requirements.'
          });
          setIsMatching(false);
          return;
        }

        // Convert to ScoredProvider format with safe optional chaining
        const scoredProviders: ScoredProvider[] = providers
          .filter((p) => p && p.id) // Filter out invalid providers
          .map((p) => {
            const costPerHour = typeof p.cost_per_hour === 'string' 
              ? parseFloat(p.cost_per_hour) 
              : (typeof p.cost_per_hour === 'number' ? p.cost_per_hour : 0);
            
            const rating = typeof p.rating === 'string'
              ? parseFloat(p.rating)
              : (typeof p.rating === 'number' ? p.rating : 0);

            return {
              id: p.id || '',
              name: p.name || 'Unknown',
              skills: Array.isArray(p.skills) ? p.skills.filter(Boolean) : [],
              hourlyRateAda: isNaN(costPerHour) ? 0 : costPerHour,
              rating: isNaN(rating) ? 0 : rating,
              completedGigs: 0, // Not in new schema
              availability: Array.isArray(p.availability) ? p.availability.filter(Boolean) : [],
              timezones: p.timezone ? [p.timezone] : [],
              bio: '',
              score: typeof p.score === 'number' ? p.score : 0,
              reasons: Array.isArray(p.reasons) ? p.reasons.filter(Boolean) : []
            };
          });

        if (scoredProviders.length === 0) {
          setError({
            type: 'no_match',
            message: 'No valid providers found after processing results.'
          });
          setIsMatching(false);
          return;
        }

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setIntentHistory((prev) => {
          const newHistory = [
            {
              utterance,
              parsed,
              summary: matchResponse.summary,
              at: timestamp
            },
            ...prev
          ];
          return newHistory.slice(0, 5);
        });

        // Intent already set above, but ensure it's set after successful match
        console.log('[App] Setting intent after successful match:', parsed);
        setIntent(parsed);
        setMatches(scoredProviders.slice(0, 3));
        setSummary(matchResponse.summary || 'No summary available');
        setEscrowStep('idle');
        setSelectedProvider(null);
        setEscrowTxId(null);
        setSessionId(null);
        setNftMetadata(null);
        setNftCid(null);
        setNftImageCid(null);
        setLearnerAttested(false);
        setProviderAttested(false);
      } catch (error: any) {
        console.error('[App] Error matching providers:', error);
        console.error('[App] Error stack:', error.stack);
        console.error('[App] Error details:', {
          message: error.message,
          name: error.name,
          cause: error.cause
        });
        
        const errorMessage = error?.message || 'Failed to fetch providers. Please check your connection and try again.';
        const isNetworkError = errorMessage.includes('fetch') || 
                              errorMessage.includes('network') || 
                              errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('CORS');
        
        setError({
          type: 'no_match',
          message: isNetworkError
            ? 'Failed to connect to backend. Make sure the server is running on http://localhost:3000'
            : errorMessage
        });
      } finally {
        setIsMatching(false);
      }
    },
    [wallet.stakeKey]
  );

  // Step 4: Select mentor
  const handleProviderSelected = (provider: ScoredProvider) => {
    if (!wallet.isConnected || !wallet.address) {
      setError({
        type: 'wallet_required',
        message: 'Please connect your wallet to select a mentor and initiate escrow.'
      });
      return;
    }
    setSelectedProvider(provider);
  };

  // Step 5: Lock funds in escrow
  const handleEscrowLocked = async (txId: string, escrowIdParam: string, sessionIdParam: string) => {
    setEscrowTxId(txId);
    setSessionId(sessionIdParam);
    setEscrowStep('fundsLocked');
    setSelectedProvider(null);
  };

  // Step 7: Submit attestation
  const handleAttest = async (isLearner: boolean) => {
    if (!sessionId || !wallet.address) return;

    setIsAttesting(true);
    try {
      const response = await attestSession({
        sessionId,
        wallet: wallet.address,
        stakeKey: wallet.stakeKey || undefined
      });

      if (isLearner) {
        setLearnerAttested(response.bothAttested || false);
      } else {
        setProviderAttested(response.bothAttested || false);
      }

      if (response.bothAttested) {
        setEscrowStep('sessionActive');
        // Both attested - ready for NFT minting
      }
    } catch (error: any) {
      console.error('Error attesting:', error);
      setError({
        type: null,
        message: `Failed to submit attestation: ${error.message}`
      });
    } finally {
      setIsAttesting(false);
    }
  };

  // Step 8-11: Mint NFT and display
  const handleMintNFT = async (eventCardImage?: File) => {
    if (!sessionId || !wallet.isConnected || !intent || !intent.skill) return;

    setIsMinting(true);

    try {
      // Step 8-9: Mint NFT via backend (handles IPFS upload)
      const mintResponse = await mintNFT({
        sessionId,
        eventCardImage,
        stakeKey: wallet.stakeKey || undefined
      });

      // Step 10: Sign and submit transaction
      const signedTx = await wallet.signTx(mintResponse.txBody);
      const txHash = await wallet.submitTx(signedTx);

      // Update backend that NFT was minted
      try {
        await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/nft/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId,
            txHash
          })
        });
      } catch (err) {
        console.error('Error updating NFT status:', err);
        // Continue even if update fails
      }

      // Step 11: Fetch metadata from IPFS and update UI
      try {
        const metadataResponse = await fetch(mintResponse.metadataUrl);
        const ipfsMetadata = await metadataResponse.json();
        
        // Extract the actual NFT metadata from IPFS response
        const nftData = ipfsMetadata['721']?.policy_id_placeholder;
        const nftName = Object.keys(nftData || {})[0];
        const nftMetadata = nftData?.[nftName];

        if (nftMetadata) {
          const metadata: SkillNftMetadata = {
            name: nftMetadata.name || nftName,
            description: nftMetadata.description || '',
            image: nftMetadata.image,
            provider: nftMetadata.provider || selectedProvider?.name || 'Unknown',
            skill: nftMetadata.skill || intent.skill,
            rating: nftMetadata.rating || 5,
            sessionDate: nftMetadata.sessionDate || new Date().toISOString(),
            attributes: nftMetadata.attributes || []
          };

          setNftMetadata(metadata);
        } else {
          // Fallback if metadata structure is different
          const metadata: SkillNftMetadata = {
            name: `SkillForge Session – ${intent.skill}`,
            description: 'Proof-of-session NFT minted by SkillForge',
            image: mintResponse.imageCid ? `ipfs://${mintResponse.imageCid}` : undefined,
            provider: selectedProvider?.name || 'Unknown',
            skill: intent.skill,
            rating: 5,
            sessionDate: new Date().toISOString(),
            attributes: [
              { trait_type: 'provider', value: selectedProvider?.name || 'Unknown' },
              { trait_type: 'skill', value: intent.skill },
              { trait_type: 'rating', value: 5 }
            ]
          };
          setNftMetadata(metadata);
        }
      } catch (err) {
        console.error('Error fetching metadata from IPFS:', err);
        // Use fallback metadata
        const metadata: SkillNftMetadata = {
          name: `SkillForge Session – ${intent.skill}`,
          description: 'Proof-of-session NFT minted by SkillForge',
          image: mintResponse.imageCid ? `ipfs://${mintResponse.imageCid}` : undefined,
          provider: selectedProvider?.name || 'Unknown',
          skill: intent.skill,
          rating: 5,
          sessionDate: new Date().toISOString(),
          attributes: [
            { trait_type: 'provider', value: selectedProvider?.name || 'Unknown' },
            { trait_type: 'skill', value: intent.skill },
            { trait_type: 'rating', value: 5 }
          ]
        };
        setNftMetadata(metadata);
      }

      setNftCid(mintResponse.ipfsCid);
      setNftImageCid(mintResponse.imageCid || null);
      setEscrowStep('nftMinted');

      console.log('NFT minted successfully:', {
        txHash,
        policyId: mintResponse.policyId,
        assetName: mintResponse.assetName,
        ipfsCid: mintResponse.ipfsCid,
        imageCid: mintResponse.imageCid
      });
    } catch (error: any) {
      console.error('Error minting NFT:', error);
      setError({
        type: null,
        message: `Failed to mint NFT: ${error.message}`
      });
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <h1>SkillForge</h1>
          <p>Voice-driven skill matching and on-chain session attestations for Cardano.</p>
        </div>
        <div className="app-badge">
          <span className="chip-dot" />
          Cardano dApp
        </div>
      </header>

      <section className="card mt-4">
        <WalletConnector />
        <AikenInfo escrowHash={escrowHash} nftPolicyId={nftPolicyId} />
      </section>

      <div className="layout-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">1. Capture intent</div>
              <div className="card-subtitle">
                Use voice or text to describe the mentor or build session you&apos;re after.
              </div>
            </div>
            <span className="pill">Input → Intent → Matches</span>
          </div>
          <VoiceInput onSubmit={handleIntentSubmit} />

          {error.type && (
            <div className="error-message animate-fade-in">
              <span className="error-icon">⚠</span>
              <span className="error-text">{error.message}</span>
            </div>
          )}

          <div className="mt-3">
            <ParsedIntentCard intent={intent} isLoading={isParsing} />
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">2. Escrow &amp; attest</div>
              <div className="card-subtitle">
                Lock funds, complete the session, then mint an IPFS-ready NFT receipt.
              </div>
            </div>
            <span className="pill">Escrow → Session → NFT</span>
          </div>

          <div className="section-spacing">
            <EscrowProgress currentStep={escrowStep} txId={escrowTxId} />

            {/* Attestation buttons */}
            {escrowStep === 'fundsLocked' && wallet.isConnected && (
              <div className="attestation-section">
                <div className="field-label">Session Attestations</div>
                <div className="attestation-buttons">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleAttest(true)}
                    disabled={isAttesting || learnerAttested}
                  >
                    {learnerAttested ? '✓ Learner Attested' : 'Attest as Learner'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleAttest(false)}
                    disabled={isAttesting || providerAttested}
                  >
                    {providerAttested ? '✓ Provider Attested' : 'Attest as Provider'}
                  </button>
                </div>
                {learnerAttested && providerAttested && (
                  <div className="success-message">
                    ✓ Both parties attested. Ready to mint NFT.
                  </div>
                )}
              </div>
            )}

            {/* NFT Minting */}
            {escrowStep === 'sessionActive' && learnerAttested && providerAttested && (
              <div className="mint-section">
                <div className="field-label">Mint Session NFT</div>
                <input
                  type="file"
                  accept="image/png"
                  id="eventCardImage"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleMintNFT(file);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <div className="flex-between">
                  <span className="small-muted">
                    Upload optional session image (PNG) and mint NFT
                  </span>
                  <div>
                    <label htmlFor="eventCardImage" className="btn btn-ghost" style={{ marginRight: '8px' }}>
                      {isMinting ? 'Minting...' : 'Mint with Image'}
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleMintNFT()}
                      disabled={isMinting || !wallet.isConnected}
                    >
                      {isMinting ? 'Minting NFT...' : 'Mint NFT'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <NFTMetadataViewer
              metadata={nftMetadata}
              cid={nftCid}
              imageCid={nftImageCid}
              isLoading={isMinting}
            />
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <div className="card-header">
          <div>
            <div className="card-title">Provider matches</div>
            <div className="card-subtitle">
              Ranked by skill fit, budget alignment, rating, and near-term availability.
            </div>
          </div>
          <span className="pill">Backend API • Real-time scoring</span>
        </div>
        <ProviderList
          providers={matches}
          onSelect={handleProviderSelected}
          parsedSummary={summary}
          isLoading={isMatching}
          showPlaceholders={isMatching}
        />
      </section>

      <section className="card mt-4">
        <div className="card-header">
          <div>
            <div className="card-title">Recent requests</div>
            <div className="card-subtitle">
              A short history of what you&apos;ve asked SkillForge for in this session.
            </div>
          </div>
          <span className="pill">In-memory • Clears on refresh</span>
        </div>
        <RequestHistory history={intentHistory} maxItems={5} />
      </section>

      <EscrowModal
        provider={selectedProvider}
        isOpen={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
        onEscrowLocked={handleEscrowLocked}
        intent={intent}
      />
    </div>
  );
};

export default App;
