import React from 'react';
import type { ParsedIntent } from '../utils/intentParser';

interface ParsedIntentCardProps {
  intent: ParsedIntent | null;
  isLoading?: boolean;
}

export const ParsedIntentCard: React.FC<ParsedIntentCardProps> = ({ intent, isLoading }) => {
  if (isLoading) {
    return (
      <div className="parsed-intent-card loading">
        <div className="loading-spinner" />
        <span className="text-xs text-subtle">Parsing intent...</span>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="parsed-intent-card empty">
        <span className="text-xs text-subtle">
          Waiting for your first request. Try "I need a Cardano smart contract mentor for 1 hour, under 80 ADA."
        </span>
      </div>
    );
  }

  const hasData = intent.skill || intent.priceMax != null || intent.durationMinutes != null || intent.urgency;

  if (!hasData) {
    return (
      <div className="parsed-intent-card empty">
        <span className="text-xs text-subtle">
          Could not parse intent from your input. Please try being more specific about skill, budget, or duration.
        </span>
      </div>
    );
  }

  return (
    <div className="parsed-intent-card">
      <div className="parsed-intent-header">
        <span className="field-label">Parsed Intent</span>
        <span className="badge badge-green">Parsed</span>
      </div>
      <div className="parsed-intent-fields">
        {intent.skill && (
          <div className="parsed-field">
            <span className="parsed-label">Skill:</span>
            <span className="parsed-value">{intent.skill}</span>
          </div>
        )}
        {intent.priceMax != null && (
          <div className="parsed-field">
            <span className="parsed-label">Budget:</span>
            <span className="parsed-value">{intent.priceMax} ₳</span>
          </div>
        )}
        {intent.durationMinutes != null && (
          <div className="parsed-field">
            <span className="parsed-label">Duration:</span>
            <span className="parsed-value">
              {intent.durationMinutes >= 60
                ? `${Math.round(intent.durationMinutes / 60)} hour${Math.round(intent.durationMinutes / 60) > 1 ? 's' : ''}`
                : `${intent.durationMinutes} minute${intent.durationMinutes > 1 ? 's' : ''}`}
            </span>
          </div>
        )}
        {intent.urgency && (
          <div className="parsed-field">
            <span className="parsed-label">Urgency:</span>
            <span className={`parsed-value urgency-${intent.urgency}`}>
              {intent.urgency.charAt(0).toUpperCase() + intent.urgency.slice(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParsedIntentCard;

