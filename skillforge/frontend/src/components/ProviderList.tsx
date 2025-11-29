import React from 'react';
import ProviderCard from './ProviderCard';

export interface Provider {
  id: string;
  name: string;
  skills: string[];
  hourlyRateAda: number;
  rating: number;
  completedGigs?: number;
  availability: string[];
  timezones: string[];
  bio?: string;
}

export interface ScoredProvider extends Provider {
  score: number;
  reasons: string[];
}

interface ProviderListProps {
  providers: ScoredProvider[];
  onSelect: (provider: ScoredProvider) => void;
  parsedSummary: string;
  isLoading?: boolean;
  showPlaceholders?: boolean;
  disabled?: boolean;
}

export const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  onSelect,
  parsedSummary,
  isLoading = false,
  showPlaceholders = false,
  disabled = false
}) => {
  // Safe guards for undefined/null providers
  if (!providers || !Array.isArray(providers)) {
    return (
      <div className="section-spacing">
        <p className="small-muted">
          No matches yet. Describe what you need on the left and SkillForge will rank providers for
          you.
        </p>
      </div>
    );
  }

  if (isLoading && showPlaceholders) {
    return (
      <div className="section-spacing">
        <div className="stack-tight">
          <span className="field-label">Top matches</span>
          <span className="small-muted">Searching for providers...</span>
        </div>
        <div className="providers-grid">
          {[1, 2, 3].map((i) => (
            <article key={i} className="provider-card placeholder">
              <div className="provider-header">
                <div className="stack-tight">
                  <div className="placeholder-line" style={{ width: '60%', height: '20px' }} />
                  <div className="placeholder-line" style={{ width: '80%', height: '16px' }} />
                </div>
              </div>
              <div className="divider" />
              <div className="pill-row">
                <div className="placeholder-line" style={{ width: '40%', height: '24px' }} />
                <div className="placeholder-line" style={{ width: '50%', height: '24px' }} />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="section-spacing">
        <p className="small-muted">
          No matches found. Try adjusting your skill, budget, or duration requirements.
        </p>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      <div className="stack-tight">
        <span className="field-label">Top matches</span>
        <span className="small-muted">{parsedSummary || 'No summary available'}</span>
      </div>
      <div className="providers-grid">
        {providers
          .filter((p) => p && p.id) // Filter out invalid providers
          .map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onSelect={onSelect}
              isLoading={isLoading}
              disabled={disabled}
            />
          ))}
      </div>
    </div>
  );
};

export default ProviderList;


