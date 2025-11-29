import React from 'react';

export interface Provider {
  id: string;
  name: string;
  skills: string[];
  hourlyRateAda: number;
  rating: number;
  completedGigs: number;
  availability: string[];
  timezones: string[];
  bio: string;
}

export interface ScoredProvider extends Provider {
  score: number;
  reasons: string[];
}

interface ProviderListProps {
  providers: ScoredProvider[];
  onSelect: (provider: ScoredProvider) => void;
  parsedSummary: string;
}

export const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  onSelect,
  parsedSummary
}) => {
  if (!providers.length) {
    return (
      <div className="section-spacing">
        <p className="small-muted">
          No matches yet. Describe what you need on the left and SkillForge will rank providers for
          you.
        </p>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      <div className="stack-tight">
        <span className="field-label">Top matches</span>
        <span className="small-muted">{parsedSummary}</span>
      </div>
      <div className="providers-grid">
        {providers.map((p) => (
          <article key={p.id} className="provider-card">
            <div className="provider-header">
              <div className="stack-tight">
                <span className="provider-name">{p.name}</span>
                <div className="provider-meta">
                  <span className="badge-rating">
                    ★ {p.rating.toFixed(1)} · {p.completedGigs} sessions
                  </span>
                  <span className="badge-price">{p.hourlyRateAda} ₳ / hour</span>
                  <span className="badge-availability">
                    {p.availability.join(' • ')} · {p.timezones.join(', ')}
                  </span>
                </div>
              </div>
              <div className="stack-tight" style={{ alignItems: 'flex-end' }}>
                <span className="score-badge">Match {Math.round(p.score)}%</span>
                <button className="btn btn-primary" onClick={() => onSelect(p)}>
                  Start escrow
                </button>
              </div>
            </div>
            <div className="divider" />
            <div className="pill-row">
              {p.skills.map((skill) => (
                <span key={skill} className="pill-soft">
                  {skill}
                </span>
              ))}
            </div>
            <p className="small-muted mt-2">{p.bio}</p>
            {p.reasons.length > 0 && (
              <div className="mt-2">
                <span className="small-muted">Why this match:</span>
                <div className="pill-row mt-1">
                  {p.reasons.map((reason, idx) => (
                    <span key={idx} className="chip chip-muted">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};

export default ProviderList;


