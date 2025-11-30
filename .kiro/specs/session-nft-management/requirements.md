# Requirements Document

## Introduction

The Session NFT Management System mints unique non-fungible tokens (NFTs) on the Cardano blockchain to commemorate completed mentoring sessions. Each NFT serves as a verifiable proof of completion, containing metadata about the session including skill, duration, participants, and timestamps. The system integrates with IPFS for decentralized metadata storage and uses Plutus minting policies to ensure exactly one NFT is created per session.

## Glossary

- **Session NFT**: A unique non-fungible token representing a completed mentoring session
- **Minting Policy**: A Plutus script that controls when and how tokens can be created
- **Policy ID**: The unique identifier for a minting policy, derived from the script hash
- **Asset Name**: The human-readable name of the NFT token
- **IPFS**: InterPlanetary File System, a decentralized storage network for NFT metadata
- **CID**: Content Identifier, a unique hash-based address for content on IPFS
- **Metadata JSON**: Structured data describing the NFT including name, image, attributes, and session details
- **NFT Redeemer**: Input data for the minting policy that includes the session identifier
- **Multi-Asset**: Cardano's native token standard supporting multiple token types in a single UTXO
- **Session Identifier**: A UUID uniquely identifying a mentoring session
- **Learner**: The recipient of the session NFT who completed the mentoring
- **Provider**: The mentor who delivered the session

## Requirements

### Requirement 1

**User Story:** As a learner, I want to mint an NFT after completing a session, so that I have a permanent on-chain record of my achievement.

#### Acceptance Criteria

1. WHEN a learner requests NFT minting THEN the system SHALL verify the session exists and is in 'completed' or 'paid' status
2. WHEN minting an NFT THEN the system SHALL create a transaction that mints exactly one token with quantity 1
3. WHEN building the mint transaction THEN the system SHALL include the session identifier in the redeemer as a ByteArray
4. WHEN the NFT is minted THEN the system SHALL send the token to the learner's address
5. WHEN the mint transaction is submitted THEN the system SHALL update the nft_metadata table with minted status and timestamp

### Requirement 2

**User Story:** As a system, I want to enforce that only one NFT can be minted per session, so that each session has a unique commemorative token.

#### Acceptance Criteria

1. WHEN the minting policy validates a transaction THEN the validator SHALL verify exactly one asset is minted for the policy ID
2. WHEN the minting policy validates a transaction THEN the validator SHALL verify the minted quantity equals 1
3. WHEN multiple assets are attempted to be minted THEN the validator SHALL reject the transaction
4. WHEN a quantity other than 1 is attempted THEN the validator SHALL reject the transaction
5. WHEN the session identifier in the redeemer is validated THEN the validator SHALL accept any valid ByteArray format

### Requirement 3

**User Story:** As a system, I want to generate and store NFT metadata on IPFS, so that the token has rich, decentralized metadata.

#### Acceptance Criteria

1. WHEN generating NFT metadata THEN the system SHALL include the session ID, skill, learner address, provider address, duration, budget, and completion timestamp
2. WHEN generating NFT metadata THEN the system SHALL create a JSON structure conforming to CIP-25 NFT metadata standards
3. WHEN uploading metadata THEN the system SHALL store the JSON on IPFS and obtain a CID
4. WHEN an image is available THEN the system SHALL upload it to IPFS and include the image CID in the metadata
5. WHEN metadata is stored THEN the system SHALL save the IPFS hash, image CID, and metadata JSON in the nft_metadata table

### Requirement 4

**User Story:** As a developer, I want to construct the NFT asset name deterministically, so that each session has a predictable and unique token identifier.

#### Acceptance Criteria

1. WHEN creating the asset name THEN the system SHALL use the format 'SkillForge-Session-{sessionId}'
2. WHEN converting the session ID to bytes THEN the system SHALL remove UUID dashes and convert the hex string to a byte array
3. WHEN the asset name is encoded THEN the system SHALL convert it to UTF-8 bytes for the transaction
4. WHEN the policy ID is calculated THEN the system SHALL derive it from the hash of the minting policy script
5. WHEN returning the minted asset details THEN the system SHALL include both the policy ID and asset name

### Requirement 5

**User Story:** As a backend service, I want to build unsigned NFT mint transactions, so that learners can sign them with their CIP-30 wallets.

#### Acceptance Criteria

1. WHEN building a mint transaction THEN the system SHALL load the compiled minting policy script from the contracts directory
2. WHEN constructing the redeemer THEN the system SHALL use Aiken's compilation format with the Mint constructor at index 0
3. WHEN adding the mint operation THEN the system SHALL specify the policy ID, asset name, and quantity of 1
4. WHEN creating the output THEN the system SHALL include the minted NFT in a multi-asset value with minimum UTXO amount
5. WHEN the transaction is built THEN the system SHALL return the unsigned transaction hex, policy ID, asset name, and IPFS metadata URLs

### Requirement 6

**User Story:** As a system administrator, I want to query NFT minting status, so that I can verify which sessions have commemorative tokens.

#### Acceptance Criteria

1. WHEN querying NFT status by session ID THEN the system SHALL return whether the NFT has been minted
2. WHEN the NFT is minted THEN the system SHALL return the IPFS hash, image CID, metadata JSON, and minted timestamp
3. WHEN the NFT has not been minted THEN the system SHALL return minted status as false with null values for IPFS fields
4. WHEN a session does not exist THEN the system SHALL return a 404 error with message 'Session not found'
5. WHEN the database query fails THEN the system SHALL return a 500 error with the failure message

### Requirement 7

**User Story:** As a learner, I want the NFT metadata to be immutable and verifiable, so that my achievement record cannot be altered.

#### Acceptance Criteria

1. WHEN metadata is uploaded to IPFS THEN the system SHALL use content-addressing to ensure immutability
2. WHEN the NFT is minted THEN the metadata CID SHALL be permanently associated with the token on-chain
3. WHEN retrieving metadata THEN the system SHALL construct IPFS gateway URLs using the stored CID
4. WHEN the image is included THEN the system SHALL reference it by CID in the metadata JSON
5. WHEN metadata is queried THEN the system SHALL return both the IPFS hash and the full metadata JSON

### Requirement 8

**User Story:** As a system, I want to prevent duplicate NFT minting for the same session, so that each session has exactly one commemorative token.

#### Acceptance Criteria

1. WHEN checking if an NFT can be minted THEN the system SHALL query the nft_metadata table for existing minted records
2. WHEN an NFT already exists for a session THEN the system SHALL return an error with message 'NFT already minted for this session'
3. WHEN the minting transaction is submitted THEN the system SHALL atomically update the minted flag to true
4. WHEN concurrent mint requests occur THEN the database constraints SHALL prevent duplicate minting
5. WHEN a mint fails THEN the system SHALL not update the minted status in the database

### Requirement 9

**User Story:** As a developer, I want the NFT system to integrate with the escrow system, so that NFTs can only be minted after successful payment settlement.

#### Acceptance Criteria

1. WHEN validating mint eligibility THEN the system SHALL verify the session status is 'completed' or 'paid'
2. WHEN the session is in 'initiated' or 'active' status THEN the system SHALL reject the mint request with message 'Session not yet completed'
3. WHEN the escrow has not been settled THEN the system SHALL allow minting only if the session status is 'completed'
4. WHEN both escrow settlement and session completion are verified THEN the system SHALL proceed with NFT minting
5. WHEN the NFT is successfully minted THEN the system SHALL not modify the session or escrow status
