import React from 'react';
import VoiceInput from './components/VoiceInput';
import ProviderList, { Provider, ScoredProvider } from './components/ProviderList';
import EscrowModal from './components/EscrowModal';
import NFTCard, { SkillNftMetadata, buildSkillNftMetadata } from './components/NFTCard';
import { parseIntent, ParsedIntent } from './utils/intentParser';
import providersData from './data/providers.json';

type AppPhase = 'idle' | 'matched' | 'escrowLocked' | 'completed';

const ALL_PROVIDERS: Provider[] = providersData as Provider[];

const scoreProviders = (intent: ParsedIntent): { scored: ScoredProvider[]; summary: string } => {
  if (!intent.skill && !intent.priceMax && !intent.durationMinutes) {
    return {
      scored: [],
      summary:
        'SkillForge will use your skill, budget, and duration to find the best mentor or builder.'
    };
  }

  const scored = ALL_PROVIDERS.map<ScoredProvider>((p) => {
    let score = 0;
    const reasons: string[] = [];

    // Skill relevance
    if (intent.skill) {
      const lowerSkill = intent.skill.toLowerCase();
      const matches = p.skills.filter((s) => lowerSkill.includes(s) || s.includes(lowerSkill));
      if (matches.length > 0) {
        score += 45;
        reasons.push(`Skill match: ${matches.join(', ')}`);
      }
    }

    // Price fit
    if (intent.priceMax != null) {
      if (p.hourlyRateAda <= intent.priceMax) {
        const budgetHeadroom = intent.priceMax - p.hourlyRateAda;
        const budgetScore = Math.max(0, Math.min(25, 25 - budgetHeadroom * 0.3));
        score += 25 + budgetScore * 0.4;
        reasons.push(`Within budget (${p.hourlyRateAda} ₳ ≤ ${intent.priceMax} ₳)`);
      } else {
        // Slight penalty for being over budget
        score -= 10;
        reasons.push(`Above budget (${p.hourlyRateAda} ₳ > ${intent.priceMax} ₳)`);
      }
    }

    // Rating
    const ratingScore = (p.rating / 5) * 20;
    score += ratingScore;
    reasons.push(`Strong rating (${p.rating.toFixed(1)}★)`);

    // Availability heuristic: reward "today"/"this week"
    if (p.availability.includes('today')) {
      score += 8;
      reasons.push('Available today');
    } else if (p.availability.includes('this week')) {
      score += 4;
      reasons.push('Available this week');
    }

    const boundedScore = Math.max(0, Math.min(100, score));

    return {
      ...p,
      score: boundedScore,
      reasons
    };
  }).sort((a, b) => b.score - a.score);

  const summaryParts: string[] = [];
  if (intent.skill) summaryParts.push(`skill ≈ “${intent.skill}”`);
  if (intent.priceMax != null) summaryParts.push(`budget ≤ ${intent.priceMax} ₳`);
  if (intent.durationMinutes != null) summaryParts.push(`duration ≈ ${intent.durationMinutes} min`);

  return {
    scored,
    summary: `Parsed intent → ${summaryParts.join(' • ')}`
  };
};

type IntentHistoryItem = {
  utterance: string;
  parsed: ParsedIntent;
  summary: string;
  at: string;
};

