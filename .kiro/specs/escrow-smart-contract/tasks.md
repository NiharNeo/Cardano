# Implementation Plan

- [ ] 1. Set up testing infrastructure and utilities
  - Install fast-check library for property-based testing
  - Create test utilities for generating valid Cardano addresses
  - Create test utilities for generating mock UTXOs
  - Create test utilities for generating session IDs and escrow datums
  - Set up test database with migrations
  - _Requirements: All (testing foundation)_

- [ ] 2. Implement datum and redeemer construction utilities
  - Create buildEscrowDatum function that constructs datum with all 7 fields
  - Create buildEscrowRedeemer function that constructs redeemers for all 4 types (AttestByLearner=0, AttestByMentor=1, ClaimFunds=2, Refund=3)
  - Implement Aiken format encoding with correct constructor indices
  - Implement Boolean to PlutusData conversion (false=0, true=1)
  - Implement session ID to ByteArray conversion (remove dashes, convert hex)
  - _Requirements: 1.2, 7.3_

- [ ]* 2.1 Write property test for datum construction
  - **Property 2: Datum contains all required fields**
  - **Validates: Requirements 1.2**

- [ ]* 2.2 Write property test for redeemer construction
  - **Property 11: Claim uses correct redeemer**
  - **Property 14: Refund uses correct redeemer**
  - **Validates: Requirements 3.3, 4.1**

- [ ] 3. Implement address parsing and public key hash extraction
  - Create addressFromBech32 function using Cardano.Address.from_bech32
  - Create pubKeyHashFromHex function to convert hex strings to Ed25519KeyHash
  - Implement payment credential extraction from addresses
  - Add error handling for invalid address formats
  - Add error handling for missing public key hashes
  - _Requirements: 8.1, 8.2, 8.3_

- [ ]* 3.1 Write property test for address parsing
  - **Property 25: Bech32 addresses parse correctly**
  - **Validates: Requirements 8.1**

- [ ]* 3.2 Write property test for credential extraction
  - **Property 26: Payment credentials extract correctly**
  - **Validates: Requirements 8.2**

- [ ] 4. Implement buildEscrowInitTx function
  - Load escrow Plutus script from contracts directory
  - Calculate script address from script hash
  - Extract receiver public key hash from fixed RECEIVER_ADDRESS constant
  - Build datum with learner, mentor, price, session, attestation flags (false), and receiver
  - Create transaction with learner UTXOs as inputs
  - Add output to script address with price amount and inline datum
  - Calculate fees and add change output to learner
  - Return txHex, scriptAddress, and datum
  - _Requirements: 1.1, 1.2, 1.3, 7.2_

- [ ]* 4.1 Write property test for escrow initialization
  - **Property 1: Escrow initialization creates valid script output**
  - **Property 3: Transaction builder returns complete response**
  - **Validates: Requirements 1.1, 1.3**

- [ ]* 4.2 Write property test for receiver hash inclusion
  - **Property 27: Receiver hash is included in datum**
  - **Validates: Requirements 8.3**

- [ ] 5. Implement buildEscrowAttestTx function
  - Parse scriptUTXO string (format: "txHash#index")
  - Build redeemer based on redeemerType (AttestByLearner or AttestByMentor)
  - Create transaction with script UTXO as input
  - Add signer UTXOs for fees
  - Create script witness with Plutus script and redeemer
  - Calculate fees and add change output
  - Return txHex
  - _Requirements: 2.1, 2.2, 2.4_

- [ ]* 5.1 Write property test for attestation transactions
  - **Property 5: Learner attestation updates datum correctly**
  - **Property 6: Mentor attestation updates datum correctly**
  - **Property 8: Attestation transactions include correct inputs**
  - **Validates: Requirements 2.1, 2.2, 2.4**

- [ ] 6. Implement buildEscrowClaimTx function
  - Parse scriptUTXO string
  - Build ClaimFunds redeemer (constructor index 2)
  - Create transaction with script UTXO as input
  - Add mentor UTXOs for fees
  - Add output to RECEIVER_ADDRESS with full escrow amount
  - Calculate fees and add change output to mentor
  - Return txHex and settledTo address
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 6.1 Write property test for claim transactions
  - **Property 9: Claim requires both attestations**
  - **Property 10: Claim sends full amount to receiver**
  - **Property 12: Claim validates receiver address**
  - **Validates: Requirements 3.1, 3.2, 3.4**

- [ ] 7. Implement buildEscrowRefundTx function
  - Reuse buildEscrowAttestTx with Refund redeemer type
  - Parse scriptUTXO and learner address
  - Build transaction that returns funds to learner
  - Return txHex
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 7.1 Write property test for refund transactions
  - **Property 15: Refund is always allowed**
  - **Validates: Requirements 4.2**

