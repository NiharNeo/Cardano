# Requirements Document

## Introduction

The Escrow Smart Contract System provides a trustless payment mechanism for SkillForge mentoring sessions on the Cardano blockchain. The system locks learner funds in a Plutus smart contract, requires attestation from both parties upon session completion, and automatically releases funds to a designated receiver address. The escrow mechanism ensures fair payment while protecting both learners and mentors through on-chain validation.

## Glossary

- **Escrow Contract**: A Plutus smart contract that holds locked funds until release conditions are met
- **Learner**: The user who pays for and receives mentoring services
- **Mentor**: The service provider who delivers mentoring sessions
- **Receiver**: The fixed wallet address that receives funds upon successful escrow settlement
- **Attestation**: An on-chain confirmation from a party that the session was completed satisfactorily
- **UTXO**: Unspent Transaction Output, the fundamental unit of value in Cardano
- **Datum**: On-chain data attached to a UTXO that stores the escrow state
- **Redeemer**: Input data provided when spending from a script address that determines the action
- **Script Address**: A Cardano address controlled by a Plutus smart contract
- **Lovelace**: The smallest unit of ADA (1 ADA = 1,000,000 Lovelace)
- **Transaction Builder**: Backend service that constructs unsigned Cardano transactions
- **CIP-30**: Cardano Improvement Proposal defining the wallet API standard

## Requirements

### Requirement 1

**User Story:** As a learner, I want to initialize an escrow with locked funds, so that I can ensure payment is held securely until the mentoring session is completed.

#### Acceptance Criteria

1. WHEN a learner initiates an escrow THEN the system SHALL create a transaction that locks the specified amount in Lovelace at the escrow script address
2. WHEN creating the escrow datum THEN the system SHALL include the learner public key hash, mentor public key hash, price in Lovelace, session identifier, attestation flags set to false, and receiver public key hash
3. WHEN the escrow transaction is built THEN the system SHALL return an unsigned transaction hex, the script address, and the datum structure
4. WHEN the learner has insufficient UTXOs THEN the system SHALL create mock UTXOs for transaction building and allow wallet-side signing with real UTXOs
5. WHEN the escrow is initialized THEN the system SHALL store the escrow state in the database with status 'pending' and update the session status to 'active'

### Requirement 2

**User Story:** As a learner or mentor, I want to attest that the session was completed, so that the escrow can track mutual agreement before releasing funds.

#### Acceptance Criteria

1. WHEN a learner attests THEN the system SHALL create a transaction with the AttestByLearner redeemer that updates the datum to set learner_attested to true
2. WHEN a mentor attests THEN the system SHALL create a transaction with the AttestByMentor redeemer that updates the datum to set mentor_attested to true
3. WHEN a party attempts to attest twice THEN the smart contract SHALL reject the transaction
4. WHEN building an attestation transaction THEN the system SHALL include the script UTXO as input and the attesting party's UTXOs for fees
5. WHEN an attestation transaction is submitted THEN the system SHALL update the escrow state in the database

### Requirement 3

**User Story:** As a mentor, I want to claim the escrowed funds after both parties attest, so that I receive payment for the completed session.

#### Acceptance Criteria

1. WHEN the mentor claims funds THEN the system SHALL verify both learner_attested and mentor_attested are true in the datum
2. WHEN the mentor claims funds THEN the system SHALL send 100% of the escrowed amount to the fixed receiver address specified in the datum
3. WHEN building the claim transaction THEN the system SHALL use the ClaimFunds redeemer with constructor index 2
4. WHEN the claim transaction is validated THEN the smart contract SHALL verify the output goes to an address with payment credential matching the receiver public key hash
5. WHEN funds are successfully claimed THEN the system SHALL update the session status to 'paid' and escrow status to 'settled'

### Requirement 4

**User Story:** As a learner, I want to refund the escrow if the session does not proceed, so that I can recover my locked funds.

#### Acceptance Criteria

1. WHEN a learner requests a refund THEN the system SHALL create a transaction with the Refund redeemer
2. WHEN the refund transaction is validated THEN the smart contract SHALL allow the funds to return to the learner
3. WHEN building the refund transaction THEN the system SHALL include the script UTXO and learner UTXOs for fees
4. WHEN a refund is processed THEN the system SHALL update the escrow state and session status accordingly

### Requirement 5

**User Story:** As a system administrator, I want to query escrow status, so that I can monitor the state of payment locks and settlements.

#### Acceptance Criteria

1. WHEN querying escrow status THEN the system SHALL return the current status from the set: 'pending', 'locked', 'in_session', 'completed', 'paid_out', 'settled'
2. WHEN the escrow status is queried THEN the system SHALL include the transaction ID, locked timestamp, and completion timestamp if available
3. WHEN a session does not exist THEN the system SHALL return a 404 error with message 'Session not found'
4. WHEN the database query fails THEN the system SHALL return a 500 error with the failure message

### Requirement 6

**User Story:** As a developer, I want the escrow contract to validate all state transitions on-chain, so that the system maintains trustless security guarantees.

#### Acceptance Criteria

1. WHEN the AttestByLearner redeemer is used THEN the validator SHALL verify learner_attested is false before allowing the transaction
2. WHEN the AttestByMentor redeemer is used THEN the validator SHALL verify mentor_attested is false before allowing the transaction
3. WHEN the ClaimFunds redeemer is used THEN the validator SHALL verify both attestation flags are true AND funds go to the receiver address
4. WHEN the Refund redeemer is used THEN the validator SHALL allow the transaction without additional checks
5. WHEN any other redeemer is provided THEN the validator SHALL reject the transaction

### Requirement 7

**User Story:** As a backend service, I want to build unsigned transactions for all escrow operations, so that users can sign them with their CIP-30 wallets.

#### Acceptance Criteria

1. WHEN building any escrow transaction THEN the system SHALL use the correct Cardano network configuration (testnet or mainnet)
2. WHEN building transactions THEN the system SHALL load the compiled Plutus script from the contracts directory
3. WHEN constructing datum or redeemer THEN the system SHALL use Aiken's compilation format with correct constructor indices
4. WHEN adding script inputs THEN the system SHALL include the Plutus script witness with the appropriate redeemer
5. WHEN calculating fees THEN the system SHALL use the protocol parameters and ensure sufficient collateral

### Requirement 8

**User Story:** As a system, I want to handle address format conversions correctly, so that public key hashes are extracted properly for datum construction.

#### Acceptance Criteria

1. WHEN receiving a bech32 address THEN the system SHALL parse it using the Cardano Serialization Library
2. WHEN extracting payment credentials THEN the system SHALL obtain the Ed25519KeyHash from the address payment credential
3. WHEN the receiver address is processed THEN the system SHALL extract the public key hash and include it in the datum
4. WHEN an address cannot be parsed THEN the system SHALL return a 400 error with message 'Invalid address format'
5. WHEN a public key hash cannot be extracted THEN the system SHALL return a 400 error with message 'Could not extract public key hashes from addresses'
