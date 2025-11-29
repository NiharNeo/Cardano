import type { Provider, ScoredProvider } from '../components/ProviderList';
import type { ParsedIntent } from './intentParser';

/**
 * Calculate skill match percentage between intent and provider skills
 */
export function calculateSkillMatchPercentage(
  intentSkill: string | null,
  providerSkills: string[]
): number {
  if (!intentSkill) return 0;

  const lowerIntent = intentSkill.toLowerCase();
  const matches = providerSkills.filter(
    (skill) => lowerIntent.includes(skill.toLowerCase()) || skill.toLowerCase().includes(lowerIntent)
  );

  if (matches.length === 0) return 0;

  // Calculate percentage based on number of matching skills
  const baseMatch = (matches.length / providerSkills.length) * 100;
  // Boost if exact match or very close match
  const exactMatch = providerSkills.some((s) => s.toLowerCase() === lowerIntent);
  return exactMatch ? 100 : Math.min(100, baseMatch * 1.5);
}

/**
 * Score providers based on intent matching
 */
export function scoreProviders(
  intent: ParsedIntent,
  providers: Provider[]
): { scored: ScoredProvider[]; summary: string } {
  if (!intent.skill && !intent.priceMax && !intent.durationMinutes) {
    return {
      scored: [],
      summary:
        'SkillForge will use your skill, budget, and duration to find the best mentor or builder.'
    };
  }

  const scored = providers.map<ScoredProvider>((p) => {
    let score = 0;
    const reasons: string[] = [];

    // Skill relevance with percentage
    if (intent.skill) {
      const skillMatchPct = calculateSkillMatchPercentage(intent.skill, p.skills);
      if (skillMatchPct > 0) {
        score += 45 * (skillMatchPct / 100);
        reasons.push(`Skill match: ${skillMatchPct.toFixed(0)}% (${p.skills.filter((s) => intent.skill!.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(intent.skill!.toLowerCase())).join(', ')})`);
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

    // Rating weight
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

    // Urgency boost
    if (intent.urgency === 'high' && p.availability.includes('today')) {
      score += 5;
      reasons.push('Urgent request - available today');
    }

    const boundedScore = Math.max(0, Math.min(100, score));

    return {
      ...p,
      score: boundedScore,
      reasons
    };
  }).sort((a, b) => b.score - a.score);

  const summaryParts: string[] = [];
  if (intent.skill) summaryParts.push(`skill ≈ "${intent.skill}"`);
  if (intent.priceMax != null) summaryParts.push(`budget ≤ ${intent.priceMax} ₳`);
  if (intent.durationMinutes != null)
    summaryParts.push(`duration ≈ ${intent.durationMinutes} min`);
  if (intent.urgency) summaryParts.push(`urgency: ${intent.urgency}`);

  return {
    scored,
    summary: `Parsed intent → ${summaryParts.join(' • ')}`
  };
}