const App: React.FC = () => {
  const [intent, setIntent] = React.useState<ParsedIntent | null>(null);
  const [matches, setMatches] = React.useState<ScoredProvider[]>([]);
  const [summary, setSummary] = React.useState('');
  const [phase, setPhase] = React.useState<AppPhase>('idle');
  const [selectedProvider, setSelectedProvider] = React.useState<ScoredProvider | null>(null);
  const [escrowTxId, setEscrowTxId] = React.useState<string | null>(null);
  const [nftMetadata, setNftMetadata] = React.useState<SkillNftMetadata | null>(null);
  const [intentHistory, setIntentHistory] = React.useState<IntentHistoryItem[]>([]);

  const handleIntentSubmit = React.useCallback((utterance: string) => {
    const parsed = parseIntent(utterance);
    const { scored, summary: s } = scoreProviders(parsed);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setIntentHistory((prev) => [
      {
        utterance,
        parsed,
        summary: s,
        at: timestamp
      },
      ...prev
    ]);

    setIntent(parsed);
    setMatches(scored.slice(0, 3));
    setSummary(s);
    setPhase('matched');
    setSelectedProvider(null);
    setEscrowTxId(null);
    setNftMetadata(null);
  }, []);

  const handleProviderSelected = (provider: ScoredProvider) => {
    setSelectedProvider(provider);
  };

  const handleEscrowLocked = (txId: string) => {
    setEscrowTxId(txId);
    setPhase('escrowLocked');
    setSelectedProvider(null);
  };

  const handleCompleteService = () => {
    if (!escrowTxId || !intent || !intent.skill) return;

    // For the demo, we simply mint with a fixed 5★ rating.
    const provider = matches[0];
    const metadata = buildSkillNftMetadata({
      provider,
      skill: intent.skill,
      rating: 5,
      txId: escrowTxId,
      when: new Date()
    });

    setNftMetadata(metadata);
    setPhase('completed');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <h1>SkillForge</h1>
          <p>Voice-driven skill matching and on-chain-ish session attestations for Cardano.</p>
        </div>
        <div className="app-badge">
          <span className="chip-dot" />
          Cardano Hackathon Demo
        </div>
      </header>

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

          <div className="mt-3 stack-tight">
            <span className="field-label">Parsed intent</span>
            <div className="status-strip">
              <span
                className={
                  phase === 'idle'
                    ? 'status-dot-muted'
                    : phase === 'matched'
                    ? 'status-dot'
                    : 'status-dot-warn'
                }
              />
              <span className="text-xs text-subtle">
                {intent
                  ? summary
                  : 'Waiting for your first request. Try “I need a Cardano smart contract mentor for 1 hour, under 80 ADA.”'}
              </span>
            </div>
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
            <div className="stack-tight">
              <span className="field-label">Escrow status</span>
              <div className="status-strip">
                <span
                  className={
                    phase === 'escrowLocked' || phase === 'completed'
                      ? 'status-dot'
                      : 'status-dot-muted'
                  }
                />
                <span className="text-xs text-subtle">
                  {phase === 'idle' && 'Waiting for you to choose a mentor from the matches.'}
                  {phase === 'matched' &&
                    'Pick a provider from the list to simulate locking funds in escrow.'}
                  {phase === 'escrowLocked' &&
                    `Escrow locked with fake TX hash ${escrowTxId?.slice(0, 8)}…`}
                  {phase === 'completed' &&
                    `Session completed and NFT metadata prepared for minting.`}
                </span>
              </div>
            </div>

            <div className="flex-between">
              <span className="small-muted">
                This demo keeps everything in-memory; no wallet or network calls are required.
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCompleteService}
                disabled={!escrowTxId || phase === 'completed'}
              >
                Complete service &amp; mint NFT
              </button>
            </div>

            <NFTCard metadata={nftMetadata} />
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
          <span className="pill">Sample dataset • In-memory scoring</span>
        </div>
        <ProviderList
          providers={matches}
          onSelect={handleProviderSelected}
          parsedSummary={summary}
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
        {intentHistory.length === 0 ? (
          <div className="small-muted">
            No history yet. Your last few intents will appear here once you start experimenting.
          </div>
        ) : (
          <div className="history-list">
            {intentHistory.map((item, idx) => (
              <div key={idx} className="history-row">
                <div className="history-main">
                  <div className="history-intent">{item.utterance}</div>
                  <div className="history-meta">
                    <span className="badge badge-blue mono">{item.summary}</span>
                  </div>
                </div>
                <div className="history-time text-xs text-subtle">{item.at}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <EscrowModal
        provider={selectedProvider}
        isOpen={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
        onEscrowLocked={handleEscrowLocked}
      />
    </div>
  );
};

export default App;


