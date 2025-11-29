import type { Provider } from '../components/ProviderList';
import type { SkillNftMetadata } from '../components/NFTCard';

/**
 * Generate a fake IPFS CID (random hash)
 */
export function generateFakeCID(): string {
  const chars = 'abcdef0123456789';
  let cid = 'Qm';
  for (let i = 0; i < 42; i++) {
    cid += chars[Math.floor(Math.random() * chars.length)];
  }
  return cid;
}

/**
 * Generate NFT metadata for a completed session
 */
export function generateNFTMetadata(params: {
  provider: Provider;
  skill: string;
  rating: number;
  txId: string;
  when: Date;
  durationMinutes?: number | null;
  budget?: number | null;
  urgency?: string | null;
}): { metadata: SkillNftMetadata; cid: string } {
  const isoDate = params.when.toISOString();
  const name = `SkillForge Session – ${params.skill} with ${params.provider.name}`;

  const attributes: Array<{ trait_type: string; value: string | number }> = [
    { trait_type: 'provider', value: params.provider.name },
    { trait_type: 'skill', value: params.skill },
    { trait_type: 'rating', value: params.rating },
    { trait_type: 'session_date', value: isoDate },
    { trait_type: 'escrow_tx', value: params.txId },
    { trait_type: 'hourly_rate_ada', value: params.provider.hourlyRateAda }
  ];

  if (params.durationMinutes) {
    attributes.push({ trait_type: 'duration_minutes', value: params.durationMinutes });
  }

  if (params.budget) {
    attributes.push({ trait_type: 'budget_ada', value: params.budget });
  }

  if (params.urgency) {
    attributes.push({ trait_type: 'urgency', value: params.urgency });
  }

  const metadata: SkillNftMetadata = {
    name,
    description:
      'Proof-of-session NFT minted by SkillForge to attest a mentoring or build session on Cardano.',
    provider: params.provider.name,
    skill: params.skill,
    rating: params.rating,
    sessionDate: isoDate,
    image: 'ipfs://<image-cid-placeholder>',
    attributes
  };

  const cid = generateFakeCID();

  return { metadata, cid };
}

