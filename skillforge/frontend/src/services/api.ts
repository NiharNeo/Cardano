const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface MatchRequest {
  skill?: string;
  duration?: number;
  budget?: number;
  urgency?: 'low' | 'medium' | 'high';
}

export interface ProviderResponse {
  id: string;
  name: string | null;
  skills: string[] | null;
  rating: number | null;
  cost_per_hour: number | null;
  availability: string[] | null;
  timezone: string | null;
  score?: number;
  reasons?: string[];
}

export interface MatchResponse {
  providers: ProviderResponse[];
  summary: string;
}

export interface CreateSessionRequest {
  learnerAddress: string;
  providerId: string;
  skill: string;
  budget?: number;
  duration?: number;
  urgency?: 'low' | 'medium' | 'high';
  stakeKey?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface EscrowInitRequest {
  learnerAddress: string;
  providerAddress: string;
  price: number;
  sessionId: string;
  stakeKey?: string;
}

export interface EscrowInitResponse {
  txBody: string; // CBOR hex
  escrowAddress: string;
  escrowId: string;
}

export interface EscrowStatusRequest {
  sessionId: string;
}

export interface EscrowStatusResponse {
  status: 'locked' | 'in_session' | 'completed' | 'paid_out';
  txId?: string;
  lockedAt?: string;
  completedAt?: string;
}

export interface AttestRequest {
  sessionId: string;
  wallet: string;
  stakeKey?: string;
}

export interface AttestResponse {
  success: boolean;
  bothAttested: boolean;
  message: string;
}

export interface NFTMintRequest {
  sessionId: string;
  eventCardImage?: File;
  stakeKey?: string;
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

export interface ContractInfo {
  contracts: string;
  version: string;
  escrowValidatorHash: string | null;
  nftPolicyId: string | null;
}

/**
 * Get Aiken contract information
 */
export async function getContractInfo(): Promise<ContractInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/contracts/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get contract info: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error: any) {
    console.error('[API] getContractInfo error:', error);
    throw error;
  }
}

/**
 * Call backend /match endpoint for provider scoring
 */
export async function matchProviders(request: MatchRequest & { stakeKey?: string }): Promise<MatchResponse> {
  console.log('[API] matchProviders request:', request);
  
  try {
    const response = await fetch(`${API_BASE_URL}/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    console.log('[API] matchProviders response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      const errorMessage = errorData.error || errorData.message || `Match request failed: ${response.statusText}`;
      console.error('[API] matchProviders error:', errorMessage);
      throw new Error(errorMessage);
    }

    let json;
    try {
      json = await response.json();
      console.log('[API] matchProviders response data:', json);
    } catch (parseError) {
      console.error('[API] matchProviders JSON parse error:', parseError);
      throw new Error('Invalid JSON response from backend');
    }

    // Ensure we always return a valid MatchResponse
    const result = json.data || json;
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from backend');
    }

    // Ensure providers is an array
    if (!Array.isArray(result.providers)) {
      console.warn('[API] matchProviders: providers is not an array, defaulting to empty array');
      result.providers = [];
    }

    // Ensure summary is a string
    if (typeof result.summary !== 'string') {
      result.summary = result.summary || 'No summary available';
    }

    return result as MatchResponse;
  } catch (error: any) {
    console.error('[API] matchProviders exception:', error);
    throw error;
  }
}

/**
 * Create a new session
 */
export async function createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
  console.log('[API] createSession request:', request);
  
  try {
    const response = await fetch(`${API_BASE_URL}/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      throw new Error(errorData.error || errorData.message || `Session creation failed: ${response.statusText}`);
    }

    let json;
    try {
      json = await response.json();
    } catch (parseError) {
      throw new Error('Invalid JSON response from backend');
    }

    const result = json.data || json;
    if (!result || !result.sessionId) {
      throw new Error('Invalid response format: missing sessionId');
    }

    return result;
  } catch (error: any) {
    console.error('[API] createSession error:', error);
    throw error;
  }
}

/**
 * Call backend /escrow/init to begin locking funds
 */
export async function initEscrow(request: EscrowInitRequest): Promise<EscrowInitResponse> {
  console.log('[API] initEscrow request:', request);
  
  try {
    const response = await fetch(`${API_BASE_URL}/escrow/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      throw new Error(errorData.error || errorData.message || `Escrow init failed: ${response.statusText}`);
    }

    let json;
    try {
      json = await response.json();
    } catch (parseError) {
      throw new Error('Invalid JSON response from backend');
    }

    const result = json.data || json;
    if (!result || !result.txBody) {
      throw new Error('Invalid response format: missing txBody');
    }

    return result;
  } catch (error: any) {
    console.error('[API] initEscrow error:', error);
    throw error;
  }
}

/**
 * Poll backend for escrow status (UTXO watcher)
 */
export async function getEscrowStatus(request: EscrowStatusRequest): Promise<EscrowStatusResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/escrow/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || error.message || `Escrow status check failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result; // Handle both { success: true, data: ... } and direct response
  } catch (error: any) {
    console.error('Error getting escrow status:', error);
    throw error;
  }
}

/**
 * Call backend /session/attest to record attestation
 */
export async function attestSession(request: AttestRequest): Promise<AttestResponse> {
  console.log('[API] attestSession request:', request);
  
  try {
    const response = await fetch(`${API_BASE_URL}/session/attest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      throw new Error(errorData.error || errorData.message || `Attestation failed: ${response.statusText}`);
    }

    let json;
    try {
      json = await response.json();
    } catch (parseError) {
      throw new Error('Invalid JSON response from backend');
    }

    const result = json.data || json;
    return result;
  } catch (error: any) {
    console.error('[API] attestSession error:', error);
    throw error;
  }
}

/**
 * Call backend /nft/mint to mint NFT with actual policy script
 */
export async function mintNFT(request: NFTMintRequest): Promise<NFTMintResponse> {
  console.log('[API] mintNFT request:', { sessionId: request.sessionId, hasImage: !!request.eventCardImage });
  
  try {
    const formData = new FormData();
    formData.append('sessionId', request.sessionId);
    
    if (request.eventCardImage) {
      formData.append('eventCardImage', request.eventCardImage);
    }
    
    if (request.stakeKey) {
      formData.append('stakeKey', request.stakeKey);
    }

    const response = await fetch(`${API_BASE_URL}/nft/mint`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      throw new Error(errorData.error || errorData.message || `NFT mint failed: ${response.statusText}`);
    }

    let json;
    try {
      json = await response.json();
    } catch (parseError) {
      throw new Error('Invalid JSON response from backend');
    }

    const result = json.data || json;
    if (!result || !result.txBody) {
      throw new Error('Invalid response format: missing txBody');
    }

    return result;
  } catch (error: any) {
    console.error('[API] mintNFT error:', error);
    throw error;
  }
}
