import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { MatchRequest, MatchResponse, Provider } from '../types';

const router = Router();

// POST /match - Match providers based on criteria
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('POST /match - Request received');
    const { skill, duration, budget, urgency, stakeKey }: MatchRequest & { stakeKey?: string } = req.body;
    console.log('Match request params:', { skill, duration, budget, urgency, stakeKey });
    
    // Store stake key if provided (for user tracking)
    if (stakeKey) {
      console.log('Stake key provided:', stakeKey);
    }

    // Build query
    let query = `
      SELECT 
        id, name, skills, cost_per_hour, rating, availability, timezone
      FROM providers
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by skill if provided
    if (skill) {
      query += ` AND $${paramIndex} = ANY(skills)`;
      params.push(skill.toLowerCase());
      paramIndex++;
    }

    // Filter by budget if provided
    if (budget) {
      query += ` AND cost_per_hour <= $${paramIndex}`;
      params.push(budget);
      paramIndex++;
    }

    query += ` ORDER BY rating DESC NULLS LAST, cost_per_hour ASC NULLS LAST`;

    console.log('Executing query:', query);
    console.log('Query params:', params);
    const result = await pool.query(query, params);
    const providers: Provider[] = result.rows;
    console.log(`Found ${providers.length} providers`);

    // Score providers
    const scoredProviders = providers.map((p) => {
      let score = 0;
      const reasons: string[] = [];

      // Skill match
      if (skill && p.skills) {
        const lowerSkill = skill.toLowerCase();
        const matches = p.skills.filter(
          (s) => s && (lowerSkill.includes(s.toLowerCase()) || s.toLowerCase().includes(lowerSkill))
        );
        if (matches.length > 0) {
          score += 45;
          reasons.push(`Skill match: ${matches.join(', ')}`);
        }
      }

      // Budget fit
      if (budget && p.cost_per_hour) {
        if (p.cost_per_hour <= budget) {
          const budgetHeadroom = budget - p.cost_per_hour;
          const budgetScore = Math.max(0, Math.min(25, 25 - budgetHeadroom * 0.3));
          score += 25 + budgetScore * 0.4;
          reasons.push(`Within budget (${p.cost_per_hour} ₳ ≤ ${budget} ₳)`);
        } else {
          score -= 10;
          reasons.push(`Above budget (${p.cost_per_hour} ₳ > ${budget} ₳)`);
        }
      }

      // Rating
      if (p.rating) {
        const ratingNum = typeof p.rating === 'string' ? parseFloat(p.rating) : p.rating;
        if (!isNaN(ratingNum)) {
          const ratingScore = (ratingNum / 5) * 20;
          score += ratingScore;
          reasons.push(`Strong rating (${ratingNum.toFixed(1)}★)`);
        }
      }

      // Availability
      if (p.availability) {
        if (p.availability.includes('today')) {
          score += 8;
          reasons.push('Available today');
        } else if (p.availability.includes('this week')) {
          score += 4;
          reasons.push('Available this week');
        }

        // Urgency boost
        if (urgency === 'high' && p.availability.includes('today')) {
          score += 5;
          reasons.push('Urgent request - available today');
        }
      }

      return {
        ...p,
        score: Math.max(0, Math.min(100, score)),
        reasons
      };
    });

    // Sort by score
    scoredProviders.sort((a, b) => (b as any).score - (a as any).score);

    // Build summary
    const summaryParts: string[] = [];
    if (skill) summaryParts.push(`skill ≈ "${skill}"`);
    if (budget) summaryParts.push(`budget ≤ ${budget} ₳`);
    if (duration) summaryParts.push(`duration ≈ ${duration} min`);
    if (urgency) summaryParts.push(`urgency: ${urgency}`);

    const response: MatchResponse = {
      providers: scoredProviders,
      summary: `Parsed intent → ${summaryParts.join(' • ')}`
    };

    console.log(`Returning ${scoredProviders.length} scored providers`);
    return res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error in /match:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to match providers', 
      message: error.message 
    });
  }
});

export default router;

