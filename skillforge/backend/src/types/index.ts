export interface User {
  id: string;
  wallet_address: string | null;
  created_at: Date;
}

export interface Provider {
  id: string;
  name: string | null;
  skills: string[] | null;
  rating: number | null;
  cost_per_hour: number | null;
  availability: string[] | null;
  timezone: string | null;
}

export interface Session {
  id: string;
  learner_id: string;
  provider_id: string;
  skill: string | null;
  budget: number | null;
  duration: number | null;
  status: 'initiated' | 'active' | 'completed' | 'paid';
  created_at: Date;
}

export interface EscrowState {
  session_id: string;
  utxo: string | null;
  status: string | null;
  updated_at: Date;
}

export interface NFTMetadata {
  session_id: string;
  ipfs_hash: string | null;
  image_cid: string | null;
  metadata_json: any | null;
  minted: boolean;
  minted_at: Date | null;
}

export interface MatchRequest {
  skill?: string;
  duration?: number;
  budget?: number;
  urgency?: 'low' | 'medium' | 'high';
}

export interface MatchResponse {
  providers: Provider[];
  summary: string;
}

export interface EscrowInitRequest {
  learnerAddress: string;
  providerAddress: string;
  price: number;
  sessionId: string;
}

export interface EscrowInitResponse {
  txBody: string; // CBOR hex
  escrowAddress: string;
  escrowId: string;
}

export interface EscrowStatusResponse {
  status: 'locked' | 'in_session' | 'completed' | 'paid_out';
  txId?: string;
  lockedAt?: string;
  completedAt?: string;
}

export interface CreateSessionRequest {
  learnerAddress: string;
  providerId: string;
  skill: string;
  budget?: number;
  duration?: number;
  urgency?: 'low' | 'medium' | 'high';
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface AttestRequest {
  sessionId: string;
  wallet: string;
}

export interface AttestResponse {
  success: boolean;
  bothAttested: boolean;
  message: string;
}

export interface NFTMintRequest {
  sessionId: string;
}

export interface NFTMintResponse {
  txBody: string; // CBOR hex
  policyId: string;
  assetName: string;
  ipfsCid: string;
  imageCid?: string;
  metadataUrl: string;
  imageUrl?: string;
}
