import React from 'react';
import type { SkillNftMetadata } from './NFTCard';

interface NFTMetadataViewerProps {
  metadata: SkillNftMetadata | null;
  cid: string | null;
  imageCid?: string | null;
  isLoading?: boolean;
}

export const NFTMetadataViewer: React.FC<NFTMetadataViewerProps> = ({
  metadata,
  cid,
  imageCid,
  isLoading
}) => {
  const handleDownload = () => {
    if (!metadata) return;

    const nftMetadata = {
      '721': {
        policy_id_placeholder: {
          [metadata.name]: metadata
        }
      },
      cid: cid || 'ipfs://<cid-placeholder>',
      imageCid: imageCid || null
    };

    const blob = new Blob([JSON.stringify(nftMetadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skillforge-nft-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="nft-shell">
        <div className="loading-spinner" />
        <span className="text-xs text-subtle">Generating NFT metadata and uploading to IPFS...</span>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="section-spacing">
        <p className="small-muted">
          After you complete a session and both parties attest, you can mint an IPFS-ready NFT
          metadata object here.
        </p>
      </div>
    );
  }

  const imageUrl = imageCid ? `https://gateway.pinata.cloud/ipfs/${imageCid}` : null;
  const metadataUrl = cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : null;

  const prettyJson = JSON.stringify(
    {
      '721': {
        policy_id_placeholder: {
          [metadata.name]: metadata
        }
      },
      cid: cid || 'ipfs://<cid-placeholder>',
      imageCid: imageCid || null
    },
    null,
    2
  );

  return (
    <div className="nft-shell">
      <div className="nft-header-row">
        <div className="stack-tight">
          <span className="nft-title">Session NFT</span>
          <span className="small-muted">
            NFT minted and stored on IPFS. Metadata and image are permanently stored.
          </span>
        </div>
        <div className="nft-meta-row">
          <span className="badge badge-green">Minted</span>
          {cid && <span className="badge badge-blue">Metadata: {cid.slice(0, 12)}...</span>}
          {imageCid && <span className="badge badge-purple">Image: {imageCid.slice(0, 12)}...</span>}
        </div>
      </div>

      {imageUrl && (
        <div className="nft-image-container">
          <img src={imageUrl} alt="Session NFT" className="nft-image" />
          <div className="text-xs text-subtle mt-2">
            Image stored on IPFS: <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="link">{imageCid}</a>
          </div>
        </div>
      )}

      <div className="tag-row">
        <span className="pill-minimal">Provider: {metadata.provider}</span>
        <span className="pill-minimal">Skill: {metadata.skill}</span>
        <span className="pill-minimal">Rating: {metadata.rating.toFixed(1)} ★</span>
        <span className="pill-minimal">Date: {new Date(metadata.sessionDate).toLocaleString()}</span>
      </div>

      {metadataUrl && (
        <div className="nft-links">
          <a href={metadataUrl} target="_blank" rel="noopener noreferrer" className="link text-xs">
            View metadata on IPFS →
          </a>
        </div>
      )}

      <div className="nft-json mono overflow-auto">
        <pre style={{ margin: 0 }}>{prettyJson}</pre>
      </div>

      <div className="flex-between mt-3">
        <span className="text-xs text-subtle">
          NFT metadata and image are permanently stored on IPFS via Pinata.
        </span>
        <button className="btn btn-primary" onClick={handleDownload}>
          Download JSON
        </button>
      </div>
    </div>
  );
};

export default NFTMetadataViewer;
