CREATE TABLE nft_metadata (
  session_id uuid PRIMARY KEY REFERENCES sessions(id),
  ipfs_hash text,
  image_cid text,
  metadata_json jsonb,
  minted boolean DEFAULT false,
  minted_at timestamp
);

-- Create index on ipfs_hash
CREATE INDEX IF NOT EXISTS idx_nft_metadata_ipfs_hash ON nft_metadata(ipfs_hash);

-- Create index on image_cid
CREATE INDEX IF NOT EXISTS idx_nft_metadata_image_cid ON nft_metadata(image_cid);

-- Create index on minted
CREATE INDEX IF NOT EXISTS idx_nft_metadata_minted ON nft_metadata(minted);
