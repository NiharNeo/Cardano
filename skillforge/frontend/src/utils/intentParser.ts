export interface ParsedIntent {
  rawText: string;
  skill: string | null;
  priceMax: number | null;
  durationMinutes: number | null;
}

const SKILL_KEYWORDS: string[] = [
  'solidity',
  'plutus',
  'haskell',
  'typescript',
  'react',
  'smart contract',
  'cardano',
  'nft',
  'defi',
  'rust',
  'wallet',
  'dapp',
  'ux',
  'ui',
  'design'
];

/**
 * Lightweight rule-based intent parser.
 * Extracts:
 * - skill (best-effort match against known keywords)
 * - priceMax (numeric; assumes ADA unless otherwise specified)
 * - durationMinutes (supports "minutes", "hours", "mins", "min", "hr", "h")
 */
export function parseIntent(input: string): ParsedIntent {
  const text = input.trim();
  const lower = text.toLowerCase();

  let skill: string | null = null;
  let priceMax: number | null = null;
  let durationMinutes: number | null = null;

  // Skill extraction
  const matchedSkills = SKILL_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedSkills.length > 0) {
    // Prefer more specific phrases (longer keyword wins)
    matchedSkills.sort((a, b) => b.length - a.length);
    skill = matchedSkills[0];
  } else {
    // Fallback heuristic: search for "learn X", "mentor for X", "help with X"
    const skillPatterns: RegExp[] = [
      /learn(?:ing)?\s+([a-zA-Z#\+\s]+)/i,
      /mentor\s+(?:for|in)\s+([a-zA-Z#\+\s]+)/i,
      /help\s+with\s+([a-zA-Z#\+\s]+)/i,
      /build\s+a?\s*([a-zA-Z#\+\s]+)\s+dapp/i
    ];
    for (const pattern of skillPatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        skill = match[1].trim().toLowerCase();
        break;
      }
    }
  }

  // Price extraction
  // Examples: "under 50 ada", "max 30", "budget 100", "up to 80"
  const pricePatterns: RegExp[] = [
    /(?:under|below|max|maximum|up to|budget)\s+(\d+(\.\d+)?)/i,
    /(\d+(\.\d+)?)\s*(?:ada|₳)/i
  ];
  for (const pattern of pricePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        priceMax = value;
        break;
      }
    }
  }

  // Duration extraction
  // Examples: "for 1 hour", "for 30 minutes", "90 min", "2h"
  const durationPatterns: RegExp[] = [
    /(\d+)\s*(hours?|hrs?|h)\b/i,
    /(\d+)\s*(minutes?|mins?|m)\b/i
  ];
  for (const pattern of durationPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        if (/hours?|hrs?|h/i.test(match[0])) {
          durationMinutes = value * 60;
        } else {
          durationMinutes = value;
        }
        break;
      }
    }
  }

  return {
    rawText: text,
    skill,
    priceMax,
    durationMinutes
  };
}


