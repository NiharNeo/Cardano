import React from 'react';
import type { Provider } from './ProviderList';

export interface SkillNftMetadata {
  name: string;
  description: string;
  image?: string;
  provider: string;
  skill: string;
  rating: number;
  sessionDate: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
}

interface NFTCardProps {
  metadata: SkillNftMetadata | null;
  cid?: string | null;
}

export const buildSkillNftMetadata = (params: {
  provider: Provider;
  skill: string;
  rating: number;
  txId: string;
  when: Date;
}): SkillNftMetadata => {
  const isoDate = params.when.toISOString();
  const name = `SkillForge Session – ${params.skill} with ${params.provider.name}`;

  return {
    name,
    description:
      'Proof-of-session NFT minted by SkillForge to attest a mentoring or build session on Cardano.',
    provider: params.provider.name,
    skill: params.skill,
    rating: params.rating,
    sessionDate: isoDate,
    // This would be replaced by an IPFS image URL in a real dapp
    image: 'ipfs://<image-cid-placeholder>',
    attributes: [
      { trait_type: 'provider', value: params.provider.name },
      { trait_type: 'skill', value: params.skill },
      { trait_type: 'rating', value: params.rating },
      { trait_type: 'session_date', value: isoDate },
      { trait_type: 'escrow_tx', value: params.txId },
      { trait_type: 'hourly_rate_ada', value: params.provider.hourlyRateAda }
    ]
  };
};

export const NFTCard: React.FC<NFTCardProps> = ({ metadata, cid }) => {
  if (!metadata) {
    return (
      <div className="section-spacing">
        <p className="small-muted">
          After you complete a session, SkillForge will materialize it as an IPFS-ready NFT
          metadata object here.
        </p>
      </div>
    );
  }

  const prettyJson = JSON.stringify(
    {
      // Example of an IPFS-ready NFT metadata object
      '721': {
        policy_id_placeholder: {
          [metadata.name]: metadata
        }
      }
    },
    null,
    2
  );

  return (
    <div className="nft-shell">
      <div className="nft-header-row">
        <div className="stack-tight">
          <span className="nft-title">Session NFT metadata</span>
          <span className="small-muted">
            Ready to pin to IPFS or to mint via a Cardano transaction builder.
          </span>
        </div>
        <div className="nft-meta-row">
          <span className="badge badge-green">Complete</span>
          {cid && <span className="badge badge-blue">IPFS CID: {cid}</span>}
        </div>
      </div>
      <div className="tag-row">
        <span className="pill-minimal">Provider: {metadata.provider}</span>
        <span className="pill-minimal">Skill: {metadata.skill}</span>
        <span className="pill-minimal">Rating: {metadata.rating.toFixed(1)} ★</span>
        <span className="pill-minimal">Date: {new Date(metadata.sessionDate).toLocaleString()}</span>
      </div>
      <div className="nft-json mono overflow-auto">
        <pre style={{ margin: 0 }}>{prettyJson}</pre>
      </div>
      <div className="text-right text-xs text-subtle">
        In a real dapp you would POST this to your backend, pin it to IPFS, and reference the CID
        in a mint transaction.
      </div>
    </div>
  );
};

export default NFTCard;


