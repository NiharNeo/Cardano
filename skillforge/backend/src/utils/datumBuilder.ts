/**
 * Helper functions to build datum and redeemer JSON for Aiken contracts
 */

export interface EscrowDatum {
  learner: string; // ByteArray (hex-encoded public key hash)
  mentor: string;  // ByteArray (hex-encoded public key hash)
  price: number;   // Int (Lovelace)
  session: string; // ByteArray (hex-encoded session ID)
  learner_attested: boolean;
  mentor_attested: boolean;
}

export interface EscrowRedeemer {
  AttestByLearner?: {};
  AttestByMentor?: {};
  ClaimFunds?: {};
  Refund?: {};
}

/**
 * Convert public key hash to hex string
 */
export function pubKeyHashToHex(pubKeyHash: string): string {
  // If already hex, return as-is
  if (/^[0-9a-fA-F]+$/.test(pubKeyHash) && pubKeyHash.length % 2 === 0) {
    return pubKeyHash;
  }
  // Otherwise, assume it's a bech32 address and extract hash
  // For now, return as-is (should be handled by cardano-serialization-lib)
  return pubKeyHash;
}

/**
 * Convert session ID to hex string
 */
export function sessionIdToHex(sessionId: string): string {
  // UUID to hex: remove dashes and convert
  const uuidHex = sessionId.replace(/-/g, '');
  return uuidHex;
}

/**
 * Build escrow datum JSON
 */
export function buildEscrowDatum(params: {
  learnerPubKeyHash: string;
  mentorPubKeyHash: string;
  priceLovelace: number;
  sessionId: string;
}): EscrowDatum {
  return {
    learner: pubKeyHashToHex(params.learnerPubKeyHash),
    mentor: pubKeyHashToHex(params.mentorPubKeyHash),
    price: params.priceLovelace,
    session: sessionIdToHex(params.sessionId),
    learner_attested: false,
    mentor_attested: false
  };
}

/**
 * Build escrow redeemer JSON
 */
export function buildEscrowRedeemer(action: 'AttestByLearner' | 'AttestByMentor' | 'ClaimFunds' | 'Refund'): EscrowRedeemer {
  return { [action]: {} };
}

/**
 * Build NFT mint redeemer JSON
 */
export function buildNFTMintRedeemer(sessionId: string): { Mint: { session: string } } {
  return {
    Mint: {
      session: sessionIdToHex(sessionId)
    }
  };
}

