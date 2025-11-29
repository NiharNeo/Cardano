import React from 'react';
import type { ParsedIntent } from '../utils/intentParser';

interface RequestHistoryItem {
  utterance: string;
  parsed: ParsedIntent;
  summary: string;
  at: string;
}

interface RequestHistoryProps {
  history: RequestHistoryItem[];
  maxItems?: number;
}

export const RequestHistory: React.FC<RequestHistoryProps> = ({ history, maxItems = 5 }) => {
  const displayHistory = history.slice(0, maxItems);

  if (displayHistory.length === 0) {
    return (
      <div className="section-spacing">
        <p className="small-muted">
          No history yet. Your last few intents will appear here once you start experimenting.
        </p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {displayHistory.map((item, idx) => (
        <div key={idx} className="history-row animate-fade-in">
          <div className="history-main">
            <div className="history-intent">{item.utterance}</div>
            <div className="history-meta">
              <span className="badge badge-blue mono">{item.summary}</span>
              {item.parsed.urgency && (
                <span className={`badge urgency-badge urgency-${item.parsed.urgency}`}>
                  {item.parsed.urgency}
                </span>
              )}
            </div>
          </div>
          <div className="history-time text-xs text-subtle">{item.at}</div>
        </div>
      ))}
    </div>
  );
};

export default RequestHistory;

