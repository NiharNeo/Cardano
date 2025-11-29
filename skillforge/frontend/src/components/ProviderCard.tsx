import React from 'react';
import type { ScoredProvider } from './ProviderList';

interface ProviderCardProps {
  provider: ScoredProvider;
  onSelect: (provider: ScoredProvider) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onSelect, isLoading, disabled = false }) => {
  // Safe guards for undefined/null values
  if (!provider) {
    return (
      <article className="provider-card">
        <div className="provider-header">
          <span className="provider-name">Invalid Provider</span>
        </div>
      </article>
    );
  }

  const reasons = provider.reasons || [];
  const skills = provider.skills || [];
  const availability = provider.availability || [];
  const timezones = provider.timezones || [];
  const rating = typeof provider.rating === 'number' ? provider.rating : 0;
  const score = typeof provider.score === 'number' ? provider.score : 0;
  const completedGigs = provider.completedGigs || 0;
  const hourlyRateAda = typeof provider.hourlyRateAda === 'number' ? provider.hourlyRateAda : 0;

  const skillMatchPercentage = reasons
    .filter((r) => r && r.includes('Skill match'))
    .length > 0
    ? Math.min(100, Math.round(score * 0.5))
    : 0;

  return (
    <article className={`provider-card ${isLoading ? 'loading' : ''}`}>
      <div className="provider-header">
        <div className="stack-tight">
          <span className="provider-name">{provider.name || 'Unknown Provider'}</span>
          <div className="provider-meta">
            <span className="badge-rating">
              ★ {rating.toFixed(1)} · {completedGigs} sessions
            </span>
            <span className="badge-price">{hourlyRateAda} ₳ / hour</span>
            {availability.length > 0 && timezones.length > 0 && (
              <span className="badge-availability">
                {availability.join(' • ')} · {timezones.join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="stack-tight" style={{ alignItems: 'flex-end' }}>
          <span className="score-badge">Match {Math.round(score)}%</span>
          {skillMatchPercentage > 0 && (
            <span className="skill-match-badge">Skill: {skillMatchPercentage}%</span>
          )}
          <button
            className="btn btn-primary"
            onClick={() => onSelect(provider)}
            disabled={isLoading || disabled}
          >
            Select Mentor
          </button>
        </div>
      </div>
      <div className="divider" />
      {skills.length > 0 && (
        <div className="pill-row">
          {skills.map((skill, idx) => (
            <span key={idx} className="pill-soft">
              {skill || 'Unknown'}
            </span>
          ))}
        </div>
      )}
      {provider.bio && <p className="small-muted mt-2">{provider.bio}</p>}
      {reasons.length > 0 && (
        <div className="mt-2">
          <span className="small-muted">Why this match:</span>
          <div className="pill-row mt-1">
            {reasons.map((reason, idx) => (
              <span key={idx} className="chip chip-muted">
                {reason || 'Match reason'}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default ProviderCard;