- [ ] 8. Implement POST /escrow/init endpoint
  - Validate required fields: learnerAddress, mentorAddress, price, sessionId
  - Validate price is greater than 0
  - Query database to verify session exists
  - Extract public key hashes from learner and mentor addresses
  - Fetch learner UTXOs (or create mock UTXOs if empty)
  - Call buildEscrowInitTx with parameters
  - Create escrow_state record with status 'pending'
  - Update session status to 'active'
  - Return txHex, scriptAddress, escrowId, and datum
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 8.1 Write property test for init endpoint database updates
  - **Property 4: Database state reflects initialization**
  - **Validates: Requirements 1.5**

- [ ] 9. Implement POST /escrow/attest-learner endpoint
  - Validate required fields: sessionId, scriptUTXO, learnerAddress
  - Fetch learner UTXOs
  - Call buildEscrowAttestTx with AttestByLearner redeemer
  - Return txHex
  - _Requirements: 2.1, 2.4_

- [ ] 10. Implement POST /escrow/attest-mentor endpoint
  - Validate required fields: sessionId, scriptUTXO, mentorAddress
  - Fetch mentor UTXOs
  - Call buildEscrowAttestTx with AttestByMentor redeemer
  - Return txHex
  - _Requirements: 2.2, 2.4_

- [ ] 11. Implement POST /escrow/claim endpoint
  - Validate required fields: sessionId, scriptUTXO, mentorAddress
  - Query database to verify session is active or completed
  - Fetch mentor UTXOs
  - Call buildEscrowClaimTx with parameters
  - Update session status to 'paid'
  - Update escrow_state status to 'settled'
  - Return txHex and settledTo address
  - _Requirements: 3.1, 3.2, 3.5_

- [ ]* 11.1 Write property test for claim endpoint database updates
  - **Property 13: Claim updates database status**
  - **Validates: Requirements 3.5**

- [ ] 12. Implement POST /escrow/refund endpoint
  - Validate required fields: sessionId, scriptUTXO, learnerAddress
  - Fetch learner UTXOs
  - Call buildEscrowRefundTx with parameters
  - Return txHex
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 13. Implement POST /escrow/status endpoint
  - Validate required field: sessionId
  - Query database for session and escrow_state
  - Return 404 if session not found
  - Map session status to escrow status response
  - Return status, txId, lockedAt, and completedAt
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 13.1 Write property test for status endpoint
  - **Property 16: Status query returns valid status**
  - **Property 17: Status response includes required fields**
  - **Validates: Requirements 5.1, 5.2**

- [ ] 14. Implement POST /escrow/update endpoint
  - Validate required fields: sessionId, txId
  - Update escrow_state with utxo and status 'locked'
  - Update session status to 'active'
  - Return success message
  - _Requirements: 2.5_

- [ ] 15. Update Aiken escrow validator with validation logic
  - Implement AttestByLearner validation: check !datum.learner_attested
  - Implement AttestByMentor validation: check !datum.mentor_attested
  - Implement ClaimFunds validation: check both attestations AND funds go to receiver
  - Implement Refund validation: always allow
  - Reject any other redeemer types
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 15.1 Write property tests for validator logic
  - **Property 7: Double attestation is rejected**
  - **Property 18: AttestByLearner validates learner flag**
  - **Property 19: AttestByMentor validates mentor flag**
  - **Property 20: ClaimFunds validates all conditions**
  - **Property 21: Invalid redeemers are rejected**
  - **Validates: Requirements 2.3, 6.1, 6.2, 6.3, 6.5**

- [ ] 16. Implement network configuration management
  - Read CARDANO_NETWORK environment variable
  - Set NETWORK to 0 for testnet, 1 for mainnet
  - Set NETWORK_MAGIC appropriately (1 for preprod, 42 for local, 764824073 for mainnet)
  - Use correct network ID in all transaction building
  - _Requirements: 7.1_

- [ ]* 16.1 Write property test for network configuration
  - **Property 22: Network configuration is correct**
  - **Property 23: Script is loaded successfully**
  - **Validates: Requirements 7.1, 7.2**

- [ ] 17. Add comprehensive error handling
  - Add try-catch blocks for script loading errors
  - Add validation for address parsing errors (return 400)
  - Add validation for public key hash extraction errors (return 400)
  - Add validation for missing session errors (return 404)
  - Add validation for database query errors (return 500)
  - Add validation for insufficient UTXO handling (create mocks)
  - Add validation for invalid price errors (return 400)
  - Add validation for missing required fields (return 400)
  - _Requirements: 1.4, 5.3, 5.4, 8.4, 8.5_

- [ ] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 19. Write integration tests for end-to-end flows
  - Test complete escrow flow: init → attest learner → attest mentor → claim
  - Test refund flow: init → refund
  - Test error scenarios: double attestation, claim without attestations, invalid addresses
  - Test database state transitions throughout flows
  - _Requirements: All_

- [ ]* 20. Write Aiken unit tests for validator
  - Test each redeemer type with valid and invalid datums
  - Test attestation flag validation
  - Test receiver address validation
  - Test refund always succeeds
  - Test invalid redeemer rejection
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 21. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
